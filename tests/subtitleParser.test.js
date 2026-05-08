import { describe, expect, it } from "vitest";
import {
  parseAss,
  parseSubtitleContent,
  parseVtt,
  timeToSeconds
} from "../src/shared/subtitleParser.js";

describe("timeToSeconds", () => {
  it("parses ASS time format", () => {
    expect(timeToSeconds("0:01:02.34")).toBeCloseTo(62.34);
  });

  it("parses VTT time format", () => {
    expect(timeToSeconds("00:01:02.345")).toBeCloseTo(62.345);
  });

  it("returns 0 for invalid input", () => {
    expect(timeToSeconds("bad")).toBe(0);
  });
});

describe("parseVtt", () => {
  it("parses basic WEBVTT cues", () => {
    const input = `WEBVTT

00:00:01.000 --> 00:00:03.000
Hello world`;

    expect(parseVtt(input)).toEqual([
      { start: 1, end: 3, text: "Hello world" }
    ]);
  });

  it("ignores cue identifiers and empty blocks", () => {
    const input = `WEBVTT

1
00:00:01.000 --> 00:00:03.000
Hello`;

    expect(parseVtt(input)[0].text).toBe("Hello");
  });

  it("removes tags and ASS line breaks from cue text", () => {
    const input = `WEBVTT

00:00:01.000 --> 00:00:03.000
<i>Hello\\Nworld</i>`;

    expect(parseVtt(input)[0].text).toBe("Hello\nworld");
  });
});

describe("parseAss", () => {
  it("parses Dialogue lines", () => {
    const input = "Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,Hello\\Nworld";

    expect(parseAss(input)).toEqual([
      { start: 1, end: 3.5, text: "Hello\nworld" }
    ]);
  });

  it("ignores non-dialogue lines", () => {
    expect(parseAss("[Script Info]\nTitle: test")).toEqual([]);
  });
});

describe("parseSubtitleContent", () => {
  it("uses the URL extension to parse VTT", () => {
    const input = `00:00:01.000 --> 00:00:02.000
Hi`;

    expect(parseSubtitleContent(input, "https://x.test/file.vtt")).toEqual([
      { start: 1, end: 2, text: "Hi" }
    ]);
  });

  it("returns an empty list for unsupported content", () => {
    expect(parseSubtitleContent("{}")).toEqual([]);
  });
});
