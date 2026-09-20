/**
 * duplicates.js - finds cards that may be duplicates of each other
 */

import { cardText } from './card.js';
import { tokenize, plainText, kanaText } from './tokenize.js';

// A sense this short is a coincidence not a match
const MIN_SENSE = 2;

const LEADING = /^(?:to|a|an|the)\s+/;

function normalizeJapanese(text) {
    // Japanese doesn't use spaces, so we drop any that were added by accident
    return (text ?? '').replace(/\s+/g, '');
}

/**
 * The senses in an English meaning: lowercased, split, and tidied 
 */
function senses(meaning) {
    return (meaning ?? '')
        .toLowerCase()
        .replace(/[(（][^)）]*[)）]/g, ' ')
        .split(/[,;/]/)
        .map((part) => part.trim().replace(LEADING, '').replace(/[.!?]+$/, '').trim())
        .filter((part) => part.length >= MIN_SENSE);
}

/**
 * The keys one card matches on -> [{ key, label }].
 */
export function keysFor(card) {
    const out = new Map();

    // Two cards of different types are allowed to look alike
    const add = (kind, value, label) => {
        if (!value) return;
        out.set(`${kind}:${card.type}:${value}`, label);
    };

    const tokens = tokenize(cardText(card));
    const written = normalizeJapanese(plainText(tokens));
    const kana = normalizeJapanese(kanaText(tokens));

    add('ja', written, written);
    add('ja', kana, kana);
    add('ja', normalizeJapanese(card.data?.reading), card.data?.reading);

    for (const sense of senses(card.meaning)) add('en', sense, sense);

    return [...out].map(([key, label]) => ({ key, label }));
}

/**
 * Union-find: every card starts in its own group and union merges two.
 */
function disjointSet(size) {
    const parent = [...Array(size).keys()];

    function find(i) {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    }

    function union(a, b) {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA !== rootB) parent[rootA] = rootB;
    }

    return { find, union };
}

/**
 * Group cards that may be duplicates 
 */
export function findDuplicates(cards) {
    const { find, union } = disjointSet(cards.length);
    const byKey = new Map();

    cards.forEach((card, i) => {
        for (const { key, label } of keysFor(card)) {
            if (!byKey.has(key)) byKey.set(key, { label, members: [] });
            byKey.get(key).members.push(i);
        }
    });

    // Everything sharing a key joins one group
    for (const { members } of byKey.values()) {
        for (let i = 1; i < members.length; i++) union(members[0], members[i]);
    }

    const groups = new Map();

    for (const { label, members } of byKey.values()) {
        if (members.length < 2) continue;

        const root = find(members[0]);
        if (!groups.has(root)) groups.set(root, { cards: [], reasons: new Set() });
        groups.get(root).reasons.add(label);
    }

    cards.forEach((card, i) => groups.get(find(i))?.cards.push(card));

    return [...groups.values()]
        .map(({ cards: group, reasons }) => ({ cards: group, reasons: [...reasons].sort() }))
        .sort((a, b) => b.cards.length - a.cards.length
        || a.reasons[0].localeCompare(b.reasons[0]));
}