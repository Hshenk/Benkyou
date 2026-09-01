# Guide 01 — Foundations

**You'll build:** a served page that says 勉強 with correct furigana above it, in
the dark palette the whole app will use.

**You'll learn:** the `<head>` boilerplate and what each line actually does, why a
CSS reset exists, CSS custom properties (variables), and the Japanese typography
setup — font stacks, `lang`, and `<ruby>`.

**Files you'll create:** `index.html`, `css/style.css`, `js/app.js`.

Nothing here is throwaway. The stylesheet you finish this guide with is the top of
the real stylesheet for the rest of the project.

---

## Step 0 — Folder structure

Create these, empty for now, in the repo root:

```
Benkyou/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── app.js
├── data/          ← cards.json lands here later (M5)
└── docs/          ← planning markdown (already exists)
```

> **Note for later:** [frontend-setup.md §4](../frontend-setup.md) flags that
> `overview.md` says `docs/data/cards.json` while this layout says `data/cards.json`.
> This guide assumes GitHub Pages serves from the **repo root**. When you set Pages
> up, pick root and fix the one stale path in `overview.md` §2.9a so the two docs
> agree.

---

## Step 1 — `index.html`, the skeleton

Type this in. Read the annotations after — every line is doing something.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Benkyou</title>
  <link rel="stylesheet" href="css/style.css">
  <script type="module" src="js/app.js"></script>
</head>
<body>

  <h1>勉強</h1>

</body>
</html>
```

### What each line is doing

**`<!DOCTYPE html>`** — not a tag, and not optional. Its only job is telling the
browser "render in standards mode." Omit it and you get *quirks mode*, a
compatibility layer emulating 1990s browsers where the box model is subtly wrong.
There is no reason to ever leave it out.

**`<html lang="en">`** — declares the page's primary language. It's load-bearing
here in a way it isn't on most sites: browsers use `lang` to pick which glyph
variants to render for CJK characters, because Chinese, Japanese, and Korean share
codepoints but draw some of them differently. Your *UI* is English, so `en` is
correct at the top — you'll mark the Japanese bits individually with `lang="ja"`
in Step 6. (See [overview.md §2.8](../../overview.md).)

**`<meta charset="UTF-8">`** — tells the browser how to decode the bytes of the
file into characters. Get this wrong and 勉強 renders as `å‹‰å¼·`. It must be in
the **first 1024 bytes** of the document, which is why it's the first thing in
`<head>`. Save your files as UTF-8 in VS Code (bottom-right of the status bar
shows the current encoding).

**`<meta name="viewport" ...>`** — tells mobile browsers not to pretend they're a
980px-wide desktop and zoom out. Benkyou is desktop-only so this is nearly
irrelevant, but it costs one line and its absence is confusing to anyone reading
the file later.

**`<link rel="stylesheet" href="css/style.css">`** — CSS goes in `<head>` because
stylesheets are *render-blocking*: the browser waits for it before painting. That
sounds bad, but the alternative is a flash of unstyled black-on-white text.

**`<script type="module" src="js/app.js"></script>`** — two things here:

- `type="module"` gives you `import` / `export` with no build step. It's also why
  you can't just double-click the file — see Step 2.
- Module scripts are **deferred by default**. They download in parallel with HTML
  parsing but execute only after the DOM is fully built. That means your JS can
  safely query for elements without wrapping everything in a `DOMContentLoaded`
  listener. Non-module scripts don't do this, which is why you may have seen
  `<script>` tags parked at the bottom of `<body>` in older tutorials — that
  workaround is obsolete for modules.

---

## Step 2 — Serve it (don't double-click it)

Put this in `js/app.js`:

```js
console.log('Benkyou: module loaded');
```

Now install **Live Preview** (Microsoft) from the VS Code extensions panel.
Right-click `index.html` → **Show Preview**, or open the command palette
(`Ctrl+Shift+P`) → *Live Preview: Start Server*, then visit the `localhost` URL it
gives you in a real browser. Use a real browser rather than the embedded preview
pane — you want the full DevTools.

**Verify the module actually loaded:** open DevTools (`F12`) → Console. You should
see `Benkyou: module loaded`.

If you instead see a CORS error mentioning `file://`, you opened the file directly
rather than through the server. That's the whole reason a server is needed:
`file://` has no origin, and ES modules — plus the `fetch()` you'll use for
`cards.json` in M5 — are blocked without one. This check is worth doing *now*,
before anything depends on it.

