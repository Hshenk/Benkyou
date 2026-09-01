# Guide 07 — Handwritten kanji forms

**You'll build:** a toggle in the top bar that switches every Japanese character in
the app between the printed (Gothic) form and the handwritten (textbook) form,
remembered across reloads.

**You'll learn:** why the two forms differ, nested custom properties, `aria-pressed`
vs `aria-current`, namespaced `localStorage`, and a specificity problem worth
understanding rather than brute-forcing.

**Font:** none to install — `UD Digi Kyokasho` ships with Windows 10 1809+ and is
already on your machine.

---

## Step 0 — What's actually different

Your instinct about 食 is right, and the reason is worth knowing precisely.

食 is **nine strokes** in both forms. A font can't change that. What changes is the
*shape*, and in a Gothic face the lower component is drawn in a way that reads as
having an extra stroke — the printed form optimizes for a clean rectangle at small
sizes, not for showing you how the character is written.

**教科書体 (kyōkasho-tai)** is a typeface class designed for exactly this problem.
It's the style used in Japanese school textbooks, drawn to match brush and pen
strokes: you can see where a stroke starts, where it lifts, and where two strokes
that look joined in print are actually separate.

Characters where the difference is large:

| Character | What changes |
|---|---|
| 令 | Printed uses a マ-like base; handwritten uses 龴 with a vertical stroke |
| 食 | The lower component's stroke structure becomes legible |
| 糸 | The bottom resolves into three distinct strokes rather than 小 |
| 心 | Stroke curvature and the angle of the dots |
| 直 | The enclosure's corner is drawn, not boxed |
| き、さ | The third stroke is *separated* in handwriting, joined in many printed faces |

That last one matters more than it looks — a beginner copying き from a Gothic
font learns the wrong stroke count.

**What this does not give you:** stroke *order*, or animation. That's KanjiVG,
already parked in [overview.md §M7](../../overview.md). This is glyph shapes only —
which is the part that was actively misleading you.

---

## Step 1 — The font token

Add to `/* ------ Design Tokens ------ */`, right below `--font-jp`:

```css
  --font-jp-hand: "UD Digi Kyokasho NP-R", "UD Digi Kyokasho N-R",
                  "Yu Kyokasho", "Klee One", "Klee",
                  "Hiragino Mincho ProN", var(--font-jp);
```

### Notes

**The stack ends with `var(--font-jp)`.** Custom properties can reference other
custom properties, so this expands to your entire existing Japanese stack as the
final fallback. If no handwriting font is present anywhere, text renders in the
normal face rather than dropping to a browser default — the toggle just quietly
does nothing instead of making things worse.

**`NP-R` before `N-R`.** The Windows family ships three variants: `N` is
monospaced, `NK` has proportional kana, `NP` is fully proportional. `NP` reads
best for running text; `N` is the fallback if a machine only has that one.

**`Klee One` is on Google Fonts**, and it's the option if you ever use a machine
without the Windows font. I'd *not* add it as a webfont: Japanese webfonts are
several megabytes because the character set is enormous, and even with Google's
subsetting it's a network dependency in a project whose whole premise is a static
folder with no dependencies ([frontend-setup.md §1](../frontend-setup.md)). Listing
the name costs nothing and picks it up if it's installed locally.

---

## Step 2 — The switch

Add to your Japanese Text section:

```css
/* Handwritten (kyokasho) forms, toggled on <html data-script="hand">. */
[data-script="hand"] [lang="ja"] {
    font-family: var(--font-jp-hand);
}
```

One rule flips every Japanese character in the app — card faces, list rows, the
brand, the editor's inputs, the detail values on a card back.

That reach is the return on a decision made in guide 01. Because language is marked
in the HTML with `lang="ja"` wherever Japanese appears, rather than with a
`.japanese` class applied by hand, a feature nobody planned for lands as **one
selector**. Had those been class names, this would be a hunt through five files.

`[data-script="hand"]` on `<html>` combined with `[lang="ja"]` scores (0,2,0),
which beats the plain `[lang="ja"]` rule at (0,1,0). No `!important`, no ordering
dependency.

> **If you'd rather keep the editor in the printed face** while authoring — a
> reasonable preference, since you're transcribing from printed material — add:
>
> ```css
> [data-script="hand"] .input[lang="ja"] { font-family: var(--font-jp); }
> ```
>
> (0,3,0), so it wins. I'd try it both ways before deciding.

---

## Step 3 — The button

The top bar's `.topbar__inner` uses `justify-content: space-between` with exactly
two children. Adding a third would spread all three across the bar, so group the
nav and the toggle:

```html
            <div class="topbar__actions">
                <nav class="nav" aria-label="View">
                    <button class="nav__btn" type="button" data-view="study">Study</button>
                    <button class="nav__btn" type="button" data-view="cards">Cards</button>
                    <button class="nav__btn" type="button" data-view="editor">New Card</button>
                </nav>

                <button class="btn btn--sm btn--ghost script-toggle" type="button"
                        id="script-toggle" aria-pressed="false"
                        title="Show handwritten (textbook) kanji forms">
                    <span lang="ja" aria-hidden="true">手</span>
                    <span class="script-toggle__text">Handwritten</span>
                </button>
            </div>
```

```css
/* ------ Topbar actions ------ */
.topbar__actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.script-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.script-toggle[aria-pressed="true"] {
    background: var(--surface-2);
    color: var(--text);
}

.script-toggle[aria-pressed="true"] span[lang="ja"] {
    color: var(--accent);
}

.script-toggle__text {
    font-size: 13px;
}
```

### Notes

**Keep the toggle *outside* `.nav` — this one is a trap.** The nav's click handler
is delegated:

```js
const btn = event.target.closest('.nav__btn');
if (!btn) return;
showView(btn.dataset.view);
```

Put a button carrying `.nav__btn` inside `.nav` without a `data-view`, and
`btn.dataset.view` is `undefined`. `showView(undefined)` then compares every
section id against `"view-undefined"`, matches none, and **hides all three views**.
You'd get a blank page from adding a button.

Two defences, and it's worth taking both: keep the toggle out of the delegation
target, *and* harden the guard:

```js
if (!btn?.dataset.view) return;
```

Delegated handlers make assumptions about what lives inside their container. Those
assumptions are invisible until someone adds an element — which is why the guard
belongs in the handler even when the markup is currently fine.

**`aria-pressed`, not `aria-current`.** Guide 02 used `aria-current="page"` for the
nav because it answers *"which one are you looking at?"* This button answers *"is
this mode on?"*, which is `aria-pressed` — a toggle button. Screen readers announce
it as "Handwritten, toggle button, pressed." Different question, different
attribute, and styling hangs off the same state either way.

**`aria-hidden="true"` on the 手 glyph** so it isn't read aloud — the adjacent
text already names the button, and the character is decoration.

---

## Step 4 — Wiring and persistence

Append to `js/app.js`:

```js
// --- Script toggle --------------------------------------------------------
const SCRIPT_KEY = 'benkyou:script';        // namespaced — see notes
const scriptToggle = document.querySelector('#script-toggle');

function setScript(mode) {
    document.documentElement.dataset.script = mode;
    scriptToggle.setAttribute('aria-pressed', String(mode === 'hand'));

    try {
        localStorage.setItem(SCRIPT_KEY, mode);
    } catch {
        // Private mode or a full quota. The toggle still works this session.
    }
}

function toggleScript() {
    setScript(document.documentElement.dataset.script === 'hand' ? 'print' : 'hand');
}

scriptToggle.addEventListener('click', toggleScript);

// Restore the saved preference.
let savedScript = 'print';
try {
    savedScript = localStorage.getItem(SCRIPT_KEY) ?? 'print';
} catch {}
setScript(savedScript);
```

And a shortcut, in the study `keydown` switch — you'll want this mid-card, not via
the mouse:

```js
        case 'f':
            toggleScript();
            break;
```

### Notes

**`'benkyou:script'`, not `'script'`.** [overview.md §2.1](../../overview.md) flags
this: every GitHub Pages project under `<username>.github.io` shares one origin, so
they share one `localStorage`. An unprefixed key is a collision waiting for your
next project. This is the first key the app stores — set the convention here and
M1's card storage inherits it.

**The `try`/`catch` around both calls.** `localStorage` throws rather than returning
`null` in a few real situations: Firefox private windows, a full quota, and browsers
configured to block site data. An uncaught throw at module top level would take down
everything below it — the same failure mode as the missing `]` in guide 05.
A font preference is not worth breaking the app for, so it degrades to
session-only.

**`setScript(savedScript)` runs at load**, which sets the attribute, the
`aria-pressed` state, and the stored value from one path. Same single-source-of-truth
move as `showView('cards')` in guide 02.

**`f` for the shortcut** — it's free, it's mnemonic, and it's inside the study
keydown handler, so it inherits all four guards from guide 06 (stage check, input
check, `isComposing`, `repeat`). Nothing extra to write.

---

## Step 5 — Both forms at once *(optional)*

You mentioned showing the two side by side, and for **kanji cards specifically**
that's better than toggling — the comparison is the information. Add to the card
back, after `#face-details`:

```html
                <div class="glyph-compare" id="glyph-compare" hidden>
                    <figure class="glyph-compare__item">
                        <span class="glyph" data-form="print" lang="ja"></span>
                        <figcaption>Printed</figcaption>
                    </figure>
                    <figure class="glyph-compare__item">
                        <span class="glyph" data-form="hand" lang="ja"></span>
                        <figcaption>Handwritten</figcaption>
                    </figure>
                </div>
```

```css
/* ------ Glyph comparison ------ */
.glyph-compare {
    display: flex;
    gap: var(--space-5);
    justify-content: center;
}

.glyph-compare__item {
    margin: 0;
    text-align: center;
}

.glyph {
    display: block;
    font-size: 76px;
    line-height: 1.2;
}

.glyph-compare figcaption {
    color: var(--text-muted);
    font-size: 12px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

/* Both panes must ignore the global toggle. See notes on specificity. */
.card-face .glyph[data-form="print"] { font-family: var(--font-jp); }
.card-face .glyph[data-form="hand"]  { font-family: var(--font-jp-hand); }
```

In `revealAnswer()`, after the details loop:

```js
    const compare = document.querySelector('#glyph-compare');
    const isKanji = card.type === 'kanji';
    compare.hidden = !isKanji;

    if (isKanji) {
        for (const glyph of compare.querySelectorAll('.glyph')) {
            glyph.textContent = card.data.character;
        }
    }
```

### The specificity problem, which is the actual lesson

The obvious rule is `.glyph[data-form="print"] { font-family: var(--font-jp); }`.
It scores (0,2,0) — and so does `[data-script="hand"] [lang="ja"]`. On a tie, the
rule appearing **later in the stylesheet wins**.

So this would work, but only because of where you happened to paste it. Move the
block, or add a section above it later, and the "Printed" pane silently starts
rendering in the handwritten face — the two panes become identical and the feature
quietly stops meaning anything. No error, no visual breakage, just a comparison
that isn't comparing.

Prefixing with `.card-face` takes it to (0,3,0), which wins outright regardless of
order. That's the fix worth internalizing: **when two rules tie, don't rely on
source order — make the one that should win actually more specific.** Reaching for
`!important` here would also work and would be the wrong habit; it wins so
completely that the next rule needing to override it has nowhere to go.

---

## Checkpoint

- The top bar has a **手 Handwritten** button beside the nav.
- Click it: every Japanese character in the app changes shape. Click again: back.
- Reload — the setting persists. Check `benkyou:script` in DevTools →
  Application → Local Storage.
- **Nav still works.** If clicking a view button blanks the page, the toggle ended
  up inside `.nav`.
- During a session, press **f** — same toggle, no mouse.
- On a kanji card's answer, both glyph panes appear, and **the Printed pane stays
  printed** when the global toggle is on.

### Look at these specifically

Add a card or edit `sampleCards`, then toggle back and forth on:

- **令** — the clearest difference in the language. If this doesn't visibly change,
  the font isn't resolving.
- **食** — your original case. Count the strokes in the handwritten form; the
  structure that read as ten resolves into nine.
- **き** and **さ** — the third stroke separates.
- **糸** — the base becomes three strokes rather than 小.

### DevTools exercises

1. **Inspect `<html>`** and edit `data-script` between `hand` and `print` directly.
   The whole page follows one attribute.
2. **Select a card face and check the Computed tab's `font-family`.** You'll see
   which font in the stack actually resolved — the fastest way to diagnose a font
   that isn't applying.
3. **Delete `.card-face` from the two `.glyph` rules** and reload with the toggle
   on. Depending on where you pasted the block, both panes may go handwritten.
   That's the specificity tie, live.
4. **Set `--font-jp-hand` to just `var(--font-jp)`** in the Styles panel. The
   toggle keeps working but changes nothing — which is exactly how it degrades on
   a machine without the font.

---

## A note on weight

`UD Digi Kyokasho` is a lighter face than `Yu Gothic UI` at the same size, and in
the card list at 22px it can read faint. A real bold ships alongside it
(`UD Digi Kyokasho N-B`), so this is the one place in the app where bolding CJK is
safe — you get a genuine bold face rather than the synthetic smearing warned about
in guide 04a:

```css
[data-script="hand"] .card-row__jp {
    font-weight: 700;
}
```

Try it before adopting it. At the 132px of a kanji card face, the regular weight is
right and bold is heavy.

---

## Next

Nothing queued — the frontend is complete. The open items from guide 06 stand:
split `app.js` into ES modules, check ruby in Firefox, deploy to Pages, then
**M2**, which will finally make `食[た]べる` and `*b:は*` render as intended.

When M2 lands, this toggle gets more useful, not less: handwritten forms plus
furigana is close to what a Japanese textbook page actually looks like.
