// --- Elements ---
const nav = document.querySelector('.nav');
const views = document.querySelectorAll('.view');
const navButtons = nav.querySelectorAll('.nav__btn');

// --- View Switching ---

function showView(name) {
    for (const section of views) {
        section.hidden = section.id !== `view-${name}`;
    }

    for (const btn of navButtons) {
        if (btn.dataset.view === name) {
            btn.setAttribute('aria-current', 'page');
        } else {
            btn.removeAttribute('aria-current');
        }
    }
}


// --- Events ---
nav.addEventListener('click', (event) => {
    const btn = event.target.closest('.nav__btn');
    if (!btn) return;
    showView(btn.dataset.view);
});

// --- Start ---
showView('cards');


// --- Editor ---
const editorForm = document.querySelector('#editor-form');
const typeFieldsets = editorForm.querySelectorAll('[data-type-fields]');

/**
 * Shows only the fieldset matching teh chosen card type.
 */
function showTypeFields(type) {
    for (const fs of typeFieldsets) {
        const active = fs.dataset.typeFields === type;
        fs.hidden = !active;
        fs.disabled = !active;
    }
}

// Change bubbles, so one listener on the form covers every control in it
editorForm.addEventListener('change', (event) => {
    if (event.target.name === 'cardType') {
        showTypeFields(event.target.value);
    }
});

// Enter also confirms an IME candidate, so don't submit form
editorForm.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.isComposing) {
        event.preventDefault();
    }
});

editorForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(editorForm));
    const intent = event.submitter?.value ?? 'save';

    console.log(intent, data);
});

showTypeFields(editorForm.querySelector('input[name="cardType"]:checked').value);


// --- Card List ---
const cardList = document.querySelector('#card-list');
const cardCount = document.querySelector('#card-count');
const cardEmpty = document.querySelector('#card-empty');
const searchInput = document.querySelector('#card-search');
const rowTemplate = document.querySelector('#card-row-template');

const TYPE_LABELS = { kanji: 'Kanji', vocab: 'Vocab', sentence: 'Sentence', grammar: 'Grammar' };

const sampleCards = [
    {
        id: 'a1', type: 'vocab', meaning: 'to eat',
        tags: ['Topic: Food', 'Level: N5'],
        data: { expression: '食[た]べる', reading: 'たべる' },
    },
    {
        id: 'a2', type: 'kanji', meaning: 'eat, food',
        tags: ['Level: N5'],
        data: { character: '食', onyomi: ['ショク'], kunyomi: ['た.べる'], strokes: 9 },
    },
    {
        id: 'a3', type: 'sentence', meaning: 'Please (do it for me).',
        tags: ['Topic: Set phrases', 'Source: Nakama 1'],
        data: { expression: 'お 願[ねが]いします', literal: 'I humbly request' },
    },
    {
        id: 'a4', type: 'vocab', meaning: 'study, diligence',
        tags: ['Topic: School', 'Level: N4'],
        data: { expression: '勉強[べんきょう]', reading: 'べんきょう' },
    },
    {
        id: 'a5', type: 'grammar', meaning: 'topic marker — “as for X”',
        tags: ['Topic: Particles', 'Level: N5'],
        data: { expression: 'は', example: '私[わたし]*b:は* 学生[がくせい]です' },
    },
];

function cardText(card) {
    return card.data.expression ?? card.data.character ?? '';
}

/** what teh front of the card asks */
function questionText(card) {
    if (card.type === 'grammar') return card.data.example;
    return card.data.expression ?? card.data.character ?? '';
}

function detailsFor(card) {
    switch (card.type) {
        case 'vocab':
            return [['Reading', card.data.reading]];
        case 'kanji':
            return [
                ["On'yomi", card.data.onyomi?.join('、')],
                ["Kun'yomi", card.data.kunyomi?.join('、')],
                ['Strokes', card.data.strokes],
            ];
        case 'sentence':
            return [['Literal', card.data.literal]];
        case 'grammar':
            return [['Point', card.data.expression]];
        default:
            return [];
    }
}


function renderJapanese(el, text) {
    el.textContent = text;
}

function buildRow(card) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const field = (name) => row.querySelector(`[data-field="${name}"]`);

    row.dataset.id = card.id;

    const badge = field('type');
    badge.textContent = TYPE_LABELS[card.type];
    badge.dataset.type = card.type;

    renderJapanese(field('expression'), cardText(card));
    field('meaning').textContent = card.meaning;

    const tagBox = field('tags');
    for (const tag of card.tags) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = tag;
        tagBox.append(chip);
    }

    return row;
}

