# AGENTS.md

Guidance for AI agents (and humans) working in this repository.

## Project overview

**Shvatka UI** is the web front-end for the Shvatka quest/game platform. It is a
single-page application built with **Angular 17** using **standalone components**
(no `NgModule`s) and **Angular Material**. It talks to a separate backend REST API
and CDN, supports running inside a **Telegram Mini App**, light/dark theming, and
web push notifications.

- Language: **TypeScript** (strict mode)
- Framework: **Angular 17** (standalone components, `bootstrapApplication`)
- UI kit: **Angular Material** + **CDK**
- Reactive: **RxJS**
- Tests: **Karma + Jasmine**
- Build/deploy: **Docker** (multi-stage) → **nginx**
- UI text is primarily in **Russian** — keep user-facing strings in Russian to match.

## Common commands

```bash
npm install          # install dependencies
npm start            # ng serve, dev server at http://localhost:4200
npm run build        # production build into dist/shvatka
npm run watch        # development build, rebuild on change
npm test             # run unit tests via Karma/Jasmine (needs Chrome)
```

There is **no lint script configured** and **no e2e** set up. `ng test` launches
a real Chrome via `karma-chrome-launcher`; in headless/CI environments Chrome must
be available (set `CHROME_BIN` and use a headless launcher).

## Repository layout

```
src/
  main.ts                       # bootstrapApplication(AppComponent, appConfig)
  index.html
  styles.scss, styles/          # global styles + shared SCSS mixins
  environments/                 # environment.ts (runtime), environment.development.ts
  assets/
    env.js / env.template.js    # runtime config injected by nginx via envsubst
    frontend-version.json       # build metadata written during Docker build
    scenario/                   # sample scenario fixture
  push-sw.js                    # push notification service worker
  app/
    app.config.ts               # ApplicationConfig providers + ShvatkaConfig
    app.routes.ts               # route table
    app.component.*             # root shell (header, version footer, debug)
    domain/game.models.ts       # domain model classes/enums (Game, Level, Scenario, ...)
    http/
      http.adapter.ts           # thin wrapper over HttpClient (base URL, credentials, auth gating)
      error.handler.ts          # GlobalErrorHandler -> snackbar messages
    auth/                       # auth + login forms, one-time-token, user/auth state
    game/ games/                # game detail + games list (+ services)
    game_play/                  # live game play (largest component)
    game_log.part/ hint.part/   # presentational "part" sub-components
    effects.part/ game_scenario.part/
    header/ home/ profile/      # shell + pages
    push/ snackbar/ theme/ version/   # cross-cutting services
```

### Naming note
Folders use a mix of conventions: kebab-style (`game_play`) plus a `.part` suffix
for presentational sub-components (`hint.part`, `effects.part`, `game_log.part`).
Files follow Angular's `name.component.ts` / `name.service.ts`. The `.part`
components are dumb/presentational pieces composed by larger feature components.

## Architecture & conventions

- **Standalone components only.** Each component declares its own `imports`. There
  are no shared modules; import `CommonModule`, Material modules, and child
  components directly.
- **Services are `providedIn: "root"` singletons.** Inject via constructor.
- **HTTP goes through `HttpAdapter`**, not `HttpClient` directly. It:
  - prefixes `ShvatkaConfig.apiUrl`,
  - sends `withCredentials: true` for authenticated calls (`postWithoutCookies`
    is the exception used for login),
  - **short-circuits known protected URLs to a synthetic 401** when
    `AuthStateService` says the user is unauthenticated (see `isProtectedUrl`).
  When you add an endpoint that requires auth, update `isProtectedUrl` so it fails
  fast instead of hitting the server.
- **Errors flow to `GlobalErrorHandler`** (registered as Angular `ErrorHandler`),
  which renders user-facing messages via `SnackbarService` in **Russian**. A 401
  opens the login form via `AuthService.showLoginForm()`. Backend errors are
  expected as `{ type, text, description, docUrl }`; read them with
  `readApiError` (`http/api-error.ts`) rather than poking at `err.error`, and map
  new known `type` codes in `knownErrorTranslations`.
