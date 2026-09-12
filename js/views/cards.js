import { TYPE_LABELS, cardText } from '../card.js';
import { renderJapanese } from '../render.js';
import { getCards, deleteCard, onChange, getCard } from "../storage.js";
import { tokenize, plainText } from '../tokenize.js';
import { canonicalTag } from '../tags.js';
import { SORTS, sortCards } from '../sort.js';

// --- Card List ---
const cardList = document.querySelector('#card-list');
const cardCount = document.querySelector('#card-count');
const cardEmpty = document.querySelector('#card-empty');
const searchInput = document.querySelector('#card-search');
const rowTemplate = document.querySelector('#card-row-template');
const sortBar = document.querySelector('#sort-bar');

let activeSort = 'default';
let dir = 1;
let SORT_KEY = 'benkyou:sort';

function buildRow(card) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const field = (name) => row.querySelector(`[data-field="${name}"]`);

    row.dataset.id = card.id;

    const badge = field('type');
    badge.textContent = TYPE_LABELS[card.type];
    badge.dataset.type = card.type;

    renderJapanese(field('expression'), cardText(card), { links: false });
    field('meaning').textContent = card.meaning;

    const tagBox = field('tags');
    for (const tag of card.tags ?? []) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = canonicalTag(tag);
        tagBox.append(chip);
    }

    const seen = card.timesSeen ?? 0;
    const missed = card.timesMissed ?? 0;
    if (seen != 0) {
        const accuracy = (((seen - missed) / seen) * 100).toFixed(1);
        field('stats').textContent = seen ? `Accuracy: ${accuracy}% of ${seen} time(s) seen` : '';
    } else {
        field('stats').textContent = '';
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
function searchableText(card) {
    return [
        plainText(tokenize(cardText(card))),
        card.meaning,
        ...(card.tags ?? []),
    ].join(' ').toLowerCase();
}

function filterCards(query) {
    const q = query.trim().toLowerCase();
    if (!q) return getCards();
    return getCards().filter((card) => searchableText(card).includes(q));
}

function rerender() {
    const query = searchInput.value;
    renderCards(sortCards(filterCards(query), activeSort, dir), query);
}

export function initCards(options = {}) {
    const onEdit = options.onEdit ?? (() => {});

    searchInput.addEventListener('input', rerender);

    // --- Sort bar ---
    sortBar.addEventListener('click', (event) => {
        const btn = event.target.closest('.sortbar__btn');
        if (!btn) return;

        chooseSort(btn.dataset.sort);
    });

    // --- Row actions ---
    cardList.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-action]');
        if (!btn) return;

        const id = btn.closest('.card-row').dataset.id;

        if (btn.dataset.action === 'edit') {
            onEdit(id);
            return;
        }

        const card = getCard(id);
        if (confirm(`Delete "${card?.meaning ?? 'this card'}"? This cannot be undone.`)) {
            deleteCard(id);
        }
    });

    onChange(rerender);

    loadSort();
    updateSortUI();
    rerender();
}

function updateSortUI() {
    for (const btn of sortBar.querySelectorAll('.sortbar__btn')) {
        const isActive = btn.dataset.sort === activeSort;
        btn.setAttribute('aria-pressed', String(isActive));

        if (isActive) {
            btn.dataset.dir = dir === 1 ? 'asc' : 'desc';
            btn.setAttribute(
                'aria-label',
                `Sort by ${btn.textContent.trim()}, ${dir === 1 ? 'ascending' : 'descending'}`,
            );
        } else {
            delete btn.dataset.dir;
            btn.removeAttribute('aria-label');
        }
    }
}

function chooseSort(id) {
    if (id === activeSort) dir = -dir; 
    else {
        const sortsEntry = SORTS.find(u => u.id === id);
        if (!sortsEntry) return;

        activeSort = id;
        dir = sortsEntry.defaultDir ?? 1;
    }

    saveSort();
    updateSortUI();
    rerender();
}

function loadSort() {
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(SORT_KEY) ?? 'null');
    } catch {
        // Blocked storage or corrupt value. Fall through
    }

    if (!saved) return;
    if (!SORTS.some((s) => s.id === saved.id)) return;
    if (saved.dir !== 1 && saved.dir !== -1) return;

    activeSort = saved.id;
    dir = saved.dir;
}

function saveSort() {
    try {
        localStorage.setItem(SORT_KEY, JSON.stringify({ id: activeSort, dir }));
    } catch {
        // If we can't remember the select sort, that's fine, no harm done
    }
}