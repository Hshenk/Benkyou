# Guide 04 — The card list

**You'll build:** the Cards view — a search bar, a live count, and a list of card
rows generated from data, with an empty state.

**You'll learn:** `<template>`, building DOM in JS without string concatenation,
`textContent` vs `innerHTML`, multi-column grid rows with truncation, hover-revealed
actions, and `:focus-within`.

This is the first guide where markup comes from *data* rather than being typed by
hand — the step 3 in [frontend-setup.md §3](../frontend-setup.md)'s workflow.

---

## Step 1 — The static row first

Do **not** start by writing the render function. Build one hardcoded row, style it
until it looks right, and only then generalize it. Debugging layout and debugging
JS at the same time is how an afternoon disappears.

Replace `#view-cards`:

```html
<section class="view" id="view-cards">
    <h2 class="view__title">Cards</h2>

    <div class="toolbar">
        <input class="input toolbar__search" type="search" id="card-search"
               placeholder="Search cards…" aria-label="Search cards">
        <p class="toolbar__count" id="card-count">1 card</p>
    </div>

    <ul class="card-list" id="card-list" role="list">

        <li class="card-row">
            <span class="type-badge" data-type="vocab">Vocab</span>

            <p class="card-row__jp" lang="ja">食[た]べる</p>

            <div class="card-row__body">
                <p class="card-row__meaning">to eat</p>
                <div class="card-row__tags">
                    <span class="chip">Topic: Food</span>
                    <span class="chip">Level: N5</span>
                </div>
            </div>

            <div class="card-row__actions">
                <button class="btn btn--sm btn--ghost" type="button" data-action="edit">Edit</button>
                <button class="btn btn--sm btn--ghost" type="button" data-action="delete">Delete</button>
            </div>
        </li>

    </ul>

    <p class="empty" id="card-empty" hidden></p>
</section>
```

### Notes

**`<ul role="list">` — this is where guide 01's reset pays off.** That reset only
stripped bullets from `ul[role="list"]`, deliberately. Removing `list-style` from a
list makes Safari's VoiceOver stop announcing it as a list; re-declaring the role
puts that back. So the attribute isn't decoration — it's the thing that makes the
styling safe.

A card list genuinely *is* a list, so `<ul>`/`<li>` is the right element. Using
`<div>`s here would be the same mistake as clickable divs in guide 02.

**`type="search"`** gets you a native clear (×) button inside the field, and it's
rendered dark because of `color-scheme: dark` from guide 01. `aria-label` gives it
an accessible name, since there's no visible `<label>` — the placeholder doesn't
count.

**`data-type="vocab"` on the badge** rather than a class like `.type-badge--vocab`.
Both work. The attribute wins here because in step 4 the JS sets it with one line
(`badge.dataset.type = card.type`) instead of managing class strings.

---

## Step 2 — Row layout

Append to `style.css`:

```css
/* ------ Toolbar ------ */
.toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
}

.toolbar__search {
    flex: 1 1 auto;
    max-width: 340px;
}

.toolbar__count {
    color: var(--text-muted);
    font-size: 14px;
    margin-left: auto;
}

/* ------ Card list ------ */
.card-list {
    border-top: 1px solid var(--border);
}

.card-row {
    display: grid;
    grid-template-columns: 76px minmax(0, 1.1fr) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-2);
    border-bottom: 1px solid var(--border);
}

.card-row:hover {
    background: var(--surface-1);
}

.card-row__jp {
    font-size: 22px;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.card-row__body {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
}

.card-row__meaning {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.card-row__tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
}

.card-row__tags:empty {
    display: none;
}

/* ------ Type badge ------ */
.type-badge {
    border-radius: var(--radius);
    color: var(--text-invert);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    padding: 2px 0;
    text-align: center;
    text-transform: uppercase;
}

.type-badge[data-type="vocab"]    { background: var(--good); }
.type-badge[data-type="sentence"] { background: var(--tag); }
.type-badge[data-type="kanji"] {
    background: var(--accent);
    color: var(--text-on-accent);
}

/* ------ Row actions ------ */
.card-row__actions {
    display: flex;
    gap: var(--space-1);
    opacity: 0;
    transition: opacity 120ms ease;
}

.card-row:hover .card-row__actions,
.card-row:focus-within .card-row__actions {
    opacity: 1;
}

.btn--sm {
    font-size: 13px;
    padding: var(--space-1) var(--space-2);
}

/* ------ Empty state ------ */
.empty {
    color: var(--text-muted);
    padding: var(--space-5) var(--space-2);
    text-align: center;
}
```

