# Guide 08 — Splitting the JavaScript

**The question:** `study.js` needs a growing pile of things from `cards.js`. Should
it just import more?

**The answer:** no — the pull you're feeling is a signal that `cards.js` is doing
two unrelated jobs. Extract the shared job into its own module and both views
import *that*. Neither view imports the other.

---

## The diagnosis

Look at what's in `views/cards.js` right now. It's two files wearing a trench coat:

| Job | Code |
|---|---|
| **The card list *view*** | `cardList`, `searchInput`, `rowTemplate`, `buildRow`, `renderCards`, `filterCards`, the search and row-action listeners |
| **What a card *is*** | `sampleCards`, `TYPE_LABELS`, `cardText`, `questionText`, `detailsFor`, `renderJapanese` |

`study.js` needs the second column and none of the first. But because they share a
file, importing anything from `cards.js` drags in the whole view — including its
top-level side effects. Importing `TYPE_LABELS` runs `renderCards(sampleCards)`,
attaches the search listener, and does six `querySelector` calls, whether you
wanted that or not.

The giveaway is `questionText` and `detailsFor`. Neither has anything to do with
listing cards — they're only used by the *study* screen. They ended up in
`cards.js` because that's where the sample data was, not because they belong
there.

**The rule to hold onto: a view module may import from shared modules, but never
from another view.** Views are leaves of the import graph. When two views need the
same thing, that thing isn't view code — it's shared code that hasn't been given
its own file yet.

The reason isn't tidiness. Two views importing each other is a **circular import**,
and ES modules resolve those by giving you a partially-initialized module: a `const`
read before its module body finished throws a `ReferenceError: Cannot access before
initialization`, and it fires only on certain load orders. Structuring the graph so
cycles are impossible is much cheaper than debugging one.

---

## The target

```
js/
├── app.js              ← startup only: shell wiring, then init each view
├── store.js            ← the cards themselves        (M1 replaces this)
├── card.js             ← what a card IS              (pure, no DOM)
├── render.js           ← renderJapanese              (M2 replaces this)
└── views/
    ├── cards.js
    ├── editor.js
    └── study.js
```

```
app.js
  ├─→ views/cards.js  ─┐
  ├─→ views/editor.js  ├─→ card.js, render.js, store.js
  └─→ views/study.js  ─┘
```

Every arrow points down. No cycles are possible.

**Three of these files are not arbitrary** — they're seams the plan already calls
for:

- `store.js` is [overview.md §2.1](../../overview.md)'s storage interface. M1
  replaces its body with localStorage and nothing else changes.
- `render.js` is the M2 tokenizer/renderer seam.
- `card.js` is the discriminated union from §2.4 — the one place that knows what
  each `type` means.

So the split isn't a style preference. You're building the file boundaries the
architecture already assumed.

---

## Step 1 — `js/card.js`

Cut these four from `views/cards.js` and add `export`:

```js
/**
 * What a card *is* — the type discriminator from overview.md §2.4.
 * Pure functions: no DOM, no side effects, no imports.
 */

export const TYPE_LABELS = {
    kanji: 'Kanji',
    vocab: 'Vocab',
    sentence: 'Sentence',
    grammar: 'Grammar',
};

/** The Japanese a card leads with in a list. */
export function cardText(card) {
    return card.data.expression ?? card.data.character ?? '';
}

/** What the front of the card asks. Grammar asks with its example (§2.4). */
export function questionText(card) {
    if (card.type === 'grammar') return card.data.example;
    return card.data.expression ?? card.data.character ?? '';
}

/** [label, value] pairs for the back, by type. */
export function detailsFor(card) {
    switch (card.type) {
        case 'vocab':
            return [['Reading', card.data.reading]];
        case 'kanji':
            return [
                ["On'yomi", card.data.onyomi?.join('、')],
                ["Kun'yomi", card.data.kunyomi?.join('、')],
                ['Strokes', card.data.strokes],
            ];
        case 'sentence':
            return [['Literal', card.data.literal]];
        case 'grammar':
            return [['Point', card.data.expression]];
        default:
            return [];
    }
}
```

**This file imports nothing and touches no DOM**, which is what makes it safe for
anything to import. It's also the only file in the project you could unit-test
today with no browser at all — worth noticing, because M2's tokenizer will want to
live under the same constraint.

---

## Step 2 — `js/render.js`

