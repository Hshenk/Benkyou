import { getCard, saveCard, allTags } from "../storage.js";
import { canonicalTag, tagKey, reservedNamespace, splitTag, compareTags } from "../tags.js";
import { loadKanjiSheet, levelTag, meaningText, LEVEL_NAMESPACE } from "../kanji.js";
import { initNotation } from "../notation.js";
import { initPreviews } from "../preview.js";
import { loadVocabSheet, searchVocab, classLabels, classTags, CLASS_NAMESPACE } from "../vocab.js";
import { tokenize, plainText } from "../tokenize.js";

// --- Editor ---
const editorTitle = document.querySelector('#view-editor .view__title');
const tagChips = document.querySelector('#tag-chips');
const tagInput = document.querySelector('#card-tags');
const tagSuggestions = document.querySelector('#tag-suggestions');
const autofillStatus = document.querySelector('#kanji-autofill-status');
const autofillBtn = document.querySelector('#kanji-autofill-btn');
const vocabExpression = document.querySelector('#vocab-expression');
const vocabReading = document.querySelector('#vocab-reading');
const vocabList = document.querySelector('#vocab-suggestions');
const vocabStatus = document.querySelector('#vocab-autofill-status');


let editingId = null;
let refreshPreviews = () => {};
let tags = [];
let onDone = () => {};
// Vocab autofill
let suggestions = [];
let activeIndex = -1;
let lastPick = null;


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
    const suggestions = new Set();


    for (const tag of allTags()) {
        suggestions.add(tag);
        const { namespace } = splitTag(tag);
        if (namespace) suggestions.add(`${namespace}: `);
    }

    tagSuggestions.replaceChildren();
    for (const value of [...suggestions].sort(compareTags)) {
        const option = document.createElement('option');
        option.value = value;
        tagSuggestions.append(option);
    }
}

