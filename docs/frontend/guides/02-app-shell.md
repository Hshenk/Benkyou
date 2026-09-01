# Guide 02 — The app shell

**You'll build:** the persistent top bar with Study / Cards / New Card, three view
sections, and working navigation between them.

**You'll learn:** semantic layout elements, flexbox (properly — the main/cross axis
model), sticky positioning, and your first DOM JavaScript: `data-` attributes,
event delegation, and toggling `hidden`.

By the end you have the skeleton every remaining guide fills in.

---

## Step 0 — Two fixups first

### Add the line you skipped

In your `/* ------ Base ------ */` section:

```css
:root {
    color-scheme: dark;
    accent-color: var(--accent);   /* ← add this */
}
```

`accent-color` tints native checkboxes, radios, and range sliders with your color.
Nothing on screen uses it yet, which is presumably why it looked droppable — but
guide 05's selection screen is a grid of checkboxes, and this one line means you
won't have to hand-style any of them.

### Make `.wrap` do one job

Right now `.wrap` sets width **and** vertical padding:

```css
.wrap {
    max-width: 900px;
    margin-inline: auto;
    padding: var(--space-5) var(--space-3);   /* 40px top/bottom, 16px sides */
}
```

That was fine for one page of content. But you're about to reuse `.wrap` inside
the top bar, where 40px of vertical padding is badly wrong. Change it to:

```css
.wrap {
    max-width: 900px;
    margin-inline: auto;
    padding-inline: var(--space-3);
}
```

`padding-inline` sets left and right only; `padding-block` sets top and bottom.
They're the *logical* counterparts to `margin-inline`, which you already used.

**The principle is worth more than the edit:** a layout primitive should do one
thing. `.wrap` now means "constrain to the content column" and nothing else, so it
composes anywhere. Vertical rhythm becomes the job of whatever is *using* the
wrap — you'll add it to `main` in step 3. Every time a utility class does two
things, the second one eventually blocks a reuse.

### And delete the smoke test

Remove the entire `/* ------ TEMP Smoke Text ------ */` block from `style.css`, and
everything inside `<body>` in `index.html`. It did its job.

Keep `.wrap` and `.chip` — chips go unused this guide and come back in guide 04.

---

## Step 1 — The shell markup

Replace the whole `<body>`:

```html
<body>

    <header class="topbar">
        <div class="topbar__inner wrap">

            <h1 class="brand">
                <span class="brand__jp" lang="ja">勉強</span>
                <span class="brand__name">Benkyou</span>
            </h1>

            <nav class="nav" aria-label="Views">
                <button class="nav__btn" type="button" data-view="study">Study</button>
                <button class="nav__btn" type="button" data-view="cards">Cards</button>
                <button class="nav__btn" type="button" data-view="editor">New Card</button>
            </nav>

        </div>
    </header>

    <main class="wrap">

        <section class="view" id="view-study" hidden>
            <h2 class="view__title">Study</h2>
            <p class="view__hint">Tag selection goes here — guide 05.</p>
        </section>

        <section class="view" id="view-cards">
            <h2 class="view__title">Cards</h2>
            <p class="view__hint">The card list goes here — guide 04.</p>
        </section>

        <section class="view" id="view-editor">
            <h2 class="view__title">New Card</h2>
            <p class="view__hint">The editor form goes here — guide 03.</p>
        </section>

    </main>

</body>
```

Yes, two sections are visible right now and only one has `hidden`. That's
deliberate — step 4 explains why, and the JS fixes it on load.

### What the structure is doing

**`<header>`, `<nav>`, `<main>`, `<section>`** are *semantic* elements. Visually
they're identical to `<div>` — the browser gives them no styling. What they buy
you is meaning: screen readers can jump straight to `<main>`, and six months from
now you can tell what a block is without reading its class name. Free, so use
them.

**`aria-label="Views"` on the `<nav>`.** A page can have several navs (main,
breadcrumbs, footer); the label distinguishes them. One attribute.

