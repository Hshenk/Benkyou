# Guide 06 — The study session

**You'll build:** the session itself — a card at full size, reveal-to-append,
**Again / Got it**, a progress bar, keyboard controls, and an end-of-session
summary.

**You'll learn:** furigana visibility as a CSS mechanism, per-type typography
scaling, `<dl>` for label/value pairs, `<kbd>`, global keyboard handling done
safely, and the requeue algorithm from
[overview.md §2.6](../../overview.md).

This is the least layout of any guide and the most *design*. You look at one
element for an hour at a time, so it lives or dies on type size and rhythm.

After this guide the frontend is complete: every screen exists and works against
sample data. What's left is M1 (real storage) and M2 (the furigana/link/highlight
renderer), both of which slot into seams already built.

---

## Step 1 — Three stages inside one view

The Study view now holds three screens: selection, session, summary. Same
`hidden`-toggling pattern as the top-level views — you're applying guide 02's idea
one level down.

Wrap guide 05's content and add two siblings. In `#view-study`:

```html
<section class="view" id="view-study" hidden>

    <!-- ---- Stage 1: selection (guide 05, now wrapped) ---- -->
    <div class="stage" id="stage-select">
        <h2 class="view__title">Study</h2>
        <p class="view__hint">
            Tick what you want to work on. A section with nothing ticked means “any”.
        </p>
        <div class="facets" id="facets"></div>
        <div class="study-bar">
            <p class="study-bar__count" id="pool-count">5 cards</p>
            <button class="btn btn--ghost" type="button" id="clear-facets">Clear</button>
            <button class="btn btn--primary" type="button" id="start-study">Study</button>
        </div>
    </div>

    <!-- ---- Stage 2: the session ---- -->
    <div class="stage" id="stage-session" hidden>

        <div class="session-bar">
            <div class="progress" id="progress"
                 role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <div class="progress__fill" id="progress-fill"></div>
            </div>
            <p class="session-bar__count" id="session-count">0 / 0</p>
            <button class="btn btn--ghost btn--sm" type="button" id="quit-study">
                Quit <kbd>Esc</kbd>
            </button>
        </div>

        <article class="card-face" id="card-face" data-type="vocab" data-furigana="hidden">

            <p class="card-face__jp has-ruby" lang="ja" id="face-question"></p>

            <div class="card-face__back" id="face-back" aria-live="polite" hidden>
                <hr class="card-face__rule">
                <p class="card-face__meaning" id="face-meaning"></p>
                <dl class="card-face__details" id="face-details"></dl>
                <p class="card-face__notes" id="face-notes"></p>
            </div>

        </article>

        <div class="grade-bar">
            <button class="btn btn--wide" type="button" data-grade="reveal" id="reveal-btn">
                Show answer <kbd>Space</kbd>
            </button>

            <button class="btn btn--again" type="button" data-grade="again" hidden>
                Again <kbd>1</kbd>
            </button>
            <button class="btn btn--good" type="button" data-grade="good" hidden>
                Got it <kbd>2</kbd>
            </button>
            <button class="btn btn--ghost btn--sm" type="button" data-grade="skip" hidden>
                Skip for now
            </button>
        </div>

    </div>

    <!-- ---- Stage 3: the summary ---- -->
    <div class="stage" id="stage-summary" hidden>
        <h2 class="view__title">Session complete</h2>

        <dl class="summary">
            <div class="summary__row">
                <dt>Cards studied</dt><dd id="summary-total">0</dd>
            </div>
            <div class="summary__row">
                <dt>Missed at least once</dt><dd id="summary-missed">0</dd>
            </div>
            <div class="summary__row">
                <dt>Skipped</dt><dd id="summary-skipped">0</dd>
            </div>
        </dl>

        <div class="form__actions">
            <button class="btn btn--primary" type="button" id="restudy-missed">
                Study the missed cards
            </button>
            <button class="btn" type="button" id="back-to-select">Back to selection</button>
        </div>
    </div>

</section>
```

### Notes

