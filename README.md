# Crunchyroll Dual Subs

![Chrome Extension](https://img.shields.io/badge/platform-Chrome-4285F4)
![JavaScript](https://img.shields.io/badge/language-JavaScript-F7DF1E)
[![CI](https://github.com/DavidEgeaCalatayud/crunchyroll-dual-subs/actions/workflows/ci.yml/badge.svg)](https://github.com/DavidEgeaCalatayud/crunchyroll-dual-subs/actions/workflows/ci.yml)
![Status](https://img.shields.io/badge/status-educational_project-orange)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

Crunchyroll Dual Subs is an unofficial Chrome extension for language learners who want to watch Crunchyroll with two synchronized subtitle lines:

- the original English subtitle track detected from Crunchyroll subtitle requests;
- a secondary Spanish study translation generated locally from bundled dictionaries, translation memory, glossary rules and sentence patterns.

The extension does **not** call external translation APIs. All translation logic runs locally in the browser. This keeps the project fast, private and easy to extend, although translation quality is intentionally limited by the rule-based approach.

> This project is intended for educational and personal language-learning purposes.

## Features

- Detects subtitle requests made by the Crunchyroll web player.
- Downloads subtitle tracks through the extension service worker.
- Parses `.ass` and `.vtt` subtitle files.
- Renders a custom dual-subtitle overlay synchronized with the video clock.
- Repositions the overlay inside the fullscreen element.
- Conservatively hides native Crunchyroll subtitle text to avoid covering the player.
- Provides a local English-to-Spanish study translation pipeline:
  - exact translation memory;
  - common phrase replacements;
  - glossary and protected terms;
  - sentence-pattern rules for common dialogue structures;
  - word dictionary fallback.

## Technical Highlights

- Chrome Manifest V3 extension architecture.
- Service worker-based subtitle request detection.
- Browser-side subtitle fetching and parsing.
- Custom subtitle overlay injected through a content script.
- Synchronization based on the active video element clock.
- Fullscreen-aware overlay positioning.
- Local rule-based translator with no external API calls.
- Modular shared logic for subtitle parsing, synchronization and translation.
- Testable browser-independent logic using Vitest.
- Build process powered by esbuild.

## Why This Project Exists

Many language learners prefer watching content with the original subtitle line and a secondary translation line. This makes it easier to compare sentence structure, vocabulary, expressions and recurring dialogue patterns while watching.

Most browser-based translation solutions rely on external APIs. That can introduce latency, API limits, cost, privacy concerns or dependency on third-party services.

This project explores a different approach: a local, deterministic and extendable translation layer optimized for common English-to-Spanish subtitle patterns.

The goal is not to compete with neural machine translation. The goal is to provide a fast, private and hackable study tool for subtitle-based language learning.

## Architecture Overview

```text
Crunchyroll web player
        |
        | subtitle request
        v
Chrome webRequest listener
        |
        v
Background service worker
        |
        | fetch subtitle resource
        v
Subtitle parser
   |-- ASS parser
   `-- VTT parser
        |
        v
Subtitle synchronizer
        |
        | video.currentTime
        v
Content script overlay
        |
        v
Dual subtitles rendered on screen
```

## Translation Pipeline

The local translator applies several layers in order:

```text
Input subtitle line
        |
        v
Text normalization
        |
        v
Protected terms and glossary rules
        |
        v
Exact translation memory
        |
        v
Common phrase replacements
        |
        v
Sentence-pattern rules
        |
        v
Word dictionary fallback
        |
        v
Spanish study subtitle
```

This pipeline is deterministic and easy to debug. It is also intentionally limited: translation quality depends on the available dictionaries, phrase memory and sentence-pattern rules.

## Translation Examples

Original:

```text
I won't let you get away with this.
```

Spanish study translation:

```text
No dejaré que te salgas con la tuya.
```

Original:

```text
Are you okay?
```

Spanish study translation:

```text
¿Estás bien?
```

Original:

```text
This power is incredible.
```

Spanish study translation:

```text
Este poder es increíble.
```

## Project Structure

```text
public/                  Extension manifest
scripts/build.mjs        Build script powered by esbuild
src/background/          Service worker for subtitle request capture and fetching
src/content/             Content script and subtitle overlay styles
src/data/                Local dictionaries, glossary and translation memory
src/popup/               Extension popup for language selection and settings
src/shared/              Shared subtitle parsing, URL detection, sync and translation logic
tests/                   Vitest test suite
tools/                   Dictionary maintenance scripts
```

## Installation From Source

Clone the repository:

```bash
git clone https://github.com/DavidEgeaCalatayud/crunchyroll-dual-subs.git
cd crunchyroll-dual-subs
```

Install dependencies:

```bash
npm install
```

Build the unpacked extension:

```bash
npm run build
```

The generated extension will be written to:

```text
dist/
```

## Loading the Extension in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the generated `dist/` folder.
5. Open Crunchyroll and start playing an episode with English subtitles enabled.

## Development

Install dependencies:

```bash
npm install
```

Build the extension:

```bash
npm run build
```

Run the development watcher:

```bash
npm run watch
```

Run the test suite:

```bash
npm test
```

Run the project CI command locally:

```bash
npm run ci
```

## Testing

The test suite focuses on browser-independent logic, including:

- subtitle URL detection;
- `.ass` subtitle parsing;
- `.vtt` subtitle parsing;
- subtitle synchronization;
- local translation rules;
- glossary and protected-term handling;
- phrase replacement behavior;
- dictionary fallback behavior;
- overlay behavior;
- popup behavior;
- build output validation.

Run tests with:

```bash
npm test
```

## Extending the Local Translator

The translation system is intentionally data-driven. The best way to improve translation quality without using an external API is to extend the local data files.

### Exact Subtitle Translations

Use `src/data/translationMemory.json` for full-line subtitle translations.

Example:

```json
{
  "i won't let you get away with this.": "No dejaré que te salgas con la tuya."
}
```

Use this file when a complete subtitle line has a known preferred translation.

### Common Phrases

Use `src/data/commonPhrases.json` for reusable expressions or dialogue fragments.

Example:

```json
{
  "get away with this": "salirte con la tuya",
  "what are you doing": "qué estás haciendo",
  "leave it to me": "déjamelo a mí"
}
```

This layer is useful for recurring anime dialogue patterns and common spoken expressions.

### Glossary and Protected Terms

Use `src/data/glossary.json` for names, attacks, locations, organizations or preferred translations.

Example:

```json
{
  "Tanjiro": "Tanjiro",
  "Hashira": "Hashira",
  "Demon Slayer Corps": "Cuerpo de Exterminio de Demonios"
}
```

This helps avoid unwanted translations of proper nouns or domain-specific terms.

### Sentence Patterns

For broader grammar improvements, extend the sentence-pattern layer in:

```text
src/shared/localTranslator.js
```

This layer is useful for common dialogue structures such as:

- `I want to...`
- `I have to...`
- `Are you...?`
- `Do you think...?`
- `I can't believe...`

## Privacy

Crunchyroll Dual Subs does not send subtitle text, browsing data, video information or user preferences to external translation services.

All translation logic runs locally in the browser using bundled dictionaries, glossary files, phrase memory and sentence-pattern rules.

The extension does not require:

- an external translation API;
- an API key;
- a backend server;
- a user account.

## Permissions

The extension requires browser permissions to detect subtitle requests and render the custom subtitle overlay.

| Permission | Reason |
| --- | --- |
| `webRequest` | Detect subtitle requests made by the Crunchyroll web player. |
| `host_permissions` | Access Crunchyroll subtitle resources requested during playback. |
| `storage` | Save extension preferences. |
| Content scripts | Inject and render the dual-subtitle overlay. |

## Limitations

- This is an unofficial extension and depends on Crunchyroll's current web player behavior.
- Subtitle request detection may break if Crunchyroll changes its player internals or subtitle request format.
- The local translator is not comparable to DeepL, Google Translate or other neural machine translation engines.
- Translation quality depends heavily on the available phrase memory, glossary and dictionary entries.
- Some `.ass` subtitle styling may not be fully preserved.
- The extension is designed around English-to-Spanish study translations.
- The extension does not bypass DRM, authentication, paywalls or regional restrictions.

## Roadmap

Possible future improvements:

- Add more translation memory examples.
- Improve English-to-Spanish sentence-pattern coverage.
- Add configurable subtitle font size.
- Add configurable subtitle position.
- Add support for custom user glossary entries.
- Add import/export for glossary and translation memory.
- Improve `.ass` style handling.
- Improve subtitle detection across more Crunchyroll locales.
- Add support for additional secondary languages.
- Publish packaged extension releases.
- Add screenshots and demo GIFs.
- Add CI workflow for build and tests.

## Development Goals

This project is also intended as a technical exploration of:

- Chrome extension architecture;
- Manifest V3 service workers;
- browser request interception;
- subtitle parsing;
- DOM overlay rendering;
- video synchronization;
- local rule-based translation;
- privacy-first browser tooling.

## Disclaimer

This is an unofficial educational project and is not affiliated with, endorsed by or sponsored by Crunchyroll, LLC.

The extension does not bypass paywalls, DRM, authentication, subscriptions or regional content restrictions. It only works with subtitle resources already requested by the Crunchyroll web player during normal playback.

Use it for personal language learning and experimentation.
