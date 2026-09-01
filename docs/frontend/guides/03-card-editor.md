# Guide 03 — The card editor

**You'll build:** the card editor form — a type picker that reshapes the form
between kanji / vocab / sentence, Japanese-aware text fields, a tag row, and save
actions.

**You'll learn:** CSS Grid, form semantics (`label`/`for`, `fieldset`, `legend`),
styling native inputs for dark mode, the visually-hidden pattern, and `FormData`.

This is the screen you'll spend the most time in — every card in Benkyou is typed
by hand ([overview.md §5](../../overview.md)) — so it's worth building carefully.

---

## Step 0 — Fixups

### The nav typo

`index.html` line 24 reads `class="nav_btn"`. One underscore, should be two:

```html
<button class="nav__btn" type="button" data-view="editor">New Card</button>
```

Worth understanding *why* it broke three things at once, because it's the standard
failure mode of this architecture: the class is the join between markup, CSS, and
JS. It missed `.nav__btn` in the stylesheet (no styling), missed
`nav.querySelectorAll('.nav__btn')` (never gets `aria-current`), and missed
`event.target.closest('.nav__btn')` (clicks do nothing). One character, three
symptoms, no error message anywhere.

### Fieldset needs a reset

`<fieldset>` has unusual browser defaults — a border, padding, and a `min-width`
that ignores its container. Add to your `/* ------ Reset ------ */` section:

```css
fieldset {
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
}

legend {
    padding: 0;
}
```

`min-width: 0` is the non-obvious one. Fieldsets default to `min-width:
min-content`, meaning they refuse to shrink below their widest child. Inside a
grid or flex layout that produces overflow you cannot explain from the CSS you
wrote. Reset it once, forget it forever.

### One more token

In `/* ------ Design Tokens ------ */`, under Text:

```css
  --text-on-accent: #fff;   /* text sitting on --accent specifically */
```

You already have `--text-invert: #222`, and it's correct on the *light* accents —
`#222` on `--tag` (`#909dc0`) is a 6:1 contrast ratio, comfortably readable. But
on the vermilion `--accent` (`#cb4042`) it's only 3.3:1, which fails the 4.5:1
minimum for body text. White on that red is 4.8:1 and passes.

The lesson generalizes: "the inverse color" isn't one value. It depends on how
light the background actually is, and mid-tone colors like this red are exactly
where guessing fails. When in doubt, DevTools shows you the contrast ratio — click
any color swatch in the Styles panel and it's listed in the picker.

---

## Step 1 — Form markup

Replace the `#view-editor` section in `index.html`. It's long; read the annotations
after typing it.

