/**
 * Storage.js - Handles the storage of cards and settings.
 * This is the only file that touches localStorage
 * Views import from here
 */
import { canonicalTag, tagKey, normalizeTags } from "./tags.js";

const COLLECTION_KEY = 'benkyou:collection';
const DEVICE_KEY = 'benkyou:device';
const SCHEMA_VERSION = 1;

// --- State --- 
let collection = null;
let device = null;
let loadFailed = false;

const bus = new EventTarget();

function emptyCollection() {
    return { schemaVersion: SCHEMA_VERSION, version: 0, exportedAt: null, deletedIds: [], cards: [] };
}

function stamp(card) {
    const now = new Date().toISOString();
    return { createdAt: now, updatedAt: now, timesSeen: 0, timesMissed: 0, ...card };
}

// --- Load ---
function load() {
    let raw = null;
    try {
        raw = localStorage.getItem(COLLECTION_KEY);
    } catch (err) {
        console.error('localStorage unavailable', err);
    }

    if (raw === null) {
        collection = emptyCollection();
    } else {
        try {
            collection = JSON.parse(raw);
        } catch (err) {
            // Do not fall back to an empty collection as we don't want to overwrite anything
            console.error('Collection is corrupt; refusing to write until resolved', err);
            loadFailed = true;
            collection = emptyCollection();
        }
    }

    try {
        device = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? 'null')
            ?? { dirty: false, lastSyncedVersion: 0, lastExportedAt: null};
    } catch {
        device = { dirty: false, lastSyncedVersion: 0, lastExportedAt: null};
    }
}

load();


/**
 * Write to localStorage and announce the change
 */
function write() {
    if (loadFailed) {
        alert('Benkyou could not read your saved cards, so it will not overwrite '
        + 'them. Check the console, and back up localStorage before continuing.');
    return false;
    }

    try {
        localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
        localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
    } catch (err) {
        console.error(err);
        alert(err.name === 'QuotaExceededError'
            ? 'Out of browser storage. Export your cards before adding more.'
            : 'Could not save. See the console.');
        return false;
    }

    bus.dispatchEvent(new Event('change'));
    return true;
}

function persist() {
    device.dirty = true;
    return write();
}


// --- Reading ---
export function getCards() {
    return collection.cards;
}

export function getCard(id) {
    return collection.cards.find((c) => c.id === id) ?? null;
}

// Every tag in use, sorted
export function allTags() {
    const byKey = new Map();
    for (const card of collection.cards) {
        for (const tag of card.tags ?? []) {
            const key = tagKey(tag);
            if (!byKey.has(key)) byKey.set(key, canonicalTag(tag));
        }
    }
    return [...byKey.values()].sort();
}

// --- Writing ---
export function saveCard(card) {
    const now = new Date().toISOString();
    const clean = { ...card, tags: normalizeTags(card.tags) };

    if (clean.id) {
        const i = collection.cards.findIndex((c) => c.id === clean.id);
        if (i === -1) return null;
        collection.cards[i] = { ...collection.cards[i], ...clean, updatedAt: now };
        persist();
        return collection.cards[i];
    }

    const created = stamp({ ...clean, id: crypto.randomUUID() });
    collection.cards.push(created);
    persist();
    return created;
}

export function deleteCard(id) {
    const i = collection.cards.findIndex((c) => c.id === id);
    if (i === -1) return false;

    collection.cards.splice(i, 1);
    collection.deletedIds.push({ id, deletedAt: new Date().toISOString() });
    persist();
    return true;
}

export function onChange(fn) {
    bus.addEventListener('change', fn);
    return () => bus.removeEventListener('change', fn);
}

// --- Transfer ---
export function getCollection() {
    return collection;
}

export function isDirty() {
    return device.dirty;
}

export function lastExportedAt() {
    return device.lastExportedAt;
}

/**
 * The collection as it would be exported
 * Nothing is committed yet
 */
export function buildExport() {
    return {
        ...collection,
        version: Math.max(collection.version, device.lastSyncedVersion) + 1,
        exportedAt: new Date().toISOString(),
    };
}

/** Call only after the file has been written */
export function commitExport(payload) {
    collection.version = payload.version;
    collection.exportedAt = payload.exportedAt;

    device.dirty = false;
    device.lastSyncedVersion = payload.version;
    device.lastExportedAt = payload.exportedAt;

    write();
}

export function replaceCollection(next, { dirty = false, syncedVersion = null } = {}) {
    collection = next;
    device.dirty = dirty;
    if ( syncedVersion !== null ) device.lastSyncedVersion = syncedVersion;
    write();
}

/** Record that we've seen a shared version without adopting its contents */
export function markSynced(version) {
    device.lastSyncedVersion = Math.max(device.lastSyncedVersion, version);
    write();
}

export function lastSyncedVersion() {
    return device.lastSyncedVersion;
}


// --- Tag Management ---
/** Map of tagKey -> { tag, count } */
export function tagCounts() {
    const counts = new Map();

    for (const card of collection.cards) {
        const seen = new Set();

        for (const tag of card.tags ?? []) {
            const key = tagKey(tag);
            if (seen.has(key)) continue;
            seen.add(key);

            const entry = counts.get(key) ?? { tag: canonicalTag(tag), count: 0 };
            entry.count += 1;
            counts.set(key, entry);
        }
    }

    return counts;
}

/**
 * Rename a tag everywhere.
 * If it already exists on a card, they merge
 */
export function renameTag(from, to) {
    const fromKey = tagKey(from);
    const target = canonicalTag(to);
    if (!target) return 0;

    let touched = 0;

    for (const card of collection.cards) {
        const tags = card.tags ?? [];
        if (!tags.some((t) => tagKey(t) === fromKey)) continue;

        card.tags = normalizeTags(tags.map((t) => (tagKey(t) === fromKey ? target : t)));
        card.updatedAt = new Date().toISOString();
        touched += 1;
    }

    if (touched) persist();
    return touched;
}

// remove a tag from every card. Returns number removed
export function deleteTag(tag) {
    const key = tagKey(tag);
    let touched = 0;

    for (const card of collection.cards) {
        const tags = card.tags ?? [];
        const next = tags.filter((t) => tagKey(t) !== key);
        if (next.length === tags.length) continue;

        card.tags = next;
        card.updatedAt = new Date().toISOString();
        touched += 1;
    }

    if (touched) persist();
    return touched;
}

// One-time pass rewriting every card's tags into canonical
export function normalizeAllTags() {
    let touched = 0;

    for (const card of collection.cards) {
        const before = JSON.stringify(card.tags ?? []);
        const after = normalizeTags(card.tags);
        if (JSON.stringify(after) === before) continue;

        card.tags = after;
        card.updatedAt = new Date().toISOString();
        touched += 1;
    }

    if (touched) persist();
    return touched;
}

/**
 * Fold a finished session's count into the cards
 * 
 * Uses write() instead of persist() because card stats are minor enough not to count as an edit to cards
 */
export function recordStudy(results) {
    const byId = new Map(collection.cards.map((c) => [c.id, c]));
    let touched = 0;

    for (const { id, seen, missed } of results) {
        const card = byId.get(id);
        if (!card) continue;

        card.timesSeen = (card.timesSeen ?? 0) + seen;
        card.timesMissed = (card.timesMissed ?? 0) + missed;
        touched += 1;
    }

    if (touched) write();
    return touched;
}