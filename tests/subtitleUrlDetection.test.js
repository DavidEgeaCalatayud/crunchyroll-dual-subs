import { describe, expect, it } from "vitest";
import {
  extractLanguageFromSubtitleUrl,
  isSubtitleUrl,
  normalizeLanguageCode
} from "../src/shared/subtitleUrlDetection.js";

describe("subtitle URL detection", () => {
  it("detects .ass subtitle URLs", () => {
    expect(isSubtitleUrl("https://cdn.example.com/subs/en-US/file.ass")).toBe(true);
  });

  it("detects .vtt subtitle URLs", () => {
    expect(isSubtitleUrl("https://cdn.example.com/captions/es-ES/file.vtt")).toBe(true);
  });

  it("does not detect unrelated video assets", () => {
    expect(isSubtitleUrl("https://cdn.example.com/video/segment.m4s")).toBe(false);
  });

  it("extracts locale from query string", () => {
    expect(extractLanguageFromSubtitleUrl("https://x.test/file.vtt?locale=en-US")).toBe("en-US");
  });

  it("normalizes underscore language codes", () => {
    expect(normalizeLanguageCode("en_us")).toBe("en-US");
  });
});
