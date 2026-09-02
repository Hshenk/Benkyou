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
| 08 | [Splitting the JavaScript](08-splitting-the-javascript.md) | ES modules, the M1/M2 seams as real files, view boundaries | ✅ done |

Guides were written one at a time, so later ones react to what tripped you up in
earlier ones.

**These guides are finished.** The frontend shell is built; guide 08 was the
handoff. Everything from guide 09 onward is application logic and lives in
**[docs/main-guides/](../../main-guides/README.md)**.

---

## What these guides left behind

The frontend shell is complete — every screen exists and works. Guide 08 split the
JavaScript into modules, which turned the two planned seams into real files:

- **`js/render.js`** was `textContent`. Filled by
  [main guide 09](../../main-guides/09-tokenizer-and-renderer.md).
- **`js/storage.js`** was a literal `sampleCards` array. Filled by
  [main guide 10](../../main-guides/10-storage-and-crud.md).

The CSS written here (`ruby`, `rt`, `.hl[data-color]`, `[data-furigana]`,
`.chip--removable`) was built ahead of the JavaScript that uses it, so those
guides add no new styles.