```html
<section class="view" id="view-editor" hidden>
    <h2 class="view__title">New Card</h2>

    <form class="form" id="editor-form" autocomplete="off">

        <!-- ---- Type picker ---- -->
        <fieldset>
            <legend class="field__label">Card type</legend>
            <div class="segmented">
                <input class="segmented__input" type="radio" name="cardType"
                       id="type-vocab" value="vocab" checked>
                <label class="segmented__label" for="type-vocab">Vocab</label>

                <input class="segmented__input" type="radio" name="cardType"
                       id="type-kanji" value="kanji">
                <label class="segmented__label" for="type-kanji">Kanji</label>

                <input class="segmented__input" type="radio" name="cardType"
                       id="type-sentence" value="sentence">
                <label class="segmented__label" for="type-sentence">Sentence</label>
            </div>
        </fieldset>

        <!-- ---- Vocab fields ---- -->
        <fieldset class="field-grid" data-type-fields="vocab">
            <div class="field field--full">
                <label class="field__label" for="vocab-expression">Expression</label>
                <input class="input input--jp" type="text" lang="ja"
                       id="vocab-expression" name="expression" placeholder="食[た]べる">
                <p class="field__help">
                    Furigana in square brackets — <code>漢字[かんじ]</code>.
                </p>
            </div>

            <div class="field">
                <label class="field__label" for="vocab-reading">Reading</label>
                <input class="input input--jp" type="text" lang="ja"
                       id="vocab-reading" name="reading" placeholder="たべる">
            </div>
        </fieldset>

        <!-- ---- Kanji fields ---- -->
        <fieldset class="field-grid" data-type-fields="kanji" hidden>
            <div class="field">
                <label class="field__label" for="kanji-character">Character</label>
                <input class="input input--jp input--single" type="text" lang="ja"
                       id="kanji-character" name="character" maxlength="1" placeholder="食">
            </div>

            <div class="field">
                <label class="field__label" for="kanji-strokes">Strokes</label>
                <input class="input" type="number" id="kanji-strokes" name="strokes"
                       min="1" max="34" placeholder="9">
            </div>

            <div class="field">
                <label class="field__label" for="kanji-onyomi">On'yomi</label>
                <input class="input input--jp" type="text" lang="ja"
                       id="kanji-onyomi" name="onyomi" placeholder="ショク、ジキ">
                <p class="field__help">Comma-separated.</p>
            </div>

            <div class="field">
                <label class="field__label" for="kanji-kunyomi">Kun'yomi</label>
                <input class="input input--jp" type="text" lang="ja"
                       id="kanji-kunyomi" name="kunyomi" placeholder="た.べる、く.う">
                <p class="field__help">Comma-separated.</p>
            </div>
        </fieldset>

        <!-- ---- Sentence fields ---- -->
        <fieldset class="field-grid" data-type-fields="sentence" hidden>
            <div class="field field--full">
                <label class="field__label" for="sentence-expression">Sentence</label>
                <textarea class="input input--jp textarea" lang="ja" rows="2"
                          id="sentence-expression" name="expression"
                          placeholder="お 願[ねが]いします"></textarea>
            </div>

            <div class="field field--full">
                <label class="field__label" for="sentence-literal">
                    Literal reading <span class="field__optional">optional</span>
                </label>
                <input class="input" type="text" id="sentence-literal" name="literal"
                       placeholder="&quot;I humbly request&quot;">
            </div>
        </fieldset>

        <!-- ---- Shared fields ---- -->
        <fieldset class="field-grid">
            <div class="field field--full">
                <label class="field__label" for="card-meaning">Meaning</label>
                <input class="input" type="text" id="card-meaning" name="meaning"
                       required placeholder="to eat">
            </div>

            <div class="field field--full">
                <label class="field__label" for="card-notes">
                    Notes <span class="field__optional">optional</span>
                </label>
                <textarea class="input textarea" id="card-notes" name="notes"
                          rows="3" placeholder="Ichidan verb. Link a word with {kanji}."></textarea>
            </div>

            <div class="field field--full">
                <label class="field__label" for="card-tags">Tags</label>

                <div class="tag-row">
                    <span class="chip chip--removable">Topic: Food
                        <button class="chip__remove" type="button"
                                aria-label="Remove tag Topic: Food">&times;</button>
                    </span>
                    <span class="chip chip--removable">Source: Nakama 1
                        <button class="chip__remove" type="button"
                                aria-label="Remove tag Source: Nakama 1">&times;</button>
                    </span>
                </div>

                <input class="input" type="text" id="card-tags" name="tagDraft"
                       list="tag-suggestions" placeholder="Namespace: Value">
                <datalist id="tag-suggestions">
                    <option value="Topic: Food"></option>
                    <option value="Topic: Activities"></option>
                    <option value="Source: Nakama 1"></option>
                    <option value="Level: N5"></option>
                    <option value="Level: N4"></option>
                </datalist>
            </div>
        </fieldset>

        <!-- ---- Actions ---- -->
        <div class="form__actions">
            <button class="btn btn--primary" type="submit">Save card</button>
            <button class="btn" type="submit" name="intent" value="save-new">Save &amp; new</button>
            <button class="btn btn--ghost" type="button" data-action="cancel">Cancel</button>
        </div>

    </form>
</section>
```

### What the markup is doing

**`<label for="vocab-reading">` matched to `id="vocab-reading"`.** This pairing is
the single most important thing in form HTML. It gives you: clicking the label
focuses the input (a much bigger click target, for free), screen readers announce
the label when the field is focused, and the field gets an accessible name. `id`
must be unique across the whole document — which is why they're prefixed
`vocab-` / `kanji-` / `sentence-`.

