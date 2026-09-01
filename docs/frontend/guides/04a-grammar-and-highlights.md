# Guide 04a — Grammar cards and highlights

A short interlude, not a full guide. Two design changes landed in
[overview.md](../../overview.md) — a fourth card type and an in-text highlight
notation — and both touch screens you've already built. This catches them up.

**Read first:** [overview.md §2.4](../../overview.md) for why grammar is a real
type rather than a tag, and **§2.7a** for the notation and why `*` won the
delimiter argument.

**Changes:** design tokens, one new CSS block, a fourth option in the editor, a
fourth badge color in the list.

---

## Step 1 — New tokens

In `/* ------ Design Tokens ------ */`, after the existing accents:

```css
  /* --- Type badge (the other three reuse --good / --tag / --accent) --- */
  --grammar:      #a98cc8;

  /* --- Highlights (overview.md §2.7a) --- */
  --hl-red:       #ff9a9c;
  --hl-red-bg:    rgb(203 64 66 / 0.20);
  --hl-blue:      #7ec8ff;
  --hl-blue-bg:   rgb(80 160 230 / 0.20);
  --hl-yellow:    #f0cf7a;
  --hl-yellow-bg: rgb(220 180 90 / 0.18);
```

### Why these values

**The highlight blue is deliberately not the link blue.** `--link` is `#9cbedf`, a
grey-blue; `--hl-blue` is `#7ec8ff`, brighter and cooler. They have to be
distinguishable, because a sentence card can contain both a jisho link and a blue
highlight, and "is this clickable?" should be answerable at a glance. The
background tint does most of that work — links have none — but the hue gap matters
too. This is the one place in the palette where two colors were at risk of
colliding, so it's worth knowing it was a deliberate choice rather than an accident
you're free to undo.

**All three clear 7:1 contrast against `--bg`.** Comfortably above the 4.5:1 floor,
which matters more than usual here: kanji have far more strokes in the same area
than Latin letters, so low-contrast Japanese text degrades faster.

**The backgrounds are translucent (`/ 0.20`), not solid.** A translucent tint
composites over whatever is behind it, so the same three values work on the page
background, on a hovered row (`--surface-1`), and on the study card later. Three
solid colors would need a variant per surface.

**`--grammar` is violet** because the other three badge colors are spoken for —
green (vocab), blue-grey (sentence), vermilion (kanji) — and violet is the
remaining hue that stays distinct from all of them and takes dark text at 5.5:1.

---

## Step 2 — The highlight styles

New section, after `/* ------ Japanese Text ------ */`:

```css
/* ------ Highlights ------ */
.hl {
    border-radius: 2px;
    padding: 0 0.12em;
}

.hl[data-color="red"] {
    color: var(--hl-red);
    background: var(--hl-red-bg);
}

.hl[data-color="blue"] {
    color: var(--hl-blue);
    background: var(--hl-blue-bg);
}

.hl[data-color="yellow"] {
    color: var(--hl-yellow);
    background: var(--hl-yellow-bg);
}
```

### Notes

**Color on a `data-` attribute, not three classes.** `<span class="hl"
data-color="blue">` rather than `.hl--blue`. Both work; the attribute wins because
the M2 renderer will set it with one line copied straight from the token
(`span.dataset.color = token.color`) instead of building a class string. It also
means adding green later is one CSS rule and zero JS. Same reasoning as
`data-type` on the badges in guide 04.

**No `font-weight: bold`.** The instinct is to bolden a highlight, and for Latin
text it'd be right. For CJK it's a mistake: a kanji like 願 already fills its box
with strokes, and synthetic bold — which is what you get without a real bold CJK
face installed — thickens them until the character turns into a blob. Color plus
the background tint carries the emphasis on its own.

**`padding: 0 0.12em`, in `em`.** The tint needs to breathe slightly around the
glyph, and `em` scales with font size — so the same rule looks right on a 16px list
row and a 42px study card. A pixel value would look tight on one and bloated on the
other.

**Vertical padding is `0` deliberately.** Inline elements don't reserve vertical
space for padding — it overflows into the lines above and below rather than pushing
them apart. On a multi-line sentence, vertical padding on a highlight would bleed
into the neighbouring line and collide with its furigana.

---

## Step 3 — See it before it exists

`renderJapanese()` is still `textContent` until M2, so nothing will produce `.hl`
markup yet. Verify the colors now anyway — paste this temporarily into
`#view-cards`, just under the `<h2>`:

```html
<p lang="ja" style="font-size: 28px; line-height: 2.1;">
    <ruby>私<rp>(</rp><rt>わたし</rt><rp>)</rp></ruby><span class="hl" data-color="blue">は</span>
    <ruby>学生<rp>(</rp><rt>がくせい</rt><rp>)</rp></ruby>です。
    <span class="hl" data-color="red">食[た]べ</span>ます／<span class="hl" data-color="yellow">まだ</span>
</p>
```

Check that: all three read clearly against the background, the blue is obviously
not the link blue (compare against a chip or a link), and — the one to look for —
**the highlight background does not touch the furigana above it**. Delete the
paragraph when you're satisfied.

