export const DEFAULT_SETTINGS = {
  primaryLanguage: "en-US",
  secondaryLanguage: "es-ES"
};

export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (result) => {
      resolve({
        primaryLanguage: result.primaryLanguage || DEFAULT_SETTINGS.primaryLanguage,
        secondaryLanguage: result.secondaryLanguage || DEFAULT_SETTINGS.secondaryLanguage
      });
    });
  });
}

export async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set(settings, () => resolve());
  });
}

export async function init() {
  const primarySelect = document.getElementById("primaryLanguage");
  const secondarySelect = document.getElementById("secondaryLanguage");
  const saveButton = document.getElementById("saveButton");
  const status = document.getElementById("status");

  const settings = await getSettings();

  primarySelect.value = settings.primaryLanguage;
  secondarySelect.value = settings.secondaryLanguage;

  saveButton.addEventListener("click", async () => {
    const nextSettings = {
      primaryLanguage: primarySelect.value,
      secondaryLanguage: secondarySelect.value
    };

    await saveSettings(nextSettings);
    status.textContent = "Saved";

    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  });
}

if (typeof document !== "undefined") {
  init();
}