**But `name` repeats.** Both `#vocab-expression` and `#sentence-expression` use
`name="expression"`. That's intentional and it's safe *because* only one fieldset
is enabled at a time — see step 4, where that turns out to matter more than it
looks.

`name` is the key the value arrives under in `FormData`. `id` is for labels and
JS. They're different jobs, and it's fine for them to differ.

**`<fieldset>` groups related controls; `<legend>` names the group.** For the radio
group this isn't cosmetic — it's how a screen reader announces "Card type, Vocab,
radio button, 1 of 3." The other fieldsets use it structurally, as the unit that
gets shown and hidden.

**`data-type-fields="vocab"`** — same pattern as guide 02's `data-view`. The JS
matches it against the selected radio's value.

**`lang="ja"` on the Japanese inputs** makes `[lang="ja"]` from guide 01 apply the
Japanese font stack automatically. Mark up what's true, let CSS follow. It also
hints to the OS which IME context you're in.

**`type="number"` on strokes** gets you numeric validation and spinner arrows free.
`min`/`max` constrain it. Note it's genuinely a number — don't reach for
`type="number"` for things like phone numbers or IDs that merely *look* numeric.

**`maxlength="1"` on the kanji character** — one field, one character, enforced by
the browser.

**`placeholder` is not a label.** It disappears the moment you type, so it can't
serve as the field's name — that's what `<label>` is for. Use placeholders for
*format examples*, which is exactly what they're doing here: `食[た]べる` shows you
the furigana syntax at the moment you need it.

**`<datalist>` gives you native autocomplete with zero JavaScript.** Type in the
tag field and the browser offers matching options. [overview.md §2.5](../../overview.md)
calls tag autocomplete the main defense against tag rot — and this is most of it
already. In M3 you'll populate the `<option>`s from your existing cards instead of
hardcoding them. Unlike a `<select>`, a datalist still accepts free text.

**`required` on meaning** gives you browser validation on submit — it blocks
submission and shows a native message. Matches [overview.md §2.4](../../overview.md):
meaning is the one field every card type has.

**`autocomplete="off"` on the form** stops the browser from offering *its* saved
form values on top of your datalist.

**Three buttons, two `type`s.** The two saves are `type="submit"`; Cancel is
`type="button"` so it can't submit. This is the habit from guide 02 paying off —
without `type="button"`, Cancel would submit the form and reload the page. Note
`name="intent" value="save-new"` on the second save: step 4 shows how you read
which one was pressed.

---

## Step 2 — Grid, and the form layout

CSS Grid is the two-dimensional counterpart to flexbox. Flexbox lays items along
one axis and lets them wrap; grid defines actual rows and columns that items snap
into.

Add a new section to `style.css`, after `/* ------ Views ------ */`:

```css
/* ------ Forms ------ */
.form {
    display: grid;
    gap: var(--space-4);
    max-width: 620px;
}

.field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
}

.field {
    display: grid;
    gap: var(--space-1);
}

.field--full {
    grid-column: 1 / -1;
}

.field__label {
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.field__optional {
    color: var(--text-faint);
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
}

.field__help {
    color: var(--text-faint);
    font-size: 13px;
    line-height: 1.4;
}

.field__help code {
    background: var(--surface-2);
    border-radius: var(--radius);
    padding: 1px 4px;
}
```

### The grid ideas here

**`grid-template-columns: repeat(2, minmax(0, 1fr))`** defines two columns.

`fr` is the *fraction* unit — it means "one share of the leftover space." Two
`1fr` columns split the width evenly; `2fr 1fr` would be a two-thirds / one-third
split. It's grid-specific and much nicer than percentages, because it accounts for
`gap` automatically. (Try `grid-template-columns: 50% 50%` with a gap and watch it
overflow.)

