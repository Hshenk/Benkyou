import { TYPE_LABELS, questionMarkup, detailsFor } from "../card.js";
import { renderJapanese } from '../render.js';
import { getCards, recordStudy, addSession, onChange } from "../storage.js";
import { toggleScript } from "../script-toggle.js";
import { canonicalTag, splitTag } from "../tags.js";

// --- Study Selection ---
const facetsEl = document.querySelector('#facets');
const poolCount = document.querySelector('#pool-count');
const startBtn = document.querySelector('#start-study');
const clearBtn = document.querySelector('#clear-facets');
const facetTemplate = document.querySelector('#facet-template');
const optionTemplate = document.querySelector('#option-template');

const selection = new Map();

function valuesFor(card, namespace) {
    if (namespace === 'Type') return new Set([TYPE_LABELS[card.type]]);

    const out = new Set();
    for (const tag of card.tags ?? []) {
        const { namespace: ns, value } = splitTag(canonicalTag(tag));
        if (ns === namespace) out.add(value);
    }
    return out;
}

function buildFacets(cards) {
    const facets = new Map();

    facets.set('Type', new Map());
    
    for (const card of cards) {
        const typeLabel = TYPE_LABELS[card.type];
        const types = facets.get('Type');
        types.set(typeLabel, (types.get(typeLabel) ?? 0) + 1);

        const seen = new Set();

        for (const tag of card.tags ?? []) {
            const canon = canonicalTag(tag);
            if (seen.has(canon)) continue;
            seen.add(canon); 

            const { namespace, value } = splitTag(canon);
            if (!namespace) continue;

            if (!facets.has(namespace)) facets.set(namespace, new Map());
            const values = facets.get(namespace);
            values.set(value, (values.get(value) ?? 0) + 1);
        }
    }
    return facets;
}

function buildPool(cards, chosenBy) {
    return cards.filter((card) => {
        for (const [namespace, chosen] of chosenBy) {
            if (chosen.size === 0) continue;

            const cardValues = valuesFor(card, namespace);
            const matches = [...chosen].some((v) => cardValues.has(v));

            if (!matches) return false;
        }
        return true;
    });
}

function facetLabels() {
    const out = [];
    for (const [namespace, chosen] of selection) {
        for (const value of chosen) out.push(`${namespace}: ${value}`);
    }
    return out.sort();
}

function renderFacets(cards) {
    const facets = buildFacets(cards);

    // Drop anything selected that no longer exists 
    for (const [namespace, chosen] of selection) {
        const values = facets.get(namespace);
        if (!values) { selection.delete(namespace); continue; }
        for (const value of chosen) {
            if (!values.has(value)) chosen.delete(value);
        }
    }

    const fragment = document.createDocumentFragment();

    for (const [namespace, values] of facets) {
        if (!selection.has(namespace)) selection.set(namespace, new Set());

        const node = facetTemplate.content.firstElementChild.cloneNode(true);
        node.dataset.namespace = namespace;
        node.querySelector('[data-field="name"]').textContent = namespace;

        const optionsBox = node.querySelector('[data-field="options"]');

        for (const value of [...values.keys()].sort()) {
            const option = optionTemplate.content.firstElementChild.cloneNode(true);
            option.dataset.namespace = namespace;
            option.dataset.value = value;
            option.querySelector('[data-field="label"]').textContent = value;
            option.querySelector('.option__input').checked = selection.get(namespace).has(value);
            optionsBox.append(option);
        }

        fragment.append(node);
    }

    facetsEl.replaceChildren(fragment);
    updateFacetUI();
}

/**
 * How many cards this option would contribute 
 */
function countFor(namespace, value) {
    const others = new Map(selection);
    others.delete(namespace);

    return buildPool(getCards(), others)
        .filter((card) => valuesFor(card, namespace).has(value))
        .length;
}

