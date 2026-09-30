import { SHEET, buildPages, cellGlyph, practiceKanji } from "../practice.js";
import { loadKanjiSheet, searchKanjiByReading, meaningText } from "../kanji.js";
import { getCards, getPractice, addPractice, onChange } from "../storage.js";
import { syncPractice } from "../sync.js";
import { localDay } from "../stats.js";
import { initCombobox } from "../combobox.js";
import { replaceSelection } from "../notation.js";


const view = document.querySelector('#view-practice');
const input = document.querySelector('#practice-input');
const countEl = document.querySelector('#practice-count');
const printBtn = document.querySelector('#practice-print');
const blankBtn = document.querySelector('#practice-blank');
const preview = document.querySelector('#sheet-preview');
const printArea = document.querySelector('#print-area');
const suggestList = document.querySelector('#practice-suggestions');
const recordBtn = document.querySelector('#practice-record');
const logEl = document.querySelector('#practice-log');


const SVG_NS = 'http://www.w3.org/2000/svg';

const GLYPH_SIZE = SHEET.cell * 0.8;

// Create an SVG element with attributes and optionally text
function svgEl(tag, attrs = {}, text = null) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value);
    }
    if (text !== null) el.textContent = text;
    return el;
}

// The dashed cross through a square
function drawGuides(x, y) {
    const half = SHEET.cell / 2;
    return [
        svgEl('line', { class: 'sheet__guide', x1: x + half, y1: y, x2: x + half, y2: y + SHEET.cell }),
        svgEl('line', { class: 'sheet__guide', x1: x, y1: y + half, x2: x + SHEET.cell, y2: y + half }),
    ];
}

// Draw a kanji centered in a square at (x, y)
function drawGlyph(char, style, x, y) {
    const half = SHEET.cell / 2;
    return svgEl('text', {
        class: `sheet__${style}`,
        x: x + half,
        y: y + half,
        'font-size': GLYPH_SIZE,
        'text-anchor': 'middle',
        'dominant-baseline' : 'central',
    }, char);
}

// One row of squares with its top edge at 'y'
function drawRow(row, y) {
    const group = svgEl('g', { class: `sheet__row sheet__row--${row.kind}` });

    for (let column = 0; column < SHEET.columns; column++) {
        const x = SHEET.gridLeft + column * SHEET.cell;

        if (row.kind !== 'free') group.append(...drawGuides(x, y));

        const style = cellGlyph(row, column);
        if (style) group.append(drawGlyph(row.char, style, x, y));

        group.append(svgEl('rect', {
            class: 'sheet__cell', x, y, width: SHEET.cell, height: SHEET.cell,
        }));
    }

    return group;
}

/** Title strip: 漢字練習, the kanji, and page number */
function drawHeader(page, number, total) {
    const y = SHEET.margin + (SHEET.gridTop - SHEET.margin) / 2;
    const group = svgEl('g', { class: 'sheet_header' });

    const title = ['漢字練習', ...page.chars].join('　');
    group.append(svgEl('text', {
        class: 'sheet__title', x: SHEET.gridLeft, y, 'dominant-baseline': 'central',
    }, title));

    if (total > 1) {
        group.append(svgEl('text', {
            class: 'sheet__meta',
            x: SHEET.width - SHEET.margin,
            y,
            'text-anchor': 'end',
            'dominant-baseline': 'central',
        }, `${number} / ${total}`));
    }

    return group;
}

// One sheet of paper as an svg
function drawPage(page, number, total) {
    const label = page.chars.length > 0
        ? `Practice sheet for ${page.chars.join(', ')}`
        : 'Blank practice sheet';
    
    const svg = svgEl('svg', {
        class: 'sheet-page',
        viewBox: `0 0 ${SHEET.width} ${SHEET.height}`,
        role: 'img',
        'aria-label': total > 1 ? `${label}, page ${number} of ${total}` : label,
    });

    svg.append(drawHeader(page, number, total));

    page.rows.forEach((row, i) => {
        svg.append(drawRow(row, SHEET.gridTop + i * SHEET.cell));
    });

    return svg;
}

function drawPages(pages) {
    return pages.map((page, i) => drawPage(page, i + 1, pages.length));
}

function render() {
    const chars = practiceKanji(input.value);
    const pages = buildPages(chars);

    preview.replaceChildren(...drawPages(pages));
    printBtn.disabled = chars.length === 0;

    const recorded = chars.length > 0 && input.value === recordedText;
    recordBtn.disabled = chars.length === 0 || recorded;
    recordBtn.textContent = recorded ? 'Recorded' : 'Record practice';

    const plural = pages.length === 1 ? '' : 's';
    countEl.textContent = chars.length === 0
        ? 'Type kanji, or a reading in kana to look one up.'
        : `${chars.length} kanji · ${pages.length} page${plural}`;
}

// --- Finding kanji by reading ---

