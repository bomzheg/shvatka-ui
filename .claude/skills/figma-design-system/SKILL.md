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
node shoot.js                       # writes PNGs at 1280 and 390
```

Three things that will bite:

- Playwright's npm package and the preinstalled browser are different versions.
  Launch with `executablePath: '/opt/pw-browsers/chromium-<build>/chrome-linux/chrome'`;
  never run `npx playwright install`.
- `src/assets/env.js` points at the owner's live test server. **Mock the API
  with `page.route`** instead of calling it.
- A 401 from `/users/me` opens the login modal over every page. Return a
  `UserData` object to get past it, and `route.abort()` gravatar.com so the
  avatar falls back to its initial instead of hanging.

Screens whose fixtures are heavy (`FullGame`, `CurrentHints`, `Keys`) are the
ones most likely to be wrong. Build the fixtures anyway — that is precisely
where guessing has failed.

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
  «Текущая игра», Home and Profile light nothing.
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

Syntax-check with `node --check` before handing it over, and re-read the diff
for the sizing-mode and font-loading traps above — an unrun plugin script
usually has one.
