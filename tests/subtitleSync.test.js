import { describe, expect, it } from "vitest";
import { getEntryAtTime } from "../src/shared/subtitleSync.js";

describe("getEntryAtTime", () => {
  const entries = [
    { start: 1, end: 3, text: "A" },
    { start: 4, end: 6, text: "B" }
  ];

  it("returns matching entry inside range", () => {
    expect(getEntryAtTime(entries, 2)?.text).toBe("A");
  });

  it("includes exact start and end boundaries", () => {
    expect(getEntryAtTime(entries, 1)?.text).toBe("A");
    expect(getEntryAtTime(entries, 3)?.text).toBe("A");
  });

  it("returns null between cues", () => {
    expect(getEntryAtTime(entries, 3.5)).toBeNull();
  });
});
