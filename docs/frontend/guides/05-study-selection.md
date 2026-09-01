# Guide 05 — Study selection

**You'll build:** the faceted selection screen from
[overview.md §2.6](../../overview.md) — one collapsible section per tag namespace,
checkboxes with live counts, zero-result options greyed out, and a pool size that
updates as you narrow.

**You'll learn:** `<details>`/`<summary>`, `repeat(auto-fit, minmax(…))`, the
`:has()` parent selector, implicit labels, and deriving UI from data rather than
hardcoding it.

The screen is mostly composition — you already have chips, buttons, inputs, and
surfaces. The genuinely new work is in the JS, and one piece of it is the rule
[overview.md §2.6](../../overview.md) warns you'll second-guess.

---

## Step 0 — Fix two typos first

Neither is guide 05's fault, but both will confuse the checkpoint.

**`js/app.js`** — an unclosed attribute selector:

```js
const typeFieldsets = editorForm.querySelectorAll('[data-type-fields]');
//                                                                  ^ add this
```

An invalid selector throws `SyntaxError` at module load. Module execution stops
at that line, so every handler below it — the editor's *and* the whole card list —
never registers. Symptom: an empty Cards view and one red console error.

**`css/style.css` line 415** — `.segmented_label` should be `.segmented__label`.

This is the cause of what you reported after guide 03. `padding` and `cursor:
pointer` were never reaching the labels, which is precisely why the type options
looked cramped and didn't read as interactive. **Fix it, then reconsider the 8px
gap** — with the padding applied you may not want it, and you may not need the
dividers either.

Two typos, both a single missing character, both silent. Worth noticing the
pattern: `nav_btn`, `segmented_label`, `[data-type-fields`. The class name is the
join between three files and nothing validates it. When something is
inexplicably unstyled, checking the selector spelling is a faster first move than
reading the rules.

---

## Step 1 — One section, by hand

Same discipline as guide 04: build one static facet, style it, generalize after.

Replace `#view-study`:

```html
<section class="view" id="view-study" hidden>
    <h2 class="view__title">Study</h2>
    <p class="view__hint">
        Tick what you want to work on. A section with nothing ticked means “any”.
    </p>

    <div class="facets" id="facets">

        <details class="facet" open>
            <summary class="facet__summary">
                <span class="facet__name">Type</span>
                <span class="facet__selected"></span>
            </summary>
            <div class="facet__options">
                <label class="option">
                    <input class="option__input" type="checkbox">
                    <span class="option__label">Vocab</span>
                    <span class="option__count">2</span>
                </label>
                <label class="option">
                    <input class="option__input" type="checkbox">
                    <span class="option__label">Kanji</span>
                    <span class="option__count">1</span>
                </label>
                <label class="option">
                    <input class="option__input" type="checkbox">
                    <span class="option__label">Grammar</span>
                    <span class="option__count">1</span>
                </label>
            </div>
        </details>

    </div>

    <div class="study-bar">
        <p class="study-bar__count" id="pool-count">5 cards</p>
        <button class="btn btn--ghost" type="button" id="clear-facets">Clear</button>
        <button class="btn btn--primary" type="button" id="start-study">Study</button>
    </div>
</section>
```

### Notes

**`<details>` and `<summary>` give you a collapsible section with no JavaScript.**
The `<summary>` is the always-visible header and the click target; everything else
inside `<details>` shows only when open. `open` as an attribute is the initial
state, and the browser toggles it for you. You also get keyboard support and
correct screen-reader announcement for free — the same argument as real `<button>`s
in guide 02, and it saves an entire component's worth of code here.

**The checkbox is *inside* the label.** Guide 03 used `<label for="…">` pointing at
an `id`. This is the other valid form — *implicit* labeling, where wrapping does
the association and no `id` is needed. That matters here because these options are
generated from data: explicit labels would mean inventing a unique id per option
and guaranteeing no collisions. Wrapping sidesteps that entirely.

Rule of thumb: use `for`/`id` when the label and control sit apart in the layout,
or when you need the `id` anyway. Use wrapping for generated lists.

The whole label is also the click target, so the count on the right is clickable
too — a much bigger hit area than a 15px box.

