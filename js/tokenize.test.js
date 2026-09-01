import { tokenize, plainText } from './tokenize.js';

const results = document.querySelector('#results');
let passed = 0, failed = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  ok ? passed++ : failed++;

  const line = document.createElement('p');
  line.className = ok ? 'pass' : 'fail';
  line.textContent = ok ? `PASS  ${label}` : `FAIL  ${label}\n  expected ${e}\n  actual   ${a}`;
  line.style.whiteSpace = 'pre';
  results.append(line);
}

/** Convenience: what plain text does this markup reduce to? */
const plain = (src) => plainText(tokenize(src));
/** Convenience: the term of the first link token found. */
const firstTerm = (src) => tokenize(src).find((t) => t.type === 'link')?.term;

// --- Furigana (overview §2.2) ---
check('simple furigana',
  tokenize('食[た]べる'),
  [{ type: 'furigana', base: '食', reading: 'た' },
   { type: 'text', value: 'べる' }]);

check('separator space is consumed', plain('お 願[ねが]いします'), 'お願いします');
check('multiple blocks',            plain('私[わたし]は 学生[がくせい]です'), '私は学生です');
check('no furigana passes through', plain('たべる'), 'たべる');
check('unmatched [ is literal',     plain('食[た'), '食[た');

// --- Links (overview §2.7) ---
check('link term strips furigana',  firstTerm('{書斎[しょさい]}'), '書斎');
check('pipe form',                  firstTerm('{食べました|食べる}'), '食べる');
check('link display text',          plain('{書斎[しょさい]}は 静[しず]かです'), '書斎は静かです');
check('unmatched { is literal',     plain('{書斎'), '{書斎');

// --- Quotation marks are NOT delimiters (overview §2.7 "the trap") ---
check('corner brackets are text',
  plain('「おはよう」と 言[い]いました'), '「おはよう」と言いました');

// --- Highlights (overview §2.7a) ---
check('highlight colour',
  tokenize('*b:は*'),
  [{ type: 'highlight', color: 'blue', inner: [{ type: 'text', value: 'は' }] }]);

check('full colour name',   tokenize('*blue:は*')[0].color, 'blue');
check('splits on first colon only', plain('*b:a:b*'), 'a:b');
check('unknown colour is literal',  plain('*bl:は*'), '*bl:は*');
check('highlight inside sentence',
  plain('私[わたし]*b:は* 学生[がくせい]です'), '私は学生です');

// --- Nesting ---
check('highlight > link > furigana', firstTerm('*y:{書斎[しょさい]}*') ?? 
  tokenize('*y:{書斎[しょさい]}*')[0].inner.find((t) => t.type === 'link')?.term, '書斎');
check('nested plain text', plain('*y:{書斎[しょさい]}*'), '書斎');

// --- Escapes ---
check('escaped bracket',  plain('\\[literal\\]'), '[literal]');
check('escaped asterisk', plain('\\*b:は\\*'), '*b:は*');

const summary = document.createElement('h2');
summary.textContent = `${passed} passed, ${failed} failed`;
summary.className = failed ? 'fail' : 'pass';
results.prepend(summary);