```js
/**
 * The M2 seam (overview.md §2.2, §2.7, §2.7a).
 *
 * Today: plain text, so 食[た]べる and *b:は* display verbatim.
 * When the tokenizer lands, only this file changes — every call site
 * starts rendering ruby, jisho links and highlights at once.
 */
export function renderJapanese(el, text) {
    el.textContent = text;
}
```

A four-line module looks silly. It isn't. The whole promise of the seam is *"M2
changes one thing and three screens light up"* — and that's only literally true
once the thing is one file. Buried in `views/cards.js`, it was a function the study
screen had to reach into a view to borrow.

---

## Step 3 — `js/store.js`

```js
/**
 * The M1 seam — the storage interface from overview.md §2.1.
 *
 * Today: an in-memory array. Later: the localStorage implementation,
 * namespaced `benkyou:cards`. Callers go through the function either way.
 */

const cards = [
    {
        id: 'a1', type: 'vocab', meaning: 'to eat',
        tags: ['Topic: Food', 'Level: N5'],
        data: { expression: '食[た]べる', reading: 'たべる' },
    },
    // …the rest of sampleCards, unchanged
];

export function getCards() {
    return cards;
}
```

### Export a function, not the array

Two reasons, and the second is the one that matters.

**It's unambiguous.** `export const cards = [...]` gives importers a *live binding*
— they see reassignments made inside `store.js`, but can't reassign it themselves.
That's a subtle rule that surprises people. A function has no such subtlety.

**It survives M1.** [overview.md §2.1](../../overview.md) defines the contract as
`async getCards()`. When storage becomes real, this becomes:

```js
export async function getCards() { … }
```

and every call site changes from `getCards()` to `await getCards()` — a mechanical
edit with the compiler-ish help of an error at each site you miss. If callers had
imported a bare array, every one of them would need restructuring instead.

So: replace `sampleCards` with `getCards()` at all eleven call sites. Yes, it's
more typing today. It's the shape the plan already committed to.

---

## Step 4 — The views

**`views/cards.js`** loses everything you cut and gains a header:

```js
import { TYPE_LABELS, cardText } from '../card.js';
import { renderJapanese } from '../render.js';
import { getCards } from '../store.js';
```

**`views/study.js`** replaces its single import with:

```js
import { TYPE_LABELS, questionText, detailsFor } from '../card.js';
import { renderJapanese } from '../render.js';
import { getCards } from '../store.js';
```

That import block is also your bug fix. `study.js` currently *calls*
`renderJapanese`, `questionText` and `detailsFor` without defining or importing any
of them — they're unexported in `cards.js`, so the first card reveal throws
`ReferenceError`. Worth noting how the extraction fixed a real bug as a side
effect: code that's hard to import correctly is usually code that's in the wrong
place.

Note `../card.js` — two dots, because the views sit one directory deeper. Relative
specifiers are resolved against the importing file, and **the `.js` extension is
required**. Bare `'../card'` works in Node but not in browsers; there's no
resolver, just a URL fetch.

---

## Step 5 — Make startup explicit

Right now each view runs its work at import time: `renderCards(sampleCards)` and
`renderFacets(sampleCards)` sit at module top level. That works, but startup order
is invisible — it's whatever order the `import` lines happen to be in.

Give each view an exported `init`:

```js
// views/cards.js — at the bottom
export function initCards() {
    searchInput.addEventListener('input', () => { … });
    cardList.addEventListener('click', (event) => { … });
    renderCards(getCards());
}
```

```js
// app.js
import { initCards } from './views/cards.js';
import { initEditor } from './views/editor.js';
import { initStudy } from './views/study.js';

// …shell wiring: showView, the nav listener, the script toggle…

initEditor();
initCards();
initStudy();
showView('cards');
```

**This isn't only tidiness — it's what makes M1 possible without a second
refactor.** Once `getCards()` is async, the views can't render at import time; the
data won't exist yet. With `init()` functions, startup becomes:

```js
await loadCollection();
initEditor();
initCards();
initStudy();
```

(Top-level `await` works in modules, no wrapper needed.) With top-level side
effects, you'd be moving code out of module bodies under time pressure while also
writing the storage layer. Do it now, while it's a cut-and-paste.

---

## Addendum — what goes in each `init()`

### The rule

| Stays at module top level | Moves into `init()` |
|---|---|
| `import` statements | Every `addEventListener` call |
| `const` element lookups | The initial render |
| Function declarations | Any initial state sync |
| Module state (`selection`, `session`) | Anything that *reads data* |
| Constants (`MISS_LIMIT`) | |

