---
name: figma-design-system
description: How the Shvatka UI design system in Figma is built and extended — via a local Figma plugin, never the MCP server, and never from markup you have not rendered. Read before creating, editing or syncing anything in the Figma file, or before adding a screen to it.
---

# The Shvatka UI design system in Figma

File: **Shvatka UI — Design System**, `fileKey` `qQVsZINvV8IouCBHzoxqrj`.
Three pages — `Foundations`, `Components`, `Screens`.

Tokens mirror `src/styles.scss`: `Primitives` (23 raw values), `Color Light` and
`Color Dark` (15 semantic each, aliased, with `var(--app-*)` WEB code syntax),
`Spacing` (9), `Radius` (5). Plus 8 Inter text styles and 3 effect styles.
Components: Button, Input, Avatar, Card, Game Row, Info Notice, Snackbar, Header.
Screens: Home, Games, Game detail, Game play, Profile, Constructor, Game editor —
desktop and mobile each.

## Never drive this over the Figma MCP server

The owner's Figma plan is **Starter**, which caps MCP at **20 tool calls per
month** — not per day. A design system is 20–100+ calls, so one month's entire
quota buys a fraction of one pass. That quota has already been spent once,
mid-build, leaving the file half-finished.

Use `plugin/` in this skill instead. A local plugin runs the Plugin API inside
the owner's own Figma client and costs **zero** MCP calls, with unlimited
re-runs. Install it once: Figma **desktop app** → Plugins → Development →
Import plugin from manifest.

Two Starter limits the plugin cannot dodge, because Figma enforces them on the
account:

- **1 mode per variable collection** — dark is a parallel `Color Dark`
  collection, not a second mode. On an upgrade, fold it into `Color`; the token
  names already match, so it is a mechanical merge.
- **3 pages per file** — use sections and frames, never `figma.createPage()`.

Also: `Segoe UI` does not exist in Figma, so the type ramp uses **Inter**. Code
Connect needs Organization tier and is unavailable.

## Never design a screen you have not rendered

Screens built by reading templates and SCSS come out wrong in ways that are
invisible from the source. Every screen built that way in this file had to be
redone. What reading misses: the shell wrapper, which elements centre, what is
a pill versus a box, and — worst — invented domain content that reads as
plausible and is simply false.

So before building or changing a screen, render it and look at it. The harness
is `scripts/shoot.js`:

```bash
cd shvatka-ui && npm install && npx ng serve --port 4200 --host 127.0.0.1 &
cd <scratchpad> && npm init -y && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright
cp <skill>/scripts/shoot.js . && OUT=./shots node shoot.js   # PNGs at 1280 and 390
```

`playwright` resolves from the directory the script runs in, so copy `shoot.js`
next to the `node_modules` you installed rather than running it in place. A
route entry may carry a third element, a function run once the page has
settled — that is how the editor gets a level open before the shot.

Three things that will bite:

- Playwright's npm package and the preinstalled browser are different versions.
  Launch with `executablePath: '/opt/pw-browsers/chromium-<build>/chrome-linux/chrome'`;
  never run `npx playwright install`.
- `src/assets/env.js` points at the owner's live test server. **Mock the API
  with `page.route`** instead of calling it.
- A 401 from `/users/me` opens the login modal over every page. Return a
  `UserData` object to get past it, and `route.abort()` gravatar.com so the
  avatar falls back to its initial instead of hanging.

