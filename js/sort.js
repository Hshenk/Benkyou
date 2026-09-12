import { TYPE_LABELS } from "./card.js";
import { kanaText, tokenize } from "./tokenize.js";
import { splitTag, canonicalTag } from "./tags.js";

const jaCollator = new Intl.Collator('ja');
const enCollator = new Intl.Collator('en', { sensitivity: 'base' }); // currently unused, but left in case we later sort by english meaning

export const SORTS = [
    { id: 'default', label: 'Default', key: null },
    { id: 'added', label: 'Added', key: addedKey, defaultDir: -1 },
    { id: 'type', label: 'Type', key: typeKey },
    { id: 'level', label: 'Level', key: levelKey },
    { id: 'gojuon', label: 'Gojūon', key: kanaKey, collator: jaCollator },
    { id: 'accuracy', label: 'Accuracy', key: accuracyKey },
];

// Set up the order each N-level should sort to
const LEVELS = new Map();
LEVELS.set("N5", 0);
LEVELS.set("N4", 1);
LEVELS.set("N3", 2);
LEVELS.set("N2", 3);
LEVELS.set("N1", 4);

const LEVEL_NAMESPACE = 'Level';

function addedKey(card) {
    return card.createdAt ?? null;
}

function typeKey(card) {
    return TYPE_LABELS[card.type] ?? null;
}

function levelKey(card) {
    const levelTags = new Set();
    for (const tag of card.tags ?? []) {
        const { namespace, value } = splitTag(canonicalTag(tag));

        if (namespace === LEVEL_NAMESPACE) {
            const level = LEVELS.get(value) ?? null;
                if (level !== null) {
                levelTags.add(level);
            }
        }
    }
    return levelTags.size === 0 ? null : Math.min(...levelTags);
}

function accuracyKey(card) {
    if (!card.timesSeen) return null;

    const seen = card.timesSeen;
    const missed = card.timesMissed ?? 0;

    return (seen - missed) / seen;
}


function isKana(ch) {
    const code = ch.charCodeAt(0);
    return (code >= 0x3041 && code <= 0x309F) || code === 0x30FC;
}

function toHiragana(text) {
    return [...text].map(char => {
        const code = char.charCodeAt(0);
        // Check if character is in the standard Katakana range
        if (code >= 0x30A1 && code <= 0x30F6) {
            return String.fromCharCode(code - 0x60);
        }
        return char;
    }).join('');
}

function normalizeKana(text) {
    return toHiragana(text).replace(/[\s、。「」『』！？・…〜]/g, '');
}


function kanaOnly(text) {
    const out = [...normalizeKana(text)]
        .filter(character => isKana(character))
        .join('');
    return out !== '' ? out : null;
}

function kanaStrict(text) {
    let output = normalizeKana(text);
    if (output === '') return null;
    for (const character of output) {
        if (!isKana(character)) return null;
    }
    return output;
}

function kanaKey(card) {
    switch (card.type) {
        case 'vocab':
            {const trimmed = card.data.reading?.trim();
            if (!trimmed) return kanaStrict(kanaText(tokenize(card.data.expression)));
            return kanaOnly(trimmed) || kanaStrict(kanaText(tokenize(card.data.expression)));}
        case 'sentence':
            return kanaStrict(kanaText(tokenize(card.data.expression)));
        case 'grammar':
            return kanaStrict(kanaText(tokenize(card.data.expression)));
        case 'kanji':
            if (card.data.kunyomi?.length) {
                return kanaOnly(card.data.kunyomi[0]);
            } else if (card.data.onyomi?.length) {
                return kanaOnly(card.data.onyomi[0]);
            } else {
                return null;
            }
        default:
            return null;
    }
}

function compareKeys(a, b, collator) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (collator) {
        return collator.compare(String(a), String(b));
    }
    return (a < b) ? -1 : (a > b) ? 1 : 0;
}

export function sortCards(cards, sortId, direction = 1) {
    const entry = SORTS.find(u => u.id === sortId) ?? null;
    if (entry === null || entry.key === null) return direction === 1 ? [...cards] : [...cards].reverse();

    // 1. Decorate: call key exactly once per card
    const decorated = [];
    for (const card of cards) {
        decorated.push({ card, key: entry.key(card) })
    }

    // 2. Split into ones we can rank and the rest
    const ranked = decorated.filter(val => val.key !== null);
    const unranked = decorated.filter(val => val.key === null);

    // 3. Sort only the ranked group
    ranked.sort((a, b) => direction * compareKeys(a.key, b.key, entry.collator));

    // 4. Undecorate, unranked last regardless of direction
    return ranked.concat(unranked).map(d => d.card);
}