**`.facet__selected` is empty for now.** JS fills it with "2 selected" so a
collapsed section still tells you it's doing something. A collapsed facet hiding
an active constraint is a real way to build a confusing session.

---

## Step 2 — Styling the facets

```css
/* ------ Facets ------ */
.facets {
    display: grid;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
}

.facet {
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
}

.facet__summary {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    list-style: none;
    padding: var(--space-2) var(--space-3);
    user-select: none;
}

/* Safari still needs this to drop the default triangle. */
.facet__summary::-webkit-details-marker {
    display: none;
}

.facet__summary::before {
    content: "▸";
    color: var(--text-muted);
    display: inline-block;
    transition: transform 150ms ease;
}

.facet[open] .facet__summary::before {
    transform: rotate(90deg);
}

.facet__name {
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.facet__selected {
    color: var(--text-faint);
    font-size: 13px;
    margin-left: auto;
}

.facet__options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: var(--space-1) var(--space-3);
    padding: 0 var(--space-3) var(--space-3);
}

/* ------ Facet options ------ */
.option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border-radius: var(--radius);
    cursor: pointer;
    padding: var(--space-1) var(--space-2);
}

.option:hover {
    background: var(--surface-2);
}

.option__input {
    flex: none;
    width: 15px;
    height: 15px;
    margin: 0;
}

.option__label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.option__count {
    color: var(--text-faint);
    font-size: 13px;
    margin-left: auto;
}

/* An option that would produce an empty pool. */
.option:has(:disabled) {
    color: var(--text-faint);
    cursor: default;
}

.option:has(:disabled):hover {
    background: none;
}
```

### The three ideas here

**`repeat(auto-fit, minmax(190px, 1fr))` — a grid that decides its own column
count.** Read it as: make as many columns as fit, each at least 190px, and let
them share the leftover space equally. A `Level` namespace with three values gets
three columns; a `Topic` with twelve wraps onto several rows. You never specify a
number, and you never write a media query.

This is the payoff for namespaces being *discovered from the data*
([overview.md §2.5](../../overview.md)) — you can't hardcode a column count for a
section whose size you won't know until you've written the cards.

> `auto-fit` vs `auto-fill`: with few items, `auto-fit` collapses the empty tracks
> so the items stretch to fill the row; `auto-fill` keeps the empty tracks and
> leaves the items narrow. `auto-fit` is what you want here.

**`list-style: none` on the `<summary>`** removes the default disclosure triangle
(browsers render it as a list marker), and `::-webkit-details-marker` covers
Safari, which hasn't caught up. Then `::before` draws a `▸` you control — which
rotates 90° via a `transform` when `[open]`, so the arrow animates and the browser
still owns the open/closed state.

`▸` is deliberate: it's the character
[overview.md §2.6](../../overview.md) used when sketching this screen.

**`:has()` is the parent selector**, and this is exactly what it's for. CSS could
never previously style an element based on its *descendants* — you'd have needed JS
to put a class on the label whenever its checkbox was disabled. `.option:has(:disabled)`
reads "an `.option` that contains a disabled element," so the whole row greys out
from the input's own state. One rule, no JS bookkeeping, and it can't fall out of
sync.

Note the flexbox pieces are all reused: `margin-left: auto` pushes the count right
(guide 02), and `flex: none` stops the checkbox from being squashed — `none` is
shorthand for `0 0 auto`, i.e. "don't grow, don't shrink."

---

## Step 3 — The study bar

```css
/* ------ Study bar ------ */
.study-bar {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--bg);
    border-top: 1px solid var(--border);
    padding: var(--space-3) 0;
}

.study-bar__count {
    font-size: 15px;
    margin-right: auto;
}

.btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
}
```

**`position: sticky; bottom: 0`** — the mirror of guide 02's top bar. The bar sits
in normal flow at the end of the content, but never scrolls out of view from the
bottom. With a long list of namespaces you can always see the pool size and reach
Study without scrolling down. That's the concrete requirement in
[overview.md §2.6](../../overview.md): *show the pool size before starting, so you
narrow up front rather than three cards in.*

**The opaque `background`** is not optional. A sticky element with a transparent
background lets content scroll visibly underneath it.

**`.btn:disabled`** goes in your Buttons section rather than here — it's a base
button state, and you'll want it on the editor's Save too.