**`<article>` for the card face.** It's a self-contained item of content, which is
what `<article>` means — not "a news story." Reasonable semantics, and it reads
better than a fourth `<div>`.

**`data-furigana="hidden"` on the face**, not a class. Step 2 turns it into a
three-state display mode, matching the `render(text, { furigana: … })` flag in
[overview.md §2.3](../../overview.md).

**`aria-live="polite"` on the back.** When the answer appends, a screen reader
should announce it — but the content isn't in the DOM at page load, and focus
doesn't move there. A live region tells assistive tech to read changes to this
element as they happen. `polite` waits for a pause instead of interrupting.

**`role="progressbar"` with `aria-valuenow`** — a `<div>` with a coloured child is
meaningless to anything that can't see it. Three attributes make it a real
progress indicator. JS updates `aria-valuenow` alongside the width.

**`<kbd>` is a real element** for keyboard input. Using it instead of a `<span>`
costs nothing and says what the text is.

**All four grade buttons live in one bar**, toggled with `hidden`. Simpler than two
containers, and it keeps their layout consistent.

---

## Step 2 — Furigana visibility

This is the mechanism [overview.md §2.3](../../overview.md) asks for: furigana is
a study feature, not a display preference. Add to your Japanese Text section:

```css
/* Furigana display modes — the CSS half of render(text, { furigana }). */
[data-furigana="hidden"] rt {
    visibility: hidden;
}

[data-furigana="hover"] rt {
    visibility: hidden;
}

[data-furigana="hover"] ruby:hover rt {
    visibility: visible;
}
```

**`visibility: hidden`, never `display: none`.** This is the entire point of the
rule and it's worth being deliberate about.

A hidden `rt` still occupies its space. So the line box stays exactly as tall with
furigana hidden as with it shown, and revealing the answer does **not** shift the
Japanese text downward. With `display: none` the ruby would collapse, every line
would jump upward on reveal, and the card would visibly lurch at the exact moment
you're reading it.

The same instinct as the transparent border in guide 02 and the `opacity: 0`
actions in guide 04: reserve the space, change only the appearance. Layout that
doesn't move is most of what makes an interface feel solid.

`hover` mode comes free once the two rules exist — it's the third state
[overview.md §2.3](../../overview.md) wanted, and it costs two lines.

---

## Step 3 — The card face

```css
/* ------ Study stages ------ */
.stage {
    display: grid;
    gap: var(--space-3);
}

/* ------ Session bar ------ */
.session-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.progress {
    flex: 1;
    height: 4px;
    background: var(--surface-2);
    border-radius: 2px;
    overflow: hidden;
}

.progress__fill {
    width: 0;
    height: 100%;
    background: var(--accent);
    border-radius: inherit;
    transition: width 220ms ease;
}

.session-bar__count {
    color: var(--text-muted);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
}

/* ------ Card face ------ */
.card-face {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: var(--space-4);
    min-height: 48vh;
    padding: var(--space-5) var(--space-4);
    text-align: center;
}

.card-face__jp {
    font-size: 40px;
}

.card-face[data-type="kanji"] .card-face__jp {
    font-size: 132px;
    line-height: 1.15;
}

.card-face[data-type="sentence"] .card-face__jp,
.card-face[data-type="grammar"] .card-face__jp {
    font-size: 30px;
    max-width: 20em;
}

.card-face__back {
    display: grid;
    gap: var(--space-3);
    justify-items: center;
    width: 100%;
}

.card-face__rule {
    width: 64px;
    height: 1px;
    border: 0;
    margin: 0;
    background: var(--border-strong);
}

.card-face__meaning {
    font-size: 24px;
}

.card-face__details {
    display: grid;
    grid-template-columns: auto auto;
    justify-content: center;
    gap: var(--space-1) var(--space-3);
}

.card-face__details dt {
    color: var(--text-muted);
    font-size: 13px;
    text-align: right;
}

.card-face__details dd {
    margin: 0;
    text-align: left;
}

.card-face__notes {
    color: var(--text-muted);
    font-size: 15px;
    max-width: 34em;
}

.card-face__notes:empty {
    display: none;
}
```