### Notes

**The four-column track** is `76px minmax(0, 1.1fr) minmax(0, 1fr) auto`. Three
different sizing strategies in one line, and it's worth naming them:

- `76px` — fixed. The badge should be the same width on every row so the column
  reads as a column. Content-sized would make it ragged.
- `minmax(0, 1.1fr)` and `minmax(0, 1fr)` — proportional. The Japanese column gets
  slightly more room than the meaning.
- `auto` — content-sized. The actions take exactly the width their buttons need.

**Truncation only works because of `minmax(0, …)`.** This is guide 03's lesson
paying a dividend. `text-overflow: ellipsis` needs three things together —
`overflow: hidden`, `white-space: nowrap`, and *an element that is actually
constrained*. With a bare `1fr` (which means `minmax(auto, 1fr)`), a long sentence
card would widen its column instead of ellipsing, and push the actions off-screen.
`minmax(0, 1fr)` is what makes the column narrower than its content, which is what
lets the ellipsis happen.

Same reason `.card-row__body` needs `min-width: 0`: it's a grid item *and* a grid
container, and its default `min-width: auto` would refuse to shrink below the
meaning text, defeating the ellipsis inside it. Any time truncation "just won't
work," it's almost always an unconstrained ancestor.

**`margin-left: auto` on the count** — the auto-margin trick from guide 02. With
the search field capped at 340px there's leftover space; the auto margin absorbs
all of it and pins the count right.

**`flex: 1 1 auto`** is shorthand for `flex-grow: 1; flex-shrink: 1; flex-basis:
auto` — "take available space, give it back when squeezed." Combined with
`max-width`, the search grows to 340px and stops.

**Borders on `.card-list` (top) and `.card-row` (bottom)** rather than both on the
row. That gives you n+1 lines with no doubling and no `:last-child` exception.

**`opacity: 0` on the actions, not `visibility: hidden` or `display: none`.** The
difference matters: an `opacity: 0` element is still focusable and still in the tab
order. That's exactly what makes the `:focus-within` rule work — Tab into an
invisible Edit button and the row reveals its actions. `display: none` would remove
them from the tab order and hover-only actions would be keyboard-inaccessible.

**`:focus-within`** matches an element when *it or any descendant* has focus. It's
the reason hover-revealed UI can be keyboard-usable at all, and it's one selector.

**`.card-row__tags:empty`** — same `:empty` trick as guide 03's tag row. A card
with no tags collapses cleanly instead of leaving a gap.

At this point, tune it with DevTools until you like it. Then continue.

---

## Step 3 — The template

`<template>` holds markup the browser parses but does **not** render — nothing
inside it displays, scripts don't run, images don't load. It's a stamp you clone.

Move your `<li>` into one. The `<ul>` becomes empty, and the template goes just
before the closing `</section>`:

```html
    <ul class="card-list" id="card-list" role="list"></ul>

    <p class="empty" id="card-empty" hidden></p>

    <template id="card-row-template">
        <li class="card-row">
            <span class="type-badge" data-field="type"></span>

            <p class="card-row__jp" lang="ja" data-field="expression"></p>

            <div class="card-row__body">
                <p class="card-row__meaning" data-field="meaning"></p>
                <div class="card-row__tags" data-field="tags"></div>
            </div>

            <div class="card-row__actions">
                <button class="btn btn--sm btn--ghost" type="button" data-action="edit">Edit</button>
                <button class="btn btn--sm btn--ghost" type="button" data-action="delete">Delete</button>
            </div>
        </li>
    </template>
</section>
```

Every element the JS needs to fill is marked `data-field="…"` and left empty. The
template carries the *shape*; JS supplies only text.

**Why a template instead of the obvious thing?** The obvious thing is:

```js
list.innerHTML = cards.map(c => `<li class="card-row">${c.data.expression}</li>`).join('');
```

[frontend-setup.md §3](../frontend-setup.md) specifically warns against this, and
for this app the reason is sharper than usual:

1. **Your card content contains characters that are HTML syntax.** Card text is
   hand-typed and includes `[`, `{`, and eventually `<`. Interpolating it into an
   HTML string means the browser parses your *data* as *markup*. A note containing
   `a < b` silently eats the rest of the row. `textContent` cannot do that —
   it sets text, full stop, so `食[た]べる` stays exactly those characters.
