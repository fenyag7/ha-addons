# Changelog

## 0.7.0

- Documents can be renamed from the document menu. The cover is renamed
  with them, so it does not get orphaned.
- Fixed the upload bar being on screen permanently, and the "delete
  collection" button showing while creating a new one: an author display
  rule beats the browser's own `[hidden]` rule, so the hidden attribute
  the scripts set was doing nothing.
- The bundled pdf.js is now the build Mozilla ships for current browsers
  rather than the transpiled one meant for old ones.

## 0.6.2

- Every response now carries `Cache-Control: no-cache`. Without it the iOS
  webview was allowed to keep serving the previous version's `app.js` from
  its cache after an update, so the 0.6.1 viewer fix never reached the
  screen. Revalidation is a 304, so nothing gets slower.
- The add-on logs its version at startup, and `GET /api/library` reports
  it, so what is actually running is no longer a guess.

## 0.6.1

- Fixed the viewer answering `400: Bad Request` instead of opening a
  document. Home Assistant runs a security filter in front of ingress that
  unquotes a URL until it stops changing and rejects anything holding a
  `../`, so the link to the document could not climb out of the viewer's
  folder however it was encoded. Documents are now also served underneath
  that folder, and the link only points downwards.
- Documents whose names the add-on would refuse to serve are no longer
  listed, rather than appearing as a tile that cannot be opened.

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
