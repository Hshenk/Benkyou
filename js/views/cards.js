import { TYPE_LABELS, cardText } from '../card.js';
import { renderJapanese } from '../render.js';
import { getCards, deleteCard, onChange } from "../storage.js";
import { tokenize, plainText } from '../tokenize.js';
import { canonicalTag } from '../tags.js';


// --- Card List ---
const cardList = document.querySelector('#card-list');
const cardCount = document.querySelector('#card-count');
const cardEmpty = document.querySelector('#card-empty');
const searchInput = document.querySelector('#card-search');
const rowTemplate = document.querySelector('#card-row-template');


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

    const seen = card.timesSeen?? 0;
    const missed = card.timesMissed ?? 0;
    field('stats').textContent = seen ? `${missed}/${seen} missed` : '';

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

export function initCards(options = {}) {
    const onEdit = options.onEdit ?? (() => {});

    const rerender = () => {
        const query = searchInput.value;
        renderCards(filterCards(query), query);
    };

    searchInput.addEventListener('input', rerender);

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
    rerender();
}