---

## Step 4 — Templates

Move the static markup into templates and empty `#facets`. Put these just before
`</section>`:

```html
    <template id="facet-template">
        <details class="facet" open>
            <summary class="facet__summary">
                <span class="facet__name" data-field="name"></span>
                <span class="facet__selected" data-field="selected"></span>
            </summary>
            <div class="facet__options" data-field="options"></div>
        </details>
    </template>

    <template id="option-template">
        <label class="option">
            <input class="option__input" type="checkbox">
            <span class="option__label" data-field="label"></span>
            <span class="option__count" data-field="count"></span>
        </label>
    </template>
```

And make `#facets` empty: `<div class="facets" id="facets"></div>`.

---

## Step 5 — Deriving the facets from the cards

Append to `js/app.js`:

```js
// --- Study selection ------------------------------------------------------
const facetsEl = document.querySelector('#facets');
const poolCount = document.querySelector('#pool-count');
const startBtn = document.querySelector('#start-study');
const clearBtn = document.querySelector('#clear-facets');
const facetTemplate = document.querySelector('#facet-template');
const optionTemplate = document.querySelector('#option-template');

/** namespace -> Set of chosen values. Empty set = no constraint. */
const selection = new Map();

/** "Topic: Food" -> ["Topic", "Food"] */
function splitTag(tag) {
    const i = tag.indexOf(':');
    if (i === -1) return [null, tag.trim()];
    return [tag.slice(0, i).trim(), tag.slice(i + 1).trim()];
}

/** The values a card has in one namespace. `type` is a field, not a tag. */
function valuesFor(card, namespace) {
    if (namespace === 'Type') return new Set([TYPE_LABELS[card.type]]);

    const out = new Set();
    for (const tag of card.tags) {
        const [ns, value] = splitTag(tag);
        if (ns === namespace) out.add(value);
    }
    return out;
}

/** Discover every namespace and value present in the collection. */
function buildFacets(cards) {
    const facets = new Map();          // namespace -> Map(value -> count)

    // Type renders as the first facet even though it isn't a tag (§2.5).
    facets.set('Type', new Map());

    for (const card of cards) {
        const typeLabel = TYPE_LABELS[card.type];
        const types = facets.get('Type');
        types.set(typeLabel, (types.get(typeLabel) ?? 0) + 1);

        for (const tag of card.tags) {
            const [namespace, value] = splitTag(tag);
            if (!namespace) continue;

            if (!facets.has(namespace)) facets.set(namespace, new Map());
            const values = facets.get(namespace);
            values.set(value, (values.get(value) ?? 0) + 1);
        }
    }
    return facets;
}
```

### Notes

**Nothing is hardcoded.** Add a card tagged `Register: Casual` and a Register
section appears on this screen with no code change. That's the entire argument in
[overview.md §2.5](../../overview.md) for namespaced tags over fixed groups, and
this function is where the payoff actually lands.

**`Map`, not a plain object.** Two reasons that matter here: `Map` guarantees
insertion order for string keys and, more importantly, it can't collide with
`Object.prototype`. A tag namespace called `constructor` would be a genuinely
nasty bug with a plain object. Free-text user data belongs in a `Map`.

**`Type` is seeded before the loop** so it's always the first entry, matching the
mockup in §2.6. It's the one facet that isn't a tag — `type` is a real field
(§2.5), and `valuesFor` special-cases it. That special case is the price of
[overview.md §2.5](../../overview.md)'s decision, and it's one `if`.

**`splitTag` splits on the first colon and trims.** Your sample tags are written
`'Topic: Food'` with a space; §2.5 writes `'Topic:Activities'` without. Trimming
accepts both — but pick one convention when you start authoring, because
`Topic: Food` and `Topic:Food` would otherwise be indistinguishable in the data
while looking different in a diff.

---

## Step 6 — The pool builder

This is the rule [overview.md §2.6](../../overview.md) tells you you'll
second-guess. Write it once, carefully.

