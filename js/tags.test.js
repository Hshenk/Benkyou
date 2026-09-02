import { splitTag, canonicalTag, tagKey, normalizeTags } from './tags.js';

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
heading.textContent = 'Tags';
results.append(heading);

// --- Splitting ---
check('splits on first colon',
  splitTag('Topic: Set phrases'), { namespace: 'Topic', value: 'Set phrases' });
check('collapses inner spaces',
  splitTag('Topic:   Set   phrases'), { namespace: 'Topic', value: 'Set phrases' });
check('no namespace',
  splitTag('Food'), { namespace: '', value: 'Food' });

// --- Canonical form ---
check('lowercase input',   canonicalTag('type: kanji'), 'Type: Kanji');
check('uppercase input',   canonicalTag('TYPE: KANJI'), 'Type: Kanji');
check('missing space',     canonicalTag('Type:Kanji'),  'Type: Kanji');
check('already correct',   canonicalTag('Type: Kanji'), 'Type: Kanji');
check('multi-word value',  canonicalTag('topic: set phrases'), 'Topic: Set Phrases');
check('JLPT level kept',   canonicalTag('level: N5'),   'Level: N5');
check('Japanese untouched', canonicalTag('topic: 食べ物'), 'Topic: 食べ物');

// --- Identity ---
check('case-insensitive identity',
  tagKey('TYPE: KANJI') === tagKey('type: kanji'), true);
check('spacing-insensitive identity',
  tagKey('Type:Kanji') === tagKey('Type:  Kanji'), true);
check('different tags differ',
  tagKey('Type: Kanji') === tagKey('Type: Vocab'), false);

// --- Normalising a list ---
check('merges duplicates',
  normalizeTags(['Type: Kanji', 'type: kanji', 'Level: n5']),
  ['Type: Kanji', 'Level: N5']);
check('empty list', normalizeTags([]), []);
check('undefined is safe', normalizeTags(undefined), []);

const summary = document.createElement('h2');
summary.textContent = `Tags: ${passed} passed, ${failed} failed`;
summary.className = failed ? 'fail' : 'pass';
results.append(summary);
