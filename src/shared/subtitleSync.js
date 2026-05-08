export function getEntryAtTime(entries, timeSeconds) {
  if (!Array.isArray(entries) || entries.length === 0) return null;

  for (const entry of entries) {
    if (timeSeconds >= entry.start && timeSeconds <= entry.end) {
      return entry;
    }
  }

  return null;
}
