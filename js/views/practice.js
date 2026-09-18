import { SHEET, buildPages, cellGlyph, practiceKanji } from "../practice.js";

const view = document.querySelector('#view-practice');
const input = document.querySelector('#practice-input');
const countEl = document.querySelector('#practice-count');
const printBtn = document.querySelector('#practice-print');
const blankBtn = document.querySelector('#practice-blank');
const preview = document.querySelector('#sheet-preview');
const printArea = document.querySelector('#print-area');

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

    const plural = pages.length === 1 ? '' : 's';
    countEl.textContent = chars.length === 0
        ? 'Kana, letters and spaces are skipped.'
        : `${chars.length} kanji · ${pages.length} page${plural}`;
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

    render();
}