Screens whose fixtures are heavy (`FullGame`, `CurrentHints`, `Keys`, the
editor's draft with its levels, files and organizers) are the ones most likely
to be wrong. Build the fixtures anyway — that is precisely where guessing has
failed. Two of them are answers you have to remember to mock: the CDN, whose
404 raises the error snackbar over the screen you are shooting, and
`/users/{me}/details` + `/teams/{id}/players`, without which the organizers
editor shows an error instead of its quick-add chips.

## What the app actually looks like

Facts that were each got wrong once:

- **Every page sits in `.app-content`** — `min(1100px, 100% - 2rem)`, radius 16
  (12 on mobile), `--app-surface` at 92%, `0 10px 30px rgba(0,0,0,.08)`, on the
  body gradient, with the centred `FE/BE` version footer beneath. Screens are
  not full-bleed.
- **The header** carries an active-game strip above the bar. The bar is
  `min-height: 64px`, padding `.75rem 1rem`, and its pills are translucent
  white: `rgba(255,255,255,.18)` for the active nav link, `.16` for the search
  pill and the theme toggle. The active theme option is filled with the accent.
  Mobile keeps only burger, brand and bell.
- **The nav pill follows the route.** Do not stamp the same header on every
  screen. Games and Game detail light «Прошедшие игры», Game play lights
  «Текущая игра», the constructor and the editor light «Мои игры», Home and
  Profile light nothing.
- **`.game-number` is a round `#e7f7ec` badge** with `#17603a` text, not
  coloured text.
- **Profile chips are tinted with borders**, not solid fills with white text:
  `.chip--ok` accent at 14%, `.chip--accent` `#6366f1` at 16%. Profile tabs are
  one bordered pill holding segments, not separate buttons.
- **Radii are not uniform.** 8 on scenario tabs, the key field and the play
  buttons; 10 on inputs and panels; 12 on rows, `<details>` and cards; 16 on
  `.app-content`. Match the element, do not normalise.
- **Several greys live outside the token set** — `#6b7280`, `#94a3b8`,
  `#e5e7eb`, `#cbd5e1`, `#9ca3af`. Mirror them; they are what ships.

## The game constructor

Two routes, and they are the one part of the app that is mostly form: the
drafts list `/games/constructor` and the editor `/games/constructor/:id`
(`/admin/games/:id` is the same editor in admin mode). Both sit in the usual
`.app-content`, but each has its own narrower column centred inside it —
`.constructor-page` is **720px**, `.editor-page` is **880px**. Do not stretch
them to the panel.

The furniture, all of it from `styles/_component-mixins.scss`, so it repeats
everywhere:

- `surface-card()` — white, `1px var(--app-border)`, padding `1rem`. Radius
  **16** for the two cards of the drafts list, **14** for every `.block` of the
  editor. Blocks stack with `1rem` between them; there is no other container.
- `input-control()` — radius **10**, padding `.65rem .75rem`, `.95rem`. A number
  field (`.time-input`) is `6rem` wide, the bonus-minutes field `8rem`; every
  other field fills its row.
- `button-base()` — radius **10**, padding `.6rem .9rem`, weight 600, `1rem`.
  `.primary` is the accent filled; `.ghost-button` is transparent with the
  border and inherited text; `.ghost-button.icon` is `.3rem .5rem` around a bare
  glyph; `.ghost-button.danger` is `#c62828` text **and** border. A disabled
  primary keeps its accent fill at `.6` opacity — it does not go grey.
- **The status pill is one chip on both pages** (`.status-badge`,
  `.game-status`, `.file-type`): `color-mix(in srgb, surface 70%, accent)` —
  `#c1ddca` resolved — with `.85rem` muted text, radius 999, padding
  `.2rem .6rem`.

What reading the templates will not tell you:

- **The editor's head wraps.** `h1` (1.6rem, 1.3rem under 640) sits in a
  wrapping flex row with the status pill and the status actions, so on desktop
  the buttons drop to a second line and on mobile the title takes a row of
  its own (`flex: 1 1 100%`).
- **The author's organizer card is amber** — `rgba(234,179,8,.06)` behind
  `rgba(234,179,8,.4)`. It carries an «автор»
  badge (`.15` fill, `#92400e` text) and four **read-only** green permission
  chips (`rgba(34,197,94,.12)` on `#166534`). Every other organizer is a plain
  white card whose four permissions are native checkboxes. Under them, quick-add
  chips for the author's own team — pill, bordered, emoji + username + «+».
- **A level is a `<details>`, and the list is read collapsed.** The summary is
  drag handle, `#1 (start)`, then the two counts with their icons —
  `key.svg` условий: N, `lightbulb.svg` подсказок: N — then up / down / delete. Open, the summary becomes an opaque sticky bar with only its
  top corners rounded and a dashed rule under it; the body is a stack of
  `.sub-block`s, each separated by a **dashed** rule, not a solid one.
- **Every hint part is a dashed card** (`.hint-editor`, `1px dashed`, radius 10,
  surface at 92%) holding the Telegram text editor: a «Визуально | HTML» tab row
  where the active tab carries a 2px accent underline, a toolbar of eight 2rem
  icon buttons (bold, italic, underline, strike, spoiler, code, quote, link),
  then the text itself.
- **The scenario has exactly one Save**, in a sticky right-aligned
  `.actions-bar` at the bottom. The name has its own «Переименовать», the start
  its own «Сохранить»; those write on their own routes.

## Domain rules — get these from the engine, never invent them

Wrong domain content is worse than wrong styling: it looks authoritative and
teaches the reader something false. All of these were invented once and corrected
by the maintainer.

- **Keys start with `SH` or `СХ`.** Every sample key, everywhere.
- **The play feed holds hints and bonus hints only.**
  `getCurrentLevelHintEvents()` filters events to those that actually carried
  hints. A key reaches the feed only as the thing that delivered a bonus hint,
  labelled by `getEventLabel` as `Ключ «SH48A» 12 мин. (21:59)`. There is no
  "key accepted" line.
- **No effect changes a level's timer.** `getEffectsTags` words exactly three
  things: `+ бонус N мин.`, `- штраф N мин.`, `бонусные подсказки: N`.
- **A hint's marker says what brought it** — lightbulb by default, else
  `timer.svg`, `key.svg`, `auto-awesome.svg`. `.feed-last-hint` changes the
  caption to 600-weight accent; it does not change the glyph.
- **The violet is `rgba(168,85,247,.15)` on `#7e22ce`** — `.scn-effect-toggle`
  and `.typed-key-hint-pill`.
- **Do not place a component somewhere the app never shows it.** An Info Notice
  about creating a team does not belong on the play screen.
- **«Мои игры» lists drafts, not games.** `GET /games/my` answers with the
  author's unfinished games; a complete one is gone from that list. Label a
  status only with `STATUS_LABELS` — «В процессе создания», «Полностью готова»,
  «Сбор вейверов», «Началась», «Все команды финишировали», «Завершена» — and
  only the first three are editable (`EDITABLE_STATUSES`); past them the
  scenario is frozen and the editor says so in an amber `.warn`.
- **A level id is not a level number.** `#1 (start)` is position plus
  `name_id`, which is latin letters, digits, `_` and `-` only. Keys in the
  editor are upper-cased as they are typed and must still start with `SH`/`СХ`.
- **The release is not part of the scenario.** It has its own page and its own
  Save; the editor only links to it («Открыть релиз»).
- **A scenario travels two ways.** YAML carries the levels and the *names* of
  files, never the media; the zip carries both, and it is the same package the
  bot reads. The zip holds the saved game, not what is currently in the editor.
- **The effects vocabulary is closed** — bonus minutes (`+ бонус` / `− штраф`),
  «Завершение уровня» and bonus hints. The editor offers nothing that changes a
  level's timer, and neither should a mock-up.

When unsure what a screen shows, read the component's `.ts`, not just its
template — the labels are built in the class.

## Extending the plugin

`plugin/code.js` is plain Plugin API. The `use_figma` conveniences
(`figma.createAutoLayout`, `node.set`, `node.query`, `node.placeholder`,
`node.screenshot`) **do not exist** in a real plugin; use `figma.createFrame()`
and set `layoutMode` yourself.

- `resize()` resets both sizing modes, so call it **before** setting
  `primaryAxisSizingMode` / `counterAxisSizingMode`.
- `createNodeFromSvg` needs `rescale()`, not `resize()`, or the frame stretches
  and the vectors stay at viewBox size.
- Set `layoutSizingHorizontal = 'FILL'` only **after** `appendChild`.
- Wrapping text needs an explicit width plus `textAutoResize = 'HEIGHT'`.
- Guard newer properties like `minHeight` in `try/catch`.
- The plugin tags its own nodes with `setPluginData('owner', …)` and removes
  only those on re-run. Keep that; never clear a page by name prefix.
- UI strings are Russian. Code comments are English.

Dry-run it before handing it over: `node scripts/mock-figma.js` stands in
enough of the Plugin API to run `main()` end to end in node and prints the
screens it built. It catches a typo, a helper that does not exist and a bad
argument; it cannot catch layout semantics, so still re-read the diff for the
sizing-mode and font-loading traps above — an unrun plugin script usually has
one.

One trap the list above understates: `resize()` freezes the **height** too, so
a frame you gave a fixed width stops hugging its children. Use `fixWidth()`,
which puts the vertical sizing back to `HUG` afterwards.