Leave the browser open. Live Preview reloads on every save from here on.

---

## Step 3 — The reset

Browsers ship a *user-agent stylesheet* with their own defaults: `body` has an
8px margin, headings have big vertical margins, lists have bullets and padding.
Those defaults disagree between browsers and mostly fight you. A **reset** is a
short block at the top of your stylesheet that flattens them.

Start `css/style.css` with this:

```css
/* ==========================================================================
   1. Reset
   ========================================================================== */

*,
*::before,
*::after {
  box-sizing: border-box;
}

body,
h1, h2, h3, h4,
p, figure, blockquote,
dl, dd {
  margin: 0;
}

ul[role="list"],
ol[role="list"] {
  list-style: none;
  margin: 0;
  padding: 0;
}

img, picture, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
  color: inherit;
}

button {
  cursor: pointer;
}

/* Views are toggled by adding/removing the `hidden` attribute. The UA default
   for [hidden] is `display: none`, but that loses to any later `display` rule
   (like `display: flex` on a section). !important is the correct tool here —
   it's a global invariant, not a specificity hack. */
[hidden] {
  display: none !important;
}
```

### Why each of those

**`box-sizing: border-box` on everything.** The single most valuable line in CSS.
By default, `width: 300px` means 300px of *content*, and padding and border get
added on top — so a 300px box with 20px padding is actually 340px wide. With
`border-box`, `width: 300px` means the box is 300px wide, full stop, and padding
eats inward. This is what everyone expects and nobody gets by default. The
`*::before, *::after` part covers pseudo-elements, which don't inherit it.

**Zeroing margins.** Default heading and paragraph margins *collapse* into each
other in ways that are genuinely surprising when you're debugging spacing. Zero
them and add space deliberately where you want it.

**`ul[role="list"]`** — note the attribute selector: this only strips bullets from
lists you've explicitly marked `role="list"`. Stripping `list-style` from a `<ul>`
makes some screen readers stop announcing it as a list; adding the role back
preserves it. If you don't care about that, plain `ul` works — but this is the
version worth learning.

**`font: inherit` on form controls.** Form elements do *not* inherit font from
their parent — they use an OS default. Without this line, your inputs and buttons
render in a completely different typeface from everything around them. This one
bites everyone once.

**`[hidden] { display: none !important; }`** — read the comment above it. This is
the load-bearing line for the app architecture: [frontend-setup.md §4](../frontend-setup.md)
says every view lives in one `index.html` as a `<section>` toggled by `hidden`.
Since you'll be giving some of those sections `display: flex` or `display: grid`,
without this rule a "hidden" section would still be visible. You'd waste an hour
on that.

---

## Step 4 — Design tokens

A **custom property** (CSS variable) is declared with a `--` prefix and read with
`var()`. Declaring them on `:root` — which is the `<html>` element — makes them
available everywhere, because custom properties inherit down the tree.

