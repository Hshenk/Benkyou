/**
 * notation.js - the editor's formatting buttons.
 */

const ACTIONS = {
    red:    { before: '*r:', after: '*' },
    blue:   { before: '*b:', after: '*' },
    yellow: { before: '*y:', after: '*' },
    link:   { before: '{',   after: '}' },

    // Furigana reads base[reading], so the brackets go *after* the selection
    // and the caret goes between them, ready for the kana.
    furigana: { before: '', after: '[]', caretFromEnd: 1 },
};

const SHORTCUTS = {
    Digit1: 'red',
    Digit2: 'blue',
    Digit3: 'yellow',
    Digit4: 'furigana',
    Digit5: 'link',
};

// Write over the field's selection
function replaceSelection(field, text) {
    field.focus();

    // Deprecated, but the only way to insert as if typed so that undo still works
    const inserted = document.execCommand?.('insertText', false, text);
    if (inserted) return;

    // Standard fallback
    field.setRangeText(text, field.selectionStart, field.selectionEnd, 'end');
    field.dispatchEvent(new Event('input', { bubbles: true }));
}

export function applyNotation(field, name) {
    const action = ACTIONS[name];
    if (!field || !action) return;

    const { before, after, caretFromEnd = 0 } = action;
    const value = field.value;

    let start = field.selectionStart;
    let end = field.selectionEnd;
    while (end > start && /\s/.test(value[end - 1])) end--;
    while (start < end && /\s/.test(value[start])) start++;

    const selected = value.slice(start, end);

    // --- Toggling off ---
    // Case 1: the markers sit just outside the selection (double clicking a word)
    if (before
        && value.slice(start - before.length, start) === before
        && value.slice(end, end + after.length) === after) {
            field.setSelectionRange(start - before.length, end + after.length);
            replaceSelection(field, selected);
            field.setSelectionRange(start - before.length, start - before.length + selected.length);
            return;
    }

    // Case 2: the markers are inside the selection
    if (before
        && selected.length >= before.length + after.length
        && selected.startsWith(before)
        && selected.endsWith(after)) {
            const inner = selected.slice(before.length, selected.length - after.length);
            field.setSelectionRange(start, end);
            replaceSelection(field, inner);
            field.setSelectionRange(start, start + inner.length);
            return;
    }

    // --- Wrapping ---
    field.setSelectionRange(start, end);
    replaceSelection(field, before + selected + after);

    const openEnd = start + before.length;
    const insertedEnd = start + before.length + selected.length + after.length;

    if (caretFromEnd > 0) {
        // Furigana inside the brackets
        const caret = insertedEnd - caretFromEnd;
        field.setSelectionRange(caret, caret);
    } else if (!selected) {
        field.setSelectionRange(openEnd, openEnd);
    } else {
        field.setSelectionRange(openEnd, openEnd + selected.length);
    }    
}

export function initNotation(root) {
    for (const bar of root.querySelectorAll('.notation')) {
        const field = root.querySelector(`#${bar.dataset.field}`);

        // Focus moves on mousedown. Cancel that and the field
        // keeps its selection
        bar.addEventListener('mousedown', (event) => event.preventDefault());

        bar.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-insert]');
            if (btn) applyNotation(field, btn.dataset.insert);
        });
    }

    root.addEventListener('keydown', (event) => {
        if (!event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;

        const name = SHORTCUTS[event.code];
        if (!name) return;

        const field = event.target;
        if (!field.id || !root.querySelector(`.notation[data-field="${field.id}"]`)) return;

        event.preventDefault();
        applyNotation(field, name);
    });
}
