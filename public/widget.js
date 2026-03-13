(function () {
  "use strict";

  // Find the script tag that loaded this file
  var script = document.currentScript;
  if (!script) {
    console.error("[Klasly Widget] Cannot find script tag.");
    return;
  }

  var studioId = script.getAttribute("data-studio");
  var theme = script.getAttribute("data-theme") || "green";
  var height = script.getAttribute("data-height") || "700";

  if (!studioId) {
    console.error("[Klasly Widget] data-studio attribute is required.");
    return;
  }

  // Determine base URL from the script src
  var baseUrl = script.src.replace(/\/widget\.js(\?.*)?$/, "");

  // Create container
  var container = document.createElement("div");
  container.id = "klasly-widget-" + studioId;
  container.style.width = "100%";
  container.style.maxWidth = "100%";
  container.style.overflow = "hidden";

  // Create iframe
  var iframe = document.createElement("iframe");
  iframe.src =
    baseUrl +
    "/widget/" +
    encodeURIComponent(studioId) +
    "?theme=" +
    encodeURIComponent(theme);
  iframe.style.width = "100%";
  iframe.style.height = height + "px";
  iframe.style.border = "none";
  iframe.style.borderRadius = "12px";
  iframe.style.backgroundColor = "transparent";
  iframe.setAttribute("allow", "popups");
  iframe.setAttribute("title", "Klasly Booking Widget");
  iframe.setAttribute("loading", "lazy");

  // Listen for resize messages from the iframe
  window.addEventListener("message", function (event) {
    // Only accept messages from our iframe
    if (event.source !== iframe.contentWindow) return;

    if (event.data && event.data.type === "KLASLY_RESIZE") {
      var newHeight = Math.max(event.data.height, 200);
      iframe.style.height = newHeight + "px";
    }
  });

  container.appendChild(iframe);

  // Insert after the script tag
  if (script.parentNode) {
    script.parentNode.insertBefore(container, script.nextSibling);
  }
})();
