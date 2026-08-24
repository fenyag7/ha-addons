"""Library storage.

The file system is the source of truth: a folder dropped into the library
root is a collection, a PDF copied into its ``docs/`` folder is a document.
``library.json`` only carries the things a folder name cannot express --
human titles, icons and the order of the tabs.

Nothing is cached. A collection holds a few dozen files, so a fresh
``os.scandir`` per request is cheaper than any invalidation scheme.
"""

import json
import logging
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

_LOGGER = logging.getLogger("pdf_library.library")

MANIFEST_NAME = "library.json"
MANIFEST_VERSION = 1
DOCS_DIR = "docs"
COVERS_DIR = "covers"

COVER_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".avif")
DOC_EXTENSION = ".pdf"

# A collection id is also a folder name and a URL segment, so it stays in
# the intersection of what is safe for both.
CID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,39}$")

# Anything that could climb out of a folder, plus the control range.
FORBIDDEN_IN_NAME = re.compile(r"[/\\\x00-\x1f\x7f]")

DEFAULT_COLLECTIONS = {
    "en": [
        {"id": "boardgames", "title": "Board games", "icon": "dice-multiple"},
        {"id": "manuals", "title": "Manuals", "icon": "tools"},
    ],
    "ru": [
        {"id": "boardgames", "title": "Настолки", "icon": "dice-multiple"},
        {"id": "manuals", "title": "Мануалы", "icon": "tools"},
    ],
}

FALLBACK_ICON = "folder-outline"


class LibraryError(Exception):
    """Raised with a machine-readable code the frontend can translate."""

    def __init__(self, code: str, detail: str = "", status: int = 400) -> None:
        super().__init__(code)
        self.code = code
        self.detail = detail
        self.status = status


def validate_cid(cid: str) -> str:
    if not CID_RE.match(cid or ""):
        raise LibraryError("bad_collection_id", cid, 400)
    return cid


def validate_name(name: str) -> str:
    """Validate a file name coming from a URL or an upload."""
    name = unicodedata.normalize("NFC", name or "")
    if not name or name in (".", ".."):
        raise LibraryError("bad_file_name", name, 400)
    if ".." in name or FORBIDDEN_IN_NAME.search(name):
        raise LibraryError("bad_file_name", name, 400)
    return name


def sort_key(text: str) -> str:
    """Case-insensitive, and yo sorts with ye the way a reader expects."""
    return text.casefold().replace("ё", "е")


