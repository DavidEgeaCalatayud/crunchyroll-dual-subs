# Crunchyroll Dual Subs

Unofficial Chrome extension for language learners who want to watch Crunchyroll with two subtitle lines:

- the original English subtitle track extracted from Crunchyroll subtitle requests
- a secondary Spanish study translation generated locally from bundled dictionaries, phrase memory, glossary rules, and sentence patterns

The extension does not call an external translation API. Translation quality is intentionally limited by the local rule-based approach, but it is fast, private, and easy to extend with more phrases.

## Features

- Detects subtitle requests made by the Crunchyroll web player.
- Downloads and parses `.ass` and `.vtt` subtitle tracks through the extension service worker.
- Renders a custom dual-subtitle overlay synchronized with the video clock.
- Repositions the overlay inside the fullscreen element.
- Hides native Crunchyroll subtitle text conservatively to avoid covering the player.
- Includes a local English-to-Spanish translation pipeline:
  - exact translation memory
  - common phrase replacements
  - glossary and protected terms
  - sentence-pattern rules for common dialogue structures
  - word dictionary fallback

## Project Structure

```text
public/                  Extension manifest
scripts/build.mjs        Build script powered by esbuild
src/background/          Service worker for subtitle request capture/fetching
src/content/             Content script and subtitle overlay styles
src/data/                Local dictionaries, glossary, and translation memory
src/popup/               Extension popup for language selection
src/shared/              Local translator implementation
tools/                   Dictionary maintenance scripts
```

## Development

Install dependencies:

```bash
npm install
```

Build the unpacked extension:

```bash
npm run build
```

The generated extension is written to `dist/`.

For development with rebuilds:

```bash
npm run watch
```

## Loading in Chrome

1. Open `chrome://extensions`.
2. Enable developer mode.
3. Click **Load unpacked**.
4. Select the `dist/` folder after running `npm run build`.

## Translation Notes

This project uses a local rule-based translator. The best way to improve quality without using an API is to add more complete subtitle lines to:

- `src/data/translationMemory.json` for exact full-line translations
- `src/data/commonPhrases.json` for reusable dialogue phrases
- `src/data/glossary.json` for names, protected terms, and preferred translations

For broader grammar improvements, extend the sentence-pattern layer in `src/shared/localTranslator.js`.

## Disclaimer

This is an unofficial educational project and is not affiliated with Crunchyroll. Use it for personal learning and development portfolio purposes.