2. **The structure stays in HTML**, where you can read it, get Emmet and
   autocomplete, and see it in the Elements panel. A template is markup; a
   template literal is a string that happens to look like markup.
3. **You keep element references.** Cloning gives you real nodes to attach
   listeners and data to, rather than re-querying the document after a blind
   `innerHTML` write.

---

## Step 4 — Rendering

Append to `js/app.js`:

```js
// --- Card list ------------------------------------------------------------
const cardList = document.querySelector('#card-list');
const cardCount = document.querySelector('#card-count');
const cardEmpty = document.querySelector('#card-empty');
const searchInput = document.querySelector('#card-search');
const rowTemplate = document.querySelector('#card-row-template');

const TYPE_LABELS = { kanji: 'Kanji', vocab: 'Vocab', sentence: 'Sentence' };

// Stand-in for storage.js (overview.md §2.1). Replaced in M1.
const sampleCards = [
    {
        id: 'a1', type: 'vocab', meaning: 'to eat',
        tags: ['Topic: Food', 'Level: N5'],
        data: { expression: '食[た]べる', reading: 'たべる' },
    },
    {
        id: 'a2', type: 'kanji', meaning: 'eat, food',
        tags: ['Level: N5'],
        data: { character: '食', onyomi: ['ショク'], kunyomi: ['た.べる'], strokes: 9 },
    },
    {
        id: 'a3', type: 'sentence', meaning: 'Please (do it for me).',
        tags: ['Topic: Set phrases', 'Source: Nakama 1'],
        data: { expression: 'お 願[ねが]いします', literal: 'I humbly request' },
    },
    {
        id: 'a4', type: 'vocab', meaning: 'study, diligence',
        tags: ['Topic: School', 'Level: N4'],
        data: { expression: '勉強[べんきょう]', reading: 'べんきょう' },
    },
];

/**
 * The Japanese text a card leads with, whatever its type.
 */
function cardText(card) {
    return card.data.expression ?? card.data.character ?? '';
}

/**
 * The seam for M2's furigana renderer. For now, plain text — so
 * 食[た]べる displays literally, brackets and all. In M2 this becomes
 * a call into the tokenizer and nothing else in this file changes.
 */
function renderJapanese(el, text) {
    el.textContent = text;
}

function buildRow(card) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const field = (name) => row.querySelector(`[data-field="${name}"]`);

    row.dataset.id = card.id;

    const badge = field('type');
    badge.textContent = TYPE_LABELS[card.type];
    badge.dataset.type = card.type;

    renderJapanese(field('expression'), cardText(card));
    field('meaning').textContent = card.meaning;

    const tagBox = field('tags');
    for (const tag of card.tags) {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = tag;
        tagBox.append(chip);
    }

    return row;
}

function renderCards(cards, query = '') {
    const fragment = document.createDocumentFragment();
    for (const card of cards) {
        fragment.append(buildRow(card));
    }
    cardList.replaceChildren(fragment);

    cardCount.textContent = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`;

    cardEmpty.hidden = cards.length > 0;
    cardEmpty.textContent = query
        ? `No cards match “${query}”.`
        : 'No cards yet. Create one from New Card.';
}

// --- Search ---------------------------------------------------------------
function filterCards(query) {
    const q = query.trim().toLowerCase();
    if (!q) return sampleCards;

    return sampleCards.filter((card) =>
        [cardText(card), card.meaning, ...card.tags]
            .join(' ')
            .toLowerCase()
            .includes(q)
    );
}

searchInput.addEventListener('input', () => {
    const query = searchInput.value;
    renderCards(filterCards(query), query);
});

// --- Row actions ----------------------------------------------------------
cardList.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;

    const id = btn.closest('.card-row').dataset.id;
    console.log(btn.dataset.action, id);
});

