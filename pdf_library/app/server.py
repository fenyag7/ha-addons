"""HTTP server for the PDF Library add-on.

Runs behind Home Assistant ingress, which strips its own path prefix before
forwarding the request. The server therefore never sees or emits absolute
URLs; everything the frontend requests is relative to the document base.
"""

import logging
import mimetypes
import os
from pathlib import Path

from aiohttp import web

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


async def ping(request: web.Request) -> web.Response:
    """Liveness probe used by the frontend to verify the ingress path."""
    return web.json_response({"pong": True})


async def index(request: web.Request) -> web.FileResponse:
    return web.FileResponse(STATIC_DIR / "index.html")


def build_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/api/ping", ping)
    app.router.add_get("/", index)
    # Registered last so it never shadows an API route.
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

    app = build_app()

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
