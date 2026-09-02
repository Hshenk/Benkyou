/**
 * tags.js - What a tag is. No DOM or imports
 */

const collapse = (s) => s.trim().replace(/\s+/g, ' ');

// Hard-coded exceptions that we want to stay in all caps.
const ACRONYMS = new Map([
    ['jlpt', 'JLPT'],
    ['nhk', 'NHK']
]);

export function splitTag(tag) {
    const i = tag.indexOf(':');
    if (i === -1) return { namespace: '', value: collapse(tag) };
    return {
        namespace: collapse(tag.slice(0, i)),
        value: collapse(tag.slice(i + 1)),
    };
}

/**
 * Capitalize the first letter of each word.
 * This ensures that Type: Kanji and Type: kanji can be displayed together as one tag
 */
function titleCase(text) {
    return collapse(text)
        .toLowerCase()
        .split(' ')
        .map((word) => (word ? ACRONYMS.get(word) ?? (word[0].toUpperCase() + word.slice(1)) : word))
        .join(' ');
}

export function canonicalTag(tag) {
    const { namespace, value } = splitTag(tag);
    if (!namespace) return titleCase(value);
    return `${titleCase(namespace)}: ${titleCase(value)}`;
}

export function tagKey(tag) {
    return canonicalTag(tag).toLowerCase();
}

export function normalizeTags(tags) {
    const byKey = new Map();
    for (const tag of tags ?? []) {
        const canon = canonicalTag(tag);
        if (canon) byKey.set(tagKey(tag), canon);
    }
    return [...byKey.values()];
}

// Namespaces the user may not create
export const RESERVED_NAMESPACES = new Set(['type']);

export function reservedNamespace(tag) {
    const ns = splitTag(tag).namespace.toLowerCase();
    return RESERVED_NAMESPACES.has(ns) ? ns : null;
}