**`type="button"` on every button — learn this now.** A `<button>` with no `type`
defaults to `type="submit"`. Outside a form that's harmless, but guide 03 is a
form, and a stray unlabeled button inside it will submit the form and reload the
page when clicked. The bug is baffling if you haven't seen it. Make it a habit
here, where it costs nothing.

**`data-view="study"`** is a *data attribute* — any attribute starting with
`data-` is valid HTML and reserved for you. JS reads it as `btn.dataset.view`
(the hyphen-to-camelCase conversion is automatic). This is how you attach
application meaning to an element without abusing `id` or `class`. Classes are
for styling; data attributes are for data.

**Two class-naming conventions in play.** `topbar__inner` uses `__` for "element
belonging to this block," matching the `chip--good` modifier syntax from guide 01.
`.view` is a plain shared class. The rule of thumb: `__` when the child is
meaningless outside its parent, a standalone class when it's reusable.

**`class="topbar__inner wrap"`** — two classes on one element, composing a
component class with a layout primitive. This is the payoff from the `.wrap`
refactor: the bar's *background* spans the full window (it's on `.topbar`) while
its *contents* line up with the 900px content column below. That alignment is what
makes a header look intentional.

---

## Step 2 — Flexbox, and the top bar

Add a new section to `style.css`, after `/* ------ Layout primitives ------ */`:

```css
/* ------ Top bar ------ */
.topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--surface-1);
    border-bottom: 1px solid var(--border);
}

.topbar__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: 56px;
}

.brand {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-size: 20px;
    font-weight: 600;
}

.brand__jp {
    color: var(--accent);
    font-size: 22px;
}

.brand__name {
    letter-spacing: 0.02em;
}
```

### The flexbox model

This is the concept to actually absorb, because it's most of CSS layout.

`display: flex` on a parent makes its **direct children** flex items, laid out
along a **main axis**. By default the main axis is horizontal (left→right), so
children sit in a row. The **cross axis** is the perpendicular one — vertical here.

Everything else follows from that:

| Property | Axis | Does |
|---|---|---|
| `justify-content` | **main** | Distributes items along the row |
| `align-items` | **cross** | Positions items across the row's height |
| `gap` | both | Space *between* items |
| `flex-direction: column` | — | Swaps which axis is which |

The trap everyone hits: `justify-content` and `align-items` swap meaning the
moment you set `flex-direction: column`. They aren't "horizontal" and "vertical" —
they're "main" and "cross." Learn them that way and column layouts stop being
confusing.

**`justify-content: space-between`** puts the first item hard left, the last hard
right, and splits leftover space between them. With exactly two children — brand
and nav — that's "one at each end."

> With three or more children where you want *one* pushed away, use an auto margin
> instead: `margin-left: auto` on an item absorbs all free space to its left,
> shoving it right. It's the flexbox trick worth remembering.

**`align-items: center`** vertically centers the brand and nav within the bar's
56px. Centering along the cross axis is one word in flexbox; it used to be a
famous CSS problem.

**`gap`** rather than margins on the children. Gap only applies *between* items, so
you never get a stray margin on the last one. Prefer it whenever the parent is
flex or grid.

**`align-items: baseline` on `.brand`** — worth seeing the difference. 勉強 is
22px, "Benkyou" is 20px. With `center` they'd be centered against each other and
the text baselines would be visibly misaligned. `baseline` sits them on a shared
writing line, which is what your eye expects for adjacent words. Toggle it in
DevTools to see.

### The sticky bar

**`position: sticky; top: 0`** means: behave normally until the element would
scroll past the top of the viewport, then stick there. It's `relative` and `fixed`
in one property, and unlike `fixed` it doesn't remove the element from the
document flow — so no content hides behind it.

`top: 0` is required. Sticky with no offset does nothing at all, silently. That's
the classic "why isn't my sticky working" answer.

**`z-index: 10`** puts the bar above content that scrolls under it. z-index only
applies to positioned elements — `sticky` counts, `static` (the default) doesn't.
Keep the numbers small and meaningful; if you find yourself typing `z-index: 9999`
something else is wrong.

---