### Notes

**Per-type font sizes, driven by `data-type`.** A lone 食 at 40px is a postage
stamp; a full sentence at 132px doesn't fit on screen. These aren't three
arbitrary numbers — they're three genuinely different kinds of content, and one
size can't serve all of them. Attribute selectors again, exactly like the badges in
guide 04.

**`min-height: 48vh` with `align-content: center`.** `vh` is 1% of the viewport
height, so the card occupies a stable region of the screen and the Japanese sits
vertically centred in it. Without a min-height the face would be as tall as its
content, and the question would jump up the screen every time you moved from a
sentence card to a kanji card. Fixing the region and centring within it means the
text stays roughly where your eyes already are.

**`font-variant-numeric: tabular-nums` on the counter.** Digits in most fonts are
proportional — `1` is narrower than `8` — so a counter ticking from `9 / 12` to
`10 / 12` visibly jitters. Tabular figures are fixed-width. One property, and it's
worth knowing for any number that updates in place.

**`<dl>`, `<dt>`, `<dd>` for the reading and on'yomi rows.** A description list is
the correct element for label/value pairs, and using it means the pairing is real
rather than implied by position. Note `dd` needs `margin: 0` — it's one of the few
elements the guide 01 reset didn't zero.

**`.card-face__notes:empty`** — the `:empty` trick a third time. Cards without
notes collapse the gap instead of leaving a hole.

---

## Step 4 — Grade buttons

```css
/* ------ Grade bar ------ */
.grade-bar {
    display: flex;
    justify-content: center;
    gap: var(--space-2);
}

.btn--wide {
    min-width: 260px;
}

.btn--again {
    border-color: var(--hl-red);
    color: var(--hl-red);
}

.btn--again:hover {
    background: var(--hl-red-bg);
    border-color: var(--hl-red);
}

.btn--good {
    border-color: var(--good);
    color: var(--good);
}

.btn--good:hover {
    background: rgb(138 188 131 / 0.18);
    border-color: var(--good);
}

kbd {
    background: var(--surface-3);
    border-radius: 3px;
    font-family: inherit;
    font-size: 11px;
    margin-left: var(--space-2);
    opacity: 0.75;
    padding: 1px 5px;
}

/* ------ Summary ------ */
.summary {
    display: grid;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
    max-width: 340px;
}

.summary__row {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    padding-bottom: var(--space-1);
}

.summary__row dt {
    color: var(--text-muted);
}

.summary__row dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
}
```

**Outlined, not filled.** You press these several hundred times in a session; two
saturated blocks of colour would be exhausting to look at and would compete with
the card itself. Colour on the border and text is enough to distinguish them
instantly, and the fill arrives on hover.

**`--hl-red` rather than `--accent` for Again.** The vermilion is the app's
"primary action" colour (Save, the active nav underline). Reusing it for a
*negative* grade would muddy what it means. The softer highlight red reads as
"missed" without shouting.

**`.summary__row` wraps each `dt`/`dd` pair in a `<div>`.** Wrapping pairs like
this is explicitly allowed in a `<dl>`, and it's what lets each row be its own
flex container with `space-between`.

---

## Step 5 — The session engine

Append to `js/app.js`:

```js
// --- Study session --------------------------------------------------------
const stages = document.querySelectorAll('.stage');
const cardFace = document.querySelector('#card-face');
const faceQuestion = document.querySelector('#face-question');
const faceBack = document.querySelector('#face-back');
const faceMeaning = document.querySelector('#face-meaning');
const faceDetails = document.querySelector('#face-details');
const faceNotes = document.querySelector('#face-notes');
const gradeBar = document.querySelector('.grade-bar');
const revealBtn = document.querySelector('#reveal-btn');
const progressFill = document.querySelector('#progress-fill');
const progressEl = document.querySelector('#progress');
const sessionCount = document.querySelector('#session-count');

const MISS_LIMIT = 3;

let session = null;

function showStage(name) {
    for (const stage of stages) {
        stage.hidden = stage.id !== `stage-${name}`;
    }
}

/** Fisher-Yates. See notes for why not sort(). */
function shuffle(items) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function startSession(cards) {
    if (cards.length === 0) return;

    session = {
        queue: shuffle(cards),
        total: cards.length,
        current: null,
        done: new Set(),        // ids graded "Got it"
        skipped: new Set(),
        misses: new Map(),      // id -> times missed this session
    };

    showStage('session');
    nextCard();
}

function nextCard() {
    session.current = session.queue.shift() ?? null;

    if (!session.current) {
        endSession();
        return;
    }

    const card = session.current;

    cardFace.dataset.type = card.type;
    cardFace.dataset.furigana = 'hidden';

    renderJapanese(faceQuestion, questionText(card));

    faceBack.hidden = true;
    revealBtn.hidden = false;
    for (const btn of gradeBar.querySelectorAll('[data-grade]:not(#reveal-btn)')) {
        btn.hidden = true;
    }

    updateProgress();
}

function revealAnswer() {
    if (!session?.current || !faceBack.hidden) return;

    const card = session.current;

    cardFace.dataset.furigana = 'shown';

    faceMeaning.textContent = card.meaning;
    faceNotes.textContent = card.notes ?? '';

    const rows = detailsFor(card).filter(([, value]) => value !== undefined && value !== '');
    faceDetails.replaceChildren();
    for (const [label, value] of rows) {
        const dt = document.createElement('dt');
        dt.textContent = label;

        const dd = document.createElement('dd');
        dd.lang = 'ja';
        renderJapanese(dd, String(value));

        faceDetails.append(dt, dd);
    }

    faceBack.hidden = false;
    revealBtn.hidden = true;

    gradeBar.querySelector('[data-grade="again"]').hidden = false;
    gradeBar.querySelector('[data-grade="good"]').hidden = false;

    const misses = session.misses.get(card.id) ?? 0;
    gradeBar.querySelector('[data-grade="skip"]').hidden = misses < MISS_LIMIT;
}

function grade(result) {
    if (!session?.current || faceBack.hidden) return;

    const card = session.current;

    if (result === 'good') {
        session.done.add(card.id);
    } else if (result === 'skip') {
        session.skipped.add(card.id);
    } else {
        session.misses.set(card.id, (session.misses.get(card.id) ?? 0) + 1);
        requeue(card);
    }

    nextCard();
}

/** Reinsert 5–15 cards ahead, jittered; append if fewer remain (§2.6). */
function requeue(card) {
    const offset = 5 + Math.floor(Math.random() * 11);
    session.queue.splice(Math.min(offset, session.queue.length), 0, card);
}

function updateProgress() {
    const settled = session.done.size + session.skipped.size;
    const percent = Math.round((settled / session.total) * 100);

    progressFill.style.width = `${percent}%`;
    progressEl.setAttribute('aria-valuenow', percent);
    sessionCount.textContent = `${settled} / ${session.total}`;
}

function endSession() {
    document.querySelector('#summary-total').textContent = session.total;
    document.querySelector('#summary-missed').textContent = session.misses.size;
    document.querySelector('#summary-skipped').textContent = session.skipped.size;

    document.querySelector('#restudy-missed').disabled = session.misses.size === 0;
    showStage('summary');
}
```

And the per-type content helpers, next to `cardText`:

```js
/** What the front of the card asks. Grammar asks with its example (§2.4). */
function questionText(card) {
    if (card.type === 'grammar') return card.data.example;
    return card.data.expression ?? card.data.character ?? '';
}

/** [label, value] pairs for the back, by type. */
function detailsFor(card) {
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

### Notes

**`questionText` is where the grammar type earns itself.** Every other type asks
with its expression; grammar asks with its *example sentence*, because
[overview.md §2.4](../../overview.md) settled that a particle out of context isn't
a question. This one function is the whole behavioural difference, and it's why
grammar is a type rather than a tag.

It's also where the `*b:は*` highlight becomes load-bearing rather than decorative:
once M2 renders it, the blue は is what tells you which of the sentence's particles
is being asked about.

**Fisher-Yates, not `.sort(() => Math.random() - 0.5)`.** The sort trick is
everywhere online and it's wrong twice over: comparison sorts assume a consistent
comparator, so an inconsistent one produces a measurably biased distribution — and
the result depends on the engine's sort implementation. Fisher-Yates is five lines,
provably uniform, and O(n). Worth learning once.

**Progress counts `done + skipped`, not cards seen.** A requeued card is seen
several times, so a "seen" counter would exceed the total and the bar would
overflow. Counting *settled* cards keeps it monotonic and honest:
[overview.md §2.6](../../overview.md) defines the session as ending when every card
has been marked Got it at least once, and this is that definition made visible.

**The miss guard is a third button, not a modal.** After `MISS_LIMIT` misses the
Skip option quietly appears. §2.6 asks that you never get stuck in an infinite
requeue loop; offering the exit only once it's relevant keeps it out of the way the
rest of the time.

**`session?.current` and the `faceBack.hidden` checks** are guards against grading
a card that isn't showing — which is exactly what a stray keypress would do. Every
entry point into `grade()` gets the same guard, so the keyboard path can't do
anything the mouse path can't.

---

## Step 6 — Wiring, and the keyboard

```js
// --- Session events -------------------------------------------------------
gradeBar.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-grade]');
    if (!btn) return;

    if (btn.dataset.grade === 'reveal') revealAnswer();
    else grade(btn.dataset.grade);
});

document.querySelector('#quit-study').addEventListener('click', () => showStage('select'));
document.querySelector('#back-to-select').addEventListener('click', () => showStage('select'));

document.querySelector('#restudy-missed').addEventListener('click', () => {
    const missedIds = new Set(session.misses.keys());
    startSession(sampleCards.filter((card) => missedIds.has(card.id)));
});

// Replace guide 05's console.log placeholder:
startBtn.addEventListener('click', () => {
    startSession(buildPool(sampleCards, selection));
});

// --- Keyboard (overview.md §M4 — keyboard-first) --------------------------
document.addEventListener('keydown', (event) => {
    // Only while a session is on screen.
    if (document.querySelector('#stage-session').hidden) return;

    // Never steal keys from a text field, and never from an IME (§2.8).
    if (event.target.closest('input, textarea, select')) return;
    if (event.isComposing) return;

    // Holding a key auto-repeats; one press should grade one card.
    if (event.repeat) return;

    switch (event.key) {
        case ' ':
            event.preventDefault();      // Space scrolls the page by default
            if (faceBack.hidden) revealAnswer();
            break;
        case '1':
            grade('again');
            break;
        case '2':
            grade('good');
            break;
        case 'Escape':
            showStage('select');
            break;
    }
});
```

### Notes

**Four guards before the switch, and each one is a real bug avoided.**

- **The stage check** — a global `keydown` listener fires no matter what's on
  screen. Without it, typing `2` into the card editor would grade an invisible
  card.
- **`closest('input, textarea, select')`** — belt and braces for the same class of
  problem. `closest` rather than `matches` so it also catches focus inside a
  wrapper.
- **`event.isComposing`** — the IME guard from
  [overview.md §2.8](../../overview.md), the same one on the editor form. Cheap
  here, essential the moment a type-the-answer mode appears (M7).
- **`event.repeat`** — holding a key fires `keydown` repeatedly. Without this,
  leaning on `2` would blow through half the session.

**`event.preventDefault()` on Space** because Space scrolls the page. It's the
single most common flashcard-app key and the default behaviour actively fights it.

**Buttons and keys share the same functions.** `revealAnswer()` and `grade()` are
called from both paths, so the two can't drift — and every guard written for one
protects the other. That's why the guards live inside those functions rather than
in the handlers.

**A global listener is right here**, even though the guides have otherwise
delegated to a container. There's no element that reliably holds focus during a
session — you might have just clicked a button, or nothing at all — so the document
is the correct place to listen. The stage check is what keeps it scoped.

---

## Checkpoint

From **Study**, pick nothing (all 5 cards) and press **Study**:

- The card face fills a stable region. The Japanese is centred; the progress bar
  reads `0 / 5`.
- A **kanji** card shows its character huge; a **sentence** or **grammar** card
  shows text at a readable size in the same space. The face doesn't resize
  jarringly between them.
- Press **Space**. A rule, the meaning, the per-type details, and any notes append
  **below** the question — the Japanese stays put and does not move up the page.
- On a grammar card, the question is the **example sentence**, and the back shows
  the point (`は`) plus the meaning.
- Press **1** (Again) — the card returns later in the session, not immediately.
  Press **2** (Got it) — progress advances.
- Miss the same card three times; **Skip for now** appears on the next reveal.
- Hold **2** down: only one card advances. That's `event.repeat`.
- Press **Esc** — back to selection, with your facet ticks intact.
- Finish a session: the summary reports totals, and **Study the missed cards**
  starts a session containing only those. With nothing missed, that button is
  disabled.
- Switch to **New Card**, type `2` into a field — nothing grades.

### DevTools exercises

1. **Change `[data-furigana="hidden"] rt` to `display: none`.** Reveal a card with
   ruby in it. The whole block jumps upward. Restore it — this is the clearest
   demonstration in the whole series of why reserving space matters.
2. **Set `data-furigana="hover"` on `#card-face`** in the Elements panel, then hover
   the Japanese. That's the third mode from §2.3, already working.