The test: **does this line only define something, or does it make something
happen?** Definitions are free to run at import time. Anything that touches the
DOM's contents, registers a handler, or reads the collection is an *action*, and
actions belong in `init()` where their order is visible and controllable.

Element lookups sit on the line: they're technically actions, but they're
idempotent and the DOM is ready by the time a deferred module runs. Leaving them
at top level is fine — see the "one thing to watch" note above for when it isn't.

---

### `views/editor.js`

Everything below `showTypeFields` moves in. The file becomes:

```js
// --- Editor ---
const editorForm = document.querySelector('#editor-form');
const typeFieldsets = editorForm.querySelectorAll('[data-type-fields]');

/** Shows only the fieldset matching the chosen card type. */
function showTypeFields(type) {
    for (const fs of typeFieldsets) {
        const active = fs.dataset.typeFields === type;
        fs.hidden = !active;
        fs.disabled = !active;
    }
}

export function initEditor() {
    // Change bubbles, so one listener on the form covers every control in it.
    editorForm.addEventListener('change', (event) => {
        if (event.target.name === 'cardType') {
            showTypeFields(event.target.value);
        }
    });

    // Enter also confirms an IME candidate, so don't submit the form.
    editorForm.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && event.isComposing) {
            event.preventDefault();
        }
    });

    editorForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const data = Object.fromEntries(new FormData(editorForm));
        const intent = event.submitter?.value ?? 'save';

        console.log(intent, data);
    });

    showTypeFields(editorForm.querySelector('input[name="cardType"]:checked').value);
}
```

That last line is the initial state sync from guide 03 — it belongs *inside*
`init()` and *last*, after the listeners exist. It's the same shape as
`renderCards(getCards())` in `initCards()`: set up the wiring, then put the screen
into its starting state.

---

### `views/study.js`

Two screens in one file, so `initStudy()` collects both sets of listeners. Order:
selection wiring, session wiring, keyboard, then the initial render.

```js
export function initStudy() {
    // --- Selection ---
    facetsEl.addEventListener('change', (event) => {
        const input = event.target;
        if (!input.matches('.option__input')) return;

        const { namespace, value } = input.closest('.option').dataset;
        const chosen = selection.get(namespace);

        if (input.checked) chosen.add(value);
        else chosen.delete(value);

        updateFacetUI();
    });

    clearBtn.addEventListener('click', () => {
        for (const chosen of selection.values()) chosen.clear();
        for (const input of facetsEl.querySelectorAll('.option__input')) input.checked = false;
        updateFacetUI();
    });

    startBtn.addEventListener('click', () => {
        startSession(buildPool(getCards(), selection));
    });

    // --- Session ---
    gradeBar.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-grade]');
        if (!btn) return;

        if (btn.dataset.grade === 'reveal') revealAnswer();
        else grade(btn.dataset.grade);
    });

    document.querySelector('#quit-study')
        .addEventListener('click', () => showStage('select'));
    document.querySelector('#back-to-select')
        .addEventListener('click', () => showStage('select'));

    document.querySelector('#restudy-missed').addEventListener('click', () => {
        const missedIds = new Set(session.misses.keys());
        startSession(getCards().filter((card) => missedIds.has(card.id)));
    });

    // --- Keyboard ---
    document.addEventListener('keydown', (event) => {
        if (document.querySelector('#stage-session').hidden) return;
        if (event.target.closest('input, textarea, select')) return;
        if (event.isComposing) return;
        if (event.repeat) return;

        switch (event.key) {
            case ' ':
                event.preventDefault();
                if (faceBack.hidden) revealAnswer();
                break;
            case '1': grade('again'); break;
            case '2': grade('good'); break;
            case 'f': toggleScript(); break;
            case 'Escape': showStage('select'); break;
        }
    });

    // --- Start ---
    renderFacets(getCards());
}
```

**Delete the duplicate `startBtn` listener.** Guide 05's placeholder
(`console.log('study pool:', …)`, currently around line 150) was supposed to be
*replaced* by guide 06's version, not joined by it. Both are registered right now,
so both fire on every Study click. Harmless, but it's the kind of leftover that
gets confusing later — `addEventListener` adds, it never replaces.

---

### The `toggleScript` problem

`study.js` line 356 calls `toggleScript()`, which lives in `app.js`. It isn't
imported, so pressing **f** during a session throws `ReferenceError`.

This is the guide's own lesson arriving from a different direction: **two consumers
means it's shared code.** The script toggle is used by the top bar's button and by
the study keyboard handler, so it isn't view code — it wants its own module.