```css
/* ==========================================================================
   2. Design tokens
   ========================================================================== */

:root {
  /* --- Surfaces -----------------------------------------------------------
     A layered scale. Higher number = closer to the viewer. In a dark UI you
     signal elevation by getting *lighter*, not by adding shadows. */
  --bg:          #2a2a2a;   /* the page itself */
  --surface-1:   #333;      /* cards, panels, the top bar */
  --surface-2:   #404040;   /* inputs, raised rows */
  --surface-3:   #555;      /* hover / pressed states */

  /* --- Text --- */
  --text:        #eee;      /* body copy */
  --text-muted:  #aaa;      /* labels, metadata, furigana */
  --text-faint:  #808080;   /* placeholders, disabled */
  --text-invert: #222;      /* text sitting ON an accent color */

  /* --- Lines --- */
  --border:        #4a4a4a; /* the default hairline */
  --border-strong: #777;    /* separators that need to read clearly */

  /* --- Accents (borrowed from jisho.org's dark theme) --- */
  --link:        #9cbedf;   /* jisho's link blue */
  --link-hover:  #c2d9ef;
  --accent:      #cb4042;   /* jisho's vermilion — primary action, active view */
  --accent-hover:#d75a5c;
  --good:        #8abc83;   /* "Got it", common-word tags */
  --tag:         #909dc0;   /* neutral chips */

  /* --- Type --- */
  --font-ui: "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-jp: "Yu Gothic UI", "Yu Gothic", "Hiragino Sans",
             "Hiragino Kaku Gothic ProN", "Noto Sans JP", Meiryo, sans-serif;

  /* --- Spacing scale ------------------------------------------------------
     Steps, not arbitrary numbers. Reaching for `--space-3` instead of "16px…
     or was it 15?" is what makes a hand-written UI look deliberate. */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 40px;

  /* --- Shape --- */
  --radius:    3px;   /* jisho's chips and buttons */
  --radius-lg: 5px;
}
```

### Notes

**Why bother, given there's no light theme?** Because the real payoff isn't dark
mode — it's that `--accent` appears in one place. When you decide the vermilion is
too loud at 2am, you change one line instead of hunting eleven hex codes. Same for
the spacing scale: retuning the app's density is five numbers.

**Why a *scale* rather than named colors like `--red`?** Because
`background: var(--surface-2)` tells you what the thing *is*; `background:
var(--grey-40)` tells you what it *looks like*. Semantic names survive a redesign.

**On the surface scale:** in dark UIs the convention is inverted from light ones.
On white, you push things forward with a drop shadow. On dark, shadows are
invisible — so elevation is expressed as lightness. That's why jisho's search bar
(`#6e6e6e`) is much lighter than its page (`#2a2a2a`).

**On the font stacks.** Both are *stacks*: the browser tries each in order and
uses the first one installed. There's no webfont here (nothing to download, no
layout shift, no dependency). `--font-jp` is ordered Windows-first
(`Yu Gothic UI`, your machine) then macOS (`Hiragino`), with `Noto Sans JP` as a
broad fallback. This matters more than it does for Latin text — the wrong CJK font
can render a character in a shape that looks *incorrect* to a Japanese reader, not
merely different.

---

## Step 5 — Base layer

```css
/* ==========================================================================
   3. Base
   ========================================================================== */

:root {
  color-scheme: dark;
  accent-color: var(--accent);
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

a {
  color: var(--link);
  text-decoration: none;
}

a:hover {
  color: var(--link-hover);
  text-decoration: underline;
}

:focus-visible {
  outline: 2px solid var(--link);
  outline-offset: 2px;
}
```

### Notes

**`color-scheme: dark`** is the one line people miss, and it does a surprising
amount. It tells the browser your page is dark, so the browser renders *its own*
UI to match: scrollbars become dark, checkboxes and radio buttons get dark
chrome, `<select>` dropdowns open dark, and text-input carets stay visible.
Without it you get a light scrollbar stapled to a dark page and light native
checkboxes on the study selection screen.

**`accent-color`** tints native checkboxes and radios with your color, with no
custom styling at all. The faceted selection screen (guide 05) is dozens of
checkboxes — this one line does most of that work.

**`line-height: 1.6`** is unitless on purpose. A unitless line-height is inherited
as a *ratio*, so a child at 32px gets 51.2px of leading. If you wrote `line-height:
26px`, every child would inherit a literal 26px and your large Japanese text would
overlap itself.

**`:focus-visible` rather than `:focus`.** `:focus-visible` shows the ring for
keyboard focus but *not* for mouse clicks — which is exactly the behavior you want.
Never write `outline: none` without a replacement: Benkyou is keyboard-first
([overview.md §M4](../../overview.md)) and the focus ring is how you know where you
are. The default ring is also nearly invisible on `#2a2a2a`, hence the override.

---

## Step 6 — Japanese text and ruby

This is the part specific to this project.