```js
/**
 * OR within a namespace, AND across namespaces (overview.md §2.6).
 * A namespace with nothing selected contributes no constraint.
 */
function buildPool(cards, chosenBy) {
    return cards.filter((card) => {
        for (const [namespace, chosen] of chosenBy) {
            if (chosen.size === 0) continue;              // "don't care"

            const cardValues = valuesFor(card, namespace);
            const matches = [...chosen].some((v) => cardValues.has(v));   // OR

            if (!matches) return false;                   // AND across namespaces
        }
        return true;
    });
}
```

### Why this shape

The whole rule is in the loop's control flow, so it's worth reading it as English:

- **`continue` on an empty set** is "empty selection means *don't care*, never
  *match nothing*." Get this wrong and the screen is unusable on load, because
  nothing is ticked yet and the pool would be zero.
- **`.some()` inside a namespace is the OR.** Ticking `Topic: Food` and
  `Topic: School` gives you both sets of cards, which is what you meant.
- **`return false` on the first miss is the AND across namespaces.** Every
  namespace with a selection must be satisfied. Adding `Source: Nakama 1` *narrows*
  the pool instead of growing it.

Use OR everywhere and ticking a Source grows the pool, which feels backwards. Use
AND everywhere and ticking two Topics gives their intersection, usually empty.
Faceted filtering is OR-within, AND-across.

**Deduplication is free** and worth noticing. §2.6 warns that a card matching via
two tags must appear once. Because this iterates *cards* and asks each one a
question — rather than iterating tags and collecting matches — a card can only be
returned once. Structuring the loop this way makes the bug impossible rather than
handled.

---

## Step 7 — Rendering, and the counts

```js
function renderFacets(cards) {
    const facets = buildFacets(cards);
    const fragment = document.createDocumentFragment();

    for (const [namespace, values] of facets) {
        if (!selection.has(namespace)) selection.set(namespace, new Set());

        const node = facetTemplate.content.firstElementChild.cloneNode(true);
        node.dataset.namespace = namespace;
        node.querySelector('[data-field="name"]').textContent = namespace;

        const optionsBox = node.querySelector('[data-field="options"]');

        for (const value of [...values.keys()].sort()) {
            const option = optionTemplate.content.firstElementChild.cloneNode(true);
            option.dataset.namespace = namespace;
            option.dataset.value = value;
            option.querySelector('[data-field="label"]').textContent = value;
            optionsBox.append(option);
        }

        fragment.append(node);
    }

    facetsEl.replaceChildren(fragment);
    updateFacetUI();
}

/**
 * How many cards this option would contribute, given every OTHER namespace's
 * constraints. Its own namespace is excluded on purpose — see notes.
 */
function countFor(namespace, value) {
    const others = new Map(selection);
    others.delete(namespace);

    return buildPool(sampleCards, others)
        .filter((card) => valuesFor(card, namespace).has(value))
        .length;
}

/** Patch the rendered facets in place. Never re-render — see notes. */
function updateFacetUI() {
    for (const option of facetsEl.querySelectorAll('.option')) {
        const { namespace, value } = option.dataset;
        const input = option.querySelector('.option__input');
        const n = countFor(namespace, value);

        option.querySelector('[data-field="count"]').textContent = n;
        input.disabled = n === 0 && !input.checked;
    }

    for (const facet of facetsEl.querySelectorAll('.facet')) {
        const chosen = selection.get(facet.dataset.namespace);
        facet.querySelector('[data-field="selected"]').textContent =
            chosen.size ? `${chosen.size} selected` : '';
    }

    const pool = buildPool(sampleCards, selection);
    poolCount.textContent = `${pool.length} ${pool.length === 1 ? 'card' : 'cards'}`;
    startBtn.disabled = pool.length === 0;
}

// --- Events ---------------------------------------------------------------
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
    console.log('study pool:', buildPool(sampleCards, selection));
});

renderFacets(sampleCards);
```

### The two subtle parts

**1. `countFor` deletes its own namespace, and that is the whole trick.**

The count beside `Topic: Food` should answer *"how many cards would this add?"* —
which means measuring it against the constraints from **other** namespaces only.

Say you tick `Topic: Food`. Within a namespace the rule is OR, so `Topic: School`
is still a perfectly good thing to tick next — it would *widen* the pool. But if
`countFor` included Topic's own selection, it would compute "cards that are Food
AND School," get 0, grey out School, and quietly make every other Topic
untickable. The screen would deadlock after your first click, and the bug would
look like a rendering problem rather than a logic one.

