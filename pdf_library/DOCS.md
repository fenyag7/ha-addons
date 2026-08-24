# PDF Library

Documents live in `/share/pdf_library`, split into collections. The add-on
opens from the Home Assistant sidebar; no separate port is exposed, and the
Home Assistant session is the only login involved.

## Options

| Option | Default | Meaning |
|---|---|---|
| `library_root` | `/share/pdf_library` | Where documents are stored. |
| `max_upload_mb` | `100` | Uploads larger than this are rejected. |
| `language` | `auto` | `auto`, `en` or `ru`. `auto` follows the browser. |
| `log_level` | `info` | `trace`, `debug`, `info`, `warning`, `error`. |

## Folder layout

```
/share/pdf_library/
├── library.json          # collection titles, icons and tab order
├── boardgames/
│   ├── docs/             # the PDF files
│   └── covers/           # optional cover images, same name as the PDF
└── manuals/
    ├── docs/
    └── covers/
```

The file system is the source of truth. A folder dropped into
`/share/pdf_library` becomes a collection, and a PDF copied into a `docs/`
folder shows up without a restart. `library.json` only holds what a folder
name cannot say: the human title, the icon and the order of the tabs.

A document's title is its file name without `.pdf`. To rename a document,
rename the file.

Folder names have to work as URLs, so a collection folder must be lower-case
letters, digits, `-` and `_`. A folder named `Настолки 2` is skipped, with a
line in the log saying so. Collections created in the interface get a
transliterated name automatically: `Настолки` becomes `nastolki`.

## Using it

- **Open** a document by tapping its cover. The page you stopped on is
  remembered and restored the next time you open the same document.
- **Add** documents with the button next to the search field. Several files
  at once are uploaded one after another, with progress for the current one.
  A name that is already taken asks before replacing.
- **Long-press a cover** for the document menu: set a cover image, or delete
  the document. Deleting a document deletes its cover too.
- **Long-press a tab** to rename a collection, change its icon or delete it.
  A collection with documents in it asks twice.
- **Search** looks at document titles across the whole library, not just the
  open collection, and results say which collection each document is in. It
  ignores case, and treats `ё` and `е` as the same letter.

Search does not look inside the documents. There is no text extraction and
no OCR.

## Covers

A cover is an image in the collection's `covers/` folder with the same name
as the document: `docs/Wingspan.pdf` is covered by `covers/Wingspan.jpg`.
JPEG, PNG, WebP and AVIF work, and the extension's case does not matter.

Covers uploaded through the interface are named after what the file actually
contains rather than what it was called, so a PNG cannot end up stored as
`.jpg`.

Documents without a cover get a generated one: the title set in a serif face
over a colour derived from the title itself, so the same document always
looks the same.

## Bulk import over Samba

`/share` is exposed by the Samba add-on, so a large import is a folder drag
in Finder or Explorer rather than dozens of uploads from a phone. Copy the
PDFs into `pdf_library/<collection>/docs/` and refresh the page.

## Troubleshooting

Set `log_level` to `debug` and read the add-on log.

**A folder is not showing up.** Its name is probably not usable as a URL
segment; the log says which folder was skipped and why. Rename it to
lower-case latin letters, digits, `-` or `_`.

**A document is not showing up.** Only files ending in `.pdf` inside a
`docs/` folder are listed, and names starting with a dot are ignored.

**An upload is rejected.** The add-on checks the first bytes of the file
rather than its extension, so something renamed to `.pdf` that is not a PDF
is refused. Files over `max_upload_mb` are refused as well.

**The viewer stays blank.** Check the log for a line about pdf.js missing
from `/opt/pdfjs`, which means the image was built without it. Rebuilding
the add-on fixes it.
