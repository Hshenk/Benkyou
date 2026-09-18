/**
 * practice.js - the layout of kanji practice sheets
 * The sheets are drawn in an SVG
 */

// US Letter 
const PAPER = { width: 215.9, height: 279.4 };
const MARGIN = 12.7;
const HEADER = 12;

const COLUMNS = 10;
const CELL = (PAPER.width - 2 * MARGIN) / COLUMNS; // 19.05
const ROWS = Math.floor((PAPER.height - 2 * MARGIN - HEADER) / CELL); // 12

// Everything the drawing code needs to know about a page
export const SHEET = {
    width: PAPER.width,
    height: PAPER.height,
    margin: MARGIN,
    columns: COLUMNS,
    cell: CELL,
    rows: ROWS,
    gridLeft: MARGIN,
    gridTop: MARGIN + HEADER,
}

// How many squares after the example hold a ghost to trace
export const GHOSTS = 7;

const ROWS_PER_KANJI = 3;
const KANJI_PER_PAGE = Math.floor(ROWS / ROWS_PER_KANJI);

const KANJI = /\p{Script=Han}/gu;

export function practiceKanji(text) {
    return [...new Set(text.match(KANJI) ?? [])];
}

// Three kinds of rows per kanji.
function kanjiRows(char) {
    return [
        { kind: 'trace', char },
        { kind: 'guided' },
        { kind: 'free' },
    ];
}

function fillPage(chars) {
    const rows = chars.flatMap(kanjiRows);
    while (rows.length < ROWS) rows.push({ kind: 'guided' });
    return { chars, rows };
}


/**
 * Split kanji into pages
 * If no kanji, it gives a blank page of guided rows
 */
export function buildPages(chars) {
    if (chars.length === 0) return [fillPage([])];

    const pages = [];
    for (let i = 0; i < chars.length; i += KANJI_PER_PAGE) {
        pages.push(fillPage(chars.slice(i, i + KANJI_PER_PAGE)));
    }
    return pages;
}

// What to draw in one square of a row
export function cellGlyph(row, column) {
    if (row.kind !== 'trace') return null;
    if (column === 0) return 'model';
    if (column <= GHOSTS) return 'ghost';
    return null;
}