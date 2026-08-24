# Changelog

## 0.6.0

- Search covers the whole library, and results say which collection a
  document is in.
- The viewer reopens a document on the page it was left on.
- Documents and collections can be deleted, and collections created,
  renamed and given an icon.
- Documents are uploaded from the phone's own file picker, several at a
  time, with progress. Covers are set from the document menu.
- Uploads are checked by their first bytes rather than their extension,
  written to a temporary file first, and only then moved into place.

## 0.3.0

- Bundled pdf.js viewer, opening as an overlay over the library.

## 0.2.0

- Collections and documents are read straight from the file system.
- Tabs, tile grid, generated covers for documents without one.
- Russian and English interface, following the `language` option.

## 0.1.0

- Initial skeleton: ingress panel, static frontend shell.
