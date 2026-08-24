// Two dictionaries and a lookup. No library, no fetching: the whole point
// is that the interface is translated before the first paint.
//
// Keys name the meaning, not the wording, so a reworded button does not
// turn into a reworded key. Both dictionaries carry the same set of keys;
// a missing one falls back to English and complains in the console.

(function (global) {
  "use strict";

  const DICT = {
    en: {
      app_title: "Library",
      search_placeholder: "Search by title",
      loading: "Loading…",
      empty_title: "Nothing here yet",
      empty_hint: "Copy PDF files into this collection over Samba, or add them here.",
      no_collections: "No collections yet",
      no_collections_hint: "Create one to start putting documents somewhere.",
      no_results: "Nothing matches that",
      unit_kb: "KB",
      unit_mb: "MB",
      unit_gb: "GB",
      err_network: "The add-on did not answer.",
      err_bad_collection_id: "That collection name cannot be used.",
      err_bad_file_name: "That file name cannot be used.",
      err_bad_path: "That path is not allowed.",
      err_collection_not_found: "No such collection.",
      err_not_found: "No such file.",
      err_unknown: "Something went wrong."
    },
    ru: {
      app_title: "Библиотека",
      search_placeholder: "Поиск по названию",
      loading: "Загрузка…",
      empty_title: "Пока пусто",
      empty_hint: "Скопируйте PDF в эту коллекцию по Samba или добавьте здесь.",
      no_collections: "Коллекций пока нет",
      no_collections_hint: "Создайте коллекцию, чтобы было куда складывать документы.",
      no_results: "Ничего не нашлось",
      unit_kb: "КБ",
      unit_mb: "МБ",
      unit_gb: "ГБ",
      err_network: "Аддон не ответил.",
      err_bad_collection_id: "Такое имя коллекции использовать нельзя.",
      err_bad_file_name: "Такое имя файла использовать нельзя.",
      err_bad_path: "Такой путь недопустим.",
      err_collection_not_found: "Коллекция не найдена.",
      err_not_found: "Файл не найден.",
      err_unknown: "Что-то пошло не так."
    }
  };

  const FALLBACK = "en";
  let current = FALLBACK;
  const warned = new Set();

  // Anything that is not Russian gets English. English is the answer to
  // every doubt, including an unset or unexpected option value.
  function resolve(option) {
    if (option === "ru" || option === "en") return option;
    const browser = (global.navigator && global.navigator.language) || "";
    return browser.toLowerCase().startsWith("ru") ? "ru" : "en";
  }

  function setLanguage(option) {
    current = resolve(option);
    if (global.document) {
      global.document.documentElement.lang = current;
    }
    return current;
  }

  function t(key) {
    const value = DICT[current][key];
    if (value !== undefined) return value;
    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`i18n: missing key "${key}" for "${current}", using ${FALLBACK}`);
    }
    const fallback = DICT[FALLBACK][key];
    return fallback !== undefined ? fallback : key;
  }

  // The error codes the server can send are translated here, so the server
  // never has to know which language the user reads in.
  function tError(code) {
    return t("err_" + (code || "unknown"));
  }

  function locale() {
    return current === "ru" ? "ru-RU" : "en-GB";
  }

  global.I18N = { setLanguage, t, tError, locale, get lang() { return current; } };
})(window);
