"""
build-vocab.py - Regenerates js/data/vocab.js, Benkyou's vocab datasheet.

Download these into one folder first:

  jmdict-eng-*.json.zip  https://github.com/scriptin/jmdict-simplified/releases/latest
                         (the full "jmdict-eng" file, not "jmdict-eng-common")
  n1.csv ... n5.csv      https://github.com/jamsinclair/open-anki-jlpt-decks/tree/main/src

Then, from the repo root:

  py tools/build-vocab.py path/to/that/folder

Add -v at the end to list the JLPT rows that were left out.

The sheet is every word on a JLPT list, plus every other word JMdict marks as common.
A JLPT row is only kept if it matches a JMdict entry, so every word in the sheet has
a checked reading and part of speech. The script asserts that nearly every JLPT row
matches and that nearly every word's furigana lines up. If either upstream source
changes shape, those are the assertions that will fail.
"""
import collections, csv, html, itertools, json, re, sys, zipfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
OUT = Path(__file__).resolve().parent.parent / "js" / "data" / "vocab.js"

MAX_GLOSSES = 3  # English glosses kept from JMdict's first sense


# --- Kana helpers ---

def is_kana(ch):
    # Hiragana, katakana and ー. ヵ/ヶ (一ヶ月) and 々 belong to the kanji around them.
    return ("ぁ" <= ch <= "ゖ" or "ァ" <= ch <= "ヺ" or ch == "ー") and ch not in "ヵヶ"


def hira(text):
    # Katakana -> hiragana, one character for one, so indexes still line up
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)


def all_kana(text):
    return all(is_kana(c) for c in text)


def furigana(word, reading):
    """
    '食べる', 'たべる' -> '食[た]べる' in Benkyou's notation: one [reading] per kanji
    block, and a space before every block that doesn't start the word, because the
    tokenizer takes everything back to the last space as the base.
    Returns None if the kana in the word can't be found in the reading.
    """
    if all_kana(word):
        return word

    runs = ["".join(group) for _, group in itertools.groupby(word, is_kana)]
    pattern = "".join(re.escape(hira(run)) if is_kana(run[0]) else "(.+?)" for run in runs)
    match = re.fullmatch(pattern, hira(reading))
    if not match:
        return None

    out, group = [], 0
    for i, run in enumerate(runs):
        if is_kana(run[0]):
            out.append(run)
            continue
        group += 1
        start, end = match.span(group)
        out.append((" " if i > 0 else "") + f"{run}[{reading[start:end]}]")
    return "".join(out)


# --- JMdict ---

archive = next((p for p in SRC.glob("jmdict-eng*.json.zip") if "common" not in p.name), None)
assert archive, f"need the full jmdict-eng-*.json.zip in {SRC}"
with zipfile.ZipFile(archive) as z:
    jmdict = json.loads(z.read(z.namelist()[0]))
dict_date = jmdict["dictDate"]
simplified_version = jmdict["version"]
entries = jmdict["words"]

by_form = collections.defaultdict(list)  # (written form, hiragana reading) -> entries
for e in entries:
    for kana in e["kana"]:
        by_form[(kana["text"], hira(kana["text"]))].append(e)
        for k in e["kanji"]:
            if "*" in kana["appliesToKanji"] or k["text"] in kana["appliesToKanji"]:
                by_form[(k["text"], hira(kana["text"]))].append(e)


def is_common(e):
    return any(f["common"] for f in e["kanji"] + e["kana"])


def usually_kana(e):
    # No kanji, marked "usually kana", or only rare kanji spellings (嗚呼 for ああ)
    return (not any(k["common"] for k in e["kanji"]) and any(k["common"] for k in e["kana"])
            or not e["kanji"] or "uk" in e["sense"][0]["misc"])


def senses_for(e, word, reading):
    """The senses that apply to this spelling and reading, in JMdict's order."""
    def applies(listed, form):
        return "*" in listed or form in listed
    return [s for s in e["sense"]
            if (all_kana(word) or applies(s["appliesToKanji"], word))
            and applies(s["appliesToKana"], reading)]


STOPWORDS = {"a", "an", "and", "as", "at", "be", "by", "etc", "for", "in", "is", "of",
             "on", "one", "or", "someone", "something", "the", "to", "with"}


def english_words(text):
    return set(re.findall(r"[a-z]+", text.lower())) - STOPWORDS


def overlap(sense, meaning):
    """How many English words a sense shares with a JLPT list's meaning."""
    return len(english_words(" ".join(g["text"] for g in sense["gloss"])) & english_words(meaning))


