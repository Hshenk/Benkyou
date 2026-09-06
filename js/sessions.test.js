import { mergeSessions, parseLog, emptyLog } from './sessions.js';

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

const heading = document.createElement('h2');
heading.textContent = 'Sessions';
results.append(heading);

const s = (id, startedAt) => ({ id, startedAt, endedAt: startedAt, facets: [], results: [] });

const a = s('a', '2026-09-01T10:00:00.000Z');
const b = s('b', '2026-09-02T10:00:00.000Z');
const c = s('c', '2026-09-03T10:00:00.000Z');

// --- Merge ---
check('unions disjoint logs',
  mergeSessions([a], [b]).map((x) => x.id), ['a', 'b']);

check('is idempotent',
  mergeSessions([a, b], [a, b]).map((x) => x.id), ['a', 'b']);

check('is order-independent',
  mergeSessions([c], [a]).map((x) => x.id), mergeSessions([a], [c]).map((x) => x.id));

check('sorts oldest first regardless of input order',
  mergeSessions([c, a], [b]).map((x) => x.id), ['a', 'b', 'c']);

check('empty local keeps everything incoming',
  mergeSessions([], [a, b]).map((x) => x.id), ['a', 'b']);

// --- Parsing ---
check('fills missing fields',
  parseLog('{"sessions":[]}'), emptyLog());

check('drops malformed records',
  parseLog('{"sessions":[{"id":"x"},' + JSON.stringify(a) + ']}').sessions.map((x) => x.id),
  ['a']);

const summary = document.createElement('h2');
summary.textContent = `${passed} passed, ${failed} failed`;
results.append(summary);