`js/script-toggle.js`:

```js
/**
 * Printed vs handwritten (kyokasho) Japanese forms — guide 07.
 * Shared: driven by the top-bar button and by the study screen's `f` key.
 */
const SCRIPT_KEY = 'benkyou:script';
const scriptToggle = document.querySelector('#script-toggle');

export function setScript(mode) {
    document.documentElement.dataset.script = mode;
    scriptToggle.setAttribute('aria-pressed', String(mode === 'hand'));

    try {
        localStorage.setItem(SCRIPT_KEY, mode);
    } catch {
        // Private mode or full quota. The toggle still works this session.
    }
}

export function toggleScript() {
    setScript(document.documentElement.dataset.script === 'hand' ? 'print' : 'hand');
}

export function initScriptToggle() {
    scriptToggle.addEventListener('click', toggleScript);

    let saved = 'print';
    try {
        saved = localStorage.getItem(SCRIPT_KEY) ?? 'print';
    } catch {}
    setScript(saved);
}
```

Then `study.js` adds `import { toggleScript } from '../script-toggle.js';` and
`app.js` calls `initScriptToggle()`.

Note what *didn't* work: putting `toggleScript` in `views/shell.js` and importing
it from `study.js`. That's a view importing a view — the exact cycle risk the rule
exists to prevent. When something is needed by two views, it moves *down* the
graph, never sideways.

---

## Optional — `views/shell.js`

`app.js` is currently doing two things itself: startup *and* the shell's own
behaviour (view switching, the script toggle). If you want the same rule applied
consistently, move `showView`, the nav listener, and the script toggle into
`views/shell.js` with an `initShell()`, leaving `app.js` as pure wiring:

```js
import { initShell, showView } from './views/shell.js';
import { initCards } from './views/cards.js';
import { initEditor } from './views/editor.js';
import { initStudy } from './views/study.js';

initShell();
initEditor();
initCards();
initStudy();
showView('cards');
```

Nine lines, and the whole startup sequence is readable at a glance. Worth it, but
do it after the rest works — one refactor at a time.

---

## Optional — splitting `study.js` later

At ~360 lines it's your biggest file, and it's genuinely two screens: the facet
selector and the session player. Don't split it now — but here's the boundary if it
keeps growing, because the obvious split doesn't work.

The coupling is one line: the Study button lives in the *selection* screen and has
to call `startSession()` in the *session* screen. Importing across would be a view
importing a view. Instead, let `app.js` connect them:

```js
// views/study-select.js
export function initStudySelect({ onStart }) {
    startBtn.addEventListener('click', () => onStart(buildPool(getCards(), selection)));
    renderFacets(getCards());
}
```

```js
// app.js
import { initStudySelect } from './views/study-select.js';
import { initStudySession, startSession } from './views/study-session.js';

initStudySession();
initStudySelect({ onStart: startSession });
```

Passing a callback into `init()` keeps both modules leaves of the graph — neither
knows the other exists, and the wiring is visible in `app.js` alongside everything
else. It's the same idea as `init()` itself: make the connection explicit at
startup rather than implicit in an import.

---

## Check it worked

- **No console errors on load**, and all three views still switch.
- **Start a session and reveal a card.** This is the real test — it's the path that
  was throwing `ReferenceError`.
- **Search still filters**, and the study screen's facet counts still update.
- **Grep for cross-view imports:** nothing in `views/` should import from
  `views/`. If something does, whatever it's reaching for wants to move down into
  `card.js`, `render.js`, or `store.js`.
- **Confirm the seams are single files.** Open `render.js` — when M2 lands, that
  file's four lines are the entire surface you're replacing.

### One thing to watch

Module scripts are deferred, so the DOM is ready when any of this runs — but the
top-level `querySelector` calls in each view still execute at *import* time, before
`initX()` is called. That's fine today. If you ever import a view module
conditionally, or move an element into a `<template>`, those constants become
`null` silently. Moving the `querySelector` calls inside `init()` closes that off
too, and is a reasonable thing to do while you're already in there.

---

## The general lesson

You hit this by feel — "there's a lot in study.js that requires stuff from
cards.js" — and that feeling is the most reliable module-boundary signal there is.

When module A keeps needing more from module B, the question is almost never *"how
do I import better?"* It's **"what is the thing they both actually depend on, and
does it have a name yet?"** Here it had three names: what a card is, how Japanese
renders, and where cards come from. Each wanted a file. Once they had one, the
import lists got shorter rather than longer — which is how you know the boundary
was right.
