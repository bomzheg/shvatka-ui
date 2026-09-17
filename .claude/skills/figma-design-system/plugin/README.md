# Shvatka Design System — Figma plugin

Finishes the design system in **[Shvatka UI — Design System](https://www.figma.com/design/qQVsZINvV8IouCBHzoxqrj)**:
builds the **Header** component set and **14 screen frames** (7 screens × desktop + mobile)
on top of the tokens and components already in the file.

It runs inside your own Figma client, so it uses **no MCP tool calls** — the Starter
plan's 20-calls-per-month limit does not apply.

## Install (one time)

Local plugins need the **Figma desktop app** — the browser can't read a manifest off disk.

1. Open the desktop app and open the **Shvatka UI — Design System** file.
2. Menu (top-left) → **Plugins** → **Development** → **Import plugin from manifest…**
3. Pick the `manifest.json` from this folder.

## Run

**Plugins** → **Development** → **Shvatka Design System**.

It takes a few seconds and closes with a summary line, e.g.
`Shvatka DS — tokens: 15 colour, 9 spacing, 5 radius, 8 text styles · Header component set created (2 variants) · built 14 screens`.

The new screens end up selected and zoomed into on the **Screens** page.

## What it builds

Rebuilt against the **running app** — I served the Angular dev server with a mocked
API and screenshotted every page, then matched the SCSS values exactly.

**Header** component set (rebuilt) — now includes the **active-game strip** above the
bar, the translucent-white pills the app actually uses (`rgba(255,255,255,.18)` for the
active nav link, `.16` for search and theme toggle), the search pill with its icon, the
sun / **Авто** / moon toggle with the accent-filled active option, the bell, the user
name and the «Выйти» pill. Mobile is burger + brand + bell only, as in the app.

**Game Row** component set (rebuilt) — the number is now the round `#e7f7ec` badge with
`#17603a` text, not plain accent text. Border `#d1e7d7`, radius 12, padding `.8rem`,
right-aligned `.85rem` `#6b7280` date.

**Screens** — every screen now sits in the real app shell: the gradient page, the header,
the **1100px-max `.app-content` panel** (radius 16, `surface` at 92%, `0 10px 30px rgba(0,0,0,.08)`),
and the centred `FE/BE` version footer. Previously they were full-bleed, which was the
single biggest thing that made them look wrong.

| Screen | Corrected to match |
|---|---|
| Home | centred heading and paragraph, 320px logo at `border-radius: 24%` with the heavy hero shadow |
| Games | year heading `#17603a` + 2px `#d1e7d7` rule, rows with the round number badge |
| Game detail | centred name, centred «Начало:» line, `<details>` blocks (`#e5e7eb`, radius 12), equal-width scenario tabs (radius **8**, `#e5e7eb` inactive) |
| Game play | rule above the centred level header, centred key row (radius **8** field + button), 640px-max result panel with the `#94a3b8` border, indented hint list |
| Profile | tinted green hero card, **tinted** chips with borders (not solid fills), three bordered stat tiles, one segmented pill for the tabs, settings card with field + disabled Save |
| Constructor | «Мои игры»: the 720px column, the create-a-game card, the import-from-zip card, three drafts with their status pills |
| Game editor | «Редактирование игры…»: the 880px column of blocks — start, name, organizers, release link, levels (one open), files, YAML — and the sticky Save |

### The game constructor (third pass)

`/games/constructor` and `/games/constructor/:id` are the one part of the app that is
mostly form, so they are built out of the three mixins the app itself uses:
`surface-card()` (radius 16 on the list page, **14** for every editor `.block`),
`input-control()` (radius 10, `.65rem .75rem`) and `button-base()` (radius 10,
`.6rem .9rem`, weight 600). Both pages keep their own narrower centred column —
**720px** for the drafts list, **880px** for the editor — inside the usual 1100px panel.

What the two screens carry:

- **One status pill, everywhere.** `color-mix(in srgb, surface 70%, accent)` → `#c1ddca`
  with muted `.85rem` text, used by the draft rows, the editor's title and the file type.
- **The organizers editor**, with the author's amber card (`rgba(234,179,8,.06)` behind
  `rgba(234,179,8,.4)`, «автор» badge, four read-only green permission chips), a
  secondary organizer whose four permissions are checkboxes, and the quick-add chips for
  the author's own team.
- **Levels as `<details>`.** Two collapsed cards show what the list looks like; the first
  is open, with the sticky opaque summary, the dashed `.sub-block` rules, the level id,
  the level key, the auto-finish timer, an effects key with the bonus-minutes field and
  the level-up toggle, and a time hint.
