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

from library import Library, LibraryError

PORT = 8099
BIND = "0.0.0.0"

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"

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
        {"language": library.language, "collections": library.collections()}
    )


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


def build_app(library: Library) -> web.Application:
    app = web.Application(middlewares=[error_middleware])
    app[LIBRARY_KEY] = library

    app.router.add_get("/api/library", api_library)
    app.router.add_get("/api/collections/{cid}/items", api_items)
    app.router.add_get("/docs/{cid}/{name}", serve_doc)
    app.router.add_get("/covers/{cid}/{name}", serve_cover)
    app.router.add_get("/", index)
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

    app = build_app(library)

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
