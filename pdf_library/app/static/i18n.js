// Two dictionaries and a lookup. No library, no fetching: the whole point
// is that the interface is translated before the first paint.
//
// Keys name the meaning, not the wording, so a reworded button does not
// turn into a reworded key. Both dictionaries carry the same set of keys;
// a missing one falls back to English and complains in the console.
//
// %s in a value is replaced by t(key, value).

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
      open_document: "Open",
      close: "Close",
      add: "Add",
      add_collection: "New collection",
      edit_collection: "Collection",
      collection_title: "Title",
      collection_icon: "Icon",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      delete_collection: "Delete collection",
      delete_confirm: "Delete “%s”?",
      delete_collection_confirm: "Delete the collection “%s”?",
      delete_collection_force: "“%s” still holds documents. Delete it and all of them?",
      rename: "Rename",
      rename_prompt: "New title",
      upload_cover: "Set cover",
      uploading: "Uploading %s",
      drop_here: "Drop PDF files to add them",
      drop_nothing: "No PDF files in what you dropped",
      overwrite_confirm: "“%s” already exists. Replace it?",
      unit_kb: "KB",
      unit_mb: "MB",
      unit_gb: "GB",
      err_network: "The add-on did not answer.",
      err_bad_request: "The add-on could not read that request.",
      err_bad_collection_id: "That collection name cannot be used.",
      err_bad_file_name: "That file name cannot be used.",
      err_bad_path: "That path is not allowed.",
      err_bad_icon: "That icon is not available.",
      err_collection_not_found: "No such collection.",
      err_collection_not_empty: "The collection still holds documents.",
      err_collection_exists: "A collection with that name already exists.",
      err_not_found: "No such file.",
      err_title_required: "A title is needed.",
      err_file_required: "No file was sent.",
      err_file_exists: "A document with that name is already here.",
      err_not_a_pdf: "That file is not a PDF.",
      err_not_an_image: "That cover is not an image.",
      err_upload_too_large: "That file is over the size limit.",
      err_cover_without_file: "A cover needs a document to belong to.",
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
      open_document: "Открыть",
      close: "Закрыть",
      add: "Добавить",
      add_collection: "Новая коллекция",
      edit_collection: "Коллекция",
      collection_title: "Название",
      collection_icon: "Иконка",
      save: "Сохранить",
      cancel: "Отмена",
      delete: "Удалить",
      delete_collection: "Удалить коллекцию",
      delete_confirm: "Удалить «%s»?",
      delete_collection_confirm: "Удалить коллекцию «%s»?",
      delete_collection_force: "В «%s» ещё есть документы. Удалить вместе с ними?",
      rename: "Переименовать",
      rename_prompt: "Новое название",
      upload_cover: "Загрузить обложку",
      uploading: "Загружается %s",
      drop_here: "Отпустите PDF, чтобы добавить",
      drop_nothing: "Среди перетащенного нет PDF",
      overwrite_confirm: "«%s» уже есть. Заменить?",
      unit_kb: "КБ",
      unit_mb: "МБ",
      unit_gb: "ГБ",
      err_network: "Аддон не ответил.",
      err_bad_request: "Аддон не смог разобрать запрос.",
      err_bad_collection_id: "Такое имя коллекции использовать нельзя.",
      err_bad_file_name: "Такое имя файла использовать нельзя.",
      err_bad_path: "Такой путь недопустим.",
      err_bad_icon: "Такой иконки нет.",
      err_collection_not_found: "Коллекция не найдена.",
      err_collection_not_empty: "В коллекции ещё есть документы.",
      err_collection_exists: "Коллекция с таким именем уже есть.",
      err_not_found: "Файл не найден.",
      err_title_required: "Нужно название.",
      err_file_required: "Файл не передан.",
      err_file_exists: "Документ с таким именем уже здесь.",
      err_not_a_pdf: "Это не PDF.",
      err_not_an_image: "Обложка не является картинкой.",
      err_upload_too_large: "Файл больше допустимого размера.",
      err_cover_without_file: "Обложке нужен документ, к которому она относится.",
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

  function t(key, value) {
    let text = DICT[current][key];
    if (text === undefined) {
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(`i18n: missing key "${key}" for "${current}", using ${FALLBACK}`);
      }
      text = DICT[FALLBACK][key];
    }
    if (text === undefined) return key;
    return value === undefined ? text : text.replace("%s", value);
  }

  // The error codes the server can send are translated here, so the server
  // never has to know which language the user reads in.
  function tError(code) {
    const key = "err_" + (code || "unknown");
    return DICT[FALLBACK][key] === undefined ? t("err_unknown") : t(key);
  }

  function locale() {
    return current === "ru" ? "ru-RU" : "en-GB";
  }

  global.I18N = { setLanguage, t, tError, locale, get lang() { return current; } };
})(window);
