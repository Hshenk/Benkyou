/**
 * combobox.js - a suggestion list under a text input.
 * The caller decides what to search for and what a row shows. This handles the
 * list itself: rows, the highlight, keys, clicks and closing.
 */

/**
 * input:       the <input role="combobox">
 * list:        its <ul role="listbox">
 * search():    the entries to show for what's typed now, [] for none. May be async.
 * renderRow(row, entry): fill in one <li> for an entry
 * onPick(entry): called after the list closes, with the entry that was chosen
 * autoSelect:  highlight the first row as soon as the list opens
 * Returns { close }.
 */
export function initCombobox({ input, list, search, renderRow, onPick, autoSelect = false }) {
    let entries = [];
    let active = -1;     // the highlighted row, -1 for none
    let request = 0;     // counts searches, so a stale one can tell it's stale

    function setActive(index) {
        list.children[active]?.setAttribute('aria-selected', 'false');
        active = index;

        const row = list.children[index];
        if (!row) {
            input.removeAttribute('aria-activedescendant');
            return;
        }

        row.setAttribute('aria-selected', 'true');
        row.scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', row.id);
    }

    function show(next) {
        entries = next;
        active = -1;

        list.replaceChildren(...next.map((entry, i) => {
            const row = document.createElement('li');
            row.className = 'suggest__option';
            row.id = `${list.id}-${i}`;
            row.dataset.index = i;
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', 'false');
            renderRow(row, entry);
            return row;
        }));

        list.hidden = next.length === 0;
        input.setAttribute('aria-expanded', String(!list.hidden));
        setActive(autoSelect && next.length > 0 ? 0 : -1);
    }

    function close() {
        request += 1;    // a search still in flight must not reopen the list
        show([]);
    }

    function pick(index) {
        const entry = entries[index];
        close();
        if (entry) onPick(entry);
    }

    async function refresh() {
        const mine = ++request;
        const next = await search();
        if (mine === request) show(next);
    }

    input.addEventListener('input', refresh);
    input.addEventListener('blur', close);

    input.addEventListener('keydown', (event) => {
        if (event.isComposing || list.hidden) return;

        const count = entries.length;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                setActive((active + 1) % count);
                break;
            case 'ArrowUp':
                event.preventDefault();
                setActive(active <= 0 ? count - 1 : active - 1);
                break;
            case 'Enter':
                if (active < 0) return;
                event.preventDefault();
                pick(active);
                break;
            case 'Escape':
                event.preventDefault();
                close();
                break;
        }
    });

    // Focus moves on mousedown. Cancel that and the input keeps it
    list.addEventListener('mousedown', (event) => event.preventDefault());

    list.addEventListener('click', (event) => {
        const row = event.target.closest('[role="option"]');
        if (row) pick(Number(row.dataset.index));
    });

    return { close };
}
