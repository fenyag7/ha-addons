"""HTTP server for the PDF Library add-on.

Runs behind Home Assistant ingress, which strips its own path prefix before
forwarding the request. The server therefore never sees or emits absolute
URLs; everything the frontend requests is relative to the document base.

Ingress has already authenticated the user, so there is no auth here. What
is here is path validation: ingress vouches for the caller, not for the
shape of the file names they send.
"""

import logging
import mimetypes
import os
from pathlib import Path

from aiohttp import web

from library import (
    COVERS_DIR,
    DOC_EXTENSION,
    Library,
    LibraryError,
    sniff_image,
    sniff_pdf,
    validate_name,
)

PORT = 8099
BIND = "0.0.0.0"

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
# Unpacked into the image by the Dockerfile; overridden when running
# the server straight from a checkout.
PDFJS_ROOT = Path(os.environ.get("PDFJS_ROOT", "/opt/pdfjs"))

# Home Assistant log levels mapped onto the stdlib ones. "trace" has no
# stdlib equivalent; it is the same as debug for our purposes.
LOG_LEVELS = {
    "trace": logging.DEBUG,
    "debug": logging.DEBUG,
    "info": logging.INFO,
    "warning": logging.WARNING,
    "error": logging.ERROR,
}

_LOGGER = logging.getLogger("pdf_library")

# The bundled pdf.js viewer is shipped as ES modules. A browser refuses a
# module served as application/octet-stream, and the Python that ends up in
# the image is not guaranteed to know this extension.
mimetypes.add_type("text/javascript", ".mjs")

LIBRARY_KEY = web.AppKey("library", Library)
MAX_UPLOAD_KEY = web.AppKey("max_upload_bytes", int)

# Room on top of the per-file limit for the cover, the part headers and the
# multipart boundaries. The real limit is enforced per part, with a message.
MULTIPART_SLACK = 8 * 1024 * 1024
CHUNK = 64 * 1024


@web.middleware
async def error_middleware(request: web.Request, handler):
    """Turn a LibraryError into the JSON shape the frontend translates."""
    try:
        return await handler(request)
    except LibraryError as err:
        _LOGGER.debug("%s %s -> %s (%s)", request.method, request.path, err.code, err.detail)
        return web.json_response(
            {"error": err.code, "detail": err.detail}, status=err.status
        )


async def api_library(request: web.Request) -> web.Response:
    library = request.app[LIBRARY_KEY]
    return web.json_response(
        {
            "language": library.language,
            "max_upload_bytes": request.app[MAX_UPLOAD_KEY],
            "collections": library.collections(),
        }
    )


async def read_json(request: web.Request) -> dict:
    try:
        body = await request.json()
    except ValueError:
        raise LibraryError("bad_request", "", 400)
    if not isinstance(body, dict):
        raise LibraryError("bad_request", "", 400)
    return body


async def api_create_collection(request: web.Request) -> web.Response:
    library = request.app[LIBRARY_KEY]
    body = await read_json(request)
    entry = library.create_collection(body.get("title", ""), body.get("icon", ""))
    return web.json_response({**entry, "count": 0}, status=201)


async def api_update_collection(request: web.Request) -> web.Response:
    library = request.app[LIBRARY_KEY]
    cid = request.match_info["cid"]
    body = await read_json(request)
    entry = library.update_collection(cid, body.get("title"), body.get("icon"))
    return web.json_response({**entry, "count": library.count(cid)})


async def api_delete_collection(request: web.Request) -> web.Response:
    library = request.app[LIBRARY_KEY]
    cid = request.match_info["cid"]
    library.delete_collection(cid, force=request.query.get("force") == "1")
    return web.json_response({"deleted": cid})


async def receive_part(part, tmp: Path, limit: int) -> bytes:
    """Stream one multipart part to a temporary file next to its target.

    Returns the first bytes, which is what the type check runs on. The
    caller owns the temporary file, including removing it.
    """
    head = b""
    total = 0
    with tmp.open("wb") as handle:
        while True:
            chunk = await part.read_chunk(CHUNK)
            if not chunk:
                break
            total += len(chunk)
            if total > limit:
                raise LibraryError("upload_too_large", part.filename or "", 413)
            if len(head) < 64:
                head = (head + chunk)[:64]
            handle.write(chunk)
    return head


async def store_cover(library: Library, cid: str, stem: str, part, limit: int) -> str:
    """Write a cover for `stem`, naming it after what the bytes actually are."""
    covers = library.collection_dir(cid) / COVERS_DIR
    covers.mkdir(parents=True, exist_ok=True)
    tmp = covers / f".{stem}.part"
    try:
        head = await receive_part(part, tmp, limit)
        extension = sniff_image(head)
        if extension is None:
            raise LibraryError("not_an_image", part.filename or "", 415)
        # One cover per document: drop whatever was there under any extension.
        library.drop_covers(cid, stem)
        target = library.cover_path(cid, stem + extension)
        os.replace(tmp, target)
        return target.name
    finally:
        tmp.unlink(missing_ok=True)


