/**
 * vocab.js - the only file that directly accesses the vocab data in data/vocab.js
 */
const vocabData = './data/vocab.js';

let sheetPromise = null;

export const CLASS_NAMESPACE = 'Class';

// Katakana -> Hiragana 
export function toHiragana(text) {
    return text.replace(/[ァ-ヶ]/g,
        (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export function loadVocabSheet() {
    sheetPromise ??= import(vocabData)
        .then(({ VOCAB }) => VOCAB.map(([word, reading, furigana, meaning, jlpt, pos]) => ({
            word, reading, furigana, meaning, jlpt, pos,
            kana: toHiragana(reading),
        })))
        .catch((err) => {
            console.warn('vocab data failed to load', err.message);
            sheetPromise = null;
            return null;
        });
    
    return sheetPromise;
}

/**
 * Up to 'limit' entries whose spelling or reading starts with 'query'
 */
export function searchVocab(sheet, query, limit = 8) {
    if (!query) return [];

    const kana = toHiragana(query);
    const found = [];

    for (const entry of sheet) {
        const exact = entry.word === query || entry.kana === kana;
        if (exact || entry.word.startsWith(query) || entry.kana.startsWith(kana)) {
            found.push({ entry, exact });
        }
    }

    found.sort((a, b) =>
        (b.exact - a.exact)
        || ((b.entry.jlpt ?? 0) - (a.entry.jlpt ?? 0))
        || (a.entry.kana.length - b.entry.kana.length));

    return found.slice(0, limit).map(({ entry }) => entry);
}

// --- Word Class ---

const CLASS_LABELS = {
    'n':      'Noun',
    'adj-no': 'Noun',
    'pn':     'Pronoun',
    'v1':     'Ru-verb',
    'v1-s':   'Ru-verb',
    'vk':     'Irregular Verb',
    'vs-i':   'Irregular Verb',
    'vs-s':   'Irregular Verb',
    'vz':     'Irregular Verb',
    'vs':     'する-verb',
    'adj-i':  'い-adjective',
    'adj-ix': 'い-adjective',
    'adj-na': 'な-adjective',
    'adj-pn': 'Pre-noun',
    'adv':    'Adverb',
    'adv-to': 'Adverb',
    'prt':    'Particle',
    'conj':   'Conjunction',
    'int':    'Interjection',
    'ctr':    'Counter',
    'num':    'Number',
    'exp':    'Expression',
    'pref':   'Prefix',
    'n-pref': 'Prefix',
    'suf':    'Suffix',
    'n-suf':  'Suffix',
};

function classLabel(code) {
    return code.startsWith('v5') ? 'U-verb' : CLASS_LABELS[code];
}

// The entry's classes, in JMdict's order 
export function classLabels(entry) {
    return [...new Set(entry.pos.map(classLabel).filter(Boolean))];
}

export function classTags(entry) {
    return classLabels(entry).map((label) => `${CLASS_NAMESPACE}: ${label}`);
}