def pos_codes(e, word, reading, meaning=""):
    """
    The first sense's part-of-speech codes. Given a JLPT list's meaning, also the codes
    of the sense closest to it: 点 "counter for scores" is n (first sense) + ctr.
    """
    senses = senses_for(e, word, reading) or e["sense"]
    codes = list(senses[0]["partOfSpeech"])
    if meaning:
        closest = max(senses, key=lambda s: overlap(s, meaning))
        codes += [c for c in closest["partOfSpeech"] if c not in codes]
    return codes


def gloss_text(e, word, reading):
    senses = senses_for(e, word, reading) or e["sense"]
    return ", ".join(g["text"] for g in senses[0]["gloss"][:MAX_GLOSSES])


def find_entry(word, reading, meaning=""):
    """
    The JMdict entry for a spelling + reading, or None. Prefers common entries, then
    for kana spellings entries usually written in kana, then the entry whose English
    is closest to the list's meaning: ああ "Ah!, Oh!" is the interjection, not the
    adverb "like that".
    """
    found = by_form.get((word, hira(reading)), [])
    if not found:
        return None
    return min(found, key=lambda e: (not is_common(e),
                                     all_kana(word) and not usually_kana(e),
                                     -max(overlap(s, meaning) for s in e["sense"]),
                                     int(e["id"])))


# --- JLPT lists ---

def clean(text):
    """'(花を〜) 生ける, 活ける' -> ['生ける', '活ける']. Drops notes and ～ affix marks."""
    text = re.sub(r"\([^)]*\)|（[^）]*）", "", text)
    text = re.sub(r"[～〜~]", "", text)
    return [part.strip() for part in re.split(r"[,、，;；\s]", text) if part.strip()]


def clean_meaning(text):
    """'to protect someone, to&nbsp;&nbsp;cover up,' -> 'to protect someone, to cover up'"""
    text = re.sub(r"\s+", " ", html.unescape(text))
    return text.strip().rstrip(",;").strip()


def attempts(spellings, readings):
    """
    Groups of spelling + reading pairs to look up, as written first. Then two fixes
    for rows the lists write differently from JMdict: a trailing する/な/と that
    JMdict leaves off (運動 うんどうする, 生意気な, ゆっくりと), and swapped columns
    (いただく 頂く). The first group with any match is used, all of its matches.
    """
    pairs = [(w, r) for w in spellings for r in readings]
    yield pairs
    yield [(w.removesuffix(ending), r.removesuffix(ending))
           for w, r in pairs for ending in ("する", "な", "と")
           if r.endswith(ending) and len(r) > len(ending)]
    yield [(r, w) for w, r in pairs if all_kana(w) and not all_kana(r)]


jlpt_rows = []  # (level, [spellings], [readings], meaning)
for level in range(1, 6):
    with open(SRC / f"n{level}.csv", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) > 500, f"n{level}.csv has only {len(rows)} rows"
    for row in rows:
        spellings = clean(row["expression"])
        readings = clean(row["reading"]) or spellings
        if spellings:
            jlpt_rows.append((level, spellings, readings, clean_meaning(row["meaning"])))

words = {}        # (word, reading) -> row dict
covered = set()   # (JMdict id, hiragana reading) already in the sheet
unmatched = []

for level, spellings, readings, meaning in jlpt_rows:
    # Every spelling + reading the row lists: 何 なん/なに, 毎月 まいげつ/まいつき
    hits = next((found for group in attempts(spellings, readings)
                 if (found := [(w, r, e) for w, r in group if (e := find_entry(w, r, meaning))])), [])

    if not hits:
        # Mostly typos and bare affixes (副 とりわけ, 蒸す ふす, ～光 こう): leave them out
        unmatched.append(f"N{level} {' '.join(spellings)} {' '.join(readings)}")
        continue

    for word, reading, e in hits:
        # JMdict's own kana for the reading: the list may write カ where JMdict has か
        kana = [k["text"] for k in e["kana"]]
        reading = reading if reading in kana else next(k for k in kana if hira(k) == hira(reading))
        covered.add((e["id"], hira(reading)))

        key = (word, reading)
        if key in words:
            # On two lists: keep the easier level (N5 = 5)
            words[key]["jlpt"] = max(words[key]["jlpt"], level)
        else:
            words[key] = {"word": word, "reading": reading, "meaning": meaning,
                          "jlpt": level, "pos": pos_codes(e, word, reading, meaning)}

