/**
 * kanji.js - This is the only file that directly access the kanji data in data/kanji.js
 */

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