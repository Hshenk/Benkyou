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

Guides were written one at a time, so later ones react to what tripped you up in
earlier ones.

---

## After guide 06

The frontend is complete — every screen exists and works against sample data.
Two deliberate seams remain, both built so they can be filled without touching
the code around them:

- **`renderJapanese(el, text)`** is `textContent`. M2 replaces its body with the
  tokenizer and renderer; ruby, jisho links, and `*b:は*` highlights then appear
  everywhere at once. The CSS for all three already exists.
- **`sampleCards`** is a literal array. M1 replaces it with the storage interface
  from [overview.md §2.1](../../overview.md).

Recommended next steps, in order: split `app.js` into ES modules before M1 grows
it, check ruby rendering in Firefox, deploy to GitHub Pages (still an open M0
item), then **M2**.