```css
/* ==========================================================================
   4. Japanese text
   ========================================================================== */

/* An attribute selector: applies to ANY element carrying lang="ja".
   Mark up the language once in HTML and the font follows automatically. */
[lang="ja"] {
  font-family: var(--font-jp);
  font-feature-settings: "palt" 0;   /* keep full-width spacing; don't kern CJK */
}

/* Ruby = the <ruby>/<rt> pair that draws furigana above a kanji block. */
ruby {
  ruby-position: over;      /* above the base text, not below */
  ruby-align: center;
}

rt {
  font-size: 0.5em;         /* relative to the base, so it scales with it */
  color: var(--text-muted); /* furigana is an aid, not the main event */
  font-weight: 400;
  line-height: 1.2;
  user-select: none;        /* dragging to select the word skips the reading */
}

/* Any block containing ruby needs extra leading, or the furigana of one line
   collides with the descenders of the line above it. */
.has-ruby {
  line-height: 2.1;
}
```

### Notes

**`[lang="ja"]` is the trick worth internalizing.** You mark language in the HTML
because it's *true* — it helps glyph selection, screen readers, and browser
translation. Then this one CSS rule turns that truth into the correct font
everywhere, forever, with no class names to remember. You'll never write
`class="japanese"`.

**Ruby markup** looks like this:

```html
<ruby>勉強<rp>(</rp><rt>べんきょう</rt><rp>)</rp></ruby>
```

- `<ruby>` wraps the whole unit; the bare text inside is the *base*.
- `<rt>` is the ruby text — the reading that floats above.
- `<rp>` is *ruby parenthesis*: fallback for anything that can't render ruby,
  which then shows `勉強(べんきょう)` inline instead of a mangled mess. Browsers
  that do support ruby hide `<rp>` automatically. It's cheap insurance, and
  [overview.md §2.8](../../overview.md) calls for it.

**You will not hand-write this markup for cards.** In M2 you write a tokenizer
that turns `勉強[べんきょう]` into these elements. For now you're typing it by hand
to get the CSS right, which is exactly the workflow in
[frontend-setup.md §3](../frontend-setup.md): real markup with real content first,
JS to generate it later.

**The line-height problem is real** and only shows up with multi-line text, which
is why the guide has you test with a full sentence below. Ruby text is drawn
*outside* the normal line box, so at a normal `line-height` the reading above line
2 overlaps line 1. `2.1` is a starting value — tune it in DevTools.

**Cross-browser check:** ruby rendering genuinely differs between Chrome and
Firefox (rt sizing and vertical position). Look at your result in both.

---

## Step 7 — The smoke test

Replace the `<body>` of `index.html` with this. It's deliberately a real card's
worth of content, not "Hello World" — placeholder text hides exactly the layout
problems ruby creates.

```html
<body>

  <div class="wrap">
    <h1 class="brand">Benkyou</h1>

    <p class="smoke-label">Vocab</p>

    <p class="smoke-jp" lang="ja">
      <ruby>勉強<rp>(</rp><rt>べんきょう</rt><rp>)</rp></ruby>
    </p>

    <p class="smoke-meaning">study, diligence</p>

    <p class="smoke-jp-sentence has-ruby" lang="ja">
      <ruby>毎日<rp>(</rp><rt>まいにち</rt><rp>)</rp></ruby>すこしずつ
      <ruby>日本語<rp>(</rp><rt>にほんご</rt><rp>)</rp></ruby>を
      <ruby>勉強<rp>(</rp><rt>べんきょう</rt><rp>)</rp></ruby>しています。
      「<ruby>頑張<rp>(</rp><rt>がんば</rt><rp>)</rp></ruby>って」と
      <ruby>言<rp>(</rp><rt>い</rt><rp>)</rp></ruby>いました。
    </p>

    <p>
      <span class="chip chip--good">Common</span>
      <span class="chip">Level: N4</span>
      <span class="chip">Source: Nakama 1</span>
    </p>

    <p>
      <a href="https://jisho.org/search/%E5%8B%89%E5%BC%B7"
         target="_blank" rel="noopener noreferrer">Look up 勉強 on jisho.org</a>
    </p>
  </div>

</body>
```

And append this CSS. Everything here is temporary *except* `.wrap` and `.chip`,
which you'll keep.

