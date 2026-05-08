import { describe, expect, it } from "vitest";
import { translate } from "../src/shared/localTranslator.js";

describe("localTranslator", () => {
  it("returns empty string for empty input", () => {
    expect(translate("")).toBe("");
  });

  it("expands common contractions before translating", () => {
    expect(translate("I can't go").toLowerCase()).toContain("no puedo");
  });

  it("preserves final punctuation", () => {
    expect(translate("I can fight!")).toMatch(/!$/);
  });

  it("does not crash with punctuation-only input", () => {
    expect(() => translate("...")).not.toThrow();
  });

  it("keeps unknown words instead of deleting the sentence", () => {
    expect(translate("Zorblax attacks")).toBeTruthy();
  });
});
