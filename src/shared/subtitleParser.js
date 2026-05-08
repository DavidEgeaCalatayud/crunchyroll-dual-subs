export function normalizeSubtitleText(value) {
  return String(value || "")
    .replace(/\{.*?\}/g, "")
    .replace(/\\N/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function timeToSeconds(value) {
  const text = String(value || "").trim();

  let match = /^(\d+):(\d{1,2}):(\d{1,2})(?:\.(\d{1,2}))?$/.exec(text);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const centiseconds = Number(match[4] || 0);

    return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
  }

  match = /^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?$/.exec(text);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const milliseconds = Number(match[4] || 0);

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }

  return 0;
}

export function parseVtt(content) {
  const text = String(content || "").replace(/\r/g, "");
  const blocks = text.split(/\n\n+/);
  const entries = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) continue;
    if (lines[0] === "WEBVTT") continue;

    let timeLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const timeLine = lines[timeLineIndex];
    const textLines = lines.slice(timeLineIndex + 1);

    if (!textLines.length) continue;

    const parts = timeLine.split("-->");
    if (parts.length !== 2) continue;

    const start = parts[0].trim().split(" ")[0];
    const end = parts[1].trim().split(" ")[0];

    const subtitleText = normalizeSubtitleText(textLines.join("\n"));
    if (!subtitleText) continue;

    entries.push({
      start: timeToSeconds(start),
      end: timeToSeconds(end),
      text: subtitleText
    });
  }

  return entries;
}

export function parseAss(content) {
  const lines = String(content || "").split("\n");
  const entries = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line.startsWith("Dialogue:")) continue;

    const payload = line.slice("Dialogue:".length).trim();
    const parts = payload.split(",");

    if (parts.length < 10) continue;

    const start = parts[1]?.trim();
    const end = parts[2]?.trim();
    const text = parts.slice(9).join(",").trim();

    const cleanText = normalizeSubtitleText(text);
    if (!cleanText) continue;

    entries.push({
      start: timeToSeconds(start),
      end: timeToSeconds(end),
      text: cleanText
    });
  }

  return entries;
}

export function parseSubtitleContent(content, url = "") {
  const text = String(content || "");
  const lowerUrl = String(url || "").toLowerCase();

  if (lowerUrl.includes(".vtt") || text.includes("WEBVTT")) {
    return parseVtt(text);
  }

  if (text.includes("Dialogue:")) {
    return parseAss(text);
  }

  return [];
}