// --- Start ----------------------------------------------------------------
renderCards(sampleCards);
```

### What's going on

**`rowTemplate.content`** is a `DocumentFragment` — the template's parsed children,
living outside the document. `.firstElementChild` is the `<li>`.

**`.cloneNode(true)`** copies the node. The `true` means *deep* — children
included. `cloneNode(false)` would give you a bare `<li>` with nothing in it, which
is a fun ten minutes of confusion. Always clone; never take the template's own node,
or you'll empty the template after the first row.

**The `field()` helper** is a small local closure so you write `field('meaning')`
instead of `row.querySelector('[data-field="meaning"]')` five times. Note it queries
within `row`, not the document — scoped queries are why cloning gives you a node
handle in the first place.

**`row.dataset.id = card.id`** stamps the card id onto the DOM. That's how the
click handler at the bottom knows which card was acted on without a lookup table.
Same `data-` pattern as `data-view` in guide 02 and `data-type-fields` in guide 03 —
by now it should feel routine.

**`document.createDocumentFragment()`** is a lightweight off-document container.
Appending 500 rows to the live list one at a time can trigger layout repeatedly;
building them in a fragment and inserting once means the browser does that work a
single time. Cheap habit, real benefit at scale.

**`replaceChildren(fragment)`** empties the list and inserts the new content in one
call. It replaces the old `while (el.firstChild) el.removeChild(el.firstChild)`
dance, and it's clearer than `innerHTML = ''`.

**`el.append()` vs `el.appendChild()`** — `append` accepts multiple arguments and
plain strings, and returns nothing. `appendChild` takes exactly one node. Use
`append` unless you need the return value.

**`renderJapanese` exists to be replaced.** Right now it's `textContent` and rows
show `食[た]べる` literally, brackets and all. That's honest — the tokenizer is M2
([overview.md §2.2](../../overview.md)), and faking ruby in the sample data would
hide the work. Defining the seam now means M2 changes this one function and no
call site.

**Search is not debounced, on purpose.** Filtering an in-memory array of a few
thousand cards is sub-millisecond; a debounce would only add lag. You *will* need
the debounce utility in M1 for localStorage writes, where the expensive thing is
`JSON.stringify` on every keystroke ([overview.md §2.1](../../overview.md)) — that's
the right place for it. Reaching for a debounce reflexively is a common way to make
a UI feel worse.

**The `input` event, not `change`.** `input` fires on every keystroke; `change`
only fires on blur. For live filtering you want `input`.

**Row actions use delegation again** — one listener on the `<ul>`, and it works for
rows that don't exist when it's attached. That is the entire reason delegation
matters here, and it's why guide 02 introduced it early.

---

## Checkpoint

- Four rows, badges color-coded by type: green Vocab, vermilion Kanji, blue-grey
  Sentence — all the same width.
- Hovering a row lightens it and fades in Edit / Delete.
- **Tab into the list.** The actions appear on the focused row. That's
  `:focus-within` doing what hover can't.
- Type `eat` in the search box — two rows, count updates to "2 cards".
- Type `nakama` — one row. Tags are searched too.
- Type `zzz` — no rows, and the empty state reads *No cards match "zzz"*.
- Clear the search with the field's × button; all four return.
- Click Edit on a row: console logs `edit a1` with the right id.
- The Japanese column shows `食[た]べる` with visible brackets. Correct for now.

### DevTools exercises

1. **Find `#card-row-template` in the Elements panel.** Its contents are there but
   nothing renders. Expand it. That's what "parsed but inert" looks like.
2. **Change `.card-row`'s `grid-template-columns` middle value to `1fr`** (dropping
   `minmax(0, …)`), then paste a very long meaning into the sample data. The
   ellipsis stops working and the layout blows out. Restore it. This is the single
   most useful grid debugging instinct to build.
3. **Set `.card-row__actions` to `visibility: hidden`** instead of `opacity: 0`,
   then Tab through the list. The buttons are now unreachable — you can focus them
   in principle but never see them. That's the accessibility difference between the
   two properties.
4. **Select a row and edit `data-type` to `kanji`** in the Elements panel. The badge
   recolors instantly. Attribute selectors are live.
5. **Break it on purpose:** in `buildRow`, change `cloneNode(true)` to
   `cloneNode(false)`. Four empty rows. Now you've seen that failure and will
   recognize it.

---

## Where the stylesheet stands

```
Reset → Design Tokens → Base → Japanese Text → Layout primitives → Chips
      → Top bar → Nav → Views → Forms → Inputs → Segmented control
      → Tag row → Buttons → Toolbar → Card list → Type badge
      → Row actions → Empty state
```

That's most of a design system: surfaces, type, chips, buttons, inputs, rows. Guide
05 should mostly *compose* what's here rather than add much new.

---

## Next

**Guide 05 — Study selection:** the faceted tag screen from
[overview.md §2.6](../../overview.md) — one collapsible section per namespace,
checkboxes in a responsive grid via `repeat(auto-fit, minmax(…))`, live pool count,
and the Study button. `<details>`/`<summary>` gives you the collapsing for free, and
`accent-color` finally earns the line you added in guide 02.

Tell me how this one goes — particularly whether `<template>` + cloning felt
natural coming from JS, since guide 06 leans on the same pattern for the study card.
