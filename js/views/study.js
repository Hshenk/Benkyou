import { TYPE_LABELS, SIDE_CUES, questionMarkup, detailsFor } from "../card.js";
import { renderJapanese } from '../render.js';
import { getCards, getSessions, recordStudy, addSession, onChange } from "../storage.js";
import { toggleScript, frontFurigana } from "../settings.js";
import { canonicalTag, splitTag } from "../tags.js";
import { cardStats, weakest, stalest } from "../stats.js";
import { syncSessions } from "../sync.js";
import { STUDY_SIDES } from "../sessions.js";

// --- Study Selection ---
const facetsEl = document.querySelector('#facets');
const poolCount = document.querySelector('#pool-count');
const startBtn = document.querySelector('#start-study');
const clearBtn = document.querySelector('#clear-facets');
const facetTemplate = document.querySelector('#facet-template');
const optionTemplate = document.querySelector('#option-template');
const focusMode = document.querySelector('#focus-mode');
const focusLimit = document.querySelector('#focus-limit');
const focusLimitField = document.querySelector('#focus-limit-field');
const focusNote = document.querySelector('#focus-note');


const selection = new Map();

// Tags that start out excluded, such as supplementary vocab
const EXCLUDED_BY_DEFAULT = new Set(['Topic: Supplementary']);
const NEXT_STATE = { off: 'include', include: 'exclude', exclude: 'off'};
const STATE_WORDS = { off: 'not filtered', include: 'included', exclude: 'excluded' };

function defaultState(namespace, value) {
    return EXCLUDED_BY_DEFAULT.has(`${namespace}: ${value}`) ? 'exclude' : 'off';
}

function stateOf(namespace, value) {
    return selection.get(namespace)?.get(value) ?? 'off';
}


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
        for (const [namespace, states] of chosenBy) {
            const values = valuesFor(card, namespace);
            let included = 0;
            let matched = false;

            for (const [value, state] of states) {
                if (state === 'exclude' && values.has(value)) return false;

                if (state === 'include') {
                    included++;
                    if (values.has(value)) matched = true;
                }
            }

            // Included values in a group are an "any of these" rule. A group
            // with none is a group you didn't filter on.
            if (included > 0 && !matched) return false;
        }
        return true;
    });
}


const FOCUS_HINTS = {
     all: '',
    weakest: 'Ranked by your last few sessions. Cards you have never studied aren\'t included.',
    stalest: 'Longest untouched first — cards you have never studied come first of all.',
}

function applyFocus(pool) {
    const mode = focusMode.value;

    const limit = Number(focusLimit.value);
    if (limit === 0) return pool; // 0 translates to no card limit set
    const byCard = cardStats(getSessions());

    return mode === 'weakest'
        ? weakest(pool, byCard, limit)
        : stalest(pool, byCard, limit);
}

function currentPool() {
    return applyFocus(buildPool(getCards(), selection));
}

function facetLabels() {
    const out = [];

    for (const [namespace, states] of selection) {
        for (const [value, state] of states) {
            if (state === 'include') out.push(`${namespace}: ${value}`);
            else if (state === 'exclude') out.push(`-${namespace}: ${value}`);
        }
    }
    return out.sort();
}