Excluding the namespace from its own count is standard faceted-search behavior,
and it's the thing that makes §2.6's *"grey out zero-result options"* requirement
correct rather than actively harmful.

**2. `input.disabled = n === 0 && !input.checked` — never disable a ticked box.**

Without the `&& !input.checked`, a selection could disable the very control you'd
use to undo it, and there'd be no way back except Clear. Any time you disable
controls based on state, check whether the rule can trap the user in that state.

**And one structural point: `updateFacetUI` patches, it doesn't re-render.**

Rebuilding the whole `#facets` tree on every checkbox would be simpler to write,
and it would throw away the `<details>` open/closed state, move focus to the body
mid-keyboard-navigation, and reset scroll. Guide 04 could re-render freely because
a card row holds no UI state. This screen does. The split — build the DOM once,
patch text and flags in place — is the normal answer, and recognizing which
situation you're in matters more than either technique.

---

## Checkpoint

Open **Study**:

- Four sections — **Type** first, then Level, Source, Topic — each collapsible, the
  `▸` rotating as it opens.
- Counts on the right of each option; **5 cards** in the bar; Study enabled.
- Tick **Type: Vocab** → 2 cards. Tick **Kanji** as well → 3 cards. *Within a
  namespace, ticking more grows the pool.* That's OR.
- With Vocab + Kanji ticked, tick **Level: N5** → narrows to 2. *Across
  namespaces, ticking more shrinks the pool.* That's AND.
- The summary of each section with a selection reads "2 selected". Collapse it —
  you can still see it's active.
- Tick **Type: Sentence**, then look at Topic. `Particles` and `School` show 0 and
  grey out, and their labels dim via `:has()`. `Set phrases` stays live.
- With a selection that yields 0 cards, **Study** goes disabled and dims.
- **Clear** resets everything to 5 cards.
- Open a section, tick a box, and confirm the section **stays open**. That's the
  patch-don't-re-render decision.
- Press **Study**: the console logs the pooled cards.
- Tab through: `<summary>` is focusable and Enter/Space toggles it; checkboxes are
  tinted with `--accent`, which is the line you added back in guide 02.

### DevTools exercises

1. **Select `.facet__options` and click its `grid` badge.** Now drag the browser
   window narrower. Watch the column count drop on its own. That's `auto-fit`, and
   it's worth seeing move.
2. **Change `auto-fit` to `auto-fill`** with only three options in a section. The
   items stop stretching and empty tracks appear on the right. That's the whole
   difference between the two.
3. **In `countFor`, comment out `others.delete(namespace)`.** Tick one Topic, then
   look at the others — all zero, all disabled, deadlocked. Restore it. This is the
   most valuable of the five.
4. **Delete `&& !input.checked`** from the disabled line, tick things until an
   option would hit 0, and try to untick it. Restore.
5. **Replace `updateFacetUI()` in the change handler with `renderFacets(sampleCards)`.**
   Collapse a section, then tick a box — it springs back open and your focus is
   gone. That's the state a full re-render destroys.

---

## Where the stylesheet stands

```
Reset → Tokens → Base → Japanese → Highlights → Layout primitives → Chips
     → Top bar → Nav → Views → Forms → Inputs → Segmented → Tag row
     → Buttons → Toolbar → Card list → Type badge → Row actions → Empty
     → Facets → Facet options → Study bar
```

---

## Next

**Guide 06 — The study session:** the card face at full size, flip, **Got it /
Again**, the progress indicator, and keyboard-first controls (space to flip, 1/2 to
grade, escape to quit). It's the least code of any guide and the most design — a
study card is one element you look at for an hour, so it lives or dies on
typography and rhythm rather than layout.

That guide also finally uses `.has-ruby` from guide 01, and the highlight styles
from 04a get their real home.

One thing worth deciding before I write it: **should the answer replace the
question, or appear beneath it?** Replacing is cleaner and more Anki-like;
appending keeps the Japanese on screen while you read the meaning, which is
better for sentence and grammar cards where you want to re-read the sentence with
the answer in hand. I lean toward appending for this app, given two of your four
card types are sentence-shaped — but it's a study-feel question and you're the one
who'll use it.