def _iso(timestamp: float) -> str:
    return (
        datetime.fromtimestamp(timestamp, timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def _visible(entry: os.DirEntry) -> bool:
    """Skip dotfiles and the debris a Samba import tends to carry along."""
    return not entry.name.startswith(".")


class Library:
    def __init__(self, root: Path, language: str = "auto") -> None:
        self.root = Path(root)
        self.language = language

    # -- paths ----------------------------------------------------------

    def _resolve(self, *parts: str) -> Path:
        """Join under the root, then prove the result stayed under it.

        The regex checks above already reject the obvious tricks; this is
        the second lock, against symlinks and anything they miss.
        """
        root = self.root.resolve()
        candidate = root.joinpath(*parts).resolve()
        if candidate != root and not candidate.is_relative_to(root):
            raise LibraryError("bad_path", "/".join(parts), 400)
        return candidate

    def collection_dir(self, cid: str) -> Path:
        return self._resolve(validate_cid(cid))

    def doc_path(self, cid: str, file_name: str) -> Path:
        return self._resolve(validate_cid(cid), DOCS_DIR, validate_name(file_name))

    def cover_path(self, cid: str, file_name: str) -> Path:
        return self._resolve(validate_cid(cid), COVERS_DIR, validate_name(file_name))

    # -- manifest -------------------------------------------------------

    @property
    def manifest_path(self) -> Path:
        return self.root / MANIFEST_NAME

    def _default_collections(self) -> list[dict]:
        # English whenever there is any doubt, including "auto".
        key = "ru" if self.language == "ru" else "en"
        return [dict(item) for item in DEFAULT_COLLECTIONS[key]]

    def read_manifest(self) -> dict:
        empty = {"version": MANIFEST_VERSION, "collections": []}
        try:
            data = json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return empty
        except (OSError, ValueError) as err:
            # A hand-edited manifest must not take the whole library down.
            _LOGGER.warning("Ignoring unreadable %s: %s", MANIFEST_NAME, err)
            return empty
        if not isinstance(data, dict) or not isinstance(data.get("collections"), list):
            _LOGGER.warning("Ignoring malformed %s", MANIFEST_NAME)
            return empty
        return data

    def write_manifest(self, collections: list[dict]) -> None:
        payload = {"version": MANIFEST_VERSION, "collections": collections}
        tmp = self.manifest_path.with_name(MANIFEST_NAME + ".tmp")
        tmp.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        os.replace(tmp, self.manifest_path)

    # -- bootstrap ------------------------------------------------------

    def ensure_layout(self) -> None:
        """Create the root and, on a first run, the default collections."""
        self.root.mkdir(parents=True, exist_ok=True)
        if self.manifest_path.exists():
            return
        collections = self._default_collections()
        for collection in collections:
            self.make_collection_dirs(collection["id"])
        self.write_manifest(collections)
        _LOGGER.info(
            "Created %s with default collections: %s",
            MANIFEST_NAME,
            ", ".join(c["id"] for c in collections),
        )

    def make_collection_dirs(self, cid: str) -> None:
        base = self.collection_dir(cid)
        (base / DOCS_DIR).mkdir(parents=True, exist_ok=True)
        (base / COVERS_DIR).mkdir(parents=True, exist_ok=True)

    # -- reading --------------------------------------------------------

    def _dirs_on_disk(self) -> set:
        found = set()
        try:
            entries = list(os.scandir(self.root))
        except FileNotFoundError:
            return found
        for entry in entries:
            if not entry.is_dir() or not _visible(entry):
                continue
            if not CID_RE.match(entry.name):
                _LOGGER.warning(
                    "Skipping folder %r: not a usable collection id", entry.name
                )
                continue
            found.add(entry.name)
        return found

    def collections(self) -> list[dict]:
        """Manifest order first, then whatever else is on disk.

        A manifest entry whose folder is gone is dropped: the disk wins.
        """
        on_disk = self._dirs_on_disk()
        result = []
        seen = set()
        for entry in self.read_manifest()["collections"]:
            if not isinstance(entry, dict):
                continue
            cid = entry.get("id", "")
            if cid not in on_disk or cid in seen:
                continue
            seen.add(cid)
            result.append(
                {
                    "id": cid,
                    "title": entry.get("title") or cid,
                    "icon": entry.get("icon") or FALLBACK_ICON,
                    "count": self.count(cid),
                }
            )
        for cid in sorted(on_disk - seen):
            result.append(
                {
                    "id": cid,
                    "title": cid,
                    "icon": FALLBACK_ICON,
                    "count": self.count(cid),
                }
            )
        return result

    def _scan_docs(self, cid: str) -> list:
        docs = self.collection_dir(cid) / DOCS_DIR
        try:
            entries = list(os.scandir(docs))
        except (FileNotFoundError, NotADirectoryError):
            return []
        return [
            entry
            for entry in entries
            if _visible(entry)
            and entry.name.lower().endswith(DOC_EXTENSION)
            and entry.is_file()
        ]

    def count(self, cid: str) -> int:
        return len(self._scan_docs(cid))

    def _cover_index(self, cid: str) -> dict:
        """Map a case-folded document stem to the cover file that matches it."""
        covers = self.collection_dir(cid) / COVERS_DIR
        try:
            entries = list(os.scandir(covers))
        except (FileNotFoundError, NotADirectoryError):
            return {}
        index = {}
        for entry in entries:
            if not _visible(entry) or not entry.is_file():
                continue
            stem, extension = os.path.splitext(entry.name)
            if extension.lower() not in COVER_EXTENSIONS:
                continue
            index.setdefault(stem.casefold(), entry.name)
        return index

    def items(self, cid: str) -> list[dict]:
        validate_cid(cid)
        covers = self._cover_index(cid)
        items = []
        for entry in self._scan_docs(cid):
            stem = entry.name[: -len(DOC_EXTENSION)]
            stat = entry.stat()
            items.append(
                {
                    "name": stem,
                    "file": entry.name,
                    "cover": covers.get(stem.casefold()),
                    "size_bytes": stat.st_size,
                    "modified": _iso(stat.st_mtime),
                }
            )
        items.sort(key=lambda item: sort_key(item["name"]))
        return items

    def exists(self, cid: str) -> bool:
        return self.collection_dir(cid).is_dir()
