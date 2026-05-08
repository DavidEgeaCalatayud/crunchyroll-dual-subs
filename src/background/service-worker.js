const subtitleUrlsByTabId = new Map();
const DEBUG = false;

function log(...args) {
  if (!DEBUG) return;
  console.log("[Crunchyroll Dual Subs][SW]", ...args);
}

function isSubtitleUrl(url) {
  return (
    /\.ass(\?|$)/i.test(url) ||
    /\.vtt(\?|$)/i.test(url) ||
    /\.json(\?|$)/i.test(url) ||
    /subtitle/i.test(url) ||
    /subtitles/i.test(url) ||
    /caption/i.test(url) ||
    /captions/i.test(url) ||
    /\/subs?\//i.test(url) ||
    /\/captions?\//i.test(url) ||
    /timedtext/i.test(url)
  );
}

function normalizeLanguageCode(language) {
  if (!language) return null;

  const value = String(language).trim().replace("_", "-");

  if (/^[a-z]{2}-[A-Z0-9]{2,3}$/i.test(value)) {
    const parts = value.split("-");
    return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
  }

  if (/^[a-z]{2}$/i.test(value)) {
    return value.toLowerCase();
  }

  return value;
}

function extractLanguageFromSubtitleUrl(url) {
  const patterns = [
    /subtitle-\d+-([a-z]{2}-[A-Z0-9]{2,3})-\d+/i,
    /[?&]locale=([a-z]{2}-[A-Z0-9]{2,3})/i,
    /[?&]lang(?:uage)?=([a-z]{2}-[A-Z0-9]{2,3})/i,
    /[?&]audio_locale=([a-z]{2}-[A-Z0-9]{2,3})/i,
    /[?&]subtitle_locale=([a-z]{2}-[A-Z0-9]{2,3})/i,
    /\/([a-z]{2}-[A-Z0-9]{2,3})\//i,
    /[_-]([a-z]{2}-[A-Z0-9]{2,3})[_-]/i
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return normalizeLanguageCode(match[1]);
    }
  }

  return null;
}

function ensureTabStore(tabId) {
  if (!subtitleUrlsByTabId.has(tabId)) {
    subtitleUrlsByTabId.set(tabId, {});
  }
  return subtitleUrlsByTabId.get(tabId);
}

function storeSubtitleUrl(tabId, url) {
  const store = ensureTabStore(tabId);
  const language = extractLanguageFromSubtitleUrl(url);

  if (language) {
    store[language] = url;
    log("Subtítulo guardado:", language, url);
  } else {
    if (!store._unknown) {
      store._unknown = [];
    }

    if (!store._unknown.includes(url)) {
      store._unknown.push(url);
    }

    log("Subtítulo candidato sin idioma reconocido:", url);
  }
}

chrome.webRequest.onCompleted.addListener(
  (details) => {
    try {
      if (details.tabId < 0) return;
      if (!details.url) return;

      if (isSubtitleUrl(details.url)) {
        log("Request candidata:", details.url);
        storeSubtitleUrl(details.tabId, details.url);
      }
    } catch (error) {
      console.error("[Crunchyroll Dual Subs][SW] Error en onCompleted:", error);
    }
  },
  {
    urls: [
      "https://*.crunchyrollcdn.com/*",
      "https://static.crunchyroll.com/*",
      "https://www.crunchyroll.com/*",
      "https://*.crunchyroll.com/*"
    ]
  }
);

chrome.tabs.onRemoved.addListener((tabId) => {
  subtitleUrlsByTabId.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    subtitleUrlsByTabId.delete(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  const tabId = sender.tab?.id;

  if (message.type === "GET_SUBTITLE_URLS") {
    const urls =
      typeof tabId === "number" ? subtitleUrlsByTabId.get(tabId) || {} : {};

    log("GET_SUBTITLE_URLS ->", tabId, urls);
    sendResponse({ urls });
    return true;
  }

  if (message.type === "CLEAR_SUBTITLE_URLS") {
    if (typeof tabId === "number") {
      subtitleUrlsByTabId.delete(tabId);
      log("CLEAR_SUBTITLE_URLS ->", tabId);
    }

    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "FETCH_ASS_TEXT") {
    const url = message.url;

    (async () => {
      try {
        log("FETCH_ASS_TEXT ->", url);

        const response = await fetch(url, { credentials: "include" });

        if (!response.ok) {
          sendResponse({ ok: false, error: `HTTP ${response.status}` });
          return;
        }

        const text = await response.text();

        log("FETCH_ASS_TEXT OK, longitud:", text.length);

        sendResponse({ ok: true, text });
      } catch (error) {
        console.error("[Crunchyroll Dual Subs][SW] FETCH_ASS_TEXT ERROR:", error);
        sendResponse({ ok: false, error: String(error) });
      }
    })();

    return true;
  }
});
