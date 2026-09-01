# Benkyou Frontend Guides

Step-by-step walkthroughs for building the Benkyou UI by hand. Each guide gives
you the complete HTML/CSS **in the guide**, annotated — you type it into the real
source files yourself. That's the point: the typing and the reading are where the
learning happens.

Companion documents:

- [overview.md](../../overview.md) — what Benkyou is and why (data model, sync, study mechanics)
- [frontend-setup.md](../frontend-setup.md) — tooling and workflow decisions

---

## Design direction *(settled)*

- **Dark mode only.** No light theme, now or later. Colors still go through CSS
  custom properties, because that's what makes them tweakable in one place.
- **Visually modeled on [jisho.org](https://jisho.org)'s dark theme** — flat
  surfaces, small radii (2–3px), thin separators instead of shadows, generous
  type size for Japanese, one vermilion accent.
- **Top bar** app shell. Study / Cards / New Card as view buttons.
- **Desktop only.** No responsive breakpoints, no touch targets.

---

## The guides

| # | Guide | Builds | Status |
|---|---|---|---|
| 01 | [Foundations](01-foundations.md) | Page skeleton, CSS reset, design tokens, Japanese typography, ruby | ✅ done |
| 02 | [App shell](02-app-shell.md) | Top bar, flexbox, view sections, view switching with `hidden` | ✅ done |
| 03 | [Card editor](03-card-editor.md) | CSS Grid, the per-type form, inputs, segmented control, `FormData` | ✅ done |
| 04 | [Card list](04-card-list.md) | Row layout, `<template>` + cloning, search, empty state | ✅ done |
| 04a | [Grammar & highlights](04a-grammar-and-highlights.md) | Fourth card type, `*color:text*` highlight styling | ✅ done |
| 05 | [Study selection](05-study-selection.md) | `<details>`, `auto-fit` grid, `:has()`, the OR/AND pool builder | ✅ done |
| 06 | [Study session](06-study-session.md) | Card face typography, furigana modes, requeue, keyboard controls | ✅ done |
| 07 | [Handwritten forms](07-handwritten-forms.md) | 教科書体 font toggle, `aria-pressed`, namespaced localStorage | ✅ done |
| 08 | [Splitting the JavaScript](08-splitting-the-javascript.md) | ES modules, the M1/M2 seams as real files, view boundaries | ✅ ready |
| 09 | [Tokenizer and renderer](09-tokenizer-and-renderer.md) | **M2.** Single-pass scanner, token tree, ruby/link/highlight DOM, tests without a build step | ✅ ready |

Guides were written one at a time, so later ones react to what tripped you up in
earlier ones.

### Planned

| # | Guide | Builds |
|---|---|---|
| 10 | Storage and CRUD | **M1.** localStorage behind the `storage.js` interface, `crypto.randomUUID()` ids, `updatedAt`, the `dirty` flag, editor save/edit/delete wired up |
| 11 | Export and import | **M1.** Versioned JSON, File System Access API save-back-to-handle, the export nag |
| 12 | Tag editing | **M3.** Real tag chips, autocomplete from existing tags, the rename/merge screen |

Order note: M2 (guide 09) comes before M1 because the notation bakes into every
card written from here on. Changing it costs nothing today and costs a migration
script once real cards exist.

---

## Where the project stands

The frontend shell is complete — every screen exists and works against sample
data. Guide 08 split the JavaScript into modules, which turned the two planned
seams into real files:

- **`js/render.js`** was `textContent`. **Guide 09 fills it** — ruby, jisho links,
  and `*b:は*` highlights then appear everywhere at once. The CSS for all three
  already exists.
- **`js/storage.js`** is still a literal `sampleCards` array behind `getCards()`.
  Guide 10 replaces it with the localStorage implementation of
  [overview.md §2.1](../../overview.md).

Still stubbed, and filled by guide 10: the editor's submit handler
(`console.log`), and the card list's Edit/Delete buttons (also `console.log`).

Open M0 item, unrelated to any guide: **deploy to GitHub Pages.** Worth doing on
its own at some point rather than bundling into a guide.