**Why `minmax(0, 1fr)` instead of just `1fr`?** Because `1fr` is really shorthand
for `minmax(auto, 1fr)`, and `auto` means "at least as wide as my content." A grid
item with long unbreakable content therefore refuses to shrink and blows out the
column. `minmax(0, 1fr)` says the floor is genuinely zero. This is the grid version
of the same class of bug as the fieldset `min-width` in step 0, and it's the fix
you'll reach for repeatedly.

**`grid-column: 1 / -1` spans an item across every column.** Grid counts *lines*,
not columns — a two-column grid has three lines. Negative indices count from the
end, so `-1` is always the last line no matter how many columns there are. `1 / -1`
means "first line to last line," and it keeps working if you change the column
count.

**`gap` works identically in grid and flexbox** — one property to learn for both.

**`.field` is itself a grid** with `gap: var(--space-1)`. A label, input, and help
text stacked with consistent spacing, and no margins to collapse. Using grid for a
simple vertical stack is completely normal — it's often the cleanest way to space
a group of siblings.

**`.form` is also a grid**, giving every fieldset the same `--space-4` separation.
So you have grids nested three deep: form → fieldset → field. That's fine and
idiomatic. Each level only knows about its own children.

---

## Step 3 — Inputs, the segmented control, and buttons

```css
/* ------ Inputs ------ */
.input {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    padding: var(--space-2) var(--space-3);
    width: 100%;
    transition: border-color 120ms ease;
}

.input:hover {
    border-color: var(--border-strong);
}

.input:focus {
    border-color: var(--link);
}

.input::placeholder {
    color: var(--text-faint);
}

.input--jp {
    font-size: 20px;
}

.input--single {
    font-size: 28px;
    text-align: center;
}

.textarea {
    resize: vertical;
    min-height: 3lh;
    line-height: 1.6;
}

/* ------ Segmented control ------ */
.segmented {
    display: inline-flex;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 2px;
    gap: 2px;
}

/* Visually hidden, but still focusable and still a real radio button. */
.segmented__input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}

.segmented__label {
    border-radius: 2px;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 14px;
    padding: var(--space-1) var(--space-3);
    transition: background-color 120ms ease, color 120ms ease;
}

.segmented__label:hover {
    color: var(--text);
}

.segmented__input:checked + .segmented__label {
    background: var(--surface-3);
    color: var(--text);
}

.segmented__input:focus-visible + .segmented__label {
    outline: 2px solid var(--link);
    outline-offset: 1px;
}

/* ------ Tag row ------ */
.tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin-bottom: var(--space-1);
}

.tag-row:empty {
    display: none;
}

/* ------ Buttons ------ */
.btn {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 15px;
    padding: var(--space-2) var(--space-4);
    transition: background-color 120ms ease, border-color 120ms ease;
}

.btn:hover {
    background: var(--surface-3);
    border-color: var(--border-strong);
}

.btn--primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--text-on-accent);
    font-weight: 600;
}

.btn--primary:hover {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
}

.btn--ghost {
    background: none;
    border-color: transparent;
    color: var(--text-muted);
}

.btn--ghost:hover {
    background: var(--surface-2);
    border-color: transparent;
    color: var(--text);
}

.form__actions {
    display: flex;
    gap: var(--space-2);
    align-items: center;
}
```

And extend your existing `/* ------ Chips ------ */` block:

```css
.chip--removable {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding-right: 2px;
}

.chip__remove {
    background: none;
    border: none;
    border-radius: 2px;
    color: inherit;
    font-size: 15px;
    line-height: 1;
    opacity: 0.6;
    padding: 1px 4px;
}

.chip__remove:hover {
    background: rgb(0 0 0 / 0.2);
    opacity: 1;
}
```

### Notes

**`:focus` on inputs, not `:focus-visible`.** Guide 01 warned against styling plain
`:focus`. Text inputs are the exception the rule was built around: browsers match
`:focus-visible` on text fields *even for mouse clicks*, because you're about to
type and need to see where. So `:focus` and `:focus-visible` behave the same here,
and `:focus` is the clearer intent. Note the global `:focus-visible` ring from
guide 01 still fires — this rule only adds the border tint on top of it.

