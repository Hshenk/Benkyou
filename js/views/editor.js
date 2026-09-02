import { getCard, saveCard, allTags } from "../storage.js";
import { canonicalTag, tagKey } from "../tags.js";

// --- Editor ---
const editorTitle = document.querySelector('#view-editor .view__title');
const tagChips = document.querySelector('#tag-chips');
const tagInput = document.querySelector('#card-tags');
const tagSuggestions = document.querySelector('#tag-suggestions');

let editingId = null;
let tags = [];
let onDone = () => {};


function splitList(value) {
    return value.split(/[、,]/).map((s) => s.trim()).filter(Boolean);
}

function readTypeData(type, fd) {
    const str = (name) => String(fd.get(name) ?? '').trim();

    switch(type) {
        case 'vocab':
            return { expression: str('expression'), reading: str('reading') };
        case 'kanji':
            return {
                character: str('character'),
                onyomi: splitList(str('onyomi')),
                kunyomi: splitList(str('kunyomi')),
                strokes: Number(str('strokes')) || undefined,
            };
        case 'sentence': 
            return { expression: str('expression'), literal: str('literal') };
        case 'grammar':
            return { expression: str('expression'), example: str('example') };
        default:
            return {};
    }
}

function readForm() {
    const fd = new FormData(editorForm);
    const type = String(fd.get('cardType'));

    return {
        ...(editingId ? { id: editingId } : {}),
        type,
        meaning: String(fd.get('meaning') ?? '').trim(),
        notes: String(fd.get('notes') ?? '').trim(),
        tags: [...tags],
        data: readTypeData(type, fd),
    };
}

function setTags(next) {
    tags = [...next];
    tagChips.replaceChildren();

    for (const tag of tags) {
        const chip = document.createElement('span');
        chip.className = 'chip chip--removable';
        chip.textContent = tag;

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'chip__remove';
        remove.dataset.tag = tag;
        remove.setAttribute('aria-label', `Remove tag ${tag}`);
        remove.textContent = 'x';

        chip.append(remove);
        tagChips.append(chip);
    }
}

function refreshTagSuggestions() {
    tagSuggestions.replaceChildren();
    for (const tag of allTags()) {
        const option = document.createElement('option');
        option.value = tag;
        tagSuggestions.append(option);
    }
}

export function openEditor(id = null) {
    const card = id ? getCard(id) : null;
    editingId = card?.id ?? null;

    editorForm.reset();
    refreshTagSuggestions();

    editorTitle.textContent = card ? 'Edit card' : 'New Card';

    if (!card) {
        setTags([]);
        showTypeFields(editorForm.querySelector('input[name="cardType"]:checked').value);
        return;
    }

    editorForm.querySelector(`input[name="cardType"][value="${card.type}"]`).checked = true;
    showTypeFields(card.type);

    const set = (name, value) => {
        const field = editorForm.querySelector(`[name="${name}"]:not([disabled])`);
        if (field) field.value = value ?? '';
    };

    set('meaning', card.meaning);
    set('notes', card.notes);

    for (const [key, value] of Object.entries(card.data ?? {})) {
        set(key, Array.isArray(value) ? value.join('、') : value);
    }

    setTags(card.tags ?? []);
}

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

export function initEditor(options = {}) {
    onDone = options.onDone ?? (() => {});

    // Change bubbles, so one listener on the form covers every control in it
    editorForm.addEventListener('change', (event) => {
        if (event.target.name === 'cardType') {
            showTypeFields(event.target.value);
        }
    });

    // --- Tags ---
    tagInput.addEventListener('keydown', (event) => {
        if (event.key != 'Enter') return;
        event.preventDefault();
        if (event.isComposing) return;

        const raw = tagInput.value.trim();
        if (!raw) return;

        const value = canonicalTag(raw);
        const exists = tags.some((t) => tagKey(t) === tagKey(value));
        if (!exists) setTags([...tags, value]);
        
        tagInput.value = '';
    });

    tagChips.addEventListener('click', (event) => {
        const btn = event.target.closest('.chip__remove');
        if (!btn) return;
        setTags(tags.filter((t) => t !== btn.dataset.tag));
    });

    // --- Submit ---
    // Enter also confirms an IME candidate, so don't submit form
    editorForm.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.isComposing) {
            event.preventDefault();
        }
    });

    editorForm.addEventListener('submit', (event) => {
        event.preventDefault();
        
        const card = readForm();
        if (!card.meaning) return;

        saveCard(card);

        if ((event.submitter?.value ?? 'save') === 'save-new') {
            const type = card.type;
            openEditor(null);
            editorForm.querySelector(`input[name="cardType"][value="${type}"]`).checked = true;
            showTypeFields(type);
            editorForm.querySelector(`[data-type-fields="${type}"] .input`)?.focus();
        } else {
            openEditor(null);
            onDone();
        }
    });

    editorForm.querySelector('[data-action="cancel"]')
        .addEventListener('click', () => { openEditor(null); onDone(); });

    openEditor(null);
}
