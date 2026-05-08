import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_SOURCE = ROOT / "data_source"
SRC_DATA = ROOT / "src" / "data"

RAW_FILE = DATA_SOURCE / "raw-wiktextract-data.jsonl"
DB_FILE = DATA_SOURCE / "word_dictionary_build.sqlite3"
OUTPUT_FILE = SRC_DATA / "wordDictionary.json"

TARGET_LANG_CODES = {"es"}
TARGET_LANG_NAMES = {"Spanish", "Spanish (Spain)", "Spanish (Latin America)", "español"}

MAX_TRANSLATIONS_PER_WORD = 5
MIN_WORD_LEN = 1
MAX_WORD_LEN = 60

ONLY_SINGLE_WORDS = True

WORD_RE = re.compile(r"^[a-zA-Z][a-zA-Z' -]*[a-zA-Z]$|^[a-zA-Z]$")


# =========================
# UTILS
# =========================
def normalize_lemma(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def normalize_translation(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def is_valid_headword(word: str) -> bool:
    if not word:
        return False
    if len(word) < MIN_WORD_LEN or len(word) > MAX_WORD_LEN:
        return False
    if ONLY_SINGLE_WORDS and " " in word:
        return False
    return bool(WORD_RE.match(word))


def is_english_entry(entry: dict) -> bool:
    lang = entry.get("lang", "")
    lang_code = entry.get("lang_code", "")
    word = entry.get("word", "")

    if not word:
        return False

    # Queremos entradas cuyo idioma sea inglés
    if lang == "English":
        return True
    if lang_code == "en":
        return True

    return False


def get_pos(entry: dict) -> str:
    pos = entry.get("pos")
    if isinstance(pos, str) and pos.strip():
        return pos.strip().lower()
    return "unknown"


def is_spanish_translation(t: dict) -> bool:
    if not isinstance(t, dict):
        return False

    lang = t.get("lang", "")
    lang_code = t.get("lang_code", "")

    if lang_code in TARGET_LANG_CODES:
        return True
    if lang in TARGET_LANG_NAMES:
        return True

    return False


def extract_spanish_translations(entry: dict) -> list[str]:
    """
    Extrae traducciones al español desde la estructura típica de Wiktextract.
    """
    out = []

    senses = entry.get("senses", [])
    if isinstance(senses, list):
        for sense in senses:
            if not isinstance(sense, dict):
                continue

            translations = sense.get("translations", [])
            if not isinstance(translations, list):
                continue

            for tr in translations:
                if not is_spanish_translation(tr):
                    continue

                word = tr.get("word") or tr.get("roman") or ""
                word = normalize_translation(word)

                if not word:
                    continue

                # Filtrado suave de basura
                if len(word) > 80:
                    continue

                out.append(word)

    translations_root = entry.get("translations", [])
    if isinstance(translations_root, list):
        for tr in translations_root:
            if not is_spanish_translation(tr):
                continue

            word = tr.get("word") or tr.get("roman") or ""
            word = normalize_translation(word)

            if not word:
                continue

            if len(word) > 80:
                continue

            out.append(word)

    # únicos manteniendo orden
    seen = set()
    dedup = []
    for item in out:
        if item in seen:
            continue
        seen.add(item)
        dedup.append(item)

    return dedup


# =========================
# SQLITE
# =========================
def init_db(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS translations (
            lemma TEXT NOT NULL,
            translation TEXT NOT NULL,
            pos TEXT NOT NULL,
            cnt INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (lemma, translation, pos)
        )
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_translations_lemma
        ON translations (lemma)
    """)

    conn.commit()


def upsert_translation(conn: sqlite3.Connection, lemma: str, translation: str, pos: str) -> None:
    conn.execute("""
        INSERT INTO translations (lemma, translation, pos, cnt)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(lemma, translation, pos)
        DO UPDATE SET cnt = cnt + 1
    """, (lemma, translation, pos))


def build_sqlite_from_raw() -> None:
    if not RAW_FILE.exists():
        raise FileNotFoundError(f"No existe: {RAW_FILE}")

    DB_FILE.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_FILE)
    init_db(conn)

    total_lines = 0
    english_entries = 0
    saved_pairs = 0

    with RAW_FILE.open("r", encoding="utf-8") as f:
        for line in f:
            total_lines += 1
            line = line.strip()
            if not line:
                continue

            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            if not isinstance(entry, dict):
                continue

            if not is_english_entry(entry):
                continue

            english_entries += 1

            lemma = normalize_lemma(entry.get("word", ""))
            if not is_valid_headword(lemma):
                continue

            pos = get_pos(entry)

            translations = extract_spanish_translations(entry)
            if not translations:
                continue

            for tr in translations:
                upsert_translation(conn, lemma, tr, pos)
                saved_pairs += 1

            if total_lines % 100000 == 0:
                conn.commit()
                print(
                    f"[stage1] lines={total_lines:,} "
                    f"english={english_entries:,} "
                    f"pairs={saved_pairs:,}"
                )

    conn.commit()
    conn.close()

    print("\n[stage1] completado")
    print(f"  líneas totales: {total_lines:,}")
    print(f"  entradas inglés: {english_entries:,}")
    print(f"  pares guardados: {saved_pairs:,}")
    print(f"  sqlite: {DB_FILE}")


def export_word_dictionary() -> None:
    if not DB_FILE.exists():
        raise FileNotFoundError(f"No existe la base SQLite: {DB_FILE}")

    SRC_DATA.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()

    cur.execute("""
        SELECT lemma, translation, pos, cnt
        FROM translations
        ORDER BY lemma ASC, cnt DESC, translation ASC
    """)

    data = {}
    current_lemma = None
    bucket = []

    def flush_bucket(lemma: str, rows: list[tuple]) -> None:
        if not lemma or not rows:
            return

        translations = []
        pos_counter = defaultdict(int)

        for translation, pos, cnt in rows:
            if len(translations) < MAX_TRANSLATIONS_PER_WORD:
                translations.append(translation)
            pos_counter[pos] += cnt

        sorted_pos = sorted(pos_counter.items(), key=lambda x: (-x[1], x[0]))
        main_pos = sorted_pos[0][0] if sorted_pos else "unknown"

        data[lemma] = {
            "translations": translations,
            "pos": main_pos
        }

    for lemma, translation, pos, cnt in cur:
        if current_lemma is None:
            current_lemma = lemma

        if lemma != current_lemma:
            flush_bucket(current_lemma, bucket)
            current_lemma = lemma
            bucket = []

        bucket.append((translation, pos, cnt))

    flush_bucket(current_lemma, bucket)

    conn.close()

    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("\n[stage2] exportado")
    print(f"  palabras: {len(data):,}")
    print(f"  salida: {OUTPUT_FILE}")


# =========================
# MAIN
# =========================
def main():
    print("=== BUILD WORD DICTIONARY ===")
    print(f"RAW_FILE   = {RAW_FILE}")
    print(f"DB_FILE    = {DB_FILE}")
    print(f"OUTPUT     = {OUTPUT_FILE}")
    print()

    build_sqlite_from_raw()
    export_word_dictionary()

    print("\nProceso completado.")


if __name__ == "__main__":
    main()