**`min-height: 3lh`** — `lh` is the line-height unit: exactly one line box tall.
So the textarea is three lines tall regardless of font size, and stays correct if
you change either. Much better than guessing a pixel height. (`rows="3"` in the
HTML does something similar; `lh` is the CSS-side tool, useful anywhere.)

**`resize: vertical`** lets you drag the textarea taller but not wider — dragging
wider would break the grid column.

**The visually-hidden pattern** on `.segmented__input` is worth learning as a
recipe. The radio is removed from view but stays in the accessibility tree and the
tab order: still focusable, still announced, still reachable by arrow keys. This is
why you *hide* it rather than using `display: none` — `display: none` would remove
it from the form entirely and it would stop working.

`clip-path: inset(50%)` clips it to nothing; the 1px size and negative margin keep
it from affecting layout. You'll see this same block in every design system, often
as a `.sr-only` utility class.

**`.segmented__input:checked + .segmented__label`** — `+` is the *adjacent sibling*
combinator: "the label immediately after a checked input." This is why the markup
puts each `<input>` directly before its `<label>` rather than nesting the input
inside it. CSS can only select forward through siblings, so the source order is
load-bearing.

The result: you never wrote a click handler for the segmented control. Clicking the
label checks the radio (that's `for`), `:checked` restyles it (that's CSS), and
**arrow keys move between options** (that's native radio behavior). Same argument
as real `<button>`s in guide 02 — semantic elements hand you the interaction.

**`.tag-row:empty { display: none }`** — `:empty` matches an element with no
children *and no text*, so once JS clears the tags, its margin disappears too. Be
aware it's strict: even a single space or newline inside counts as content.

**`rgb(0 0 0 / 0.2)`** is modern CSS color syntax — space-separated, with `/`
before alpha. Equivalent to `rgba(0,0,0,0.2)`. A translucent black works on
*any* chip color, which is why it beats hardcoding a darker shade of each.

---

## Step 4 — Wiring the type switcher

Append to `js/app.js`:

```js
// --- Editor ---------------------------------------------------------------
const editorForm = document.querySelector('#editor-form');
const typeFieldsets = editorForm.querySelectorAll('[data-type-fields]');

/**
 * Show only the fieldset matching the chosen card type.
 * Hiding is not enough — a hidden field still submits. See notes.
 */
function showTypeFields(type) {
    for (const fs of typeFieldsets) {
        const active = fs.dataset.typeFields === type;
        fs.hidden = !active;
        fs.disabled = !active;
    }
}

// `change` bubbles, so one listener on the form covers every control in it.
editorForm.addEventListener('change', (event) => {
    if (event.target.name === 'cardType') {
        showTypeFields(event.target.value);
    }
});

editorForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(editorForm));
    const intent = event.submitter?.value ?? 'save';

    console.log(intent, data);
});

// Sync to whichever radio is checked in the HTML.
showTypeFields(editorForm.querySelector('input[name="cardType"]:checked').value);
```

### The part that matters most

**`fs.disabled = !active` is not optional.** This is the bug this guide exists to
inoculate you against.

`hidden` only affects *display*. A hidden input is still in the form, and
`FormData` still collects its value. So with only `fs.hidden`, saving a vocab card
would silently include the kanji card's empty `character`, `onyomi`, `kunyomi`,
and `strokes` — and because `#vocab-expression` and `#sentence-expression` share
`name="expression"`, the hidden one would **overwrite** the visible one in
`Object.fromEntries`. You'd save blank expressions and have no idea why.

Setting `disabled` on a `<fieldset>` disables every control inside it, and disabled
controls are excluded from `FormData` entirely. One property, and the whole class
of problem disappears. That's also what makes the repeated `name="expression"`
safe.

**`change` bubbles; `focus` and `blur` don't.** That's why one delegated listener
on the form catches every radio. If you ever need delegated focus handling, the
bubbling versions are `focusin` / `focusout` — a genuinely useful thing to know.

**`event.preventDefault()` on submit** stops the browser's default behavior, which
is to navigate. Without it the page reloads and you lose everything. Note it runs
*after* browser validation — `required` on meaning still blocks submission before
your handler is ever called.

**`new FormData(form)`** reads every named, enabled control in one line. That's the
payoff for putting `name` on everything.

**`Object.fromEntries` has one limitation**: it keeps only the last value for a
repeated name. Fine here, but when you add multiple on'yomi inputs in M1, use
`formData.getAll('onyomi')` for those specific fields.

**`event.submitter`** tells you which button submitted the form. That's how "Save"
and "Save & new" share one handler — the second carries `value="save-new"`. It's
`undefined` when the form is submitted by pressing Enter, hence `?? 'save'`.

---

## Step 5 — The IME guard

One Japanese-specific thing, from [overview.md §2.8](../../overview.md). Pressing
Enter in a single-line input submits the form. But Enter is *also* how you confirm
an IME candidate — so typing たべる, pressing Enter to accept 食べる, and having the
form save instead is a real bug you will hit on your first real card.

Add above the submit listener:

```js
// Enter also confirms an IME candidate. Don't let that submit the form.
editorForm.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.isComposing) {
        event.preventDefault();
    }
});
```

`event.isComposing` is `true` while an IME composition session is active. Test it
for real: switch to Japanese input, type in the expression field, and press Enter
to confirm a candidate. The form should not submit.

This is the *minimum* version. The fuller treatment — `compositionstart` /
`compositionend` tracking, and the shortcut keys that insert half-width `[` and
`{` regardless of IME state — belongs with the fast-entry work in M6. The guard
above is the part you need now, while you're testing with actual Japanese.

---

## Checkpoint

Click **New Card**. You should have:

- A segmented control with **Vocab** selected, its pill lighter than the others.
- Clicking **Kanji** swaps the fields: Character / Strokes on one row, On'yomi /
  Kun'yomi on the next. **Sentence** shows a two-line textarea.
- Meaning, Notes, and Tags stay put across all three.
- Clicking a field's label focuses its input.
- Two chips with `×` buttons, and the tag input offering suggestions as you type.
- **Save card** in vermilion with white text; Cancel nearly invisible until hover.

Then:

- **Submit with Meaning empty.** The browser blocks it and points at the field.
  You wrote no validation.
- **Fill Meaning and submit.** Console logs `save` plus an object. Confirm it has
  `expression` and `reading` and **no** `character` or `strokes`. Switch to Kanji
  and submit again — now it's the reverse. That's `disabled` working.
- **Press "Save & new."** Logs `save-new`. Press Enter in a text field instead —
  logs `save`.
- **Tab through the whole form.** The segmented control takes one stop, then arrow
  keys move between the three types. That's free native radio behavior.

### DevTools exercises

1. **Select `.field-grid` and click its `grid` badge** in the Elements tree. You
   get an overlay with numbered grid lines — including the negative ones. Now the
   `1 / -1` in `.field--full` is literal rather than abstract.
2. **Change `grid-template-columns` to `repeat(3, minmax(0, 1fr))`.** The kanji
   fields reflow into three columns and the full-width ones still span everything,
   with no other edit. That's what `-1` bought you.
3. **Delete `fs.disabled = !active` from app.js**, reload, and submit a vocab card.
   Look at `expression` in the logged object. Put it back.
4. **Set `.segmented__input`'s `clip-path` to `none`** and watch the real radio
   buttons appear inside the pills — proof they were there, focusable, the whole
   time.
5. **Click the color swatch beside `--accent`** in the Styles panel. The picker
   shows the contrast ratio against the current text color. Switch
   `.btn--primary`'s color between `--text-on-accent` and `--text-invert` and watch
   it cross the 4.5 line.

---

## Where the stylesheet stands

```
Reset → Design Tokens → Base → Japanese Text → Layout primitives → Chips
      → Top bar → Nav → Views → Forms → Inputs → Segmented control
      → Tag row → Buttons
```

---

## Addendum — dividers in the segmented control

The control as written leans entirely on the checked pill to communicate that the
three labels are separate options. When nothing is hovered that's thin, and the
unselected two read as plain text. Adding a vertical rule between them fixes it.

The obvious approach is `border-left` on each label but the first. It works, but
the line lands *hard against* the label's left edge rather than centered in the
gap, and a full-height border makes the control look like a table. What you want
is a short rule, inset from the top and bottom, floating in the middle of the gap.
That means a pseudo-element.

```css
.segmented {
    --seg-gap: 8px;          /* one source of truth for the spacing */
    gap: var(--seg-gap);
}

.segmented__label {
    position: relative;      /* the positioning context for ::before */
}

.segmented__label:not(:first-of-type)::before {
    content: "";
    position: absolute;
    left: calc(var(--seg-gap) / -2);
    top: 25%;
    bottom: 25%;
    width: 1px;
    background: var(--border-strong);
    transition: opacity 120ms ease;
}

/* A divider touching the selected pill looks like a seam. Hide the one on
   each side of it: the checked label's own, and the next label's. */
.segmented__input:checked + .segmented__label::before,
.segmented__input:checked + .segmented__label + .segmented__input + .segmented__label::before {
    opacity: 0;
}
```

### What's going on

**`::before` is a pseudo-element** — a box you create from CSS with no markup. It
needs `content: ""` to exist at all; that's not optional, and forgetting it is why
a pseudo-element silently doesn't appear. Since it's decorative and empty, screen
readers ignore it, which is exactly right for a divider.

**`position: absolute` on the child, `position: relative` on the parent.** An
absolutely positioned element is placed relative to its nearest *positioned*
ancestor. Without `position: relative` on `.segmented__label` it would escape to
the page and land somewhere unhelpful. This parent/child pairing is one of the most
reused patterns in CSS — worth committing to memory.

**`top: 25%; bottom: 25%` sets the height by inset**, so the rule is always half
the label's height and stays centered no matter the padding. Pinning both edges
instead of setting a `height` is usually the more robust choice.

**`--seg-gap` is a custom property scoped to a component**, not `:root`. That's the
half of custom properties people miss: they don't have to be global design tokens.
Declaring it on `.segmented` means the gap and the divider's offset can never drift
apart — change one number and both follow. `calc(var(--seg-gap) / -2)` pulls the
rule back into the middle of the gap.

**`:not(:first-of-type)`** skips the leading edge. `:first-of-type` means "first
`<label>` among its siblings," which is what you want here — the `<input>`s are
interleaved, so `:first-child` would match nothing.

**That double selector for hiding** is a chain of adjacent-sibling combinators
walking the markup: checked input → its label → the next input → *that* label. It
reads as a mouthful, but it's just following the source order you already have. If
you'd rather not, dropping the second half is fine — the seam is minor.

### If it still doesn't read as interactive enough

Dividers separate the options; they don't announce that the options are clickable.
If you want more affordance, give the unselected labels a hover background rather
than just a color change:

```css
.segmented__label:hover {
    background: var(--surface-3);
    color: var(--text);
}
```

Segmented controls are deliberately quiet — they're a "which mode" control, not a
primary action, and three fully-outlined buttons would compete with **Save card**
for attention. The pill plus a divider plus a hover state is about the right
weight. But it's your app; if you want each option outlined, give
`.segmented__label` its own `border: 1px solid var(--border)` and drop the track
background on `.segmented`.

---

## Next

**Guide 04 — The card list:** `<template>` for repeated rows
([frontend-setup.md §4](../frontend-setup.md)), the search bar, chips back in their
real home, and the first JS that generates DOM from data instead of just toggling
it.

Two things I'd like to know before writing it:

1. **Did Grid land as cleanly as flexbox did?** Guide 05's selection screen is the
   heavy grid one — `repeat(auto-fit, minmax(...))` for responsive columns — so
   it's worth knowing whether to spend more space on it there.
2. **Do you want the card list as rows or as a grid of tiles?** Rows are denser and
   better for scanning a large collection; tiles show more of each card's Japanese
   at a glance. I'd default to rows, since [overview.md §M1](../../overview.md)
   pairs the list with search over card text.
