import { normalizeSubtitleText } from "../shared/subtitleParser.js";

const overlayState = {
  overlay: null,
  originalLine: null,
  secondaryLine: null,
  overlayHost: null,
  lastOriginalText: "",
  lastSecondaryText: ""
};

export function getOverlayElement() {
  return overlayState.overlay;
}

export function getOverlayHostElement() {
  return overlayState.overlayHost;
}

export function resetOverlayTextCache() {
  overlayState.lastOriginalText = "";
  overlayState.lastSecondaryText = "";
}

export function createOverlay(host = document.body) {
  const existing = document.querySelector("#crds-overlay");

  if (existing) {
    overlayState.overlay = existing;
    overlayState.originalLine = existing.querySelector(".crds-line-original");
    overlayState.secondaryLine = existing.querySelector(".crds-line-secondary");
    overlayState.overlayHost = existing.parentElement;
    return existing;
  }

  const overlay = document.createElement("div");
  overlay.id = "crds-overlay";
  overlay.classList.add("crds-hidden");

  const originalLine = document.createElement("div");
  originalLine.className = "crds-line crds-line-original";

  const secondaryLine = document.createElement("div");
  secondaryLine.className = "crds-line crds-line-secondary";

  overlay.appendChild(originalLine);
  overlay.appendChild(secondaryLine);

  overlayState.overlay = overlay;
  overlayState.originalLine = originalLine;
  overlayState.secondaryLine = secondaryLine;

  attachOverlay(host);

  return overlay;
}

export function attachOverlay(host = document.body) {
  if (!overlayState.overlay) {
    createOverlay(host);
    return;
  }

  if (overlayState.overlay.parentElement !== host) {
    host.appendChild(overlayState.overlay);
    overlayState.overlayHost = host;
  }
}

export function setOverlayText(originalText, secondaryText = "", options = {}) {
  const cleanOriginal = normalizeSubtitleText(originalText);
  let cleanSecondary = normalizeSubtitleText(secondaryText);

  if (!cleanSecondary && cleanOriginal && options.fallbackTranslate) {
    cleanSecondary = normalizeSubtitleText(options.fallbackTranslate(cleanOriginal));
  }

  if (
    cleanOriginal === overlayState.lastOriginalText &&
    cleanSecondary === overlayState.lastSecondaryText
  ) {
    return;
  }

  overlayState.lastOriginalText = cleanOriginal;
  overlayState.lastSecondaryText = cleanSecondary;

  if (overlayState.originalLine) {
    overlayState.originalLine.textContent = cleanOriginal;
  }

  if (overlayState.secondaryLine) {
    overlayState.secondaryLine.textContent = cleanSecondary;
  }

  const hasText = Boolean(cleanOriginal || cleanSecondary);

  if (overlayState.overlay) {
    overlayState.overlay.classList.toggle("crds-hidden", !hasText);
  }
}
