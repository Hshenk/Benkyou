/**
 * kanji.js - This is the only file that directly access the kanji data in data/kanji.js
 */
import { splitTag, canonicalTag } from './tags.js';
import { toHiragana } from './vocab.js';

const kanjiData = './data/kanji.js';

let sheetPromise = null;

export const LEVEL_NAMESPACE = 'Level'; // imported by sort.js

export function loadKanjiSheet() {
    sheetPromise ??= import(kanjiData)
        .then(({ KANJI }) => KANJI)
        .catch((err) => {
            console.warn('kanji data failed to load', err.message);
            sheetPromise = null;
            return null;
        });
    
    return sheetPromise;
}

export function levelTag(entry) {
    if (!entry?.jlpt) return null;
    return `${LEVEL_NAMESPACE}: N${entry.jlpt}`;
}

export function meaningText(entry) {
    return entry?.meanings?.join(', ') ?? '';
}

export function inTop2500(entry) {
    return entry?.freq != null;
}

// One of the 2, 136 Joyo kanji
export function inJoyo(entry) {
    return entry?.grade != null;
}

export function schoolGradeName(grade) {
    return grade === 'S' ? 'Secondary school' : `Grade ${grade}`;
}

export function schoolGradeShort(grade) {
    return grade === 'S' ? '中学' : `${grade}年`;
}

// A card's easiest tagged JLPT Level (5-1)
export function cardLevel(card) {
    let easiest = null;

    for (const tag of card.tags ?? []) {
        const { namespace, value } = splitTag(canonicalTag(tag));
        if (namespace !== LEVEL_NAMESPACE) continue;

        const match = /^N([1-5])$/.exec(value);
        if (match) easiest = Math.max(easiest ?? 0, Number(match[1]));
    }

    return easiest;
}

// --- Search by reading ---
function readingKey(reading) {
    return toHiragana(reading.replace(/[.-]/g, ''));
}

let readingIndex = null;

export function searchKanjiByReading(sheet, query, owned = new Set(), limit = 10) {
    const key = toHiragana(query);
    if (!key) return [];

    readingIndex ??= Object.entries(sheet).map(([char, entry]) => ({
        char,
        entry,
        readings: [...entry.on, ...entry.kun].map((text) => ({ text, key: readingKey(text) })),
    }));

    const found = [];

    for (const { char, entry, readings } of readingIndex) {
        const matched = readings.filter((r) => r.key.startsWith(key));
        if (matched.length === 0) continue;

        found.push({
            char,
            entry,
            matched: matched.map((r) => r.text),
            exact: matched.some((r) => r.key === key),
            owned: owned.has(char),
        });
    }

    const rank = (entry) => entry.freq ?? 2501;

    found.sort((a, b) =>
        (b.exact - a.exact)
        || (b.owned - a.owned)
        || (rank(a.entry) - rank(b.entry)));
    
    return found.slice(0, limit);
}