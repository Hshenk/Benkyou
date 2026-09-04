/**
 * collection.js = reading, comparing, and merging whole collections
 * no DOM or localStorage
 */

const SCHEMA_VERSION = 1;
export function serialize(payload) {
    return JSON.stringify(payload, null, 2);
}

// parse and sanity-check on imported file
export function parseCollection(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('That file is not valid JSON');
    }

    if (!data || typeof data !== 'object' || !Array.isArray(data.cards)) {
        throw new Error('That does not look like a Benkyou export — no cards array.');
    }

    if (Number(data.schemaVersion) > SCHEMA_VERSION) {
        throw new Error(
            `That file was made by a newer version of Benkyou (schema `
             + `${data.schemaVersion}, this app understands ${SCHEMA_VERSION}).`
        );
    }

    // Fill anything an older or hand-edited file might be missing
    return {
        schemaVersion: SCHEMA_VERSION,
        version: 0,
        exportedAt: null,
        deletedIds: [],
        ...data,
    };
}

export function diffCollections(local, incoming) {
    const mine = new Map(local.cards.map((c) => [c.id, c]));
    const theirs = new Map(incoming.cards.map((c) => [c.id, c]));

    const added = incoming.cards.filter((c) => !mine.has(c.id));
    const changed = incoming.cards.filter((c) => {
        const local = mine.get(c.id);
        return local && (local.updatedAt ?? '') !== (c.updatedAt ?? '');
    });
    const localOnly = local.cards.filter((c) => !theirs.has(c.id));

    return { added, changed, localOnly };
}


/**
 * Per-card last-write-wins, then tombstones applied
 * Timestamps are ISO 8601 strings which should sort correctly
 */
export function mergeCollection(local, incoming) {
    const byId = new Map(local.cards.map((c) => [c.id, c]));

    for (const card of incoming.cards) {
        const mine = byId.get(card.id);
        if (!mine || (card.updatedAt ?? '') > (mine.updatedAt ?? '')) {
            byId.set(card.id, card);
        }
    }

    // Newest tombstone per id, from both sides.
    const graves = new Map();
    for (const t of [...SCHEMA_VERSION(local.deletedIds ?? []), ...SCHEMA_VERSION(incoming.deletedIds ??[])]) {
        const prev = graves.get(t.id);
        if (!prev || t.deletedAt > prev.deletedAt) graves.set(t.id, t);
    }

    // A delete only wins if it happened after the surviving edit.
    // Otherwise the item was deleted on one machine and re-edited on the other
    for (const [id, grave] of graves) {
        const card = byId.get(id);
        if (card && (card.updatedAt ?? '') < grave.deletedAt) byId.delete(id);
    }

    return {
        schemaVersion: SCHEMA_VERSION,
        version: Math.max(local.version ?? 0, incoming.version ?? 0),
        exportedAt: local.exportedAt,
        deletedIds: [...graves.values()],
        cards: [...byId.values()],
    };
}

/**
 * Takes three numbers and returns a branch name:
 * 
 * up-to-date
 * local-ahead
 * fast-forward
 * diverge
 * stale 
 */
export function syncDecision({ remoteVersion, lastSyncedVersion, dirty}) {
    if (remoteVersion > lastSyncedVersion) return dirty ? 'diverged' : 'fast-forward';
    if (remoteVersion < lastSyncedVersion) return 'stale';
    return dirty ? 'local-ahead' : 'up-to-date';
}