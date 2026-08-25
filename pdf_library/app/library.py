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
import shutil
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

# An mdi name as the frontend spells it, without the "mdi:" prefix.
ICON_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,39}$")

# Russian only, which is the alphabet this add-on has to deal with. Titles
# in any other script simply lose those characters and fall back to a
# generated id, which is still addressable.
TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}

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

# Manifest key recording that the bundled sample has been placed once.
SAMPLE_FLAG = "sample_installed"
SAMPLE_COLLECTION = "manuals"


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


def is_safe_name(name: str) -> bool:
    name = unicodedata.normalize("NFC", name or "")
    if not name or name in (".", ".."):
        return False
    return ".." not in name and not FORBIDDEN_IN_NAME.search(name)


def validate_name(name: str) -> str:
    """Validate a file name coming from a URL or an upload."""
    name = unicodedata.normalize("NFC", name or "")
    if not is_safe_name(name):
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

    def write_manifest(self, collections: list[dict], **extra) -> None:
        # Whatever else the manifest carries is preserved: a key this
        # version does not know about belongs to one that does.
        payload = self.read_manifest()
        payload["version"] = MANIFEST_VERSION
        payload["collections"] = collections
        payload.update(extra)
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

    def install_sample(self, sample: Path) -> str:
        """Drop the bundled quick-start document in, once and only once.

        A brand new library with nothing in it teaches nobody anything. The
        flag lives in the manifest rather than being a file check, so that
        deleting the document does not bring it back.
        """
        manifest = self.read_manifest()
        if manifest.get(SAMPLE_FLAG) or not sample.is_file():
            return ""
        collections = manifest["collections"]
        target_id = None
        for entry in collections:
            if isinstance(entry, dict) and entry.get("id") == SAMPLE_COLLECTION:
                target_id = SAMPLE_COLLECTION
                break
        if target_id is None:
            available = sorted(self._dirs_on_disk())
            target_id = available[0] if available else None
        if target_id is None:
            return ""

        self.make_collection_dirs(target_id)
        target = self.doc_path(target_id, sample.name)
        if not target.exists():
            shutil.copyfile(sample, target)
        self.write_manifest(collections, **{SAMPLE_FLAG: True})
        _LOGGER.info("Installed the sample document into %s", target_id)
        return target_id

    def coverless(self) -> list:
        """Every document with no cover, as (cid, file name) pairs."""
        missing = []
        for collection in self.collections():
            cid = collection["id"]
            for item in self.items(cid):
                if not item["cover"]:
                    missing.append((cid, item["file"]))
        return missing

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
            # A name the server would refuse to serve has no business being
            # on a tile that cannot be opened.
            and is_safe_name(entry.name)
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

    # -- writing --------------------------------------------------------

    def taken_ids(self) -> set:
        ids = self._dirs_on_disk()
        for entry in self.read_manifest()["collections"]:
            if isinstance(entry, dict) and entry.get("id"):
                ids.add(entry["id"])
        return ids

    def unique_cid(self, title: str) -> str:
        base = slugify(title)
        taken = self.taken_ids()
        if base not in taken:
            return base
        for suffix in range(2, 1000):
            candidate = f"{base[: 40 - len(str(suffix)) - 1]}-{suffix}"
            if candidate not in taken:
                return candidate
        raise LibraryError("collection_exists", title, 409)

    def create_collection(self, title: str, icon: str) -> dict:
        title = (title or "").strip()
        if not title:
            raise LibraryError("title_required", "", 400)
        cid = self.unique_cid(title)
        self.make_collection_dirs(cid)
        collections = self.read_manifest()["collections"]
        entry = {"id": cid, "title": title, "icon": validate_icon(icon)}
        collections.append(entry)
        self.write_manifest(collections)
        return entry

    def update_collection(self, cid: str, title=None, icon=None) -> dict:
        validate_cid(cid)
        if not self.exists(cid):
            raise LibraryError("collection_not_found", cid, 404)
        collections = self.read_manifest()["collections"]
        entry = next(
            (c for c in collections if isinstance(c, dict) and c.get("id") == cid), None
        )
        if entry is None:
            # Picked up from disk and never named; give it a manifest row now.
            entry = {"id": cid, "title": cid, "icon": FALLBACK_ICON}
            collections.append(entry)
        if title is not None:
            title = title.strip()
            if not title:
                raise LibraryError("title_required", cid, 400)
            entry["title"] = title
        if icon is not None:
            entry["icon"] = validate_icon(icon)
        self.write_manifest(collections)
        return entry

    def delete_collection(self, cid: str, force: bool = False) -> None:
        validate_cid(cid)
        base = self.collection_dir(cid)
        if not base.is_dir():
            raise LibraryError("collection_not_found", cid, 404)
        if not force and self.count(cid):
            raise LibraryError("collection_not_empty", cid, 409)
        shutil.rmtree(base)
        collections = [
            c
            for c in self.read_manifest()["collections"]
            if not (isinstance(c, dict) and c.get("id") == cid)
        ]
        self.write_manifest(collections)

    def delete_item(self, cid: str, file_name: str) -> None:
        """Remove the document and whatever cover was standing in for it."""
        path = self.doc_path(cid, file_name)
        if not path.is_file():
            raise LibraryError("not_found", file_name, 404)
        path.unlink()
        self.drop_covers(cid, path.name[: -len(DOC_EXTENSION)])

    def rename_item(self, cid: str, file_name: str, new_title: str) -> str:
        """Rename a document, and its cover along with it.

        The title is the file name without the extension, so renaming is the
        only way to retitle a document. The cover follows because it is
        matched by stem: leaving it behind would silently orphan it.
        """
        source = self.doc_path(cid, file_name)
        if not source.is_file():
            raise LibraryError("not_found", file_name, 404)

        new_title = unicodedata.normalize("NFC", (new_title or "").strip())
        # Typing the extension is a natural thing to do; do not end up with
        # "Rules.pdf.pdf" because of it.
        if new_title.lower().endswith(DOC_EXTENSION):
            new_title = new_title[: -len(DOC_EXTENSION)].strip()
        if not new_title:
            raise LibraryError("title_required", file_name, 400)

        target = self.doc_path(cid, new_title + DOC_EXTENSION)
        if target == source:
            return source.name
        if target.exists():
            raise LibraryError("file_exists", target.name, 409)

        old_stem = source.name[: -len(DOC_EXTENSION)]
        cover = self._cover_index(cid).get(old_stem.casefold())
        # The document moves first: if the cover rename then fails, the
        # library is merely missing a cover, not missing a document.
        source.rename(target)
        if cover:
            extension = os.path.splitext(cover)[1]
            self.cover_path(cid, cover).rename(
                self.cover_path(cid, new_title + extension)
            )
        return target.name

    def drop_covers(self, cid: str, stem: str) -> None:
        existing = self._cover_index(cid).get(stem.casefold())
        if existing:
            self.cover_path(cid, existing).unlink(missing_ok=True)

    def temp_path(self, target: Path) -> Path:
        """A sibling of the target, so the final os.replace stays on one device."""
        return target.with_name(f".{target.name}.part")


