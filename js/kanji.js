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