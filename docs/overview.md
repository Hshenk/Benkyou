# Benkyou — Project Overview & Development Plan

A custom digital flashcard app for studying Japanese. Anki-like in concept, but
deliberately simpler: no spaced-repetition scheduler, a UI built around how I
actually study, and first-class support for Japanese text (furigana, kanji lookup).

**Stack:** vanilla JS + HTML/CSS, static-hosted on GitHub Pages. **No backend** —
cards live in browser storage, with JSON export/import as the transfer and backup
mechanism, and a `cards.json` committed to the repo as the canonical collection.

---

## 1. Core concept

- **Cards** — a single study item, of one **type**: `kanji`, `vocab`, `sentence`,
  or `grammar`. All share a meaning and notes; each type adds its own fields.
- **Tags** — namespaced labels on cards: `Topic: Activities`,
  `Source: Nakama Book 1`, `Level: N4`. Free-form and many-to-many.
- **Study session** — tick tags across one or more namespaces (OR within a
  namespace, AND across them); matching cards shuffle into a pool. Cards you miss
  get requeued a few cards later rather than waiting for tomorrow.

No scheduling, no intervals, no ease factors. You decide what to study by choosing
what you want to work on today, not by letting an algorithm choose for you.

---

## 2. Key design decisions

These are the choices that are expensive to reverse. Worth settling before code.

### 2.1 No backend; browser storage is the working copy

Supabase is dropped. For one user on two machines that are never used
simultaneously, a hosted Postgres with auth and Row Level Security is a lot of
moving parts to solve a problem that a file solves.

What you give up: automatic cross-device sync. Every transfer becomes a manual
export → commit → import. Whether that's acceptable depends on one thing —
**how often you author cards on both machines in the same sitting.** If you mostly
create on one and study on both, the friction is near zero. If you're switching
mid-session, it will grate, and that's the signal to revisit.

What you gain, beyond simplicity:

- **Free version history.** Once `cards.json` is in git, you get the entire
  history of your collection for nothing. Fat-finger a bulk edit and `git log`
  bails you out. Supabase would charge you real effort for that.
- **No account, no auth, no network dependency, nothing to pause or expire.**
- **The data is a file you own**, in a format you can read, forever.

This decision is **reversible**, which is what makes it low-risk: keep coding
against a storage interface and adding a network backend later stays a
one-file change. That was the point of the abstraction; this is the situation it
insures against.

```js
// storage.js — the contract, not the implementation
export const store = {
  async getCards(),
  async getCard(id),
  async saveCard(card),      // create or update
  async deleteCard(id),
  async getGroups(),
  async saveGroup(group),
  async deleteGroup(id),
  async setCardGroups(cardId, groupIds),
};
```

**localStorage or IndexedDB?** With no backend, the access pattern is now
explicitly blob-shaped: parse the whole collection once at startup, hold it in
memory, write it back on change. That is exactly what localStorage is good at, so
**start with localStorage** — one `JSON.parse` on load, one debounced
`JSON.stringify` on save.

(This reverses an earlier lean toward IndexedDB, which assumed per-record access
and a sync layer. Neither exists now.)

Three caveats, all cheap to handle:

- **5MB hard cap**, and exceeding it *throws* rather than warning. At ~200 bytes
  per card that's roughly 25,000 cards — far beyond what you'll hand-author — but
  catch `QuotaExceededError` and surface it rather than losing a save silently.
- **Debounce writes.** Stringifying the collection on every keystroke will jank.
  Write on blur/save, or on a ~500ms trailing debounce.
- **Origin scoping gotcha:** all your GitHub Pages projects share the origin
  `<username>.github.io`, which means they share one localStorage. Namespace every
  key (`benkyou:cards`) or a future project will collide with this one. The
  convention is already in use — `benkyou:script` (the handwritten-forms toggle,
  2.8) is the first key the app writes.

  Wrap every `getItem`/`setItem` in `try`/`catch`: localStorage *throws* rather
  than returning `null` in Firefox private windows, on a full quota, and when the
  browser is set to block site data. An uncaught throw at module top level takes
  down everything below it.

If you ever do outgrow it, the interface above means swapping in IndexedDB touches
one file.

### 2.2 Furigana storage format — bracket notation *(chosen)*

This is the single most consequential data decision in the project, because every
card is stored in whatever format you pick and migrating later means writing a
converter.

Three options:

| Format | Example | Verdict |
|---|---|---|
| Raw HTML | `<ruby>日本語<rt>にほんご</rt></ruby>` | **Avoid.** Mixes presentation with data, painful to author by hand, can't be stripped cleanly for a "hide furigana" mode, and means rendering user content as HTML. |
| Bracket notation | ` 日本語[にほんご]` | **Recommended.** Human-typeable, trivially parseable, trivially strippable. |
| Structured JSON | `[{t:"日本",r:"にほん"},{t:"語",r:"ご"}]` | Most robust, but miserable to author by hand and bloats the payload. |

Go with **bracket notation as the storage/authoring format, parsed into segments
at render time.** You get the ergonomics of the first and the structure of the
third.