// Patch the rendered facets in place
function updateFacetUI() {
    for (const option of facetsEl.querySelectorAll('.option')) {
        const { namespace, value } = option.dataset;
        const input = option.querySelector('.option__input');
        const n = countFor(namespace, value);

        option.querySelector('[data-field="count"]').textContent = n;
        input.disabled = n === 0 && !input.checked;
    }

    for (const facet of facetsEl.querySelectorAll('.facet')) {
        const chosen = selection.get(facet.dataset.namespace);
        facet.querySelector('[data-field="selected"]').textContent = 
            chosen.size ? `${chosen.size} selected` : ''
    }

    const pool = buildPool(getCards(), selection);
    poolCount.textContent = `${pool.length} ${pool.length === 1 ? 'card' : 'cards'}`;
    startBtn.disabled = pool.length === 0;
}

// --- Study Session ---
const stages = document.querySelectorAll('.stage');
const cardFace = document.querySelector('#card-face');
const faceQuestion = document.querySelector('#face-question');
const faceBack = document.querySelector('#face-back');
const faceMeaning = document.querySelector('#face-meaning');
const faceDetails = document.querySelector('#face-details');
const faceNotes = document.querySelector('#face-notes');
const gradeBar = document.querySelector('.grade-bar');
const revealBtn = document.querySelector('#reveal-btn');
const progressFill = document.querySelector('#progress-fill');
const progressEl = document.querySelector('#progress');
const sessionCount = document.querySelector('#session-count');

const MISS_LIMIT = 3;

let session = null;

function showStage(name) {
    for (const stage of stages) {
        stage.hidden = stage.id !== `stage-${name}`;
    }
}

function shuffle(items) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function startSession(cards) {
    if (cards.length === 0) return;

    session = {
        queue: shuffle(cards),
        total: cards.length,
        current: null,
        done: new Set(),
        skipped: new Set(),
        misses: new Map(),
        first: new Map(),
        startedAt: new Date().toISOString(),
        lastGradedAt: null,
        facets: facetLabels(),
        flushed: false,
    };

    showStage('session');
    nextCard();
}

function nextCard() {
    session.current = session.queue.shift() ?? null;

    if (!session.current) {
        endSession();
        return;
    }

    const card = session.current;

    cardFace.dataset.type = card.type;
    cardFace.dataset.furigana = 'hidden';

    renderJapanese(faceQuestion, questionMarkup(card));

    faceBack.hidden = true;
    revealBtn.hidden = false;
    for (const btn of gradeBar.querySelectorAll('[data-grade]:not(#reveal-btn)')) {
        btn.hidden = true;
    }

    updateProgress();
}

function revealAnswer() {
    if (!session?.current || !faceBack.hidden) return;

    const card = session.current;

    cardFace.dataset.furigana = 'shown';

    faceMeaning.textContent = card.meaning;
    faceNotes.textContent = card.notes ?? '';

    const rows = detailsFor(card).filter(([, value]) => value !== undefined && value !== '');
    faceDetails.replaceChildren();
    for (const [label, value] of rows) {
        const dt = document.createElement('dt');
        dt.textContent = label;

        const dd = document.createElement('dd');
        dd.lang = 'ja';
        renderJapanese(dd, String(value));

        faceDetails.append(dt, dd);
    }

    // Font comparison 
    const compare = document.querySelector('#glyph-compare');
    const isKanji = card.type === 'kanji';
    compare.hidden = !isKanji;

    if (isKanji) {
        for (const glyph of compare.querySelectorAll('.glyph')) {
            glyph.textContent = card.data.character;
        }
    }

    faceBack.hidden = false;
    revealBtn.hidden = true;

    gradeBar.querySelector('[data-grade="missed"]').hidden = false;
    gradeBar.querySelector('[data-grade="work"]').hidden = false;
    gradeBar.querySelector('[data-grade="easy"]').hidden = false;

    const misses = session.misses.get(card.id) ?? 0;
    gradeBar.querySelector('[data-grade="skip"]').hidden = misses < MISS_LIMIT;
}

function grade(result) {
    if (!session?.current || faceBack.hidden) return;

    const card = session.current;

    if (!session.first.has(card.id)) {
        session.first.set(card.id, result === 'skip' ? 'missed' : result);
    }

    session.lastGradedAt = new Date().toISOString();

    if (result === 'missed') {
        session.misses.set(card.id, (session.misses.get(card.id) ?? 0) + 1);
        requeue(card);
    } else if (result === 'skip') {
        session.skipped.add(card.id);
    } else {
        session.done.add(card.id);
    }

    nextCard();
}

