# Frontend Setup & Workflow

Companion to [overview.md](overview.md). That document covers *what* Benkyou is
and the architectural decisions behind it; this one covers *how* to build the
HTML/CSS side — tooling, workflow, and structure.

---

## Context for anyone picking this up

- **Benkyou** is a custom Japanese flashcard webapp. Vanilla JS + HTML/CSS, static,
  hosted on GitHub Pages, no backend. See [overview.md](overview.md) for the full
  design.
- **The author writes the code.** This project is deliberately hands-on — the
  point is to learn, not to receive a finished app. Advice, explanations, and
  short illustrative snippets are welcome; **do not write implementation code to
  files.** For this frontend part, however, you may recommend full HTML or CSS, but only written to markdown files, not the actual source files.
- **Skill level:** comfortable with JavaScript, newer to frontend. Has written
  simple raw HTML pages before, but nothing complex. Wants to genuinely learn the
  UI side rather than delegate it.
- **Editor:** VS Code on Windows.

---

## 1. Tooling decision: no build step *(chosen)*

**Skip Vite, at least initially.**

Vite's core jobs — bundling npm packages, transforming JSX/TypeScript, dependency
pre-bundling — solve problems this project doesn't have. The stack is vanilla JS,
no framework, no dependencies. Adding Vite means introducing `package.json`,
`node_modules`, a `dist/` build output, and a GitHub Action to build before
deploying — all while simultaneously learning CSS. That's machinery sitting
between the author and the thing being learned.

Without a build step:

- What you write is exactly what runs in the browser. No source maps, no
  build/deploy mismatch, no "works locally but not deployed."
- Deployment is "push the folder."
- Native ES modules (`<script type="module">`) work in every modern browser, so
  `import` / `export` are available with zero config.

**Revisit Vite when** you want an npm package, TypeScript, or minification. It
handles plain HTML/JS projects fine, so the migration is easy — this is not a
decision that locks anything in.

### But a local dev server *is* required

This trips up nearly everyone going no-build. **You cannot just double-click
`index.html`.** Over the `file://` protocol:

- ES modules are blocked by CORS — `<script type="module">` silently fails.
- `fetch('./data/cards.json')` fails.
- localStorage origin behaviour is inconsistent.

All three are day-one needs. A local HTTP server is needed purely for *serving*,
not building. The VS Code extension below handles it; `npx serve` also works.

---

## 2. VS Code setup

Four things, in descending order of usefulness:

| Tool | Why |
|---|---|
| **Live Preview** (Microsoft) — or **Live Server** (Ritwick Dey) | Right-click `index.html` → open with it. Serves over `http://localhost` and auto-reloads on save. Solves the `file://` problem. The important one. |
| **Emmet** — *built in, no install* | Type `div.card>h2+p`, press Tab, get the full nested markup. Large speedup when HTML writing is still slow. Worth ten minutes on the cheat sheet. |
| **Prettier** | Format on save. Matters more in HTML than JS, because nesting gets deep fast and manual indentation becomes a time sink. |
| **Auto Rename Tag** | Renaming `<div>` updates its closing tag. Minor, but constantly useful. |

Skip ESLint until the JS grows. Skip anything CSS-framework-related (see §5).

**Browser DevTools is the real learning tool here** — more than any extension. The
Elements panel with live CSS editing is how CSS actually gets learned.

---

## 3. Workflow: static markup first, then wire up JS

This is the most important habit in this document.

The trap for someone strong in JavaScript and newer to HTML is building the entire
DOM from JS:

```js
container.innerHTML = cards.map(c => `<div class="card">...</div>`).join('');
```

It feels natural because it's all in the familiar language. Resist it, at least
while learning.

**Per view, work in this order:**

1. **Hardcode a realistic example** directly in `index.html` — a real card with
   real Japanese text in it, not `Lorem ipsum`. Placeholder text hides layout
   problems that real content exposes (especially with ruby annotations, which
   change line height).
2. **Style it with DevTools open**, editing CSS values live in the browser until
   it looks right, then copy the final values back into the stylesheet.
3. **Only then** replace the hardcoded content with JS that fills it in.

Step 2 is the one that teaches CSS. Live-editing values and watching the box model
update is dramatically faster feedback than editing a file and reloading.

---

## 4. Project structure

**One `index.html` containing all views as sections**, toggled by JS — not
separate HTML files per view.

Reason: without a build step there's no way to share a header or nav between HTML
files. Multi-page means copy-pasting the nav into every file and updating it in
five places on every change. A single page sidesteps that entirely and needs no
router.

```
index.html          ← all views live here
css/style.css
js/app.js           ← <script type="module" src="js/app.js"></script>
js/storage.js       ← the storage interface (overview.md §2.1)
js/tokenizer.js     ← furigana + jisho link parsing (overview.md §2.7)
data/cards.json     ← the canonical collection (overview.md §2.9a)
docs/               ← planning markdown (this file, overview.md)
```

```html
<main>
  <section id="view-study"  hidden>...</section>
  <section id="view-cards">...</section>
  <section id="view-editor" hidden>...</section>
</main>
```

View switching is then just toggling the `hidden` attribute. No framework, no
router, and it stays obvious what's happening.

> **Unresolved:** [overview.md](overview.md) references `docs/data/cards.json`,
> which assumes GitHub Pages serves from `/docs`. The layout above serves from the
> repo root and keeps `/docs` for planning markdown, which is a cleaner
> separation. Either works — pick one when setting up Pages and make the two
> documents agree.

### Two specifics worth adopting early

**Use `<template>` for repeated elements.** Put an empty card row inside a
`<template>` tag, then `cloneNode` it per card and fill text in with
`textContent`. Cleaner than string-concatenating HTML, and using `textContent`
means hand-entered Japanese can never be accidentally parsed as markup.

**Use real `<button>` elements, never clickable `<div>`s.** Not as
accessibility box-ticking — because buttons are focusable and fire on both Enter
and Space for free. M4 in the overview is keyboard-first, and semantic elements
supply a large chunk of that behaviour with no key handling written at all.

---

## 5. CSS approach

**Learn two things; they cover nearly all layout:**

- **Flexbox** — one-dimensional arrangement (a row of buttons, a card header).
- **Grid** — two-dimensional (the tag selection screen in overview.md §2.6).

Skip everything else until a specific need appears.

**Use CSS custom properties for colors from the very first stylesheet:**

```css
:root {
  --bg: #fff;
  --text: #1a1a1a;
  --accent: #3b6ea5;
}
```

Dark mode is an M6 item. With variables it's roughly ten lines; with hardcoded
colors scattered through a stylesheet it's a tedious find-and-replace.

**Avoid Bootstrap and Tailwind here.** Bootstrap makes the result look like
Bootstrap. Tailwind requires a build step and teaches utility class names rather
than CSS itself. The stated goal is to experiment with UI — that means writing the
CSS.

Also see [overview.md](overview.md) §2.8 for Japanese-specific typography
requirements (font stacks and Chinese glyph variants, sizing, ruby rendering
differences between browsers) — those interact directly with CSS decisions.

---

## 6. First session

1. Create `index.html` with a bare skeleton.
2. Install Live Preview; get "Hello 勉強" rendering at `localhost`.
3. Confirm a `<script type="module">` actually loads — this validates the server
   setup before anything depends on it.
4. Hand-build the **card editor form for one card type**, with no JavaScript at
   all.

Step 4 is a genuinely good first frontend exercise: forms contain most of the HTML
elements this app needs (inputs, labels, selects, buttons, fieldsets), and the
per-type editor form is central to the design (overview.md §2.4).

That set is M0 in the overview's milestone list.