- **An error that carries a `docUrl` shows it.** The backend puts a link to the
  documentation page explaining the rule into the error body; show such errors
  with `snackbar.errorWithDoc(message, docUrl)`, which offers the page as the
  snackbar's «Справка» action (a snackbar is text-only, so the action button is
  the only place a link can go). Only http(s) urls are ever opened — see
  `isSafeDocUrl`.
- **Runtime configuration** comes from `window.env` (`environment.ts`), populated
  at container start by nginx (`envsubst` over `assets/env.template.js`). Do **not**
  hardcode API/CDN/bot values; read them through `ShvatkaConfig`. Local dev values
  live in `environment.development.ts`.
- **Domain models** are plain classes in `domain/game.models.ts`. Some include
  static factories/normalizers (e.g. `HintPart.create`, `Effects.normalize`) to
  cope with loosely-typed backend payloads. Prefer extending these helpers over
  scattering `any` handling across components.
- **Theming** is handled by `ThemeService` (`system`/`light`/`dark`), persisted in
  `localStorage`, synced with the OS media query and Telegram WebApp chrome. Theme
  is applied via `data-theme` / `color-scheme` on `<html>`; style with those hooks.
- **Telegram Mini App**: code reads `window.Telegram.WebApp` defensively
  (optional-chaining everything). Preserve that defensiveness.

## Coding style

- Follow `.editorconfig`: 2-space indent, LF, UTF-8, trim trailing whitespace.
- TypeScript is **strict** (`tsconfig.json`): `strict`, `noImplicitOverride`,
  `noImplicitReturns`, `noFallthroughCasesInSwitch`,
  `noPropertyAccessFromIndexSignature`, plus Angular `strictTemplates`. Keep it
  compiling cleanly under these — don't loosen them.
- Match the existing import style (double quotes are common in app code; the root
  files vary). Mirror the file you're editing rather than reformatting wholesale.
- Avoid introducing new `any`. The codebase has a few deliberate `any`s at the
  backend boundary; don't expand the blast radius.

## Testing

- Specs live next to source as `*.spec.ts` (Jasmine `describe`/`it`,
  `TestBed.configureTestingModule`). Coverage is partial — services and a few
  components are tested.
- When changing a service with a spec (`game`, `games`, `game_play`, `auth`,
  components with specs), update/extend its spec.
- Run `npm test` before pushing logic changes. If Chrome isn't available, say so
  rather than skipping silently.

## CI / build / deploy

- `.github/workflows/build.yaml` builds and pushes a Docker image to Docker Hub on
  pushes to `master`/`test` and on `*.*.*` tags. **It does not run tests or build
  the app outside Docker** — a broken `npm test` won't fail CI today.
- `.github/workflows/claude-code.yml` runs Claude Code on PRs / `@claude` comments.
- The `Dockerfile` writes `src/assets/frontend-version.json` (vcs hash/name, commit
  & build timestamps) which the footer displays via `VersionService`.

## Git / PR conventions for agents

- Develop on the assigned feature branch; never push to `master` without explicit
  permission.
- Keep commits focused and messages descriptive.
- Open PRs as **drafts** by default.
- Don't commit secrets or real environment values. `assets/env.js` is runtime-
  generated; treat `environment.development.ts` host IPs as local-only.

## Gotchas

- `ng test` requires a browser; CI does not catch test breakage — verify locally.
- Auth gating is duplicated knowledge: protected routes exist both in the backend
  and in `HttpAdapter.isProtectedUrl`. Keep them in sync.
- User-facing strings are Russian; don't accidentally introduce English copy.
- **Comments and doc comments are English**, in contrast to the user-facing
  strings around them.
- `game_play.component.ts` is large (~700 lines) — read it fully before editing.