This is the guide 01 smoke-test move again: prove the CSS with static markup before
any code generates it, so when M2's renderer misbehaves you already know the
styling is not the suspect.

---

## Step 4 — The editor gains a type

Add a fourth radio to the segmented control in `#view-editor`:

```html
                <input class="segmented__input" type="radio" name="cardType"
                       id="type-grammar" value="grammar">
                <label class="segmented__label" for="type-grammar">Grammar</label>
```

And a fourth fieldset, after the sentence one:

```html
        <!-- ---- Grammar fields ---- -->
        <fieldset class="field-grid" data-type-fields="grammar" hidden>
            <div class="field field--full">
                <label class="field__label" for="grammar-expression">Grammar point</label>
                <input class="input input--jp" type="text" lang="ja"
                       id="grammar-expression" name="expression" placeholder="は">
            </div>

            <div class="field field--full">
                <label class="field__label" for="grammar-example">Example sentence</label>
                <textarea class="input input--jp textarea" lang="ja" rows="2"
                          id="grammar-example" name="example"
                          placeholder="私[わたし]*b:は* 学生[がくせい]です"></textarea>
                <p class="field__help">
                    Mark the point with <code>*b:は*</code> — <code>r</code>,
                    <code>b</code>, <code>y</code> for red, blue, yellow.
                </p>
            </div>
        </fieldset>
```

**No JavaScript changes.** `showTypeFields()` loops over
`[data-type-fields]` and compares against the checked radio's value — so a fourth
fieldset with a matching `data-type-fields` is picked up automatically, hidden and
disabled along with the rest.

That's the payoff for the data-attribute pattern, and it's worth noticing: adding a
card type touched markup only. Had the switcher been a `switch` statement over
three hardcoded ids, this step would have been a JS edit too, and a fifth type
would be another.

The `name="expression"` on the grammar input repeats the vocab and sentence ones
again — still safe, still for the same reason: `fieldset.disabled` keeps every
inactive fieldset out of `FormData` (guide 03, step 4).

The control is now four options wide, around 340px. Comfortable inside the 620px
form. A fifth would want a rethink; four is fine.

---

## Step 5 — The list gains a badge

One CSS rule, beside the other three:

```css
.type-badge[data-type="grammar"] { background: var(--grammar); }
```

One entry in `TYPE_LABELS`:

```js
const TYPE_LABELS = { kanji: 'Kanji', vocab: 'Vocab', sentence: 'Sentence', grammar: 'Grammar' };
```

And a sample card, so there's something to look at:

```js
    {
        id: 'a5', type: 'grammar', meaning: 'topic marker — “as for X”',
        tags: ['Topic: Particles', 'Level: N5'],
        data: { expression: 'は', example: '私[わたし]*b:は* 学生[がくせい]です' },
    },
```

`cardText()` already handles this — its `card.data.expression ?? card.data.character`
chain finds `expression` on a grammar card with no change. The row shows `は`, and
the example sentence is a study-screen concern (guide 06), not a list one.

If you'd rather scan grammar rows by their example than by the bare particle,
that's a one-line change in `cardText()` — but I'd leave it. A list column reads
better when every row holds the same *kind* of thing, and `は` beside "topic
marker" is a scannable pair. The example is the answer, and the list isn't where
you want answers.

---

## Checkpoint

- Editor: four options, dividers between all of them, Grammar shows two full-width
  fields and hides the other three fieldsets.
- Fill Meaning, pick Grammar, submit. The logged object has `expression` and
  `example`, and **no** `reading`, `character`, or `literal`.
- Cards: five rows, the new one with a violet **Grammar** badge.
- Search `particle` — the grammar row matches on its tag.
- The temporary highlight paragraph looked right, and you've deleted it.

Nothing renders `*b:は*` as blue yet — the list still shows the raw notation,
brackets, asterisks and all. That's correct until M2.

---

## What this changed elsewhere

For the record, since the plan is now the source of truth for M1 and M2:

| Document | Section | Change |
|---|---|---|
| overview.md | §1, §2.4 | Fourth type, `grammar: { expression, example }`, why it isn't a tag |
| overview.md | §2.4 | Grammar is JP→EN only; no auto-derived jisho link |
| overview.md | §2.7 | Highlight row added to the notation table |
| overview.md | **§2.7a** *(new)* | Full `*color:text*` spec, delimiter rationale, four tokenizer rules |
| overview.md | M2 | Tokenizer handles three syntaxes; new done-when case |
| overview.md | §5 | Settled scope updated |

The four rules in §2.7a — first-colon split, unknown-key passthrough, strip
highlights from link targets, `\*` escaping — are the ones to write tests against
in M2. Rule 3 is the one that fails quietly: `{*b:書斎*}` searching jisho for
`*b:書斎*` returns a bad result page rather than an error.

---

## Next

**Guide 05 — Study selection**, unchanged in shape by any of this: the faceted tag
screen, `<details>`/`<summary>` for collapsible namespace sections,
`repeat(auto-fit, minmax(…))` for the checkbox grid, live pool counts, and the
Study button. Grammar simply shows up as a fourth checkbox in the Type section —
which is exactly the point of discovering namespaces from the data rather than
hardcoding them ([overview.md §2.5](../../overview.md)).