function renderFacets(cards) {
    const facets = buildFacets(cards);

    // Drop anything chosen that no longer exists
    for (const [namespace, states] of selection) {
        const values = facets.get(namespace);
        if (!values) { selection.delete(namespace); continue; }
        for (const value of states.keys()) {          // CHANGED: keys(), it's a Map now
            if (!values.has(value)) states.delete(value);
        }
    }

    const fragment = document.createDocumentFragment();

    for (const [namespace, values] of facets) {
        if (!selection.has(namespace)) selection.set(namespace, new Map());   // CHANGED
        const states = selection.get(namespace);

        const node = facetTemplate.content.firstElementChild.cloneNode(true);
        node.dataset.namespace = namespace;
        node.querySelector('[data-field="name"]').textContent = namespace;

        const optionsBox = node.querySelector('[data-field="options"]');

        for (const value of [...values.keys()].sort()) {
            // NEW: first sight of a value decides its state. After that the map
            // remembers what you set it to, including 'off'.
            if (!states.has(value)) states.set(value, defaultState(namespace, value));

            const option = optionTemplate.content.firstElementChild.cloneNode(true);
            option.dataset.namespace = namespace;
            option.dataset.value = value;
            option.querySelector('[data-field="label"]').textContent = value;
            optionsBox.append(option);
            // REMOVED: the line that set .option__input.checked
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
        const state = stateOf(namespace, value);
        const n = countFor(namespace, value);

        option.dataset.state = state;
        option.querySelector('[data-field="state"]').textContent = STATE_WORDS[state];
        option.querySelector('[data-field="count"]').textContent = n;

        // An option worth nothing is only dead weight while it's doing nothing.
        option.disabled = n === 0 && state === 'off';
    }

    for (const facet of facetsEl.querySelectorAll('.facet')) {
        const states = [...selection.get(facet.dataset.namespace).values()];
        const included = states.filter((s) => s === 'include').length;
        const excluded = states.filter((s) => s === 'exclude').length;

        const parts = [];
        if (included) parts.push(`${included} included`);
        if (excluded) parts.push(`${excluded} excluded`);

        facet.querySelector('[data-field="selected"]').textContent = parts.join(', ');
    }
    
    const matched = buildPool(getCards(), selection);
    const pool = applyFocus(matched);
    const mode = focusMode.value;

    poolCount.textContent = pool.length === matched.length
        ? `${pool.length} ${pool.length === 1 ? 'card' : 'cards'}`
        : `${pool.length} of ${matched.length} cards`;

    focusNote.textContent =
        mode !== 'all' && matched.length > 0 && pool.length === 0
            ? 'None of these cards has been studied yet, so there is nothing to rank.'
            : FOCUS_HINTS[mode];

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
const faceEnglish = document.querySelector('#face-english');
const faceCue = document.querySelector('#face-cue');
const facePrompt = document.querySelector('#face-prompt');


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

function startSession(cards, mode = selectedSide(), sides = assignSides(cards, mode)) {
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
        side: mode,
        sides,
        flushed: false,
    };

    showStage('session');
    nextCard();
}

// The mode ticked in the picker, or fall back to Japanese
function selectedSide() {
    const value = document.querySelector('input[name="studySide"]:checked')?.value;
    return STUDY_SIDES.includes(value) ? value : 'japanese';
}

/**
 * Which side each card shows
 */
function assignSides(cards, mode) {
    const sides = new Map();

    if (mode !== 'mix') {
        for (const card of cards) sides.set(card.id, mode);
        return sides; 
    }

    const mixed = shuffle(cards);

    let english = Math.floor(mixed.length / 2);
    if (mixed.length % 2 === 1 && Math.random() < 0.5) english += 1;

    mixed.forEach((card, i) => {
        sides.set(card.id, i < english ? 'english' : 'japanese');
    });

    return sides;
}

function nextCard() {
    session.current = session.queue.shift() ?? null;

    if (!session.current) {
        endSession();
        return;
    }

    const card = session.current;
    const english = session.sides.get(card.id) === 'english';

    cardFace.dataset.type = card.type;
    cardFace.dataset.side = english ? 'english' : 'japanese';
    cardFace.dataset.furigana = frontFurigana();

    faceEnglish.hidden = !english;
    faceQuestion.hidden = english;

    if (english) {
        faceCue.textContent = SIDE_CUES[card.type] ?? 'Answer in Japanese';
        facePrompt.textContent = card.meaning;
    }

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

    const english = cardFace.dataset.side === 'english';

    // If it was an English first card, don't show the english twice
    faceQuestion.hidden = false;
    faceMeaning.hidden = english;

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
    facetsEl.addEventListener('click', (event) => {
        const option = event.target.closest('.option');
        if (!option) return;

        const { namespace, value } = option.dataset;
        const states = selection.get(namespace);
        states.set(value, NEXT_STATE[states.get(value) ?? 'off']);

        updateFacetUI();
    });

    clearBtn.addEventListener('click', () => {
        for (const [namespace, states] of selection) {
            for (const value of states.keys()) states.set(value, defaultState(namespace, value));
        }

        focusMode.value = 'all';
        focusLimitField.hidden = false;

        updateFacetUI();
    });



    startBtn.addEventListener('click', () => {
    startSession(currentPool());
    });

    focusMode.addEventListener('change', () => {
        focusLimitField.hidden = false;
        updateFacetUI();
    });

    focusLimit.addEventListener('change', updateFacetUI);


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
    const missed = getCards().filter((card) => missedIds.has(card.id));

        // Retry each card the way round you missed it.
        startSession(missed, session.side, session.sides);
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
        side: session.side,
        results,
    });

    syncSessions();

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