function renderCards(cards, query = '') {
    const fragment = document.createDocumentFragment();
    for (const card of cards) {
        fragment.append(buildRow(card));
    }
    cardList.replaceChildren(fragment);

    cardCount.textContent = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`;

    cardEmpty.hidden = cards.length > 0;
    cardEmpty.textContent = query
        ? `No cards match “${query}”.`
        : 'No cards yet. Create one from New Card.';
}

// --- Search ---
function filterCards(query) {
    const q = query.trim().toLowerCase();
    if (!q) return sampleCards;

    return sampleCards.filter((card) =>
        [cardText(card), card.meaning, ...card.tags]
            .join(' ')
            .toLowerCase()
            .includes(q)
    );
}

searchInput.addEventListener('input', () => {
    const query = searchInput.value;
    renderCards(filterCards(query), query);
});

// --- Row actions ---
cardList.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;

    const id = btn.closest('.card-row').dataset.id;
    console.log(btn.dataset.action, id);
});

renderCards(sampleCards);


// --- Study Selection ---
const facetsEl = document.querySelector('#facets');
const poolCount = document.querySelector('#pool-count');
const startBtn = document.querySelector('#start-study');
const clearBtn = document.querySelector('#clear-facets');
const facetTemplate = document.querySelector('#facet-template');
const optionTemplate = document.querySelector('#option-template');

const selection = new Map();

function splitTag(tag) {
    const i = tag.indexOf(':');
    if (i === -1) return [null, tag.trim()];
    return [tag.slice(0, i).trim(), tag.slice(i + 1).trim()];
}

function valuesFor(card, namespace) {
    if (namespace === 'Type') return new Set([TYPE_LABELS[card.type]]);

    const out = new Set();
    for (const tag of card.tags) {
        const [ns, value] = splitTag(tag);
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

        for (const tag of card.tags) {
            const [namespace, value] = splitTag(tag);
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

function renderFacets(cards) {
    const facets = buildFacets(cards);
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

    return buildPool(sampleCards, others)
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

    const pool = buildPool(sampleCards, selection);
    poolCount.textContent = `${pool.length} ${pool.length === 1 ? 'card' : 'cards'}`;
    startBtn.disabled = pool.length === 0;
}

// --- Events ---
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
    console.log('study pool:', buildPool(sampleCards, selection));
});

renderFacets(sampleCards);

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

    renderJapanese(faceQuestion, questionText(card));

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

    gradeBar.querySelector('[data-grade="again"]').hidden = false;
    gradeBar.querySelector('[data-grade="good"]').hidden = false;

    const misses = session.misses.get(card.id) ?? 0;
    gradeBar.querySelector('[data-grade="skip"]').hidden = misses < MISS_LIMIT;
}

function grade(result) {
    if (!session?.current || faceBack.hidden) return;

    const card = session.current;
    if (result === 'good') {
        session.done.add(card.id);
    } else if (result === 'skip') {
        session.skipped.add(card.id);
    } else {
        session.misses.set(card.id, (session.misses.get(card.id) ?? 0) + 1);
        requeue(card);
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
    document.querySelector('#summary-total').textContent = session.total;
    document.querySelector('#summary-missed').textContent = session.misses.size;
    document.querySelector('#summary-skipped').textContent = session.skipped.size;

    document.querySelector('#restudy-missed').disabled = session.misses.size === 0;
    showStage('summary');
}

// --- Session Events ---
gradeBar.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-grade]');
    if (!btn) return;

    if (btn.dataset.grade === 'reveal') revealAnswer();
    else grade(btn.dataset.grade);
});

document.querySelector('#quit-study').addEventListener('click', () => showStage('select'));
document.querySelector('#back-to-select').addEventListener('click', () => showStage('select'));

document.querySelector('#restudy-missed').addEventListener('click', () => {
    const missedIds = new Set(session.misses.keys());
    startSession(sampleCards.filter((card) => missedIds.has(card.id)));
});

// Replace guide 05's console.log placeholder:
startBtn.addEventListener('click', () => {
    startSession(buildPool(sampleCards, selection));
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
            grade('again');
            break;
        case '2':
            grade('good');
            break;
        case 'f':
            toggleScript();
            break;
        case 'Escape':
            showStage('select');
            break;
    }
});

// --- Script toggle ---
const SCRIPT_KEY = 'benkyou:script';
const scriptToggle = document.querySelector('#script-toggle');

function setScript(mode) {
    document.documentElement.dataset.script = mode;
    scriptToggle.setAttribute('aria-pressed', String(mode === 'hand'));

    try {
        localStorage.setItem(SCRIPT_KEY, mode);
    } catch {
        // Private mode or full quota. The toggle still works this session
    }
}

function toggleScript() {
    setScript(document.documentElement.dataset.script === 'hand' ? 'print' : 'hand');
}

scriptToggle.addEventListener('click', toggleScript);

let savedScript = 'print';
try {
    savedScript = localStorage.getItem(SCRIPT_KEY) ?? 'print';
} catch {}
setScript(savedScript);