async def api_upload(request: web.Request) -> web.Response:
    library = request.app[LIBRARY_KEY]
    limit = request.app[MAX_UPLOAD_KEY]
    cid = request.match_info["cid"]
    if not library.exists(cid):
        raise LibraryError("collection_not_found", cid, 404)
    overwrite = request.query.get("overwrite") == "1"

    reader = await request.multipart()
    stem = None
    stored = None
    while True:
        part = await reader.next()
        if part is None:
            break
        if part.name == "file":
            name = validate_name(part.filename or "")
            if not name.lower().endswith(DOC_EXTENSION):
                name += DOC_EXTENSION
            target = library.doc_path(cid, name)
            # Checked before a single byte is read, so a duplicate fails fast.
            if target.exists() and not overwrite:
                raise LibraryError("file_exists", name, 409)
            tmp = library.temp_path(target)
            try:
                head = await receive_part(part, tmp, limit)
                if not sniff_pdf(head):
                    raise LibraryError("not_a_pdf", name, 415)
                # Rename only once the whole file is on disk and verified, so
                # an interrupted upload cannot leave a broken PDF behind.
                os.replace(tmp, target)
            finally:
                tmp.unlink(missing_ok=True)
            stem = name[: -len(DOC_EXTENSION)]
            stored = {"name": stem, "file": name, "cover": None}
        elif part.name == "cover":
            if stem is None:
                raise LibraryError("cover_without_file", "", 400)
            stored["cover"] = await store_cover(library, cid, stem, part, limit)

    if stored is None:
        raise LibraryError("file_required", "", 400)
    _LOGGER.info("Stored %s/%s", cid, stored["file"])
    return web.json_response(stored, status=201)


async def api_upload_cover(request: web.Request) -> web.Response:
    library = request.app[LIBRARY_KEY]
    limit = request.app[MAX_UPLOAD_KEY]
    cid = request.match_info["cid"]
    file_name = request.match_info["name"]
    if not library.doc_path(cid, file_name).is_file():
        raise LibraryError("not_found", file_name, 404)
    stem = validate_name(file_name)[: -len(DOC_EXTENSION)]

    reader = await request.multipart()
    while True:
        part = await reader.next()
        if part is None:
            break
        if part.name == "cover":
            return web.json_response(
                {"cover": await store_cover(library, cid, stem, part, limit)}
            )
    raise LibraryError("file_required", "", 400)


async def api_delete_item(request: web.Request) -> web.Response:
    library = request.app[LIBRARY_KEY]
    cid = request.match_info["cid"]
    name = request.match_info["name"]
    library.delete_item(cid, name)
    _LOGGER.info("Deleted %s/%s", cid, name)
    return web.json_response({"deleted": name})


async def api_items(request: web.Request) -> web.Response:
    library = request.app[LIBRARY_KEY]
    cid = request.match_info["cid"]
    if not library.exists(cid):
        raise LibraryError("collection_not_found", cid, 404)
    return web.json_response({"id": cid, "items": library.items(cid)})


def _file_response(path: Path, content_type: str = None) -> web.FileResponse:
    if not path.is_file():
        raise LibraryError("not_found", path.name, 404)
    headers = {
        # No filename parameter: it buys nothing here and drags in the
        # RFC 5987 encoding dance for every non-ASCII title.
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return web.FileResponse(path, headers=headers)


async def serve_doc(request: web.Request) -> web.FileResponse:
    library = request.app[LIBRARY_KEY]
    path = library.doc_path(request.match_info["cid"], request.match_info["name"])
    return _file_response(path, "application/pdf")


async def serve_cover(request: web.Request) -> web.FileResponse:
    library = request.app[LIBRARY_KEY]
    path = library.cover_path(request.match_info["cid"], request.match_info["name"])
    return _file_response(path)


async def index(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC_DIR / "index.html")


def build_app(library: Library, max_upload_bytes: int) -> web.Application:
    app = web.Application(
        middlewares=[error_middleware],
        client_max_size=max_upload_bytes + MULTIPART_SLACK,
    )
    app[LIBRARY_KEY] = library
    app[MAX_UPLOAD_KEY] = max_upload_bytes

    app.router.add_get("/api/library", api_library)
    app.router.add_post("/api/collections", api_create_collection)
    app.router.add_patch("/api/collections/{cid}", api_update_collection)
    app.router.add_delete("/api/collections/{cid}", api_delete_collection)
    app.router.add_get("/api/collections/{cid}/items", api_items)
    app.router.add_post("/api/collections/{cid}/items", api_upload)
    app.router.add_delete("/api/collections/{cid}/items/{name}", api_delete_item)
    app.router.add_put("/api/collections/{cid}/items/{name}/cover", api_upload_cover)
    app.router.add_get("/docs/{cid}/{name}", serve_doc)
    app.router.add_get("/covers/{cid}/{name}", serve_cover)
    app.router.add_get("/", index)
    if PDFJS_ROOT.is_dir():
        app.router.add_static("/pdfjs/", PDFJS_ROOT)
    else:
        _LOGGER.error("pdf.js is missing from %s; the viewer will not open", PDFJS_ROOT)
    # Registered last so it never shadows a route above.
    app.router.add_static("/", STATIC_DIR)
    return app


def setup_logging() -> None:
    level = LOG_LEVELS.get(os.environ.get("LOG_LEVEL", "info").lower(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def main() -> None:
    setup_logging()

    library = Library(
        root=Path(os.environ.get("LIBRARY_ROOT", "/share/pdf_library")),
        language=os.environ.get("UI_LANGUAGE", "auto"),
    )
    library.ensure_layout()
    _LOGGER.info("Serving %s", library.root)

    try:
        max_upload_mb = int(os.environ.get("MAX_UPLOAD_MB", "100"))
    except ValueError:
        max_upload_mb = 100
    app = build_app(library, max_upload_mb * 1024 * 1024)

    # Local development aid: serve the app under a nested path so that any
    # absolute URL in the frontend breaks here rather than on a real ingress.
    prefix = os.environ.get("INGRESS_PREFIX_SIMULATION", "").strip().rstrip("/")
    if prefix:
        if not prefix.startswith("/"):
            prefix = "/" + prefix
        root = web.Application()
        root.add_subapp(prefix, app)
        app = root
        _LOGGER.info("Ingress simulation active: http://%s:%s%s/", BIND, PORT, prefix)

    web.run_app(app, host=BIND, port=PORT, print=None, access_log=None)


if __name__ == "__main__":
    main()