export function openEditor(id = null) {
    const card = id ? getCard(id) : null;
    editingId = card?.id ?? null;

    editorForm.reset();
    clearAutofillStatus();
    closeSuggestions();
    lastPick = null;
    refreshTagSuggestions();

    editorTitle.textContent = card ? 'Edit card' : 'New Card';

    if (!card) {
        setTags([]);
        showTypeFields(editorForm.querySelector('input[name="cardType"]:checked').value);
        refreshPreviews();
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
    refreshPreviews();
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
            if (event.target.value === 'kanji') {
                loadKanjiSheet();
            }
        }
    });

    // --- Kanji autofill ---
    const characterInput = editorForm.querySelector('#kanji-character');

    characterInput.addEventListener('input', (event) => {
        if (event.isComposing) return;
        autofillKanji();
    });

    characterInput.addEventListener('compositionend', () => {
        autofillKanji();
    });

    autofillBtn.addEventListener('click', () => {
        autofillKanji();
    });


    // --- Vocab suggestions ---
    vocabExpression.addEventListener('focus', () => {
        loadVocabSheet();
    });

    vocabExpression.addEventListener('input', () => {
        updateSuggestions();
    });

    vocabExpression.addEventListener('blur', () => {
        closeSuggestions();
    });

    vocabExpression.addEventListener('keydown', (event) => {
        if (event.isComposing || vocabList.hidden) return;

        const count = suggestions.length;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                setActive((activeIndex + 1) % count);
                break;
            case 'ArrowUp':
                event.preventDefault();
                setActive(activeIndex <= 0 ? count - 1 : activeIndex - 1);
                break;
            case 'Enter':
                if (activeIndex < 0) return;
                event.preventDefault();
                pickVocab(suggestions[activeIndex]);
                break;
            case 'Escape':
                event.preventDefault();
                closeSuggestions();
                break;
        }
    });

    // Focus moves on mousedown. Cancel that and the input keeps it
    vocabList.addEventListener('mousedown', (event) => event.preventDefault());

    vocabList.addEventListener('click', (event) => {
        const row = event.target.closest('.suggest__option');
        if (row) pickVocab(suggestions[Number(row.dataset.index)]);
    });


    // Notation
    initNotation(editorForm);
    refreshPreviews = initPreviews(editorForm);

    // --- Tags ---
    tagInput.addEventListener('keydown', (event) => {
        if (event.key != 'Enter') return;
        event.preventDefault();
        if (event.isComposing) return;

        const raw = tagInput.value.trim();
        if (!raw) return;

        const value = canonicalTag(raw);

        if (reservedNamespace(value)) {
            alert(`"${splitTag(value).namespace}" is reserved — pick the card type above instead.`);
            return;
        }

        if (!tags.some((t) => tagKey(t) === tagKey(value))) setTags([...tags, value]);
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

// Is there already a tag in this namespace?
function hasTagIn(namespace) {
    return tags.some((t) => splitTag(canonicalTag(t)).namespace === namespace);
}

function setAutofillStatus(text, state = '', el = autofillStatus) {
    el.textContent = text;
    if (state === '') {
        delete el.dataset.state;
    } else {
        el.dataset.state = state;
    }
}


function clearAutofillStatus() {
    setAutofillStatus('')
    setAutofillStatus('', '', vocabStatus);
    autofillStatus.dataset.char = '';
}

// --- Vocab Suggestions ---

// What's typed in expression, without notation or spaces
function vocabQuery() {
    return plainText(tokenize(vocabExpression.value)).replace(/[\s~～〜]/g, '');
}

async function updateSuggestions() {
    const query = vocabQuery();
    if (!query) {
        closeSuggestions();
        return;
    }

    const sheet = await loadVocabSheet();
    if (!sheet) {
        closeSuggestions();
        setAutofillStatus('Could not load vocab data', 'error', vocabStatus);
        return;
    }

    // User kept typing or left the field
    if (query !== vocabQuery() || document.activeElement !== vocabExpression) return;

    showSuggestions(searchVocab(sheet, query));
}

function suggestionRow(entry, i) {
    const row = document.createElement('li');
    row.className = 'suggest__option';
    row.id = `vocab-option-${i}`;
    row.dataset.index = i;
    row.title = entry.meaning;
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', 'false');

    const word = document.createElement('span');
    word.className = 'suggest__word';
    word.lang = 'ja';
    word.textContent = entry.word;

    const reading = document.createElement('span');
    reading.className = 'suggest__reading';
    reading.lang = 'ja';
    reading.textContent = entry.reading === entry.word ? '' : entry.reading;

    const meaning = document.createElement('span');
    meaning.className = 'suggest__meaning';
    meaning.textContent = entry.meaning;

    const meta = document.createElement('span');
    meta.className = 'suggest__meta';
    meta.textContent = [entry.jlpt ? `N${entry.jlpt}` : '', ...classLabels(entry)]
        .filter(Boolean)
        .join(' · ');

    row.append(word, reading, meaning, meta);
    return row;
}

function showSuggestions(entries) {
    suggestions = entries;
    activeIndex = -1;

    vocabList.replaceChildren(...entries.map(suggestionRow));
    vocabList.hidden = entries.length === 0;

    vocabExpression.setAttribute('aria-expanded', String(!vocabList.hidden));
    vocabExpression.removeAttribute('aria-activedescendant');
}

function closeSuggestions() {
    showSuggestions([]);
}

function setActive(index) {
    vocabList.children[activeIndex]?.setAttribute('aria-selected', 'false');
    activeIndex = index;

    const row = vocabList.children[index];
    row.setAttribute('aria-selected', 'true');
    row.scrollIntoView({ block: 'nearest' });
    vocabExpression.setAttribute('aria-activedescendant', row.id);
}

function pickVocab(entry) {
    closeSuggestions();

    const meaningField = editorForm.querySelector('#card-meaning');

    // A second pick replaces what the first one filled
    if (lastPick) {
        if (meaningField.value === lastPick.meaning) meaningField.value = '';
        setTags(tags.filter((t) => !lastPick.tags.includes(t)));
    }

    const filled = ['expression'];
    vocabExpression.value = entry.furigana;

    // Kana-only words leave reading blank
    const reading = entry.reading === entry.word ? '' : entry.reading;
    vocabReading.value = reading;
    if (reading) filled.push('reading');

    let filledMeaning = null;
    if (!meaningField.value.trim()) {
        meaningField.value = filledMeaning = entry.meaning;
        filled.push('meaning');
    }

    // Tags, only in namespaces the card doesn't use yet
    const added = [];
    const level = levelTag(entry);
    if (level && !hasTagIn(LEVEL_NAMESPACE)) added.push(level);
    if (!hasTagIn(CLASS_NAMESPACE)) added.push(...classTags(entry));
    if (added.length > 0) setTags([...tags, ...added]);

    lastPick = { meaning: filledMeaning, tags: added };

    let report = `Filled: ${filled.join(', ')}.`;
    if (added.length > 0) report += ` Added ${added.join(', ')}.`;
    if (!entry.jlpt) report += ' Not on a JLPT list.';
    setAutofillStatus(report, 'filled', vocabStatus);

    refreshPreviews();
}

async function autofillKanji() {
    const character = editorForm.querySelector('[data-type-fields="kanji"] [name="character"]').value.trim();
    if ([...character].length !== 1) {
        clearAutofillStatus();
        return;
    }

    const sheet = await loadKanjiSheet();
    if (!sheet) {
        setAutofillStatus('Could not load kanji data', 'error')
        return;
    }

    // Quietly exit if the character was changed
    if (character !== editorForm.querySelector('[data-type-fields="kanji"] [name="character"]').value.trim()) return;

    const entry = sheet[character];
    if (!entry) {
        setAutofillStatus('Could not find character in kanji data');
        return;
    }

    // Fill empty fields
    let report = []; // record what's changed
    const strokeField = editorForm.querySelector('[data-type-fields="kanji"] [name="strokes"]');
    const onField = editorForm.querySelector('[data-type-fields="kanji"] [name="onyomi"]');
    const kunField = editorForm.querySelector('[data-type-fields="kanji"] [name="kunyomi"]');
    const meaningField = editorForm.querySelector('#card-meaning');

    if (!strokeField.value.trim() && entry.strokes) {
        strokeField.value = String(entry.strokes);
        report.push('strokes');
    }
    if (!onField.value.trim() && entry.on.length > 0) {
        onField.value = entry.on.join('、');
        report.push('onyomi');
    }
    if (!kunField.value.trim() && entry.kun.length > 0) {
        kunField.value = entry.kun.join('、');
        report.push('kunyomi');
    }
    if (!meaningField.value.trim() && entry.meanings.length > 0) {
        meaningField.value = meaningText(entry);
        report.push('meaning');
    }

    // Tag level
    const tag = levelTag(entry);
    let addedTag = false;

    if (tag && !hasTagIn(LEVEL_NAMESPACE)) {
        setTags([...tags, tag]);
        addedTag = true;
    }


    let statusReport = 'Nothing to fill.';
    if (report.length > 0) {
        statusReport = 'Filled: ' + report.join(', ') + '.';
    }

    // Second half of report 
    let metaData = [];
    if (addedTag) {
        metaData.push(tag);
    }
    if (entry.grade) {
        metaData.push(entry.grade === 'S' ? 'secondary school' : `Grade ${entry.grade}`);
    }
    if (entry.freq) {
        metaData.push(`#${entry.freq} in frequency`);
    }

    if (metaData.length > 0) {
        statusReport += ' ' + metaData.join(' · ') + '.';
    }

    if (report.length === 0 && !addedTag && autofillStatus.dataset.char === character) return;

    setAutofillStatus(statusReport, 'filled')
    autofillStatus.dataset.char = character;
}