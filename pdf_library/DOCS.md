# PDF Library

Documents live in `/share/pdf_library`, split into collections. The add-on opens
from the Home Assistant sidebar; no separate port is exposed.

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
├── library.json          # collection titles, icons and order
├── boardgames/
│   ├── docs/             # the PDF files
│   └── covers/           # optional cover images, same stem as the PDF
└── manuals/
    ├── docs/
    └── covers/
```

The file system is the source of truth. A folder dropped into `/share/pdf_library`
becomes a collection; a PDF copied into a `docs/` folder shows up without a restart.

## Bulk import over Samba

`/share` is exposed by the Samba add-on, so a large import is a folder drag in
Finder or Explorer rather than dozens of uploads from a phone. Copy the PDFs into
`pdf_library/<collection>/docs/` and refresh the page.

## Troubleshooting

Set `log_level` to `debug` and check the add-on log.
