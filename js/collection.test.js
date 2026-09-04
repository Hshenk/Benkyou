import { parseCollection, diffCollections, syncDecision } from './collection.js';

const results = document.querySelector('#results');
let passed = 0, failed = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  ok ? passed++ : failed++;

  const line = document.createElement('p');
  line.className = ok ? 'pass' : 'fail';
  line.style.whiteSpace = 'pre';
  line.textContent = ok ? `PASS  ${label}`
                        : `FAIL  ${label}\n  expected ${e}\n  actual   ${a}`;
  results.append(line);
}

function throws(label, fn) {
  try { fn(); check(label, 'no error', 'an error'); }
  catch { check(label, true, true); }
}

const heading = document.createElement('h2');
heading.textContent = 'Collection';
results.append(heading);

const card = (id, updatedAt, meaning = 'x') =>
  ({ id, updatedAt, meaning, type: 'vocab', tags: [], data: {} });

const collection = (cards, extra = {}) =>
  ({ schemaVersion: 1, version: 1, exportedAt: null, deletedIds: [], cards, ...extra });

// --- Parsing ---
throws('rejects invalid JSON',      () => parseCollection('{nope'));
throws('rejects a non-collection',  () => parseCollection('{"foo":1}'));
throws('rejects a newer schema',    () => parseCollection('{"schemaVersion":99,"cards":[]}'));
check('fills missing fields',
  parseCollection('{"cards":[]}').deletedIds, []);

// --- Diff ---
const local = collection([card('a', '2026-01-01'), card('b', '2026-01-01')]);
const incoming = collection([card('a', '2026-02-01'), card('c', '2026-01-01')]);
const d = diffCollections(local, incoming);

check('diff: added',      d.added.map((c) => c.id),     ['c']);
check('diff: changed',    d.changed.map((c) => c.id),   ['a']);
check('diff: local only', d.localOnly.map((c) => c.id), ['b']);

// --- Merge ---
const merged = mergeCollections(local, incoming);
check('merge keeps all three', merged.cards.map((c) => c.id).sort(), ['a', 'b', 'c']);
check('merge takes the newer card',
  merged.cards.find((c) => c.id === 'a').updatedAt, '2026-02-01');

// --- Tombstones ---
const deleted = collection([], { deletedIds: [{ id: 'b', deletedAt: '2026-03-01' }] });
check('tombstone removes the card',
  mergeCollections(local, deleted).cards.map((c) => c.id), ['a']);

const reEdited = collection([card('b', '2026-04-01')]);
const graved = collection([], { deletedIds: [{ id: 'b', deletedAt: '2026-03-01' }] });
check('edit after delete survives',
  mergeCollections(reEdited, graved).cards.map((c) => c.id), ['b']);


// --- Sync decisions (overview §2.9a) ---
const decide = (remoteVersion, lastSyncedVersion, dirty) =>
  syncDecision({ remoteVersion, lastSyncedVersion, dirty });

check('repo ahead, clean → fast-forward', decide(6, 5, false), 'fast-forward');
check('repo ahead, dirty → diverged',     decide(6, 5, true),  'diverged');
check('level, clean → up to date',        decide(5, 5, false), 'up-to-date');
check('level, dirty → local ahead',       decide(5, 5, true),  'local-ahead');
check('repo behind → stale',              decide(4, 5, false), 'stale');
check('repo behind, dirty → stale',       decide(4, 5, true),  'stale');
check('first run, empty repo',            decide(0, 0, false), 'up-to-date');


const summary = document.createElement('h2');
summary.textContent = `Collection: ${passed} passed, ${failed} failed`;
summary.className = failed ? 'fail' : 'pass';
results.append(summary);
