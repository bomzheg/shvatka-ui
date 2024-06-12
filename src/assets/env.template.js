(function(window) {
  window["env"] = window["env"] || {};

  // Environment variables
  window["env"]["apiUrl"] = "${SHVATKA_UI_API_URL}";
  window["env"]["mainUrl"] = "${SHVATKA_UI_MAIN_URL}";
  window["env"]["botUsername"] = "${SHVATKA_UI_BOT_USERNAME}";
  window["env"]["baseHref"] = "${SHVATKA_UI_BASE_HREF}"
})(this);
