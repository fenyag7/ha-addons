// Every URL here is relative on purpose: ingress serves the app from a path
// prefix the add-on never sees, so a leading slash would leave the add-on
// and come back as the Home Assistant frontend.

(function () {
  "use strict";

  const { t, tError, setLanguage, locale } = window.I18N;

  // Material Design Icons (Pictogrammers, Apache 2.0), path data only.
  // Twelve of them, embedded: no icon font to load and nothing to fetch.
  const ICONS = {
    "bookshelf": "M9 3V18H12V3H9M12 5L16 18L19 17L15 4L12 5M5 5V18H8V5H5M3 19V21H21V19H3Z",
    "dice-multiple": "M19.78,3H11.22C10.55,3 10,3.55 10,4.22V8H16V14H19.78C20.45,14 21,13.45 21,12.78V4.22C21,3.55 20.45,3 19.78,3M12.44,6.67C11.76,6.67 11.21,6.12 11.21,5.44C11.21,4.76 11.76,4.21 12.44,4.21A1.23,1.23 0 0,1 13.67,5.44C13.67,6.12 13.12,6.67 12.44,6.67M18.56,12.78C17.88,12.79 17.33,12.24 17.32,11.56C17.31,10.88 17.86,10.33 18.54,10.32C19.22,10.31 19.77,10.86 19.78,11.56C19.77,12.23 19.23,12.77 18.56,12.78M18.56,6.67C17.88,6.68 17.33,6.13 17.32,5.45C17.31,4.77 17.86,4.22 18.54,4.21C19.22,4.2 19.77,4.75 19.78,5.44C19.78,6.12 19.24,6.66 18.56,6.67M4.22,10H12.78A1.22,1.22 0 0,1 14,11.22V19.78C14,20.45 13.45,21 12.78,21H4.22C3.55,21 3,20.45 3,19.78V11.22C3,10.55 3.55,10 4.22,10M8.5,14.28C7.83,14.28 7.28,14.83 7.28,15.5C7.28,16.17 7.83,16.72 8.5,16.72C9.17,16.72 9.72,16.17 9.72,15.5A1.22,1.22 0 0,0 8.5,14.28M5.44,11.22C4.77,11.22 4.22,11.77 4.22,12.44A1.22,1.22 0 0,0 5.44,13.66C6.11,13.66 6.66,13.11 6.66,12.44V12.44C6.66,11.77 6.11,11.22 5.44,11.22M11.55,17.33C10.88,17.33 10.33,17.88 10.33,18.55C10.33,19.22 10.88,19.77 11.55,19.77A1.22,1.22 0 0,0 12.77,18.55H12.77C12.77,17.88 12.23,17.34 11.56,17.33H11.55Z",
    "tools": "M21.71 20.29L20.29 21.71A1 1 0 0 1 18.88 21.71L7 9.85A3.81 3.81 0 0 1 6 10A4 4 0 0 1 2.22 4.7L4.76 7.24L5.29 6.71L6.71 5.29L7.24 4.76L4.7 2.22A4 4 0 0 1 10 6A3.81 3.81 0 0 1 9.85 7L21.71 18.88A1 1 0 0 1 21.71 20.29M2.29 18.88A1 1 0 0 0 2.29 20.29L3.71 21.71A1 1 0 0 0 5.12 21.71L10.59 16.25L7.76 13.42M20 2L16 4V6L13.83 8.17L15.83 10.17L18 8H20L22 4Z",
    "book-open-page-variant": "M19 2L14 6.5V17.5L19 13V2M6.5 5C4.55 5 2.45 5.4 1 6.5V21.16C1 21.41 1.25 21.66 1.5 21.66C1.6 21.66 1.65 21.59 1.75 21.59C3.1 20.94 5.05 20.5 6.5 20.5C8.45 20.5 10.55 20.9 12 22C13.35 21.15 15.8 20.5 17.5 20.5C19.15 20.5 20.85 20.81 22.25 21.56C22.35 21.61 22.4 21.59 22.5 21.59C22.75 21.59 23 21.34 23 21.09V6.5C22.4 6.05 21.75 5.75 21 5.5V19C19.9 18.65 18.7 18.5 17.5 18.5C15.8 18.5 13.35 19.15 12 20V6.5C10.55 5.4 8.45 5 6.5 5Z",
    "file-document-outline": "M6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6M6,4H13V9H18V20H6V4M8,12V14H16V12H8M8,16V18H13V16H8Z",
    "gamepad-variant": "M7,6H17A6,6 0 0,1 23,12A6,6 0 0,1 17,18C15.22,18 13.63,17.23 12.53,16H11.47C10.37,17.23 8.78,18 7,18A6,6 0 0,1 1,12A6,6 0 0,1 7,6M6,9V11H4V13H6V15H8V13H10V11H8V9H6M15.5,12A1.5,1.5 0 0,0 14,13.5A1.5,1.5 0 0,0 15.5,15A1.5,1.5 0 0,0 17,13.5A1.5,1.5 0 0,0 15.5,12M18.5,9A1.5,1.5 0 0,0 17,10.5A1.5,1.5 0 0,0 18.5,12A1.5,1.5 0 0,0 20,10.5A1.5,1.5 0 0,0 18.5,9Z",
    "chef-hat": "M12.5,1.5C10.73,1.5 9.17,2.67 8.67,4.37C8.14,4.13 7.58,4 7,4A4,4 0 0,0 3,8C3,9.82 4.24,11.41 6,11.87V19H19V11.87C20.76,11.41 22,9.82 22,8A4,4 0 0,0 18,4C17.42,4 16.86,4.13 16.33,4.37C15.83,2.67 14.27,1.5 12.5,1.5M12,10.5H13V17.5H12V10.5M9,12.5H10V17.5H9V12.5M15,12.5H16V17.5H15V12.5M6,20V21A1,1 0 0,0 7,22H18A1,1 0 0,0 19,21V20H6Z",
    "car-wrench": "M20.96 16.45C20.97 16.3 21 16.15 21 16V16.5L20.96 16.45M11 16C11 16.71 11.15 17.39 11.42 18H6V19C6 19.55 5.55 20 5 20H4C3.45 20 3 19.55 3 19V11L5.08 5C5.28 4.42 5.84 4 6.5 4H17.5C18.16 4 18.72 4.42 18.92 5L21 11V16C21 13.24 18.76 11 16 11S11 13.24 11 16M8 13.5C8 12.67 7.33 12 6.5 12S5 12.67 5 13.5 5.67 15 6.5 15 8 14.33 8 13.5M19 10L17.5 5.5H6.5L5 10H19M22.87 21.19L18.76 17.08C19.17 16.04 18.94 14.82 18.08 13.97C17.18 13.06 15.83 12.88 14.74 13.38L16.68 15.32L15.33 16.68L13.34 14.73C12.8 15.82 13.05 17.17 13.93 18.08C14.79 18.94 16 19.16 17.05 18.76L21.16 22.86C21.34 23.05 21.61 23.05 21.79 22.86L22.83 21.83C23.05 21.65 23.05 21.33 22.87 21.19Z",
    "home-outline": "M12 5.69L17 10.19V18H15V12H9V18H7V10.19L12 5.69M12 3L2 12H5V20H11V14H13V20H19V12H22",
    "music": "M21,3V15.5A3.5,3.5 0 0,1 17.5,19A3.5,3.5 0 0,1 14,15.5A3.5,3.5 0 0,1 17.5,12C18.04,12 18.55,12.12 19,12.34V6.47L9,8.6V17.5A3.5,3.5 0 0,1 5.5,21A3.5,3.5 0 0,1 2,17.5A3.5,3.5 0 0,1 5.5,14C6.04,14 6.55,14.12 7,14.34V6L21,3Z",
    "camera-outline": "M20,4H16.83L15,2H9L7.17,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6A2,2 0 0,0 20,4M20,18H4V6H8.05L9.88,4H14.12L15.95,6H20V18M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15Z",
    "folder-outline": "M20,18H4V8H20M20,6H12L10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6Z"
  };
  const ICON_NAMES = Object.keys(ICONS);
  const FALLBACK_ICON = "folder-outline";
  const PLUS_PATH = "M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z";

  const LONG_PRESS_MS = 500;
  const LONG_PRESS_SLOP = 10;

  const state = {
    collections: [],
    activeId: null,
    items: [],
    query: "",
    maxUploadBytes: 100 * 1024 * 1024,
    // Built lazily the first time someone searches, dropped on any change.
    searchIndex: null,
    menuItem: null,
    editing: null,
    pageTimer: null,
    viewing: null
  };

  const id = (name) => document.getElementById(name);
  const dom = {
    search: id("search"),
    add: id("add"),
    tabs: id("tabs"),
    grid: id("grid"),
    notice: id("notice"),
    progress: id("progress"),
    progressLabel: id("progress-label"),
    progressBar: id("progress-bar"),
    fileInput: id("file-input"),
    coverInput: id("cover-input"),
    viewer: id("viewer"),
    viewerTitle: id("viewer-title"),
    viewerClose: id("viewer-close"),
    viewerFrame: id("viewer-frame"),
    dropzone: id("dropzone"),
    dropzoneText: id("dropzone-text"),
    docMenu: id("doc-menu"),
    docMenuTitle: id("doc-menu-title"),
    docRename: id("doc-rename"),
    docCover: id("doc-cover"),
    docDelete: id("doc-delete"),
    docCancel: id("doc-cancel"),
    collectionDialog: id("collection-dialog"),
    collectionForm: id("collection-form"),
    collectionDialogTitle: id("collection-dialog-title"),
    collectionTitleLabel: id("collection-title-label"),
    collectionTitle: id("collection-title"),
    collectionIconLabel: id("collection-icon-label"),
    iconPicker: id("icon-picker"),
    collectionCancel: id("collection-cancel"),
    collectionSave: id("collection-save"),
    collectionDelete: id("collection-delete")
  };

  // -- helpers --------------------------------------------------------

  async function api(path, options) {
    let response;
    try {
      response = await fetch(path, options);
    } catch (error) {
      throw { code: "network", detail: String(error) };
    }
    if (response.status === 204) return {};
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      // Not JSON means the request never reached the add-on.
      throw { code: "network", detail: `${response.status} ${response.url}` };
    }
    if (!response.ok) throw { code: payload.error, detail: payload.detail, status: response.status };
    return payload;
  }

  const asJson = (body) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  function formatSize(bytes) {
    const units = ["unit_kb", "unit_mb", "unit_gb"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    const digits = value >= 100 || unit === 0 ? 0 : 1;
    return `${value.toLocaleString(locale(), {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    })} ${t(units[unit])}`;
  }

  // Case-insensitive, and ё folded onto е so that a search for "елка"
  // finds "Ёлка". The server sorts with the same rule.
  function fold(text) {
    return text.toLowerCase().replace(/ё/g, "е");
  }

  // A stable hue per title, so a document keeps its colour between visits.
  function hueOf(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) % 360;
    }
    return hash;
  }

  function icon(name, path) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("icon");
    const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
    shape.setAttribute("d", path || ICONS[name] || ICONS[FALLBACK_ICON]);
    svg.appendChild(shape);
    return svg;
  }

  function notice(message) {
    dom.notice.textContent = message || "";
    dom.notice.hidden = !message;
  }

  function progress(label, fraction) {
    if (label === null) {
      dom.progress.hidden = true;
      return;
    }
    dom.progress.hidden = false;
    dom.progressLabel.textContent = label;
    dom.progressBar.value = fraction;
  }

  // A long press is how a tile and a tab give up their menu. Any real
  // movement cancels it, so scrolling never opens anything.
  //
  // The press leaves a mark on the element rather than trying to swallow the
  // click that follows: listeners on the element the event targets run in
  // registration order, capture flag or not, so ordering is not something to
  // rely on here. The mark is cleared when the next gesture starts, which
  // bounds it to exactly one click.
  function onLongPress(element, handler) {
    let timer = null;
    let origin = null;

    const stop = () => {
      window.clearTimeout(timer);
      timer = null;
      origin = null;
    };

    element.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      element.dataset.longPressed = "";
      origin = { x: event.clientX, y: event.clientY };
      timer = window.setTimeout(() => {
        timer = null;
        element.dataset.longPressed = "1";
        handler();
      }, LONG_PRESS_MS);
    });
    element.addEventListener("pointermove", (event) => {
      if (!origin) return;
      if (
        Math.abs(event.clientX - origin.x) > LONG_PRESS_SLOP ||
        Math.abs(event.clientY - origin.y) > LONG_PRESS_SLOP
      ) {
        stop();
      }
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((name) =>
      element.addEventListener(name, stop)
    );
    element.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      handler();
    });
  }

  function wasLongPress(element) {
    return element.dataset.longPressed === "1";
  }

  // -- rendering ------------------------------------------------------

  function renderTabs() {
    dom.tabs.replaceChildren();
    state.collections.forEach((collection) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tab";
      button.dataset.cid = collection.id;
      if (collection.id === state.activeId) {
        button.classList.add("is-active");
        button.setAttribute("aria-current", "true");
      }
      button.appendChild(icon(collection.icon));
      const title = document.createElement("span");
      title.textContent = collection.title;
      button.appendChild(title);
      const count = document.createElement("span");
      count.className = "tab-count";
      count.textContent = collection.count;
      button.appendChild(count);
      button.addEventListener("click", () => {
        if (wasLongPress(button)) return;
        selectCollection(collection.id);
      });
      onLongPress(button, () => openCollectionDialog(collection));
      dom.tabs.appendChild(button);
    });

    const add = document.createElement("button");
    add.type = "button";
    add.className = "tab tab-add";
    add.setAttribute("aria-label", t("add_collection"));
    add.appendChild(icon(null, PLUS_PATH));
    add.addEventListener("click", () => openCollectionDialog(null));
    dom.tabs.appendChild(add);
  }

  function placeholder(container, title) {
    const box = document.createElement("div");
    box.className = "cover cover-placeholder";
    box.style.setProperty("--tile-hue", hueOf(title));
    const label = document.createElement("span");
    label.textContent = title;
    box.appendChild(label);
    container.replaceChildren(box);
  }

  function renderTile(entry) {
    const tile = document.createElement("article");
    tile.className = "tile";

    const frame = document.createElement("button");
    frame.type = "button";
    frame.className = "tile-cover";
    frame.setAttribute("aria-label", `${t("open_document")}: ${entry.name}`);
    frame.addEventListener("click", () => {
      if (wasLongPress(frame)) return;
      openViewer(entry);
    });
    onLongPress(frame, () => openDocMenu(entry));

    if (entry.cover) {
      const image = document.createElement("img");
      image.className = "cover";
      image.loading = "lazy";
      image.alt = "";
      image.src = `covers/${encodeURIComponent(entry.cid)}/${encodeURIComponent(entry.cover)}`;
      // A cover deleted between the listing and the load must not leave a
      // broken image behind: fall back to the drawn one.
      image.addEventListener("error", () => placeholder(frame, entry.name));
      frame.appendChild(image);
    } else {
      placeholder(frame, entry.name);
    }
    tile.appendChild(frame);

    const title = document.createElement("h2");
    title.className = "tile-title";
    title.textContent = entry.name;
    tile.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "tile-meta";
    meta.textContent = formatSize(entry.size_bytes);
    tile.appendChild(meta);

    // Only while searching: people remember the title, not the shelf.
    if (entry.collectionTitle) {
      const where = document.createElement("p");
      where.className = "tile-collection";
      where.textContent = entry.collectionTitle;
      tile.appendChild(where);
    }
    return tile;
  }

  function renderEmpty(titleKey, hintKey) {
    const box = document.createElement("div");
    box.className = "empty";
    const heading = document.createElement("p");
    heading.className = "empty-title";
    heading.textContent = t(titleKey);
    box.appendChild(heading);
    if (hintKey) {
      const hint = document.createElement("p");
      hint.className = "empty-hint";
      hint.textContent = t(hintKey);
      box.appendChild(hint);
    }
    dom.grid.replaceChildren(box);
  }

  function renderList(entries, searching) {
    if (!entries.length) {
      renderEmpty(searching ? "no_results" : "empty_title", searching ? null : "empty_hint");
      return;
    }
    const fragment = document.createDocumentFragment();
    entries.forEach((entry) => fragment.appendChild(renderTile(entry)));
    dom.grid.replaceChildren(fragment);
  }

  function renderGrid() {
    if (!state.collections.length) {
      renderEmpty("no_collections", "no_collections_hint");
      return;
    }
    renderList(state.items, false);
  }

  // -- search ---------------------------------------------------------

  // An empty query shows the open collection. A real one searches the whole
  // library, because people remember what a document is called long before
  // they remember which collection they filed it under.
  async function loadSearchIndex() {
    const lists = await Promise.all(
      state.collections.map(async (collection) => {
        const data = await api(`api/collections/${encodeURIComponent(collection.id)}/items`);
        return data.items.map((item) => ({
          ...item,
          cid: collection.id,
          collectionTitle: collection.title
        }));
      })
    );
    return lists.flat();
  }

  async function runSearch() {
    const query = fold(state.query.trim());
    if (!query) {
      renderGrid();
      return;
    }
    if (!state.searchIndex) {
      renderEmpty("loading", null);
      try {
        state.searchIndex = await loadSearchIndex();
      } catch (error) {
        notice(tError(error.code));
        return;
      }
      // The field may have been cleared while that was in flight.
      if (!fold(state.query.trim())) {
        renderGrid();
        return;
      }
    }
    const current = fold(state.query.trim());
    renderList(
      state.searchIndex
        .filter((entry) => fold(entry.name).includes(current))
        .sort((a, b) => fold(a.name).localeCompare(fold(b.name), locale())),
      true
    );
  }

  // -- viewer ---------------------------------------------------------

  const pageKey = (cid, file) => `page:${cid}:${file}`;

  function remembered(cid, file) {
    try {
      const value = parseInt(window.localStorage.getItem(pageKey(cid, file)), 10);
      return value > 1 ? value : null;
    } catch (error) {
      return null; // storage can be denied; the viewer still works
    }
  }

  function rememberPage() {
    if (!state.viewing) return;
    try {
      const app = dom.viewerFrame.contentWindow.PDFViewerApplication;
      if (app && app.page > 0) {
        window.localStorage.setItem(
          pageKey(state.viewing.cid, state.viewing.file),
          String(app.page)
        );
      }
    } catch (error) {
      // Not loaded yet, already torn down, or storage denied. Nothing to do.
    }
  }

  // The path points down, never up. Home Assistant's security filter sits in
  // front of ingress, unquotes the URL until it stops changing and rejects
  // anything holding a "../" with a bare 400 -- so climbing out of pdfjs/web/
  // to reach /docs is not an option, however it is encoded. The server serves
  // the documents under the viewer's folder as well, which makes this a plain
  // downward path.
  //
  // The inner encoding turns the path into a valid URL; the outer one turns
  // that URL into a valid query value, and pdf.js undoes exactly one layer.
  function viewerUrl(cid, file) {
    const target = `docs/${encodeURIComponent(cid)}/${encodeURIComponent(file)}`;
    const page = remembered(cid, file);
    const hash = page ? `#page=${page}&zoom=page-width` : "#zoom=page-width";
    return `pdfjs/web/viewer.html?file=${encodeURIComponent(target)}${hash}`;
  }

  // pdf.js hands the pinch anchor to the viewer in screen coordinates while
  // the viewer subtracts the container's layout offset from it -- two
  // different coordinate spaces. The wheel path passes clientX/clientY and
  // is correct, which is what makes this a bug rather than a convention.
  // The error is the distance from the top of the screen to the top of this
  // frame: the status bar, the Home Assistant header and our own bar. That
  // is exactly what a touch tells us, by reporting both spaces at once.
  //
  // Everything here is optional. If pdf.js changes shape, the checks fail
  // and the viewer keeps its own behaviour rather than breaking.
  function correctPinchOrigin(frameWindow) {
    try {
      const viewerApp = frameWindow.PDFViewerApplication;
      if (!viewerApp || typeof viewerApp.touchPinchCallback !== "function") return;
      if (viewerApp.pinchOriginCorrected) return;

      const offset = { x: 0, y: 0 };
      frameWindow.document.addEventListener(
        "touchstart",
        (event) => {
          const touch = event.touches[0];
          if (!touch) return;
          offset.x = touch.screenX - touch.clientX;
          offset.y = touch.screenY - touch.clientY;
        },
        { capture: true, passive: true }
      );

      const original = viewerApp.touchPinchCallback.bind(viewerApp);
      viewerApp.touchPinchCallback = (origin, previous, distance) => {
        const corrected = Array.isArray(origin)
          ? [origin[0] - offset.x, origin[1] - offset.y]
          : origin;
        original(corrected, previous, distance);
      };
      viewerApp.pinchOriginCorrected = true;
    } catch (error) {
      // A viewer we cannot reach into is a viewer we leave alone.
    }
  }

  function onViewerLoaded() {
    let frameWindow;
    try {
      frameWindow = dom.viewerFrame.contentWindow;
    } catch (error) {
      return;
    }
    const viewerApp = frameWindow && frameWindow.PDFViewerApplication;
    if (!viewerApp) return; // about:blank, or not the viewer
    Promise.resolve(viewerApp.initializedPromise)
      .then(() => correctPinchOrigin(frameWindow))
      .catch(() => {});
  }

  function openViewer(entry) {
    state.viewing = { cid: entry.cid, file: entry.file };
    dom.viewerTitle.textContent = entry.name;
    dom.viewerFrame.title = entry.name;
    dom.viewerFrame.src = viewerUrl(entry.cid, entry.file);
    dom.viewer.showModal();
    // Polling beats hooking the event bus: it survives a pdf.js upgrade and
    // costs nothing, and a rules PDF is read for minutes at a time.
    state.pageTimer = window.setInterval(rememberPage, 2000);
  }

  function closeViewer() {
    if (dom.viewer.open) dom.viewer.close();
  }

  // -- upload ---------------------------------------------------------

  function uploadOne(file, cid, overwrite) {
    return new Promise((resolve) => {
      const form = new FormData();
      form.append("file", file, file.name);
      const query = overwrite ? "?overwrite=1" : "";
      const request = new XMLHttpRequest();
      request.open("POST", `api/collections/${encodeURIComponent(cid)}/items${query}`);
      // fetch() reports no upload progress, which is the whole reason this
      // one call is not written with it.
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          progress(t("uploading", file.name), event.loaded / event.total);
        }
      };
      request.onload = () => {
        let payload = {};
        try {
          payload = JSON.parse(request.responseText);
        } catch (error) {
          resolve({ ok: false, code: "network" });
          return;
        }
        resolve(
          request.status >= 200 && request.status < 300
            ? { ok: true, payload }
            : { ok: false, code: payload.error, status: request.status }
        );
      };
      request.onerror = () => resolve({ ok: false, code: "network" });
      request.send(form);
    });
  }

  async function uploadFiles(files) {
    const cid = state.activeId;
    if (!cid) return;
    notice("");
    for (const file of files) {
      if (file.size > state.maxUploadBytes) {
        notice(`${file.name}: ${tError("upload_too_large")}`);
        continue;
      }
      progress(t("uploading", file.name), 0);
      let result = await uploadOne(file, cid, false);
      if (!result.ok && result.code === "file_exists") {
        if (window.confirm(t("overwrite_confirm", file.name))) {
          result = await uploadOne(file, cid, true);
        } else {
          continue;
        }
      }
      if (!result.ok) notice(`${file.name}: ${tError(result.code)}`);
    }
    progress(null);
    await refresh();
  }

  async function uploadCover(entry, file) {
    const form = new FormData();
    form.append("cover", file, file.name);
    try {
      await api(
        `api/collections/${encodeURIComponent(entry.cid)}/items/` +
          `${encodeURIComponent(entry.file)}/cover`,
        { method: "PUT", body: form }
      );
      await refresh();
    } catch (error) {
      notice(tError(error.code));
    }
  }

  // -- document menu --------------------------------------------------

  function openDocMenu(entry) {
    state.menuItem = entry;
    dom.docMenuTitle.textContent = entry.name;
    dom.docMenu.showModal();
  }

  async function renameDocument(entry) {
    const next = window.prompt(t("rename_prompt"), entry.name);
    if (next === null || next.trim() === "" || next === entry.name) return;
    try {
      await api(
        `api/collections/${encodeURIComponent(entry.cid)}/items/${encodeURIComponent(entry.file)}`,
        { ...asJson({ name: next }), method: "PATCH" }
      );
    } catch (error) {
      notice(tError(error.code));
    }
    await refresh();
  }

  async function deleteDocument(entry) {
    if (!window.confirm(t("delete_confirm", entry.name))) return;
    try {
      await api(
        `api/collections/${encodeURIComponent(entry.cid)}/items/${encodeURIComponent(entry.file)}`,
        { method: "DELETE" }
      );
    } catch (error) {
      notice(tError(error.code));
    }
    await refresh();
  }

  // -- collection dialog ----------------------------------------------

  function selectIcon(name) {
    dom.iconPicker.querySelectorAll(".icon-choice").forEach((choice) => {
      const chosen = choice.dataset.icon === name;
      choice.classList.toggle("is-selected", chosen);
      choice.setAttribute("aria-checked", String(chosen));
    });
  }

  function renderIconPicker(selected) {
    dom.iconPicker.replaceChildren();
    ICON_NAMES.forEach((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "icon-choice";
      button.dataset.icon = name;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-label", name);
      button.appendChild(icon(name));
      // Toggling rather than re-rendering, so the button keeps focus.
      button.addEventListener("click", () => selectIcon(name));
      dom.iconPicker.appendChild(button);
    });
    selectIcon(selected);
  }

  function chosenIcon() {
    const selected = dom.iconPicker.querySelector(".is-selected");
    return selected ? selected.dataset.icon : FALLBACK_ICON;
  }

  function openCollectionDialog(collection) {
    state.editing = collection;
    dom.collectionDialogTitle.textContent = t(
      collection ? "edit_collection" : "add_collection"
    );
    dom.collectionTitle.value = collection ? collection.title : "";
    renderIconPicker(collection ? collection.icon : ICON_NAMES[0]);
    dom.collectionDelete.hidden = !collection;
    dom.collectionDialog.showModal();
  }

  async function submitCollection() {
    const title = dom.collectionTitle.value.trim();
    if (!title) return;
    const icon = chosenIcon();
    try {
      if (state.editing) {
        await api(`api/collections/${encodeURIComponent(state.editing.id)}`, {
          ...asJson({ title, icon }),
          method: "PATCH"
        });
      } else {
        const created = await api("api/collections", asJson({ title, icon }));
        state.activeId = created.id;
      }
    } catch (error) {
      notice(tError(error.code));
    }
    dom.collectionDialog.close();
    await refresh();
  }

  async function deleteCollection() {
    const collection = state.editing;
    if (!collection) return;
    if (!window.confirm(t("delete_collection_confirm", collection.title))) return;
    try {
      await api(`api/collections/${encodeURIComponent(collection.id)}`, { method: "DELETE" });
    } catch (error) {
      if (error.code === "collection_not_empty") {
        if (!window.confirm(t("delete_collection_force", collection.title))) return;
        try {
          await api(`api/collections/${encodeURIComponent(collection.id)}?force=1`, {
            method: "DELETE"
          });
        } catch (forced) {
          notice(tError(forced.code));
        }
      } else {
        notice(tError(error.code));
      }
    }
    dom.collectionDialog.close();
    if (state.activeId === collection.id) state.activeId = null;
    await refresh();
  }

  // -- flow -----------------------------------------------------------

  async function selectCollection(cid) {
    state.activeId = cid;
    state.query = "";
    dom.search.value = "";
    renderTabs();
    // A blank grid reads as broken; over a slow tunnel this is visible.
    renderEmpty("loading", null);
    notice("");
    try {
      const data = await api(`api/collections/${encodeURIComponent(cid)}/items`);
      if (state.activeId !== cid) return; // a faster tap won
      state.items = data.items.map((item) => ({ ...item, cid }));
    } catch (error) {
      state.items = [];
      notice(tError(error.code));
    }
    renderGrid();
  }

  // Anything that changed the library on disk lands here.
  async function refresh() {
    state.searchIndex = null;
    let data;
    try {
      data = await api("api/library");
    } catch (error) {
      notice(tError(error.code));
      return;
    }
    state.collections = data.collections;
    state.maxUploadBytes = data.max_upload_bytes || state.maxUploadBytes;
    dom.add.hidden = !state.collections.length;

    if (!state.collections.length) {
      state.activeId = null;
      state.items = [];
      renderTabs();
      renderGrid();
      return;
    }
    const stillThere = state.collections.some((c) => c.id === state.activeId);
    const target = stillThere ? state.activeId : state.collections[0].id;
    if (state.query.trim()) {
      state.activeId = target;
      renderTabs();
      await runSearch();
    } else {
      await selectCollection(target);
    }
  }

  function applyStaticText() {
    document.title = t("app_title");
    dom.search.placeholder = t("search_placeholder");
    dom.search.setAttribute("aria-label", t("search_placeholder"));
    dom.add.textContent = t("add");
    dom.viewerClose.textContent = t("close");
    dom.dropzoneText.textContent = t("drop_here");
    dom.docRename.textContent = t("rename");
    dom.docCover.textContent = t("upload_cover");
    dom.docDelete.textContent = t("delete");
    dom.docCancel.textContent = t("cancel");
    dom.collectionTitleLabel.textContent = t("collection_title");
    dom.collectionIconLabel.textContent = t("collection_icon");
    dom.collectionCancel.textContent = t("cancel");
    dom.collectionSave.textContent = t("save");
    dom.collectionDelete.textContent = t("delete_collection");
  }

  async function start() {
    let data;
    try {
      data = await api("api/library");
    } catch (error) {
      setLanguage("auto");
      applyStaticText();
      notice(tError(error.code));
      return;
    }
    setLanguage(data.language);
    applyStaticText();
    state.collections = data.collections;
    state.maxUploadBytes = data.max_upload_bytes || state.maxUploadBytes;
    dom.add.hidden = !state.collections.length;
    if (state.collections.length) {
      await selectCollection(state.collections[0].id);
    } else {
      renderTabs();
      renderGrid();
    }
  }

  // -- wiring ---------------------------------------------------------

  dom.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    runSearch();
  });

  dom.add.addEventListener("click", () => dom.fileInput.click());
  dom.fileInput.addEventListener("change", async (event) => {
    const files = [...event.target.files];
    event.target.value = ""; // so the same file can be picked twice
    if (files.length) await uploadFiles(files);
  });

  // Dragging files onto the window is the desktop counterpart of the Add
  // button. dragenter and dragleave fire for every element crossed, so the
  // overlay is driven by a depth counter rather than by the last event.
  let dragDepth = 0;

  const showDropzone = (shown) => {
    dom.dropzone.hidden = !shown;
  };

  const draggingFiles = (event) =>
    Array.from(event.dataTransfer?.types || []).includes("Files");

  window.addEventListener("dragenter", (event) => {
    if (!draggingFiles(event) || !state.activeId) return;
    event.preventDefault();
    dragDepth += 1;
    showDropzone(true);
  });

  window.addEventListener("dragover", (event) => {
    if (!draggingFiles(event) || !state.activeId) return;
    // Without this the browser opens the file instead of handing it over.
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  });

  window.addEventListener("dragleave", (event) => {
    if (!draggingFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) showDropzone(false);
  });

  window.addEventListener("drop", async (event) => {
    if (!draggingFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    showDropzone(false);
    if (!state.activeId) return;
    const files = Array.from(event.dataTransfer.files).filter(
      (file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name)
    );
    if (!files.length) {
      notice(t("drop_nothing"));
      return;
    }
    await uploadFiles(files);
  });

  dom.viewerFrame.addEventListener("load", onViewerLoaded);
  dom.viewerClose.addEventListener("click", closeViewer);
  // Esc closes the dialog on its own, so the tidying up belongs here.
  dom.viewer.addEventListener("close", () => {
    rememberPage();
    window.clearInterval(state.pageTimer);
    state.pageTimer = null;
    state.viewing = null;
    // Drop the document so the pdf.js worker stops holding it in memory.
    dom.viewerFrame.src = "about:blank";
  });

  dom.docCancel.addEventListener("click", () => dom.docMenu.close());
  dom.docRename.addEventListener("click", async () => {
    const entry = state.menuItem;
    dom.docMenu.close();
    if (entry) await renameDocument(entry);
  });
  dom.docCover.addEventListener("click", () => {
    dom.docMenu.close();
    dom.coverInput.click();
  });
  dom.docDelete.addEventListener("click", async () => {
    const entry = state.menuItem;
    dom.docMenu.close();
    if (entry) await deleteDocument(entry);
  });
  dom.coverInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (file && state.menuItem) await uploadCover(state.menuItem, file);
  });

  dom.collectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitCollection();
  });
  dom.collectionCancel.addEventListener("click", () => dom.collectionDialog.close());
  dom.collectionDelete.addEventListener("click", deleteCollection);

  start();
})();
