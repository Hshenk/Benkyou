/**
 * Storage.js - Handles the storage of cards and settings.
 * This is the only file that touches localStorage
 * Views import from here
 */
import { canonicalTag, tagKey, normalizeTags } from "./tags.js";

const COLLECTION_KEY = 'benkyou:collection';
const DEVICE_KEY = 'benkyou:device';
const SCHEMA_VERSION = 1;

// --- Seed Data ---
// Only used on first run with empty storage.
const SEED = [
  { id: 'a1', type: 'vocab', meaning: 'to eat',
    tags: ['Topic: Food', 'Level: N5'],
    data: { expression: '食[た]べる', reading: 'たべる' } },
  { id: 'a2', type: 'kanji', meaning: 'eat, food',
    tags: ['Level: N5'],
    data: { character: '食', onyomi: ['ショク'], kunyomi: ['た.べる'], strokes: 9 } },
  { id: 'a3', type: 'sentence', meaning: 'Please (do it for me).',
    tags: ['Topic: Set phrases', 'Source: Nakama 1'],
    data: { expression: 'お 願[ねが]いします', literal: 'I humbly request' } },
  { id: 'a4', type: 'vocab', meaning: 'study, diligence',
    tags: ['Topic: School', 'Level: N4'],
    data: { expression: '勉強[べんきょう]', reading: 'べんきょう' } },
  { id: 'a5', type: 'grammar', meaning: 'topic marker — "as for X"',
    tags: ['Topic: Particles', 'Level: N5'],
    data: { expression: 'は', example: '私[わたし]*b:は* 学生[がくせい]です' } },
];

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
        collection.cards = SEED.map(stamp);
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
        version: collection.version + 1,
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

export function replaceCollection(next, { synced = false } = {}) {
    collection = next;
    device.dirty = !synced;
    if ( synced) device.lastSyncedVersion = next.version;
    write();
}