- **The hint editor** as the app draws it: a dashed card per hint part holding the
  Telegram text editor — «Визуально | HTML» tabs with the accent underline, the toolbar
  of eight real icon buttons, then the text.
- **The scenario's one Save** in the sticky right-aligned `.actions-bar`; the name and
  the start keep their own buttons, because they write on their own routes.

Sample content follows the engine: keys are `SH50A` / `СХ50А`, the statuses are
`STATUS_LABELS` («В процессе создания», «Полностью готова», «Сбор вейверов»), and no
effect touches a level's timer.

### Scenario / play vocabulary (second pass)

The first pass rendered Game detail and Game play as generic cards. They now use the
components the app actually has:

- **Violet effect spoilers.** `.scn-effect-toggle` and `.typed-key-hint-pill` —
  `rgba(168,85,247,.15)` on `#7e22ce` at `.72rem`. These were missing entirely.
- **Compact scenario chips.** The «Ключи и таймеры» tab is `.scn-compact`: one chip row
  per level — grey key chips `rgba(15,23,42,.08)`, blue timer chips `rgba(59,130,246,.12)`,
  the violet effect toggle, and a `rgba(148,163,184,.25)` rule between levels.
- **Hint markers.** `ul.hints > li::before` masks a real icon per source — lightbulb,
  `timer.svg`, `key.svg`, `auto-awesome.svg`. Those four SVGs are inlined from
  `src/assets/svg-icons`, so the markers are the app's own glyphs. The level's last hint
  goes 600-weight in the accent colour, as `.feed-last-hint` does.
- **Hint balloons.** `.hint-card` — 360px max, radius 12, a 40px round accent icon plus
  title and `.85rem` muted sub-line.
- **The three play spoilers.** «Подсказки прошлых уровней», «Последние игровые события»
  and «Лог ключей», in a `.play-spoilers` stack. The key log lists typed keys with their
  colour-coded status (`#22c55e` ok / `#eab308` duplicate / `#ef4444` wrong) and the
  violet effect pill.
- **Tinted result panel.** `.key-result-ok` is `rgba(34,197,94,.2)` behind the `#94a3b8`
  border, with grey `.effect-tag` pills.

### Domain rules the sample content obeys

Corrections from the maintainer, now encoded in the placeholder content:

- **The play feed carries only hints and bonus hints.** `getCurrentLevelHintEvents()`
  filters events down to the ones that actually brought hints, so a key appears in the
  feed as `Ключ «SH48A» 12 мин. (21:59)` delivering a bonus hint — never as a bare
  "key accepted" line.
- **No effect changes a level's timer.** The only effects the app words are
  `+ бонус N мин.`, `- штраф N мин.` and `бонусные подсказки: N` (`getEffectsTags`).
- **Keys start with `SH` or `СХ`.** Every sample key across the scenario chips, the key
  field, the result panel and the key log follows that.
- **No info notice on the play screen.** It was a create-a-team hint sitting somewhere it
  never appears.

### Header now reflects the route

Every screen previously carried the same header with «Прошедшие игры» lit. The nav pill
is now set per screen: Games and Game detail light «Прошедшие игры», Game play lights
«Текущая игра», the constructor and the editor light «Мои игры», Home and Profile light
nothing.

### One deliberate difference

At exactly 1280px the real desktop header **wraps its nav onto two lines** and grows to
~115px. The Figma Desktop variant keeps it on one line at the documented 64px, which is
what the app does at wider viewports. Say the word if you'd rather have the wrap.

## Re-running

Safe. The plugin tags the nodes it creates with plugin data and removes its own previous
screens before rebuilding. It never touches nodes it did not create.

Note that it now **replaces** the `Header` and `Game Row` component sets rather than
reusing them, because both were wrong. Any instances you placed by hand will need
re-placing; everything the plugin itself builds is regenerated.

## Checking a change without Figma

`node ../scripts/mock-figma.js` runs the plugin against a stand-in Plugin API and
prints the screens it built. It catches a typo, a missing helper or a bad argument
before the file is ever opened; it says nothing about how the layout looks.

## If something is missing

The plugin degrades instead of failing: a missing component is skipped and named in the
closing summary (`missing components: …`). A missing colour token falls back to the literal
hex from `src/styles.scss`. If it reports the `Components` or `Screens` page is not found,
you're running it in the wrong file.

## Plan limits this does *not* work around

These are enforced by Figma on the account, not by the API, so the plugin can't dodge them:

- **1 mode per variable collection** — dark stays a parallel `Color Dark` collection rather
  than a second mode on `Color`.
- **3 pages per file** — everything lives on `Foundations` / `Components` / `Screens`.

On Professional both go away: fold `Color Dark` into `Color` as a second mode (the token
names already match, so it's a mechanical merge) and split components onto their own pages.