function requeue(card) {
    const offset = 5 + Math.floor(Math.random() * 11);
    session.queue.splice(Math.min(offset, session.queue.length), 0, card);
}

function updateProgress() {
    const settled = session.done.size + session.skipped.size;
    const percent = Math.round((settled / session.total) * 100);

    progressFill.style.width = `${percent}%`;
    progressEl.setAttribute('aria-valuenow', percent);
    sessionCount.textContent = `${settled} / ${session.total}`;
}

function endSession() {
    flushStats();

    const grades = [...session.first.values()];

    document.querySelector('#summary-total').textContent = session.total;
    document.querySelector('#summary-easy').textContent =
        grades.filter((g) => g === 'easy').length;
    document.querySelector('#summary-work').textContent =
        grades.filter((g) => g === 'work').length;
    document.querySelector('#summary-missed').textContent = session.misses.size;
    document.querySelector('#summary-skipped').textContent = session.skipped.size;

    document.querySelector('#restudy-missed').disabled = session.misses.size === 0;
    showStage('summary');
}


export function initStudy() {
    // --- Selection ---
    facetsEl.addEventListener('change', (event) => {
        const input = event.target;
        if (!input.matches('.option__input')) return;

        const { namespace, value } = input.closest('.option').dataset;
        const chosen = selection.get(namespace);

        if (input.checked) chosen.add(value);
        else chosen.delete(value);

        updateFacetUI();
    });

    clearBtn.addEventListener('click', () => {
        for (const chosen of selection.values()) chosen.clear();
        for (const input of facetsEl.querySelectorAll('.option__input')) input.checked = false;
        updateFacetUI();
    });

    startBtn.addEventListener('click', () => {
    startSession(buildPool(getCards(), selection));
    });

    // --- Session ---
    gradeBar.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-grade]');
        if (!btn) return;

        if (btn.dataset.grade === 'reveal') revealAnswer();
        else grade(btn.dataset.grade);
    });

    document.querySelector('#quit-study').addEventListener('click', quitSession);
    document.querySelector('#back-to-select').addEventListener('click', () => showStage('select'));

    document.querySelector('#restudy-missed').addEventListener('click', () => {
        const missedIds = new Set(session.misses.keys());
        startSession(getCards().filter((card) => missedIds.has(card.id)));
    });

    // --- Keyboard ---
    document.addEventListener('keydown', (event) => {
        if (document.querySelector('#stage-session').hidden) return;

        if (event.target.closest('input, textarea, select')) return;
        if (event.isComposing) return;

        if (event.repeat) return;

        switch(event.key) {
            case ' ':
                event.preventDefault();
                if (faceBack.hidden) revealAnswer();
                break;
            case '1':
                grade('missed');
                break;
            case '2':
                grade('work');
                break;
            case '3':
                grade('easy');
                break;
            case 'f':
                toggleScript();
                break;
            case 'Escape':
                quitSession();
                break;
        }
    });

    // --- Start ---
    onChange(() => {
        // Never rebuild mid-session
        if (document.querySelector('#stage-select').hidden) return;
        renderFacets(getCards());
    });

    renderFacets(getCards());
}

function flushStats() {
    if (!session || session.flushed) return;
    session.flushed = true;

    const results = [...session.first].map(([id, result]) => {
        const row = { id, result };
        const misses = session.misses.get(id) ?? 0;
        if (misses) row.misses = misses;
        if (session.skipped.has(id)) row.skipped = true;
        return row;
    });

    if (results.length === 0) return;

    addSession({
        id: crypto.randomUUID(),
        startedAt: session.startedAt,
        endedAt: session.lastGradedAt ?? new Date().toISOString(),
        facets: session.facets,
        results,
    });

    recordStudy(results.map(({ id, misses = 0 }) => ({
        id,
        seen: misses + 1,
        missed: misses,
    })));
}

function quitSession() {
    flushStats();
    showStage('select');
}