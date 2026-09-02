import { tagCounts, renameTag, deleteTag, normalizeAllTags, onChange } from "../storage.js";
import { splitTag, canonicalTag, reservedNamespace } from "../tags.js";

const groupsEl = document.querySelector('#tag-groups');
const emptyEl = document.querySelector('#tag-empty');
const totalEl = document.querySelector('#tag-total');
const normalizeBtn = document.querySelector('#normalize-tags');
const groupTemplate = document.querySelector('#tag-group-template');
const rowTemplate = document.querySelector('#tag-row-template');

// Group canonical tags by namespace 
function groupTags() {
    const groups = new Map();

    for (const { tag, count } of tagCounts().values()) {
        const { namespace, value } = splitTag(tag);
        const key = namespace || '(no namespace)';

        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ tag, value, count });
    }

    for (const list of groups.values()) {
    list.sort((a, b) => a.value.localeCompare(b.value));
    }

    return new Map([...groups].sort((a, b) => a[0].localeCompare(b[0])));
}

function render() {
    const groups = groupTags();
    const total = [...groups.values()].reduce((n, list) => n + list.length, 0);

    const fragment = document.createDocumentFragment();

    for (const [namespace, list] of groups) {
        const group = groupTemplate.content.firstElementChild.cloneNode(true);
        group.querySelector('[data-field="namespace"]').textContent = namespace;

        const listEl = group.querySelector('[data-field="list"]');

        for (const { tag, value, count } of list) {
            const row = rowTemplate.content.firstElementChild.cloneNode(true);
            row.dataset.tag = tag;
            row.querySelector('[data-field="value"]').textContent = value;
            row.querySelector('[data-field="count"]').textContent = `${count} card${count === 1 ? '' : 's'}`;
            listEl.append(row);
        }

        fragment.append(group);
    }

    groupsEl.replaceChildren(fragment);
    emptyEl.hidden = total > 0;
    totalEl.textContent = `${total} tag${total === 1 ? '' : 's'}`;
}

function handleRename(tag) {
    const input = prompt('Rename rag (renaming onto an existing tag merges them)', tag);
    if (input === null) return;

    const next = canonicalTag(input);
    if (!next || next === tag) return;

    const reserved = reservedNamespace(next);
    if (reserved) {
        alert(`"${splitTag(next).namespace} is reserved - card type is a field, not a tag.`);
        return;
    }

    const touched = renameTag(tag, next);
    console.log(`Renamed ${tag} → ${next} on ${touched} card(s)`);
}

function handleDelete(tag) {
    const { count } = [...tagCounts().values()].find((e) => e.tag === tag) ?? { count: 0 };
    const ok = confirm(
        `Remove "${tag}" from ${count} card${count === 1 ? '' : 's'}? The cards stay; only the tag goes.`
    );
    if (ok) deleteTag(tag);
}

export function initTags() {
    groupsEl.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-action]');
        if (!btn) return;

        const tag = btn.closest('.tag-row').dataset.tag;
        if (btn.dataset.action === 'rename') handleRename(tag);
        else handleDelete(tag);
    });

    normalizeBtn.addEventListener('click', () => {
        const ok = confirm(
            'Rewrite every card\'s tags into canonical form? This cannot be undone — '
            + 'export first if you want a backup.'
        );
        if (!ok) return;

        const touched = normalizeAllTags();
        alert(touched === 0 
                        ? 'Everything was already canonical.'
                        : `Updated ${touched} card${touched === 1 ? '' : 's'}.`);
    });

    onChange(render);
    render();
}