## Step 3 — Nav buttons and the active state

```css
/* ------ Nav ------ */
.nav {
    display: flex;
    gap: var(--space-1);
}

.nav__btn {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: var(--radius) var(--radius) 0 0;
    color: var(--text-muted);
    font-size: 15px;
    padding: var(--space-2) var(--space-3);
    transition: color 120ms ease, background-color 120ms ease;
}

.nav__btn:hover {
    color: var(--text);
    background: var(--surface-2);
}

.nav__btn[aria-current="page"] {
    color: var(--text);
    border-bottom-color: var(--accent);
}

/* ------ Views ------ */
main {
    padding-block: var(--space-5);
}

.view__title {
    font-size: 22px;
    font-weight: 600;
    margin-bottom: var(--space-2);
}

.view__hint {
    color: var(--text-muted);
}
```

### Notes

**`border-bottom: 2px solid transparent` is the important line**, and it looks
pointless. It reserves the 2px the active underline will occupy, on *every* button.
Without it, activating a button would add 2px of height and nudge the whole bar —
a visible jump every time you switch views. Reserving space with a transparent
border is the standard fix, and the same trick applies to any style that changes
an element's box on a state change.

**`.nav__btn[aria-current="page"]` — styling from an attribute, not a class.**
`aria-current="page"` is the standard way to mark "this is the thing you're looking
at," and screen readers announce it. So rather than tracking a separate
`.is-active` class, style directly off the accessibility state. One piece of state,
correct semantics and correct appearance from it. Same idea as `[lang="ja"]`
driving the Japanese font in guide 01 — mark up what's *true* and let CSS follow.

**`background: none; border: none`** because you're using a real `<button>` and
browsers style those heavily by default. You strip the chrome but keep everything
a button does: keyboard focusable, fires on Enter *and* Space, correct role,
`:disabled` support. That's the argument in
[frontend-setup.md §4](../frontend-setup.md) for never using a clickable `<div>` —
you'd have to rebuild all of that by hand, and Benkyou is keyboard-first.

**`transition`** interpolates a property over time instead of snapping. Name the
properties explicitly rather than writing `transition: all` — `all` will animate
things you didn't intend and costs performance. 120ms is about right for hover;
much slower and the UI feels laggy.

**`main { padding-block: ... }`** — the vertical rhythm that used to live in
`.wrap`, now where it belongs.

---

## Step 4 — Wiring it up

Replace `js/app.js` entirely:

```js
// --- Elements -------------------------------------------------------------
const nav = document.querySelector('.nav');
const views = document.querySelectorAll('.view');
const navButtons = nav.querySelectorAll('.nav__btn');

// --- View switching -------------------------------------------------------

/**
 * Show one view and hide the rest.
 * @param {string} name - matches a button's data-view and a section's id
 */
function showView(name) {
    for (const section of views) {
        section.hidden = section.id !== `view-${name}`;
    }

    for (const btn of navButtons) {
        if (btn.dataset.view === name) {
            btn.setAttribute('aria-current', 'page');
        } else {
            btn.removeAttribute('aria-current');
        }
    }
}

// --- Events ---------------------------------------------------------------

// One listener on the container, not three on the buttons.
nav.addEventListener('click', (event) => {
    const btn = event.target.closest('.nav__btn');
    if (!btn) return;             // clicked the gap between buttons
    showView(btn.dataset.view);
});

// --- Start ----------------------------------------------------------------
showView('cards');
```

### What's going on

**`section.hidden = ...`** — `hidden` is a DOM *property* mirroring the HTML
attribute, so you set it with a boolean rather than `setAttribute`/`removeAttribute`.
Assigning `false` removes the attribute entirely. This is why the architecture in
[frontend-setup.md §4](../frontend-setup.md) is so cheap: view switching is one
boolean per section, no router, no framework.

And this is where guide 01's `[hidden] { display: none !important; }` earns its
keep. Later guides give these sections `display: grid` — without that rule, a
"hidden" section would sit there fully visible while `section.hidden === true`.
You'd be debugging the JS, and the JS would be fine.