The convention (borrowed from Anki, though there's no collection to import): a
space precedes each kanji block, and the reading follows in square brackets —
`私[わたし]は 学生[がくせい]です`. Since every card here is hand-typed, the format
being *fast to type* is the whole argument — and this is about as light as it gets.

Because everything depends on this, **write the parser and renderer as a
standalone module with real tests** (milestone 2). It has genuinely fiddly cases:

- Mixed kanji/kana words where okurigana splits the reading — `食[た]べる`
- Multiple readings in one string
- Text with no furigana at all (must pass through untouched)
- Escaping a literal `[` in card text
- Per-mora alignment if you ever want `振[ふ]り仮名[がな]` to align per-kanji

Deciding *now* that you'll only ever align per-block (not per-character) is a
reasonable simplification — just make it a conscious choice.

### 2.3 Furigana visibility is a study feature, not just a display option

Worth realizing early: you usually want furigana **hidden on the front and shown
on the back**. Sometimes you want hover-to-reveal. Sometimes always-on for
reading practice.

If storage is a parseable format (2.2), this is a render flag —
`render(text, { furigana: 'hidden' | 'shown' | 'hover' })`. If you stored HTML,
it's a regex nightmare. Another reason for the decision above.

### 2.4 Four card types, one shared core — type discriminator *(chosen)*

Words, phrases, kanji, and grammar points genuinely want different fields. A kanji
card has on'yomi and kun'yomi; a sentence card has a translation and no use for
reading fields at all. Three ways to handle that:

| Approach | Verdict |
|---|---|
| One universal shape, all fields optional | Simple, but the editor becomes a wall of mostly-empty inputs — exactly the clunk you're escaping |
| A `type` discriminator: shared core + type-specific fields | **Recommended** |
| User-defined note types (Anki's model) | This *is* the thing you're escaping |

Recommended shape:

```js
// shared by every card
{
  id, type,          // 'kanji' | 'vocab' | 'sentence' | 'grammar'
  meaning,           // the English side — always present
  notes,             // free text
  timesSeen, timesMissed,
  createdAt, updatedAt,
  data: { ... }      // type-specific
}
```

```js
// data, by type
kanji:    { character: "食", onyomi: ["ショク"], kunyomi: ["た.べる", "く.う"], strokes: 9 }
vocab:    { expression: "食[た]べる", reading: "たべる" }
sentence: { expression: "お 願[ねが]いします", literal: "" }
grammar:  { expression: "は", example: "私[わたし]*b:は* 学生[がくせい]です" }
```

Naming note: you've said "phrases" and "sentences" at different points. Unless you
genuinely want to study them separately, collapse both into one `sentence` type —
a set phrase and a full sentence want identical fields, and a type you can't
crisply define is a type you'll misfile cards into. Use the type names as your
own study vocabulary, since you'll be picking them on every session screen (2.6).

#### Why `grammar` earns its own type

A grammar point is not a vocab word with a different tag. The thing you're
studying is a **particle or pattern that only means anything in context**, so the
card needs a field a vocab card doesn't have: an `example` sentence carrying the
point in use. `は` on its own is unanswerable; `私は学生です` with `は` marked is
the actual question.

That's also why the highlight notation (2.7a) exists — the example sentence needs
to say *which* part of itself is the point being asked about, or a sentence with
three particles in it is ambiguous.

Two consequences:

- **No auto-derived jisho link** (2.7), unlike kanji and vocab. Searching jisho for
  `は` is noise. Link specific words inside the example with `{ }` if you want them.
- **Study direction is JP→EN only.** "What does は do here?" works; "what particle
  marks a topic?" has too many valid answers to self-grade honestly.

Two payoffs worth the small extra complexity:

- **The editor shows a different form per type.** No empty on'yomi field on a
  sentence card. That's a large fraction of the "Anki feels clunky" complaint,
  solved structurally rather than with CSS.
- **Study directions can differ per type.** Word: JP→EN and EN→JP both work.
  Kanji: character→meaning+readings, or meaning→character. Phrase: JP→EN is
  useful, EN→JP is brutal and should default off. Grammar: JP→EN only. Store the
  chosen direction on the *session*, not the card — you don't want duplicate cards
  per direction.

**Keep all four types in one flat array**, discriminated by `type` — not four
separate collections. Every shared operation (list all, search, tag filtering, the
M4 pool builder) would otherwise become a four-way union for no benefit.

Furigana load also varies by type: sentences and grammar examples lean on it
hardest (many kanji blocks per card), vocab moderately, kanji cards not at all.
That's a further argument for getting M2 right.

### 2.5 Namespaced tags, not groups *(chosen)*

Anki decks are effectively 1:1 — a card lives in one deck — which is exactly the
thing that gets annoying. Flat many-to-many groups fix that, but **namespaced tags
are better still**, and cost essentially nothing extra:

```
Type:   Kanji
Topic:  Activities
Source: Nakama Book 1
Level:  N4
```

A tag is just a `namespace:value` string on the card. Three payoffs:

- **The namespace gives you the UI for free.** Render one collapsible section of
  checkboxes per namespace and you have exactly the per-type dropdown layout you
  wanted — generalized, so `Source` and `Level` get the same treatment without new
  code.
- **Cross-cutting selection works naturally.** "Brush up on Activities across every
  type" is just selecting one tag.
- **New axes need no schema change.** Deciding next month to track `Level` is data
  entry, not a migration.

#### But `type` should stay a real field, not a tag

Tempting to make `Type: Kanji` just another tag and have one uniform mechanism.
Don't. `type` is load-bearing in a way other tags aren't (2.4): it decides which
editor form renders, which fields exist in `data`, and which study directions are
offered. As a tag, a card could carry two types or none, and the editor wouldn't
know what to show — so you'd add validation enforcing "exactly one Type tag,"
which is a required enum field rebuilt with extra steps and no guarantees.

**Keep `type` as a required field; make everything else a namespaced tag.** In the
selection UI it can still *render* as the first section, so it looks uniform even
though it isn't.

#### Storage

Simplest thing that works — an array of strings on the card:

```js
tags: ["Topic:Activities", "Source:Nakama Book 1", "Level:N4"]
```

Parse the namespace on read. Disallow `:` inside values so the split is
unambiguous. **Discover namespaces from existing tags** rather than hardcoding a
list, so new axes appear in the UI automatically.

#### The real cost: tag hygiene

This is the honest downside versus fixed groups. Free-text tags rot —
`Nakama Book 1` vs `Nakama book 1` vs `nakama 1` become three tags that look like
one, and you won't notice until a study session is mysteriously missing cards. Two
mitigations, both worth building rather than deferring:

- **Autocomplete from existing tags** on the card editor, for both namespace and
  value. Prevents most of it.
- **A tag management screen** — rename (cascading to all cards), merge, delete.
  Modest work, and without it you'll accumulate mess you can't clean up.

Later idea this leaves room for: **saved selections** ("Kanji + Activities +
Nakama 1") as one-click study presets, and filter-based tags ("cards I've missed
3+ times").

### 2.6 The study session — selection, then requeue

Your two ideas — a checkbox dropdown per type, and a namespaced tag system —
aren't competing. **The dropdown is a UI; tags are the data model, and the UI you
described falls straight out of them.** Build tags (2.5), render one collapsible
checkbox section per namespace, and the first section *is* your per-type dropdown:

```
▸ Type      ☑ Kanji  ☐ Vocab  ☐ Sentence
▸ Topic     ☑ Activities  ☐ Numbers  ☐ Colors
▸ Source    ☐ Nakama Book 1  ☐ Genki I
                                        142 cards  [ Study ]
```

"Just kanji today" is one checkbox. "Brush up on Activities across every type" is
one checkbox in a different section. Same mechanism.

#### The one thing that's easy to get wrong: AND vs OR

This is the part that feels subtly broken if you pick wrong, and it stays
invisible until you have enough cards to notice.

- **Within a namespace: OR.** `Topic: Activities` + `Topic: Numbers` means
  *either* — you want both sets of cards.
- **Across namespaces: AND.** Adding `Source: Nakama Book 1` should *narrow* the
  pool to Nakama's activity/number cards, not widen it.

Use OR everywhere and ticking a Source box grows the pool, which feels backwards.
Use AND everywhere and ticking two Topics gives you their intersection — usually
empty. Faceted filtering is OR-within, AND-across, and it's worth writing down
because you'll second-guess it mid-implementation.

```
pool = cards where
    (no Type selected  OR card.type ∈ selectedTypes)
    AND for each namespace with ≥1 selection:
        card has at least one tag in that namespace's selection
```

Note the other important rule embedded there: **a namespace with nothing ticked
contributes no constraint.** Empty selection means "don't care," never "match
nothing."

Implementation notes:

- **Deduplicate.** A card matching via two tags must appear once.
- **Show live counts and grey out zero-result options** as selections narrow —
  after ticking "Kanji," a Topic with no kanji cards should visibly have none,
  rather than letting you build an empty session.
- **Show the pool size before starting**, so you narrow up front rather than three
  cards in.
- **Save selections as presets** once a few combinations become routine (2.5).

#### The requeue mechanic

No scheduler, so the session is self-graded: flip the card, then **Got it** or
**Again**.

Design decisions worth making deliberately:

- **Where does a requeued card go?** Not the end of the queue — in a 150-card
  session you won't see it again for half an hour, which defeats the point. Not
  immediately either, or you're just reading the answer off the screen. Reinsert
  **5–15 cards ahead, jittered**; append to the end if fewer than that remain.
- **Repeat misses requeue again.** The session ends when the queue is empty, i.e.
  every card has been marked *Got it* at least once.
- **Guard the infinite loop.** A card you genuinely can't recall could requeue
  forever. After ~3 misses, offer *skip for now* or *flag it* so you're never
  stuck.
- **Count misses into `timesMissed`.** Persisted stats aren't used for scheduling,
  but they can't be backfilled — you can't recover history you never recorded.
- **End-of-session summary → "study just the missed cards again"**, and optionally
  "save these as a group." That gives you the useful half of an SRS (focus on weak
  cards) with none of the machinery, and it falls straight out of what you're
  already building.

Direction (JP→EN vs EN→JP, kanji→meaning vs meaning→kanji) fits naturally as a
sub-choice of step 1, since it's type-dependent (2.4). Give it a sensible default
per type and remember the last used one — don't make it a mandatory step every
session.

### 2.7 Jisho links — manual, via `{ }` notation *(chosen)*

**Decided:** no auto-detection of kanji, no API. A double-bracketed term
`{書斎}` renders as a hyperlink to jisho. Manual is the better design here — you
decide what's worth linking, which sidesteps the whole "clicking 食 in 食べる gives
you the kanji page when you wanted the word" problem, and needs no morphological
analyzer.

(Jisho has no usable public API anyway — the unofficial endpoint sends no CORS
headers — so linking out was always the only option.)

**Two corrections to the URL:** the domain is **jisho.org**, not `.com`. And
prefer `/search/` over `/word/`:

```js
`https://jisho.org/search/${encodeURIComponent(term)}`
```

`/word/書斎` is a real pattern and gives a cleaner direct entry page when one
exists, but it can miss for conjugated forms, rare compounds, or terms without a
canonical entry. `/search/` always resolves to *something*. Use search as the
default; `/word/` is a reasonable opt-in later if you want the tidier page.

Render with `target="_blank"` and `rel="noopener noreferrer"`.

#### Notation: use a different delimiter class *(chosen)*

The `[[ ]]` / `[ ]` collision isn't worth solving with clever lookahead. Give the
two features **different delimiter characters** and the ambiguity disappears
entirely:

| Feature | Notation | Example |
|---|---|---|
| Furigana | `[ ]` | `漢字[かんじ]` |
| Jisho link | `{ }` | `{書斎}` |
| Highlight | `* *` | `*b:は*` (2.7a) |
| Both | nested | `{書斎[しょさい]}` |
| Display ≠ target | pipe | `{食べました\|食べる}` |

Why this beats `[[ ]]`:

- **No lookahead, no `]]]`.** `[[書斎[しょさい]]]` requires the scanner to
  disambiguate three closing brackets in a row; `{書斎[しょさい]}` has exactly one
  way to read it.
- **Far easier to read** when you're scanning a card you wrote weeks ago.
- **A stray single `[` can't silently become half a link.** With doubled
  delimiters, one typo changes the meaning of everything downstream.

Still write **one left-to-right tokenizer**, not two regex passes — but now it's
genuinely simple, because the delimiters don't overlap:

```js
{ type: 'text',     value: 'は' }
{ type: 'furigana', base: '漢字', reading: 'かんじ' }
{ type: 'link',     term: '書斎', inner: [ /* nested tokens */ ] }
```

Two rules to write tests for:

1. **Link target = furigana-stripped inner text.** `{書斎[しょさい]}` links to
   `書斎`, never `書斎[しょさい]`. Easy to get wrong, and it fails as a bad search
   result rather than an obvious error.
2. **Escaping** — `\[` and `\{` for literals.

#### The trap: don't accept full-width brackets

The tempting fix for the IME problem below is "accept `「」` as furigana
delimiters too." **Don't.** `「」` are real Japanese quotation marks and will
appear in your sentence cards as actual punctuation:

```
「おはよう」と 言[い]いました
```

Treat them as delimiters and that card breaks. Same hazard for `『』`. Keep the
markup strictly half-width ASCII, which never appears in Japanese text you'd
write.

#### The IME friction problem, and the right fix

Typing `[` while the IME is in hiragana mode gives you `「`, not `[`. Entering
`漢字[かんじ]` by hand means toggling IME mode four times per word — genuinely
annoying, and you're hand-typing every card.

Fix it in the **editor, not the notation**: keyboard shortcuts that wrap the
current selection in `[ ]` or `{ }` and insert half-width characters regardless of
IME state. Select the reading, hit a key. No mode switching, no ambiguity. This
belongs with the fast-entry work (M6) and matters more than the delimiter choice
does.

#### Most cards need no link markup at all

Worth realizing before you build this: for `kanji` and `vocab` cards, the thing
you'd look up *is the card itself*. So **derive the jisho link automatically from
`data.character` / `data.expression`** — the whole expression is clickable, zero
notation typed.

Inline `{ }` links then only matter where you want *specific words within* longer
text linked — sentence cards, and the notes field. That's a small fraction of your
collection, which sharply reduces how much markup you actually hand-type.

### 2.7a Highlighting inside card text — `*color:text*` *(chosen)*

A grammar card (2.4) needs to point at *one part* of its example sentence: the
card is asking about `は` in `私は学生です`, not about the sentence as a whole.
Without a way to mark that, a sentence with three particles in it is an ambiguous
question. Highlighting is useful on sentence and vocab cards too — marking the
conjugated ending, or the one word you actually keep forgetting.

**Three colors only: red, blue, yellow.** Not a palette — a small fixed set you
can hold in your head and assign meanings to (e.g. blue = the point being asked,
red = an irregularity, yellow = something to notice). More colors means deciding
what each one means every time you write a card, which is how a convention decays
into decoration.

#### Notation

```
*b:は*                  → は, highlighted blue
*red:食[た]べ*ます       → highlights just the stem; furigana still renders
*y:{書斎[しょさい]}*      → highlight wrapping a link wrapping furigana
```

The color key comes first, then a colon, then the text. Both the initial and the
full name are accepted, because the initial is what you'll actually type:

| Color | Key |
|---|---|
| red | `r` or `red` |
| blue | `b` or `blue` |
| yellow | `y` or `yellow` |

Rules, all of which need tests:

1. **Split on the first colon only.** `*b:a:b*` highlights the literal text `a:b`.
2. **An unrecognized color key is not a highlight.** `*bl:は*` renders as the
   literal characters `*bl:は*`, not as a mystery-colored span. A typo you can see
   beats a typo that silently changes meaning — this is the same instinct behind
   preferring single delimiters below.
3. **The color is not part of the text.** Furigana-stripping for jisho link
   targets (2.7) must strip highlight markup too, or `{*b:書斎*}` searches for
   `*b:書斎*`.
4. **Escaping:** `\*` for a literal asterisk, matching `\[` and `\{`.

#### Why `*`, and why a single delimiter

The delimiter had to clear the bars 2.7 already set: half-width ASCII (never
appears in Japanese text you'd type), a different delimiter class from `[ ]` and
`{ }`, and readable weeks later.

- **`~` is disqualified outright.** `～` appears constantly in grammar notation —
  `～ている`, `～なければならない` — and the half-width and full-width forms are
  near-indistinguishable when scanning. For a *grammar* card type that's a trap.
- **`( )` and `" "` appear in English meanings and notes** all the time.
- **`=` appears in the notes you'd actually write** — `は = topic marker`.
- **`| |` is already spoken for** as the pipe inside `{ }`.
- **`*` is essentially absent from both Japanese text and English glosses**, is one
  keystroke, and its emphasis connotation matches what it does.

Single `*`, not doubled `**`, for the reason 2.7 gives for rejecting `[[ ]]`: with
doubled delimiters a single typo silently changes the meaning of everything
downstream. Single delimiters fail locally and visibly.

The one real cost: `*text*` is markdown italics, so card text pasted into a
markdown context renders oddly. That's cosmetic and only affects text leaving the
app. If it grates, `^` is the drop-in alternative — it's a single tokenizer
constant, and nothing else in the format depends on the choice.

#### Tokenizer impact

The left-to-right scan (2.7) now handles three constructs rather than two. Same
single pass; the highlight token nests like the link token does:

```js
{ type: 'highlight', color: 'blue', inner: [ /* nested tokens */ ] }
```

Render as a `<span>` with the color on a data attribute, so the three colors are
three CSS rules and adding a fourth later touches no JS.

### 2.8 Japanese typography and input gotchas

Small things that will bite:

- **Font selection.** Without `lang="ja"` on your elements and an explicit font
  stack, browsers may render CJK with Chinese glyph variants — some characters
  genuinely look wrong to a Japanese reader. Set `<html lang="ja">` or per-element
  `lang`, and specify e.g. `"Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif`.
- **Printed vs handwritten glyph forms.** Even with a correct Japanese font, Gothic
  and Mincho faces draw many characters differently from how they are written by
  hand — 令, 食, 糸, 直, 心, and the third stroke of き and さ are the usual
  offenders. The printed form of 食 in particular reads as having an extra stroke.
  **教科書体 (kyōkasho-tai)** is the typeface class designed to show the taught,
  handwritten shapes.

  *Built:* a top-bar toggle (and `f` during a session) flips every `lang="ja"`
  element between `--font-jp` and `--font-jp-hand` via `<html data-script="hand">`,
  with the preference stored under `benkyou:script`. Kanji cards additionally show
  both forms side by side on the answer. `UD Digi Kyokasho` ships with Windows 10
  1809+, so this needs no webfont — full CJK webfonts run to megabytes and would
  undercut the static-folder premise (frontend-setup.md §1).

  Note this changes glyph *shapes* only, not stroke counts or order. Stroke order
  remains KanjiVG (M7).

- **Size.** Kanji need more pixels than Latin text to stay legible. Whatever body
  size feels right for English, Japanese wants noticeably larger — especially with
  ruby text above it.
- **Ruby rendering differs across browsers.** Line height, `ruby-position`, and rt
  sizing are inconsistent between Chrome and Firefox. Include `<rp>` fallback
  parens and test both.
- **IME composition events.** This is the classic bug: you bind Enter to "submit
  card" / "flip card", and it fires while the user is confirming an IME candidate,
  swallowing their input. Guard with composition state:

  ```js
  let composing = false;
  input.addEventListener('compositionstart', () => composing = true);
  input.addEventListener('compositionend',   () => composing = false);
  input.addEventListener('keydown', e => {
    if (composing || e.isComposing) return;   // ignore during IME
    if (e.key === 'Enter') submit();
  });
  ```

  Affects both the card editor and any future type-the-answer study mode.

### 2.9 The two-sources-of-truth trap — read before building sync

The file-based plan has one genuine hazard, and it's worth naming precisely
because it silently eats data rather than failing loudly.

If the app both (a) fetches `cards.json` from the repo on load and (b) keeps
user-created cards in localStorage, **there are two sources of truth and no
defined rule for reconciling them.** Concrete failures:

1. Desktop creates cards → export → commit. Laptop opens the app; it has its own
   localStorage cards *and* a repo file. Which wins? "Seed on first run only"
   means repo updates never reach an initialized device. "Merge every load" needs
   a rule for cards that exist in both and differ.
2. You edit a card locally that also exists in `cards.json`. Next load, does the
   repo version overwrite your edit? Yes → silent data loss. No → the repo file
   can't function as an update channel.
3. **You delete a card locally; it exists in `cards.json`; next load it returns
   from the dead.** Deletes are invisible to any union-style merge. This is the
   classic one, and it needs either tombstones or a model that avoids merging.

The two naive poles are **Model A** (localStorage is truth; repo file is only ever
loaded by explicit user action) and **Model B** (repo file is truth, fetched and
applied every load; local is a scratchpad). A is friction-free to author in but
never updates itself; B is unambiguous but makes every uncommitted card fragile.

### 2.9a Model C — timestamped auto fast-forward *(chosen)*

Better than either pole: put a timestamp on the collection, and let the repo file
replace localStorage automatically **only when the repo copy is newer.**

Two properties make this work, and the second is the one that matters:

- **It's replace, not merge — so deletes propagate correctly.** Failure 3 above
  disappears. Merging is what resurrects deleted cards; wholesale replacement
  honors an absence. This is why the model is sound.
- Ordering is decided by data, not by the user remembering which machine they
  were last on.

**But one timestamp isn't enough**, and the gap is the whole design:

> Laptop: add 5 cards, don't export yet (local stamp T1).
> Desktop: add 3 different cards, export, commit (repo stamp T2, where T2 > T1).
> Laptop opens the app. Repo is newer → auto-replace → **the 5 unexported laptop
> cards are silently destroyed**, without a click.

"I'll export at some point" is exactly the window where this happens, and *auto*
is what makes it dangerous — there's no moment where you could have noticed.

**The fix is two pieces of state instead of one:**

- `lastSyncedVersion` — the repo version this device last ingested, i.e. the base
  it started from.
- `dirty` — a boolean set on any local write, cleared on export or import. A flag
  beats a second timestamp here: it's immune to clock skew and can't be
  ambiguous.

Then the load-time decision is a three-way, not a two-way:

| Repo vs. base | Local dirty? | Meaning | Action |
|---|---|---|---|
| same | no | Up to date | Nothing |
| same | yes | Only you have changes | Nothing (nag to export) |
| **newer** | **no** | Repo moved ahead, local clean | **Auto-replace — silent, safe** |
| **newer** | **yes** | **Both diverged** | **Prompt. The only case needing a human** |
| older | either | Stale/cached fetch, or a revert | Ignore, warn quietly |

This is exactly git's fast-forward rule, which is a useful way to hold it: advance
automatically when your base hasn't moved, stop and ask only on true divergence.
You get the automatic behavior you wanted on the overwhelming majority of loads,
and an interruption only when silence would have cost you work.

In the divergence case, offer three choices — *keep local* / *take repo* /
*merge by card id* — since per-card `updatedAt` (below) makes a real merge
possible. That's the one place merge is worth its complexity, and the one place
the delete-resurrection problem can still appear. Cheap mitigation: carry a
`deletedIds: [{id, deletedAt}]` array in the export format. It's ~15 lines, and
even if you don't implement it now, **reserve the field in the JSON schema** so
adding it later isn't a format migration.

**Use an integer `version` counter, not a wall-clock timestamp, for the
comparison.** Two machines, two clocks — NTP makes skew unlikely but not
impossible, and a counter that increments on each export is strictly more robust
and no harder. Keep an `exportedAt` timestamp alongside it for display; compare on
the counter.

**Where the repo version comes from:** put it inside `cards.json` and just fetch
the file. A `HEAD` request for `Last-Modified` avoids the download but GitHub
Pages' CDN makes that header unreliable, and the GitHub API costs you a rate limit
and a dependency. The file is a couple hundred KB and you'll download it anyway
whenever it *is* newer — not worth optimizing.

Two things become load-bearing under any of these models:

- **Stable, client-generated IDs.** `crypto.randomUUID()` — available everywhere
  modern, and `github.io` is HTTPS so the secure-context requirement is met.
  Without collision-free IDs, no merge is possible.
- **A `updatedAt` per card**, so "which version is newer" is answerable during a
  merge preview.

**Cache gotcha:** GitHub Pages sets caching headers, so a freshly pushed
`cards.json` may not be what the browser fetches. Cache-bust with
`fetch('./data/cards.json?v=' + Date.now())`.

### 2.9b Make export/import not feel like homework

The friction in this design is entirely in the transfer step, so it's worth
spending effort there.

Baseline: export via `Blob` + `URL.createObjectURL` + a `<a download>` click;
import via `<input type="file">` and `FileReader`, plus drag-and-drop onto the
window.

Much better on desktop: the **File System Access API**
(`showSaveFilePicker` / `showOpenFilePicker`, Chromium-only — which exactly
matches your laptop-and-desktop constraint). It hands you a persistent *file
handle*, so you can point the app at
`<repo>/docs/data/cards.json` in your local working copy **once**, and thereafter
save directly back to that file. No download folder, no move step. Your workflow
collapses to: edit cards → click save → `git commit`.

Handles can be stashed in IndexedDB to survive reloads; the browser re-prompts for
permission on a new session, which is a single click. Keep the `<a download>` path
as the fallback.

**Auto-nag:** since localStorage can be cleared by a browser privacy sweep, track
`lastExportedAt` and prompt when the collection has drifted meaningfully since the
last export. Cheap insurance for irreplaceable hand-typed data.

### 2.10 Export early

Hand-authored cards are the most valuable thing in this project and the hardest to
recreate. With no backend, **JSON export/import is not a side feature — it is the
entire persistence and transfer story.** It is the first thing to build after
cards exist at all, and it deserves real UI care (2.9b) rather than being a
button in a settings menu.

Design the JSON format deliberately, since it's now your on-disk schema. Reserve
four top-level fields from day one, even if some sit unused for a while:

```js
{
  schemaVersion: 1,        // format version, for future migrations
  version: 47,             // collection counter, ++ on each export (2.9a)
  exportedAt: "2026-...",  // human-readable; for display, not comparison
  deletedIds: [],          // tombstones; reserved now, may stay empty (2.9a)
  cards: [ ... ]           // tags live on the cards (2.5)
}
```

No separate `tags` collection — the tag list is derived by scanning cards, so it
can't drift out of sync with them. (The one thing that buys you later is that a
tag with zero cards simply vanishes, which is usually what you want anyway.)

`schemaVersion` and `version` are different things and both matter — the first
tracks the *shape* of the file, the second tracks *which copy is newer*.

---

## 3. Milestones

Sequenced so you have a *usable app* as early as possible, and so the riskiest
integration work happens against code that already works.

### M0 — Foundations

- Repo init, `.gitignore`, README.
- Static skeleton: `index.html`, `app.js`, `style.css`. No framework, no build step.
- **Deploy to GitHub Pages immediately**, with nothing but "Hello 勉強" on the page.
  Getting deployment working on day one means it's never a scary unknown later.
- Write down the data model (2.4/2.5) in `docs/data-model.md`, **including the
  JSON export format** — that file is now your real schema, so version it (2.10).
- Define the storage interface (2.1) — just the function signatures, no impl.

*Done when:* a blank page is live on Pages and you know what a card looks like.

### M1 — Local data layer + card CRUD

- localStorage implementation of the storage interface (2.1), namespaced.
- Create / edit / delete / list cards, with a **per-type editor form** (2.4).
- `crypto.randomUUID()` ids and `updatedAt` on every card — load-bearing for
  merging later (2.9).
- Set the `dirty` flag on every local write, from the very first save. It costs
  one line now and is the thing standing between M5's auto-replace and your
  unexported cards (2.9a).
- **JSON export and import, versioned** (2.10). With no backend this is the
  persistence story, not a nice-to-have; it belongs in the first useful build.
- Basic list view with search over card text.

*Done when:* you can enter real cards, close the browser, and they're still there
— and you can get them onto the other machine, even if clumsily.

### M2 — Japanese text rendering

Self-contained and heavily testable — a good milestone to do carefully.

- **One tokenizer handling all three syntaxes** — `漢字[かんじ]`, `{書斎}`, and
  `*b:は*` — in a single left-to-right scan (2.7, 2.7a). Not three regex passes.
- Renderer: tokens → `<ruby>`, `<a>`, and `<span data-color>` DOM, with furigana
  `hidden` / `shown` / `hover` modes.
- Pipe form `{display|target}`, and furigana- **and highlight**-stripping for link
  targets (2.7, 2.7a).
- Auto-derived jisho links for `kanji` and `vocab` cards from their own fields —
  no markup needed (2.7).
- Font stack, `lang` attributes, sizing, ruby cross-browser check (2.8).
- Unit tests for the edge cases in 2.2 **and** the three collision cases in 2.7,
  **and** the four highlight rules in 2.7a.

*Done when:* `{書斎[しょさい]}は 静[しず]かです` renders with correct ruby on both
words, 書斎 is a link pointing at `jisho.org/search/書斎` (not at
`書斎[しょさい]`), toggling furigana off leaves the link intact,
`「おはよう」と 言[い]いました` renders its quotation marks as text, and
`私[わたし]*b:は* 学生[がくせい]です` renders は blue with both readings intact.

### M3 — Tags

- Tags as `namespace:value` strings on the card (2.5); namespaces **discovered
  from the data**, not hardcoded.
- Tag editing on cards, with **autocomplete on both namespace and value** — this
  is the main defense against tag rot, so it ships with the feature, not after.
- Bulk tagging from the card list.
- **Tag management screen**: rename with cascade, merge, delete. Without it you
  accumulate `Nakama Book 1` / `Nakama book 1` and can't clean up.
- Tag browser showing counts per tag, broken down by type — "Activities: 24 kanji,
  11 vocab." That breakdown is what makes the M4 selection screen honest.

*Done when:* one "Activities" tag spans kanji and vocab cards, you can see the
split, and renaming it updates every card.

### M4 — Study mode

The heart of the app.

- **Faceted selection screen** (2.6): one collapsible checkbox section per tag
  namespace, Type first. Live counts, zero-result options greyed out, pool size
  shown before you start.
- Pool builder with **OR-within-namespace, AND-across-namespaces** semantics, and
  empty-selection-means-no-constraint (2.6). Deduplicated. Unit-test this — it's
  the rule you'll second-guess.
- Session engine: shuffle, present, flip, self-grade **Got it / Again**, and
  requeue 5–15 cards ahead with jitter (2.6).
- Miss-count guard — after ~3 requeues of the same card, offer skip or flag.
- Card display using the M2 renderer, furigana hidden on front / shown on back.
- **Keyboard-first controls** — space to flip, 1/2 or arrows to grade, escape to
  quit. This is a large part of what makes a flashcard app feel good and what
  makes clunky ones clunky.
- Progress indicator; end-of-session summary with **"study the missed cards
  again"**.
- Persist `timesSeen` / `timesMissed` counters.
- Per-type study direction with a remembered default (2.4, 2.6).

*Done when:* you can genuinely study from this instead of Anki. **After M4 the
project is complete as a local app** — everything past this point is convenience.

### M5 — Repo as canonical store

Turning the clumsy M1 export/import into a workflow you'll actually keep using.
This is the milestone that makes two machines practical.

- Commit `docs/data/cards.json` as the canonical collection.
- **Model C fast-forward logic (2.9a)** — the `version` counter in the JSON, the
  `lastSyncedVersion` and `dirty` flags in localStorage, and the five-case
  decision table. This is the milestone's real content; build it deliberately.
- Auto-replace on the clean-and-behind case, silently.
- Divergence prompt on the dirty-and-behind case: *keep local* / *take repo* /
  *merge by id*, with new / changed / local-only counts shown before anything is
  written.
- **File System Access API** save-back-to-handle, so exporting is one click into
  your local repo checkout instead of a trip through Downloads (2.9b).
- `lastExportedAt` tracking and an unexported-drift nag.
- Cache-bust the `cards.json` fetch (2.9a).

*Test the divergence case deliberately* — make conflicting edits on both machines
on purpose and confirm you get the prompt rather than a silent overwrite. It's the
one path that destroys data if it's wrong, and the one you'll never hit by
accident while developing.

*Done when:* a normal laptop→desktop handoff takes zero clicks (it just
fast-forwards on open), and the case where you forgot to export stops you instead
of eating your work.

*Explicitly not doing:* accounts, or a server.

### M6 — Polish

Mobile and touch are **out of scope** — laptop and desktop only. That removes
swipe gestures, touch targets, responsive study layouts, and home-screen install
from the plan entirely. Keyboard-first (M4) is the only interaction model, so put
the effort there instead.

**Dark mode is also out of scope — because the UI is dark-only.** There is no light
theme and none is planned. The palette is modeled on jisho.org's dark theme and
lives entirely in CSS custom properties, so retuning it is a token edit rather than
a theming feature. This removes what used to be an M6 line item.

- **Fast card entry** — "save and immediately start another of the same type,"
  focus already in the first field, no mouse. Every card in this app is hand-made,
  so minutes invested here compound more than anywhere else in the project.
- Search and filtering across cards, by type and by group. *(Plain text search over
  the card list already shipped with the frontend build; filtering by type and tag
  has not.)*
- Basic stats view (cards studied, most-missed).
- Keyboard shortcut reference / help overlay.
- Optional: service worker for laptop offline. Lower value with no phone to
  install to.

**Shipped ahead of this milestone:** the handwritten-forms toggle (2.8), built
during the frontend work because it turned out to be one CSS rule once `lang="ja"`
was already marked up everywhere.

### M7 — Backlog

Not planned, just parked so they don't feel like scope creep when they come up:

- Audio (TTS or recorded) on cards.
- Images on cards.
- Type-the-answer mode (mind the IME gotcha in 2.8).
- Smart groups / saved filters (2.5).
- Bulk editing.
- A real backend (Supabase or otherwise), *if and only if* manual transfer proves
  genuinely annoying in practice. The storage interface (2.1) keeps this a
  one-file change, so it's a decision you can defer indefinitely rather than
  pre-commit to.
- Stroke-order diagrams (KanjiVG).
- Optional light SRS as a *toggle*, if you ever want it back.

---

## 4. Risks

| Risk | Mitigation |
|---|---|
| Furigana format chosen badly, needs migration | Settle it in M2 with tests before mass card entry |
| **Auto-replace destroys unexported local cards** | **`dirty` flag gates the auto path; divergence prompts instead (2.9a)** |
| Losing hand-made cards to a cleared localStorage | Versioned JSON export in M1, export nag in M5 |
| Manual transfer friction becomes a daily annoyance | Storage interface keeps adding a backend a one-file change (M7) |
| Tag rot — near-duplicate tags silently splitting a category | Autocomplete on entry + rename/merge screen, both in M3 (2.5) |
| Scope creep into rebuilding Anki | M7 backlog exists to park ideas, not to do them |

---

## 5. Settled scope

- **No Anki import.** Every card is authored by hand, which makes the card editor
  the screen you'll spend the most time in — budget accordingly (M1, M6).
- **Laptop + desktop, no mobile.** Touch/responsive/PWA work is cut. Keyboard-first
  is the only interaction model.
- **Dark-only UI**, modeled on jisho.org's dark theme. No light theme, now or ever;
  colors live in CSS custom properties for tunability, not for theming (M6).
- **Four card types: kanji, vocab, sentence, grammar.** Discriminated union (2.4),
  per-type editor forms, per-type study directions. Grammar carries an `example`
  sentence, since a particle out of context isn't a question.
- **Furigana via bracket notation** `漢字[かんじ]` (2.2).
- **Jisho links are manual**, via `{書斎}` — curly braces, deliberately a
  different delimiter class from furigana's `[ ]` (2.7). No auto-detection, no
  API. Kanji and vocab cards derive their link automatically and need no markup;
  sentence and grammar cards don't.
- **Highlights via `*color:text*`** — red / blue / yellow only, keyed `r` / `b` /
  `y` (2.7a). Primarily how a grammar card marks which part of its example it's
  asking about.
- **Namespaced tags, not groups** (2.5) — `Topic: Activities`,
  `Source: Nakama Book 1`. `type` stays a real field, everything else is a tag.
- **Faceted study selection with requeue** (2.6): OR within a namespace, AND
  across namespaces.
- **No backend.** localStorage + versioned JSON + `cards.json` in the repo (2.1).
  Reversible by design; revisit only if manual transfer actually annoys you.

- **Sync is Model C** (2.9a): timestamped auto fast-forward, gated on a `dirty`
  flag, prompting only on true divergence.

Still open, both deferrable:

1. Should kanji cards auto-link to the word cards that use them? Much easier if
   decided before the schema hardens (a `relatedCards` id array).
2. Does a card ever need multiple meanings ranked by commonness, or is one
   free-text meaning field enough? One field is fine to start; splitting it later
   is a migration.
