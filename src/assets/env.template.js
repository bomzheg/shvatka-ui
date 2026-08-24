(function(window) {
  window["env"] = window["env"] || {};

  // Environment variables
  window["env"]["apiUrl"] = "${SHVATKA_UI_API_URL}";
  window["env"]["cdnUrl"] = "${SHVATKA_UI_CDN_URL}";
  window["env"]["mainUrl"] = "${SHVATKA_UI_MAIN_URL}";
  window["env"]["botUsername"] = "${SHVATKA_UI_BOT_USERNAME}";
  // the root of the published documentation, version included; unset falls back
  // to the docs of master (see ShvatkaConfig)
  window["env"]["docsUrl"] = "${SHVATKA_UI_DOCS_URL}";
  window["env"]["baseHref"] = "${SHVATKA_UI_BASE_HREF}"
})(this);
