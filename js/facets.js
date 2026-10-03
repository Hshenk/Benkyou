/**
 * facet.sjs - which cards a study selection matches and how many cards each option would add
 */
import { TYPE_LABELS } from './card.js';
import { canonicalTag, splitTag } from './tags.js';

export const TYPE_NAMESPACE = 'Type';

const NONE = new Set();

// Parse every card's tag once
export function buildIndex(cards) {
    return cards.map((card) => {
        const values = new Map([[TYPE_NAMESPACE, new Set([TYPE_LABELS[card.type]])]]);

        for (const tag of card.tags ?? []) {
            const { namespace, value } = splitTag(canonicalTag(tag));
            if (!namespace) continue;

            if (!values.has(namespace)) values.set(namespace, new Set());
            values.get(namespace).add(value);
        }

        return { card, values };
    });
}

// Every namespace in use and its values
export function facetValues(index) {
    const facets = new Map([[TYPE_NAMESPACE, new Set()]]);

    for (const { values } of index) {
        for (const [namespace, mine] of values) {
            if (!facets.has(namespace)) facets.set(namespace, new Set());
            for (const value of mine) facets.get(namespace).add(value);
        }
    }

    return facets;
}

function rulesFrom(selection) {
    const rules = [];

    for (const [namespace, states] of selection) {
        const include = new Set();
        const exclude = new Set();

        for (const [value, state] of states) {
            if (state === 'include') include.add(value);
            else if (state === 'exclude') exclude.add(value);
        }

        rules.push({ namespace, include, exclude });
    }

    return rules;
}

function passes(values, { namespace, include, exclude }) {
    const mine = values.get(namespace) ?? NONE;

    for (const value of mine) {
        if (exclude.has(value)) return false;
    }

    // If nothing is selected, no filter applied
    if (include.size === 0) return true;

    for (const value of mine) {
        if (include.has(value)) return true;
    }
    return false;
}

/**
 * One pass over the index to build { pool, counts }
 */
export function tally(index, selection) {
    const rules = rulesFrom(selection);
    const counts = new Map(rules.map((rule) => [rule.namespace, new Map()]));
    const pool = [];

    for (const { card, values } of index) {
        let failed = null;
        let failures = 0;

        for (const rule of rules) {
            if (passes(values, rule)) continue;

            failed = rule;
            failures += 1;
            if (failures > 1) break;
        }

        if (failures > 1) continue;
        if (failures === 0) pool.push(card);

        for (const { namespace } of failures === 0 ? rules: [failed]) {
            const count = counts.get(namespace);
            for (const value of values.get(namespace) ?? NONE) {
                count.set(value, (count.get(value) ?? 0) + 1);
            }
        }
    }

    return { pool, counts };
}