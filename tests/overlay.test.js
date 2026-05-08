import { beforeEach, describe, expect, it } from "vitest";
import { createOverlay, setOverlayText } from "../src/content/overlay.js";

describe("overlay", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("creates the overlay with original and secondary lines", () => {
    createOverlay();

    expect(document.querySelector("#crds-overlay")).toBeTruthy();
    expect(document.querySelector(".crds-line-original")).toBeTruthy();
    expect(document.querySelector(".crds-line-secondary")).toBeTruthy();
  });

  it("sets original and secondary text safely with textContent", () => {
    createOverlay();
    setOverlayText("<script>alert(1)</script>", "Hola");

    expect(document.querySelector(".crds-line-original").textContent).toBe("alert(1)");
    expect(document.querySelector(".crds-line-secondary").textContent).toBe("Hola");
  });

  it("hides overlay when both lines are empty", () => {
    createOverlay();
    setOverlayText("", "");

    expect(document.querySelector("#crds-overlay").classList.contains("crds-hidden")).toBe(true);
  });
});