jlpt_count = len(words)
match_rate = 1 - len(unmatched) / len(jlpt_rows)
assert match_rate >= 0.95, f"only {match_rate:.1%} of JLPT rows matched JMdict"


# --- JMdict common words that aren't on a JLPT list ---

for e in entries:
    if not is_common(e):
        continue

    if usually_kana(e):
        headword = None
        readings = [k for k in e["kana"] if k["common"]] or e["kana"][:1]
    else:
        headword = next((k for k in e["kanji"] if k["common"]), e["kanji"][0])["text"]
        readings = [k for k in e["kana"] if k["common"]
                    and ("*" in k["appliesToKanji"] or headword in k["appliesToKanji"])]

    for kana in readings:
        reading = kana["text"]
        word = headword or reading
        if (e["id"], hira(reading)) in covered or (word, reading) in words:
            continue
        covered.add((e["id"], hira(reading)))
        words[(word, reading)] = {"word": word, "reading": reading,
                                  "meaning": gloss_text(e, word, reading),
                                  "jlpt": None, "pos": pos_codes(e, word, reading)}

common_count = len(words) - jlpt_count


# --- Furigana ---

misaligned = []
for w in words.values():
    notation = furigana(w["word"], w["reading"])
    if notation is None:
        misaligned.append(f"{w['word']} {w['reading']}")
        notation = f"{w['word']}[{w['reading']}]"
    w["furigana"] = notation

assert len(misaligned) / len(words) < 0.01, f"{len(misaligned)} words failed furigana alignment"


# --- Write ---

order = sorted(words.values(),
               key=lambda w: (-(w["jlpt"] or 0), hira(w["reading"]), w["word"]))

per_level = collections.Counter(w["jlpt"] for w in order)

lines = [
    "/**",
    " * vocab.js - Benkyou's vocab datasheet. GENERATED by tools/build-vocab.py, do not edit by hand.",
    " *",
    f" * {len(order)} words: every word on a JLPT list ({jlpt_count}), then every other word",
    f" * JMdict marks as common ({common_count}). N5 first, then by reading within a level.",
    " *",
    " * One row per spelling + reading:",
    " *   [word, reading, furigana, meaning, jlpt, pos]",
    " *",
    " *   word      the spelling: 食べる (kana for words usually written in kana)",
    " *   reading   the kana reading: たべる",
    " *   furigana  Benkyou's notation: 食[た]べる",
    " *   meaning   the JLPT list's gloss, or JMdict's first sense for common words",
    " *   jlpt      5-1 for N5-N1, null = on no list (unofficial lists; there is no official one)",
    " *   pos       JMdict part-of-speech codes: v1, v5k, v5k-s, adj-i, adj-na, n, vs ...",
    " *             From the first sense, plus the sense matching the JLPT list's meaning.",
    " *",
    " * Sources:",
    f" *   JMdict ({dict_date}), © Electronic Dictionary Research and Development Group,",
    " *     CC BY-SA 4.0 - https://www.edrdg.org/edrdg/licence.html",
    f" *     via github.com/scriptin/jmdict-simplified {simplified_version}",
    " *   JLPT levels and meanings: Jonathan Waller's JLPT lists (tanos.co.uk), CC BY, via",
    " *     github.com/jamsinclair/open-anki-jlpt-decks (MIT)",
    " */",
    f"export const JMDICT_VERSION = '{dict_date}';",
    "",
    "export const VOCAB = [",
]
for w in order:
    row = [w["word"], w["reading"], w["furigana"], w["meaning"], w["jlpt"], w["pos"]]
    lines.append("  " + json.dumps(row, ensure_ascii=False, separators=(",", ":")) + ",")
lines.append("];")

text = "\n".join(lines) + "\n"
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(text, encoding="utf-8", newline="\n")

print(f"JMdict {dict_date}: wrote {len(order)} words to {OUT}")
print(f"  {jlpt_count} from JLPT lists ("
      + ", ".join(f"N{n} {per_level[n]}" for n in range(5, 0, -1))
      + f"), {common_count} more common words")
print(f"  JLPT rows matched to JMdict: {match_rate:.1%} ({len(unmatched)} unmatched and left out; -v lists them)")
print(f"  Furigana alignment failures: {len(misaligned)} (kept as one block)")
print(f"  {len(text.encode()):,} bytes")
if "-v" in sys.argv:
    print("\nUnmatched:", *unmatched, sep="\n  ")
    print("\nMisaligned:", *misaligned, sep="\n  ")
