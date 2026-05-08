import { beforeEach, describe, expect, it, vi } from "vitest";

function renderPopup() {
  document.body.innerHTML = `
    <select id="primaryLanguage">
      <option value="en-US">English</option>
      <option value="es-ES">Spanish</option>
    </select>
    <select id="secondaryLanguage">
      <option value="off">Off</option>
      <option value="en-US">English</option>
      <option value="es-ES">Spanish</option>
    </select>
    <button id="saveButton">Save</button>
    <div id="status"></div>
  `;
}

describe("popup settings", () => {
  beforeEach(() => {
    vi.resetModules();
    renderPopup();
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn((defaults, callback) => callback(defaults)),
          set: vi.fn((_settings, callback) => callback())
        }
      }
    };
  });

  it("loads default settings into selects", async () => {
    const { init } = await import("../src/popup/popup.js");

    await init();

    expect(document.getElementById("primaryLanguage").value).toBe("en-US");
    expect(document.getElementById("secondaryLanguage").value).toBe("es-ES");
  });

  it("saves selected languages when clicking Save", async () => {
    const { init } = await import("../src/popup/popup.js");
    await init();

    document.getElementById("primaryLanguage").value = "es-ES";
    document.getElementById("secondaryLanguage").value = "off";
    document.getElementById("saveButton").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      { primaryLanguage: "es-ES", secondaryLanguage: "off" },
      expect.any(Function)
    );
  });

  it("shows Saved status after saving", async () => {
    const { init } = await import("../src/popup/popup.js");
    await init();

    document.getElementById("saveButton").click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.getElementById("status").textContent).toBe("Saved");
  });
});