def validate_icon(icon: str) -> str:
    icon = (icon or "").strip() or FALLBACK_ICON
    if not ICON_RE.match(icon):
        raise LibraryError("bad_icon", icon, 400)
    return icon


def slugify(title: str) -> str:
    """Fold a human title down to something usable as a folder and a URL."""
    text = unicodedata.normalize("NFKD", (title or "").strip().lower())
    out = []
    for char in text:
        if char in TRANSLIT:
            out.append(TRANSLIT[char])
        elif char.isascii() and char.isalnum():
            out.append(char)
        elif char in " -_./":
            out.append("-")
        # Anything else, combining accents included, is dropped.
    slug = re.sub(r"-+", "-", "".join(out)).strip("-")[:40].strip("-")
    if not slug:
        return "collection"
    if not slug[0].isalnum():
        slug = slug.lstrip("-_")[:40] or "collection"
    return slug


def sniff_pdf(head: bytes) -> bool:
    return head.startswith(b"%PDF-")


def sniff_image(head: bytes):
    """Return the canonical extension for a cover, or None if unrecognised.

    The extension is taken from the bytes, never from the uploaded name, so
    a PNG cannot end up stored as .jpg and served with the wrong type.
    """
    if head.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return ".webp"
    if head[4:8] == b"ftyp" and (b"avif" in head[8:32] or b"avis" in head[8:32]):
        return ".avif"
    return None