3. **Change `.card-face`'s `min-height` to `auto`** and grade through several
   cards. Watch the question jump around as content height changes.
4. **Remove `font-variant-numeric: tabular-nums`** and step the counter past `9`.
   The jitter is subtle and, once you've seen it, unmissable.
5. **Edit `MISS_LIMIT` to `1`** and miss a card once. Skip appears immediately.

Once the ruby actually renders (M2), come back to exercise 1 — the effect is much
stronger with real furigana than with bracket notation.

---

## The frontend is done

Every screen exists and works:

| View | Guide |
|---|---|
| Shell, navigation | 02 |
| Card editor, four types | 03, 04a |
| Card list, search | 04 |
| Faceted selection | 05 |
| Study session, summary | 06 |

### What's deliberately still fake

Two seams, both built to be filled without touching anything around them:

- **`renderJapanese(el, text)`** is `el.textContent = text`. M2 replaces its body
  with the tokenizer + renderer, and every call site — list rows, card face,
  detail values — starts rendering ruby, jisho links, and `*b:は*` highlights at
  once. The CSS for all three is already in your stylesheet and already tested.
- **`sampleCards`** is a literal array. M1 replaces it with the storage interface
  from [overview.md §2.1](../../overview.md). `renderCards`, `buildFacets`, and
  `buildPool` all take cards as an argument, so they don't care where they come
  from.

### Worth doing before you build on it

- **Split `app.js`.** It's around 400 lines covering four screens. Native ES
  modules work with no build step ([frontend-setup.md §1](../frontend-setup.md)),
  so `js/views/editor.js`, `js/views/cards.js`, `js/views/study.js` and an
  `app.js` that imports them is a free improvement. Do it before M1 adds storage,
  not after.
- **Check it in Firefox.** Ruby rendering genuinely differs from Chrome
  ([overview.md §2.8](../../overview.md)), and this is the first build with ruby in
  a layout that matters.
- **Deploy to GitHub Pages**, which is still an open M0 item — and settle the
  `docs/data/cards.json` vs `data/cards.json` path question flagged back in guide
  01 while you're in there.

### Then

**M2** is the natural next milestone: it's self-contained, heavily testable, and it
lights up work already sitting in three screens. **M1** is more valuable but less
fun. Doing M2 first means M1's editor is saving text you can actually see rendered.
