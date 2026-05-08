import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORD_DICT_FILE = ROOT / "src" / "data" / "wordDictionary.json"

MAX_TRANSLATIONS = 2

ALLOWED_POS = {"noun", "verb", "adjective", "adverb", "unknown"}

# Caracteres razonables para traducciones normales en español
VALID_TRANSLATION_RE = re.compile(r"^[a-záéíóúüñ0-9' -]+$", re.IGNORECASE)

# Tokens/patrones que suelen indicar glosas raras, explicaciones o basura
BAD_PATTERNS = [
    r"\(",
    r"\)",
    r"\[",
    r"\]",
    r"\{",
    r"\}",
    r":",
    r";",
    r"/",
    r"\\",
    r"\|",
    r"  ", 
]

# Palabras que suelen sonar a explicación larga o entrada poco útil
BAD_CONTAINS = {
    "alguien que",
    "persona que",
    "acción de",
    "acto de",
    "el hecho de",
    "tipo de",
    "clase de",
    "forma de",
    "que ",
    " por ",
    " para ",
}

# Traducciones regionales o poco útiles para una v1 de subtítulos.
# Esto es ampliable con el tiempo.
LOW_PRIORITY_WORDS = {
    "chamuyo",
    "chamuyar",
    "gaguear",
    "alcaucil",
    "pregonante",
    "alertador",
    "delator en su trabajo",
    "chuflar",
    "chifla"
}


def load_dictionary(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_dictionary(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def normalize_text(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def word_count(text: str) -> int:
    return len([w for w in text.split(" ") if w.strip()])


def has_bad_pattern(text: str) -> bool:
    for pattern in BAD_PATTERNS:
        if re.search(pattern, text):
            return True
    return False


def has_bad_contains(text: str) -> bool:
    lower = text.lower()
    return any(token in lower for token in BAD_CONTAINS)


def has_uncommon_chars(text: str) -> bool:
    return VALID_TRANSLATION_RE.fullmatch(text) is None


def looks_like_noise(text: str) -> bool:
    if not text:
        return True

    if len(text) > 40:
        return True

    if word_count(text) > 3:
        return True

    if has_bad_pattern(text):
        return True

    if has_bad_contains(text):
        return True

    if has_uncommon_chars(text):
        return True

    return False


def score_translation(text: str, pos: str) -> int:
    """
    Cuanto más alto, mejor.
    """
    score = 0
    t = text.lower().strip()

    # Prioriza traducciones cortas y limpias
    wc = word_count(t)
    if wc == 1:
        score += 50
    elif wc == 2:
        score += 30
    elif wc == 3:
        score += 10

    if len(t) <= 12:
        score += 20
    elif len(t) <= 20:
        score += 10

    # Penaliza claramente lo raro
    if t in LOW_PRIORITY_WORDS:
        score -= 80

    if has_bad_contains(t):
        score -= 50

    if has_bad_pattern(t):
        score -= 50

    # Prioriza POS simples
    if pos in {"noun", "verb", "adjective", "adverb"}:
        score += 15
    else:
        score += 0

    # Penaliza frases demasiado explicativas
    if " " in t and wc >= 3:
        score -= 15

    # Preferencia ligera por palabras con caracteres normales
    if not has_uncommon_chars(t):
        score += 10

    return score


def clean_translations(translations: list[str], pos: str) -> list[str]:
    normalized = []
    seen = set()

    for item in translations:
        t = normalize_text(item)
        if not t:
            continue
        if t in seen:
            continue
        seen.add(t)
        normalized.append(t)

    filtered = [t for t in normalized if not looks_like_noise(t)]

    ranked = sorted(
        filtered,
        key=lambda t: (-score_translation(t, pos), len(t), t)
    )

    return ranked[:MAX_TRANSLATIONS]


def clean_entry(word: str, entry: dict) -> dict | None:
    pos = normalize_text(entry.get("pos", "unknown"))
    translations = entry.get("translations", [])

    if pos not in ALLOWED_POS:
        pos = "unknown"

    if not isinstance(translations, list) or not translations:
        return None

    cleaned = clean_translations(translations, pos)
    if not cleaned:
        return None

    return {
        "translations": cleaned,
        "pos": pos
    }


def main() -> None:
    if not WORD_DICT_FILE.exists():
        raise FileNotFoundError(f"No existe el archivo: {WORD_DICT_FILE}")

    print("=== CLEAN WORD DICTIONARY ===")
    print(f"INPUT/OUTPUT = {WORD_DICT_FILE}")

    data = load_dictionary(WORD_DICT_FILE)

    original_words = len(data)
    cleaned_data = {}

    removed_words = 0
    reduced_entries = 0

    for word, entry in data.items():
        if not isinstance(entry, dict):
            removed_words += 1
            continue

        original_translations = entry.get("translations", [])
        cleaned_entry = clean_entry(word, entry)

        if cleaned_entry is None:
            removed_words += 1
            continue

        if len(cleaned_entry["translations"]) < len(original_translations):
            reduced_entries += 1

        cleaned_data[word] = cleaned_entry

    # Orden alfabético final
    cleaned_data = dict(sorted(cleaned_data.items(), key=lambda kv: kv[0]))

    save_dictionary(WORD_DICT_FILE, cleaned_data)

    print("\nProceso completado.")
    print(f"  palabras originales : {original_words:,}")
    print(f"  palabras finales    : {len(cleaned_data):,}")
    print(f"  palabras eliminadas : {removed_words:,}")
    print(f"  entradas reducidas  : {reduced_entries:,}")
    print(f"  archivo sobrescrito : {WORD_DICT_FILE}")


if __name__ == "__main__":
    main()