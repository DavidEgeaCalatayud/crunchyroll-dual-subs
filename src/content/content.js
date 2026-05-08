import { translate as translateLocally } from "../shared/localTranslator.js";
import {
  normalizeSubtitleText,
  parseSubtitleContent
} from "../shared/subtitleParser.js";
import { getEntryAtTime } from "../shared/subtitleSync.js";
import {
  attachOverlay,
  createOverlay as createOverlayElement,
  getOverlayElement,
  resetOverlayTextCache,
  setOverlayText as setOverlayElementText
} from "./overlay.js";

(() => {
  "use strict";

  const APP_NAME = "Crunchyroll Dual Subs";
  const DEBUG = false;

  const DEFAULT_SETTINGS = {
    primaryLanguage: "en-US",
    secondaryLanguage: "es-ES"
  };

  const LOCAL_TRANSLATION_LANGUAGE = "es-ES";

  const state = {
    video: null,

    settings: { ...DEFAULT_SETTINGS },

    primaryEntries: [],
    secondaryEntries: [],

    primaryUrl: null,
    secondaryUrl: null,

    primaryLanguageLoaded: null,
    secondaryLanguageLoaded: null,

    syncTimer: null,
    bootTimer: null,

    lastOriginalText: "",
    lastSecondaryText: "",

    lastLocation: location.href,

    loadingPrimary: false,
    loadingSecondary: false,

    hiddenNativeElements: new Set()
  };

  function log(...args) {
    if (!DEBUG) return;
    console.log(`[${APP_NAME}]`, ...args);
  }

  function normalizeText(value) {
    return normalizeSubtitleText(value);
  }

  function getOverlayHost() {
    if (document.fullscreenElement) {
      return document.fullscreenElement;
    }

    if (state.video) {
      return (
        state.video.closest("[data-testid*='player' i]") ||
        state.video.closest("[class*='player' i]") ||
        state.video.parentElement ||
        document.body
      );
    }

    return document.body;
  }

  function createOverlay() {
    createOverlayElement(getOverlayHost());
    log("Overlay creado");
  }

  function ensureOverlayAttached() {
    attachOverlay(getOverlayHost());
  }

  function translate(text) {
    const cleanText = normalizeText(text);
    if (!cleanText) return "";

    return normalizeText(translateLocally(cleanText)) || cleanText;
  }

  function setOverlayText(originalText, secondaryText = "", options = {}) {
    const cleanOriginal = normalizeText(originalText);
    let cleanSecondary = normalizeText(secondaryText);

    if (!cleanSecondary && cleanOriginal) {
      cleanSecondary = normalizeText(translate(cleanOriginal));
    }

    if (options.force) {
      state.lastOriginalText = "";
      state.lastSecondaryText = "";
      resetOverlayTextCache();
    }

    if (
      cleanOriginal === state.lastOriginalText &&
      cleanSecondary === state.lastSecondaryText
    ) {
      return;
    }

    state.lastOriginalText = cleanOriginal;
    state.lastSecondaryText = cleanSecondary;
    setOverlayElementText(cleanOriginal, cleanSecondary);
  }

  function disableVideoTextTracks() {
    if (!state.video || !state.video.textTracks) return;

    for (const track of state.video.textTracks) {
      if (track.mode !== "disabled") {
        track.mode = "disabled";
      }
    }
  }

  function restorePreviouslyHiddenNativeElements() {
    document.documentElement.classList.remove("crds-hide-native-subtitles");

    for (const element of state.hiddenNativeElements) {
      if (element && element.isConnected) {
        element.classList.remove("crds-native-subtitle-hidden");
      }
    }

    state.hiddenNativeElements.clear();
  }

  function applyHiddenNativeElements(nextElements) {
    for (const element of state.hiddenNativeElements) {
      if (!nextElements.has(element) && element && element.isConnected) {
        element.classList.remove("crds-native-subtitle-hidden");
      }
    }

    for (const element of nextElements) {
      element.classList.add("crds-native-subtitle-hidden");
    }

    state.hiddenNativeElements = nextElements;
  }

  function looksLikeNativeSubtitleElement(element, currentText) {
    const overlay = getOverlayElement();
    if (!element || element === overlay || overlay?.contains(element)) {
      return false;
    }

    const tagName = element.tagName?.toLowerCase();
    if (tagName === "html" || tagName === "body" || tagName === "video") {
      return false;
    }

    if (state.video && element.contains(state.video)) {
      return false;
    }

    if (document.fullscreenElement === element) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    if (rect.height > Math.max(160, window.innerHeight * 0.24)) {
      return false;
    }

    if (rect.width > window.innerWidth * 0.98 && rect.height > window.innerHeight * 0.1) {
      return false;
    }

    if (rect.top < window.innerHeight * 0.45) {
      return false;
    }

    const text = normalizeText(element.textContent);
    if (!text || text.length < 2) return false;

    const target = normalizeText(currentText);
    if (!target) return false;

    if (text === target) return true;

    const longest = Math.max(text.length, target.length);
    const shortest = Math.min(text.length, target.length);
    if (shortest / longest < 0.72) return false;

    return text.includes(target) || target.includes(text);
  }

  function collectNativeSubtitleCandidates(currentText) {
    const root = document.fullscreenElement || getOverlayHost() || document.body;
    const selector = [
      "[class*='subtitle' i]",
      "[class*='caption' i]",
      "[class*='cue' i]",
      "[class*='text-track' i]",
      "[class*='timedtext' i]",
      "[data-testid*='subtitle' i]",
      "[data-testid*='caption' i]",
      "[data-t*='subtitle' i]",
      "[data-t*='caption' i]"
    ].join(",");

    const candidates = new Set();
    const roots = [root];

    for (const element of root.querySelectorAll("*")) {
      if (element.shadowRoot) {
        roots.push(element.shadowRoot);
      }
    }

    for (const candidateRoot of roots) {
      for (const element of candidateRoot.querySelectorAll(selector)) {
        candidates.add(element);
      }

      const target = normalizeText(currentText);
      if (!target) continue;

      const walker = document.createTreeWalker(candidateRoot, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || getOverlayElement()?.contains(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          const text = normalizeText(node.nodeValue);
          if (!text) return NodeFilter.FILTER_REJECT;

          return text === target || text.includes(target) || target.includes(text)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      });

      while (walker.nextNode()) {
        let element = walker.currentNode.parentElement;
        let best = element;

        while (element?.parentElement && element.parentElement !== candidateRoot) {
          const parent = element.parentElement;

          if (!normalizeText(parent.textContent).includes(target)) break;
          if (!looksLikeNativeSubtitleElement(parent, target)) break;

          best = parent;
          element = parent;
        }

        if (best) {
          candidates.add(best);
        }
      }
    }

    return candidates;
  }

  function hideNativeSubtitles(currentText = "") {
    disableVideoTextTracks();
    document.documentElement.classList.add("crds-hide-native-subtitles");

    const cleanCurrentText = normalizeText(currentText);
    if (!cleanCurrentText) {
      document.documentElement.classList.remove("crds-hide-native-subtitles");
      applyHiddenNativeElements(new Set());
      return;
    }

    const matches = Array.from(collectNativeSubtitleCandidates(cleanCurrentText)).filter((element) =>
      looksLikeNativeSubtitleElement(element, cleanCurrentText)
    );

    const leafMatches = matches.filter((element) => {
      return !matches.some((other) => other !== element && element.contains(other));
    });

    applyHiddenNativeElements(new Set(leafMatches));
  }

  function findVideo() {
    return document.querySelector("video");
  }

  function getSettings() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(DEFAULT_SETTINGS, (result) => {
          if (chrome.runtime.lastError) {
            console.error(
              `[${APP_NAME}] Error leyendo settings:`,
              chrome.runtime.lastError
            );
            resolve({ ...DEFAULT_SETTINGS });
            return;
          }

          resolve({
            primaryLanguage:
              result.primaryLanguage || DEFAULT_SETTINGS.primaryLanguage,
            secondaryLanguage:
              result.secondaryLanguage || DEFAULT_SETTINGS.secondaryLanguage
          });
        });
      } catch (error) {
        console.error(`[${APP_NAME}] Excepción leyendo settings:`, error);
        resolve({ ...DEFAULT_SETTINGS });
      }
    });
  }

  function getSubtitleUrlsFromBackground() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "GET_SUBTITLE_URLS" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              `[${APP_NAME}] Error consultando background:`,
              chrome.runtime.lastError
            );
            resolve({});
            return;
          }

          resolve(response?.urls || {});
        });
      } catch (error) {
        console.error(
          `[${APP_NAME}] Excepción consultando background:`,
          error
        );
        resolve({});
      }
    });
  }

  function clearSubtitleUrlsInBackground() {
    try {
      chrome.runtime.sendMessage({ type: "CLEAR_SUBTITLE_URLS" });
    } catch (error) {
      console.error(
        `[${APP_NAME}] Excepcion limpiando URLs de subtitulos:`,
        error
      );
    }
  }

  function fetchSubtitleTextFromBackground(url) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { type: "FETCH_ASS_TEXT", url },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }

            if (!response?.ok) {
              reject(new Error(response?.error || "No se pudo descargar subtítulo"));
              return;
            }

            resolve(response.text);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  function stopSubtitleSync() {
    if (state.syncTimer) {
      clearInterval(state.syncTimer);
      state.syncTimer = null;
    }
  }

  function startSubtitleSync() {
    stopSubtitleSync();

    state.syncTimer = setInterval(() => {
      if (!state.video) return;
      ensureOverlayAttached();

      const currentTime = state.video.currentTime;

      const primaryEntry = getEntryAtTime(state.primaryEntries, currentTime);
      const secondaryEntry =
        state.secondaryEntries.length > 0
          ? getEntryAtTime(state.secondaryEntries, currentTime)
          : null;

      const originalText = primaryEntry?.text || "";

      hideNativeSubtitles(originalText);
      setOverlayText(originalText, secondaryEntry?.text || "");
    }, 100);
  }

  async function loadSubtitleEntries(url) {
    log("Descargando subtítulo:", url);

    const content = await fetchSubtitleTextFromBackground(url);

    if (!content || !content.trim()) {
      throw new Error("El subtítulo descargado está vacío");
    }

    log(`Subtítulo descargado correctamente. Longitud=${content.length}`);

    const entries = parseSubtitleContent(content, url);
    log(`parseSubtitleContent devolvió ${entries.length} líneas`);

    return entries;
  }

  async function ensurePrimaryTrack(url, language) {
    if (!url) return;
    if (state.loadingPrimary) return;

    const alreadyLoadedSameTrack =
      state.primaryUrl === url &&
      state.primaryLanguageLoaded === language &&
      state.primaryEntries.length > 0;

    if (alreadyLoadedSameTrack) return;

    state.loadingPrimary = true;

    try {
      log("Cargando pista primaria:", language, url);

      const entries = await loadSubtitleEntries(url);

      state.primaryUrl = url;
      state.primaryLanguageLoaded = language;
      state.primaryEntries = entries;

      log(`Primaria cargada (${language}): ${entries.length} líneas`);

      if (entries[0]) {
        log("Primera línea primaria:", entries[0]);
      }
    } catch (error) {
      console.error(`[${APP_NAME}] Error cargando pista primaria:`, error);
      state.primaryEntries = [];
      state.primaryUrl = null;
      state.primaryLanguageLoaded = null;
    } finally {
      state.loadingPrimary = false;
    }
  }

  async function ensureSecondaryTrack(url, language) {
    if (!url || language === "off") {
      state.secondaryUrl = null;
      state.secondaryLanguageLoaded = language;
      state.secondaryEntries = [];
      return;
    }

    if (state.loadingSecondary) return;

    const alreadyLoadedSameTrack =
      state.secondaryUrl === url &&
      state.secondaryLanguageLoaded === language &&
      state.secondaryEntries.length > 0;

    if (alreadyLoadedSameTrack) return;

    state.loadingSecondary = true;

    try {
      log("Cargando pista secundaria:", language, url);

      const entries = await loadSubtitleEntries(url);

      state.secondaryUrl = url;
      state.secondaryLanguageLoaded = language;
      state.secondaryEntries = entries;

      log(`Secundaria cargada (${language}): ${entries.length} líneas`);

      if (entries[0]) {
        log("Primera línea secundaria:", entries[0]);
      }
    } catch (error) {
      console.error(`[${APP_NAME}] Error cargando pista secundaria:`, error);
      state.secondaryEntries = [];
      state.secondaryUrl = null;
      state.secondaryLanguageLoaded = null;
    } finally {
      state.loadingSecondary = false;
    }
  }

  function resetLoadedTracks() {
    state.primaryEntries = [];
    state.secondaryEntries = [];

    state.primaryUrl = null;
    state.secondaryUrl = null;

    state.primaryLanguageLoaded = null;
    state.secondaryLanguageLoaded = null;

    state.lastOriginalText = "";
    state.lastSecondaryText = "";

    restorePreviouslyHiddenNativeElements();
    setOverlayText("", "", { force: true });
    stopSubtitleSync();
  }

  function resetStateForNavigation() {
    state.video = null;

    state.primaryEntries = [];
    state.secondaryEntries = [];

    state.primaryUrl = null;
    state.secondaryUrl = null;

    state.primaryLanguageLoaded = null;
    state.secondaryLanguageLoaded = null;

    state.lastOriginalText = "";
    state.lastSecondaryText = "";

    restorePreviouslyHiddenNativeElements();
    setOverlayText("", "", { force: true });
    stopSubtitleSync();
  }

  async function heartbeat() {
    ensureOverlayAttached();

    const video = findVideo();
    if (!video) {
      log("No se ha encontrado ningún vídeo todavía");
      return;
    }

    if (state.video !== video) {
      state.video = video;
      log("Vídeo detectado");
    }

    state.settings = await getSettings();

    const urlsByLanguage = await getSubtitleUrlsFromBackground();
    log("URLs recibidas desde background:", urlsByLanguage);

    const primaryLanguage = state.settings.primaryLanguage;
    const secondaryLanguage = state.settings.secondaryLanguage;

    const unknownUrls = Array.isArray(urlsByLanguage?._unknown)
      ? urlsByLanguage._unknown
      : [];

    const primaryUrl =
      urlsByLanguage?.[primaryLanguage] ||
      unknownUrls[0] ||
      null;

    const shouldUseLocalTranslation =
      secondaryLanguage === LOCAL_TRANSLATION_LANGUAGE;

    const secondaryUrl =
      secondaryLanguage !== "off" && !shouldUseLocalTranslation
        ? (urlsByLanguage?.[secondaryLanguage] || unknownUrls[1] || null)
        : null;

    if (!primaryUrl) {
      log(`No hay URL para subtítulo principal (${primaryLanguage})`);
    } else if (primaryUrl !== state.primaryUrl) {
      log(`URL principal detectada (${primaryLanguage}):`, primaryUrl);
      await ensurePrimaryTrack(primaryUrl, primaryLanguage);
    } else {
      log(`La pista primaria no ha cambiado (${primaryLanguage})`);
    }

    if (secondaryLanguage === "off") {
      if (state.secondaryEntries.length > 0 || state.secondaryUrl) {
        state.secondaryEntries = [];
        state.secondaryUrl = null;
        state.secondaryLanguageLoaded = "off";
        log("Pista secundaria desactivada");
      }
    } else if (shouldUseLocalTranslation) {
      if (state.secondaryEntries.length > 0 || state.secondaryUrl) {
        state.secondaryEntries = [];
        state.secondaryUrl = null;
      }

      state.secondaryLanguageLoaded = LOCAL_TRANSLATION_LANGUAGE;
      log("Pista secundaria generada por traduccion local");
    } else if (!secondaryUrl) {
      log(`No hay URL para subtítulo secundario (${secondaryLanguage})`);

      if (state.secondaryEntries.length > 0 || state.secondaryUrl) {
        state.secondaryEntries = [];
        state.secondaryUrl = null;
        state.secondaryLanguageLoaded = null;
        log("Pista secundaria limpiada por falta de URL");
      }
    } else if (secondaryUrl !== state.secondaryUrl) {
      log(`URL secundaria detectada (${secondaryLanguage}):`, secondaryUrl);
      await ensureSecondaryTrack(secondaryUrl, secondaryLanguage);
    } else {
      log(`La pista secundaria no ha cambiado (${secondaryLanguage})`);
    }

    if (!state.syncTimer && state.video && state.primaryEntries.length > 0) {
      log("Iniciando sincronización de subtítulos");
      startSubtitleSync();
    } else if (!state.primaryEntries.length) {
      log("No se inicia sync porque no hay líneas en la pista primaria");
    }
  }

  function watchStorageChanges() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      const primaryChanged = Object.prototype.hasOwnProperty.call(
        changes,
        "primaryLanguage"
      );
      const secondaryChanged = Object.prototype.hasOwnProperty.call(
        changes,
        "secondaryLanguage"
      );

      if (!primaryChanged && !secondaryChanged) return;

      log("Cambio de preferencias detectado");

      if (primaryChanged) {
        state.settings.primaryLanguage =
          changes.primaryLanguage.newValue || DEFAULT_SETTINGS.primaryLanguage;
        state.primaryEntries = [];
        state.primaryUrl = null;
        state.primaryLanguageLoaded = null;
      }

      if (secondaryChanged) {
        state.settings.secondaryLanguage =
          changes.secondaryLanguage.newValue ||
          DEFAULT_SETTINGS.secondaryLanguage;
        state.secondaryEntries = [];
        state.secondaryUrl = null;
        state.secondaryLanguageLoaded = null;
      }

      setOverlayText("", "", { force: true });
      stopSubtitleSync();
    });
  }

  function watchFullscreenChanges() {
    document.addEventListener("fullscreenchange", () => {
      ensureOverlayAttached();
      hideNativeSubtitles(state.lastOriginalText);
    });
  }

  function hasExtensionApis() {
    return Boolean(
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.id &&
      chrome.runtime.sendMessage &&
      chrome.storage &&
      chrome.storage.local
    );
  }

  function boot() {
    if (!hasExtensionApis()) {
      console.error(
        `[${APP_NAME}] Este script no está en un contexto válido de extensión`,
        {
          hasChrome: typeof chrome !== "undefined",
          hasRuntime: Boolean(typeof chrome !== "undefined" && chrome.runtime),
          hasRuntimeId: Boolean(
            typeof chrome !== "undefined" &&
              chrome.runtime &&
              chrome.runtime.id
          ),
          hasSendMessage: Boolean(
            typeof chrome !== "undefined" &&
              chrome.runtime &&
              chrome.runtime.sendMessage
          ),
          hasStorage: Boolean(typeof chrome !== "undefined" && chrome.storage),
          hasStorageLocal: Boolean(
            typeof chrome !== "undefined" &&
              chrome.storage &&
              chrome.storage.local
          ),
          href: location.href,
          topWindow: window === window.top
        }
      );
      return;
    }

    createOverlay();
    watchStorageChanges();
    watchFullscreenChanges();
    log("Traductor local cargado desde datos empaquetados");

    log("Inicializado en:", location.href);

    if (state.bootTimer) {
      clearInterval(state.bootTimer);
    }

    state.bootTimer = setInterval(() => {
      heartbeat().catch((error) => {
        console.error(`[${APP_NAME}] Error en heartbeat:`, error);
      });

      if (location.href !== state.lastLocation) {
        state.lastLocation = location.href;
        log("Cambio de URL detectado");
        resetStateForNavigation();
        clearSubtitleUrlsInBackground();
      }
    }, 1000);
  }

  boot();
})();