// Kana at the end of a string. ー is listed on its own: Unicode files it under
// neither script, since both use it.
const KANA_RUN = /[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;

// The kana just before the cursor
function kanaBeforeCursor() {
    const end = input.selectionStart;
    const match = KANA_RUN.exec(input.value.slice(0, end));
    return match ? { text: match[0], start: match.index, end } : null;
}

// Characters of kanji cards
function ownedKanji() {
    return new Set(getCards()
        .filter((card) => card.type === 'kanji')
        .map((card) => card.data?.character?.trim()));
}

async function kanjiMatches() {
    const kana = kanaBeforeCursor();
    if (!kana) return [];

    const sheet = await loadKanjiSheet();
    if (!sheet) return [];

    return searchKanjiByReading(sheet, kana.text, ownedKanji());
}

function fillKanjiRow(row, { char, entry, matched, owned }) {
    row.title = meaningText(entry);

    const glyph = document.createElement('span');
    glyph.className = 'suggest__word';
    glyph.lang = 'ja';
    glyph.textContent = char;

    const readings = document.createElement('span');
    readings.className = 'suggest__reading';
    readings.lang = 'ja';
    readings.textContent = matched.join('、');

    const meaning = document.createElement('span');
    meaning.className = 'suggest__meaning';
    meaning.textContent = meaningText(entry);

    const meta = document.createElement('span');
    meta.className = 'suggest__meta';
    meta.textContent = [entry.jlpt ? `N${entry.jlpt}` : '', owned ? 'in your cards' : '']
        .filter(Boolean)
        .join(' · ');

    row.append(glyph, readings, meaning, meta);
}

// Swap the kana before the cursor
function pickKanji({ char }) {
    const kana = kanaBeforeCursor();
    if (!kana) return;

    input.setSelectionRange(kana.start, kana.end);
    replaceSelection(input, char);
}

// --- Recording Practice ---

// the field's text the last time Record was pressed
let recordedText = null;

function recordPractice() {
    const kanji = practiceKanji(input.value);
    if (kanji.length === 0) return;

    addPractice({
        id: crypto.randomUUID(),
        practicedAt: new Date().toISOString(),
        kanji,
    });

    recordedText = input.value;
    render();
    syncPractice();
}

// "Practiced today: 食×2 飲", from every record made today
function renderLog() {
    const today = localDay(new Date());
    const counts = new Map();

    for (const record of getPractice()) {
        if (localDay(record.practicedAt) !== today) continue;
        for (const char of record.kanji) counts.set(char, (counts.get(char) ?? 0) + 1);
    }

    if (counts.size === 0) {
        logEl.replaceChildren();
        return;
    }

    const kanji = document.createElement('span');
    kanji.lang = 'ja';
    kanji.textContent = [...counts]
        .map(([char, n]) => (n > 1 ? `${char}×${n}` : char))
        .join(' ');

    logEl.replaceChildren('Practiced today: ', kanji);
}

// --- Printing ---
let savedTitle = null;

// A filename for save as PDF
function sheetTitle(chars) {
    if (chars.length === 0) return 'Kanji practice - blank';
    return `Kanji practice ${chars.slice(0, 12).join('')}`;
}

function preparePrint(chars) {
    printArea.replaceChildren(...drawPages(buildPages(chars)));
    savedTitle ??= document.title;
    document.title = sheetTitle(chars);
}

// undo preparePrint when the dialog closes
function finishPrint() {
    printArea.replaceChildren();
    if (savedTitle !== null) document.title = savedTitle;
    savedTitle = null;

    blankBtn.disabled = false;
    render();
}

async function loadSheetFonts(chars) {
    if (chars.length === 0) return;

    const text = chars.join('');
    try {
        await Promise.all([
            document.fonts.load('40px KanjiStrokeOrders', text),
            document.fonts.load('40px "Klee One"', text),
        ]);
    } catch (err) {
        console.warn('Practice sheet fonts did not load', err);
    }
}

async function printSheet(chars) {
    printBtn.disabled = true;
    blankBtn.disabled = true;

    preparePrint(chars);
    await loadSheetFonts(chars);
    window.print();
}

export function initPractice() {
    input.addEventListener('input', render);

    printBtn.addEventListener('click', () => printSheet(practiceKanji(input.value)));
    blankBtn.addEventListener('click', () => printSheet([]));

    window.addEventListener('beforeprint', () => {
        if (view.hidden || printArea.childElementCount > 0) return;
        preparePrint(practiceKanji(input.value));
    });

    window.addEventListener('afterprint', finishPrint);

    // --- Finding kanji by reading ---
    input.addEventListener('focus', () => {
        loadKanjiSheet();
    });

    initCombobox({
        input,
        list: suggestList,
        search: kanjiMatches,
        renderRow: fillKanjiRow,
        onPick: pickKanji,
        autoSelect: true,
    });

    // --- Recording practice ---
    recordBtn.addEventListener('click', recordPractice);
    onChange(renderLog);
    renderLog();
    render();
}