**`querySelector` vs `querySelectorAll`** — the first returns one element or
`null`, the second returns a `NodeList` of all matches (empty, never `null`).
A `NodeList` is array-*like*: it has `length` and `forEach` and works in
`for...of`, but not `.map()` or `.filter()`. `[...views]` spreads it into a real
array when you need those.

**Event delegation** — the listener is on `.nav`, not on each button. Two wins:
one listener instead of three, and it keeps working for buttons that don't exist
yet, which matters a lot in guide 04 where card rows are generated.

**`event.target.closest('.nav__btn')`** is what makes delegation reliable.
`event.target` is the deepest element clicked, which could be a text node's parent
or an icon inside the button rather than the button itself. `closest()` walks *up*
from there and returns the first ancestor matching the selector — or `null`, which
is the guard clause. Whenever you delegate, you want `closest()`, not
`event.target.matches()`.

**`showView('cards')` at the bottom** is why the HTML's `hidden` attributes were
inconsistent. If the initial state lived in the HTML, you'd have to keep the
`hidden` attributes and the `aria-current` attribute in sync by hand, and they'd
drift. Instead JS sets the whole state on load from one call. **One source of
truth**, established at startup.

*(The `hidden` on `#view-study` in the markup is still worth keeping: it prevents a
flash of all three views during page load, before the module runs.)*

---

## Checkpoint

Reload and check:

- The bar spans the full window width, but 勉強 lines up with the content below it.
- **Cards** is the active view on load: white text, vermilion underline. The other
  two are grey.
- Clicking each button swaps the content and moves the underline. **No vertical
  jump** in the bar when the underline moves.
- `Tab` walks through the three buttons with a visible focus ring; `Enter` *and*
  `Space` both activate the focused one. You wrote zero key handling for that.
- Hovering a button lightens it — and clicking in the small gap *between* two
  buttons does nothing. That's your `closest()` guard.
- Scroll the page. Nothing to scroll yet, so temporarily paste `<p>` tags into a
  view if you want to watch the bar stick.
- No console errors.

### DevTools exercises

The Elements panel is where flexbox stops being abstract.

1. **Select `.topbar__inner`.** Chrome puts a small `flex` badge next to it in the
   Elements tree — click it. You get an overlay drawing the flex container, its
   items, and the gaps. Leave it on for the rest of these.
2. **In Styles, click the icon next to `justify-content`.** You get a visual
   picker of every value. Try `center`, `flex-start`, `space-around`. Watch the
   overlay. This is the fastest way to build intuition for the main axis.
3. **Add `flex-direction: column` to `.topbar__inner`.** The bar stacks. Now change
   `justify-content` again and notice it moves things *vertically* — the axes
   swapped. That's the whole lesson from step 2, in one edit. Delete it after.
4. **Change `.brand`'s `align-items` from `baseline` to `center`.** Look closely at
   the bottoms of 勉強 and Benkyou. Subtle, but it's the difference between typography
   that looks set and typography that looks placed.
5. **Delete `border-bottom: 2px solid transparent` from `.nav__btn`** and click
   between views. There's the layout jump you avoided.

---

## Where the stylesheet stands

```
Reset → Design Tokens → Base → Japanese Text → Layout primitives
      → Top bar → Nav → Views → Chips
```

Section order matters less than you'd think — CSS specificity, not source order,
decides most conflicts — but *between rules of equal specificity, later wins.*
Keeping generic things (reset, base) above specific things (components) means a
component rule always overrides a base rule at the same specificity, which is the
direction you want.

---

## Next

**Guide 03 — The card editor:** the per-type form. Labels, inputs, `<select>`,
`<fieldset>`, textarea, and CSS Grid for form layout — plus how the form changes
shape between kanji / vocab / sentence
([overview.md §2.4](../../overview.md)). It's the screen you'll spend the most time
in, since every card in Benkyou is hand-typed.

Tell me how this one went first — especially whether the flexbox axis model landed,
since guide 03 leans on grid and the two are easier to keep straight when the first
one is solid.