```css
/* ==========================================================================
   5. Layout primitives
   ========================================================================== */

.wrap {
  max-width: 900px;
  margin-inline: auto;      /* left+right auto = horizontally centered */
  padding: var(--space-5) var(--space-3);
}

/* ==========================================================================
   6. Chips (tags)
   ========================================================================== */

.chip {
  display: inline-block;
  background: var(--tag);
  color: var(--text-invert);
  font-size: 12px;
  line-height: 1.4;
  padding: 2px var(--space-2);
  border-radius: var(--radius);
  margin-right: var(--space-1);
}

.chip--good {
  background: var(--good);
}

/* ==========================================================================
   99. Smoke test — delete after guide 02
   ========================================================================== */

.brand {
  font-size: 28px;
  letter-spacing: 0.02em;
}

.smoke-label {
  color: var(--text-muted);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: var(--space-4);
}

.smoke-jp {
  font-size: 42px;
  line-height: 1.8;
}

.smoke-meaning {
  font-size: 19px;
  color: var(--text);
  margin-bottom: var(--space-4);
}

.smoke-jp-sentence {
  font-size: 24px;
  max-width: 34em;
  margin-bottom: var(--space-4);
}
```

### Notes

**`.chip--good`** uses BEM-ish naming: `block__element--modifier`. You only need
the `--modifier` half. `class="chip chip--good"` means "a chip, in the good
variant" — the base class carries shape and spacing, the modifier changes one
thing. Much better than a separate `.good-chip` that duplicates all the padding.

**`margin-inline: auto`** is the modern spelling of `margin-left: auto;
margin-right: auto`. "Inline" means the text-flow direction. It's one property
instead of two.

**`max-width: 34em` on the sentence.** `em` is relative to that element's own
font-size, so this is "about 34 characters wide" and it stays correct if you change
the font size. Long lines are hard to read; capping measure is a real typographic
rule, not decoration.

**The `「」` in the test sentence are deliberate.** [overview.md §2.7](../../overview.md)
warns against treating full-width brackets as markup delimiters, because they're
real Japanese punctuation. They're here so you see them rendering as *text* from
day one.

---

## Checkpoint

Reload. You should have:

- A `#2a2a2a` page, off-white text, content centered in a 900px column.
- べんきょう floating above 勉強 in muted grey, at roughly half the size.
- A multi-line sentence where the furigana on line 2 does **not** touch line 1.
- 「頑張って」 with its quotation marks rendered as ordinary characters.
- Three colored chips, and a blue jisho link that underlines on hover.
- A **dark scrollbar**, not a light one. If it's light, `color-scheme: dark` is
  missing or misplaced.
- `Benkyou: module loaded` in the console.

### Then go play in DevTools

This is the step that actually teaches CSS, per
[frontend-setup.md §3](../frontend-setup.md). With the page open, `F12`:

1. **Inspect `.wrap`.** In the Styles panel find the Box Model diagram at the
   bottom. Change `padding` and watch it update live. This is how the box model
   becomes intuitive instead of memorized.
2. **Find `:root` in the Styles panel** (inspect `<html>`). Change `--bg` to
   `#1a1a1a` and watch the entire page follow from one edit. That's the argument
   for tokens, demonstrated in two seconds.
3. **Change `.has-ruby`'s `line-height` to `1.4`.** Watch the furigana collide.
   Now you know what that rule is for.
4. **Press `Tab`** on the page. The jisho link should get a visible blue ring.
   That's `:focus-visible`.

Anything you like from step 2 or 3, copy the value back into `style.css`.

---

## Your stylesheet so far

`css/style.css` is now, in order: **1. Reset → 2. Tokens → 3. Base →
4. Japanese → 5. Layout primitives → 6. Chips → 99. Smoke test**.

Keep those numbered section comments. Guide 02 adds sections in between them, and
a stylesheet you can navigate by scrolling is worth the ten seconds of typing.

---

## Next

**Guide 02 — App shell:** the top bar with Study / Cards / New Card, the
`<section>` per view, and switching between them by toggling `hidden`. That's your
first real flexbox layout, and the first JavaScript that touches the DOM.

Before then, tell me: anything above that didn't land, or any part of the result
that looks off to you.
