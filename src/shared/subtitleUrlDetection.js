export function isSubtitleUrl(url) {
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

export function normalizeLanguageCode(language) {
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

export function extractLanguageFromSubtitleUrl(url) {
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
    const match = String(url || "").match(pattern);
    if (match?.[1]) {
      return normalizeLanguageCode(match[1]);
    }
  }

  return null;
}
