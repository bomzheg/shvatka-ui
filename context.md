# Context — the ubiquitous language of Shvatka

This is the **ubiquitous language** (UL) of the project in the DDD sense: the one
set of words used by the game's players and organizers, by this document, by the
code, and by the tests. A term listed here means exactly what it says here — in a
commit message, in a class name, in a component folder, in a template.

Two rules keep it useful:

- **Code follows the glossary.** If you name a component `TaskListComponent`, a
  reader has to guess whether you mean levels, requests, or something else. Use
  the term. If a name in the code contradicts the glossary, one of the two is
  wrong — say which in your PR.
- **The glossary follows the domain.** When the domain gains a concept (or an
  existing word shifts meaning), change this file in the same PR that changes the
  code.

The domain is Russian-speaking, the code is English. Every entry therefore carries
both forms: **the Russian term is what organizers and players actually say and
what the UI must display**, and the English one is what the code calls it. This
matches the repository's standing rule — user-facing strings in Russian, code and
comments in English (see `AGENTS.md`).

**The model is owned by the engine**, [bomzheg/Shvatka](https://github.com/bomzheg/Shvatka),
which carries the same glossary in its own `context.md` with the server-side code
references. This app is a view over that model: `src/app/domain/game.models.ts`
mirrors the API payloads, so a term that changes there changes here. The two files
describe one language — when a term changes, change it in both.

## The domain in one paragraph

**Схватка** (*Shvatka*) is a night urban search game, of the same family as
Encounter and Дозор. An **author** writes a **game** as a sequence of **levels**;
each level poses a **puzzle** that a **team** has to solve on the ground, on foot
or by car. Solving it yields a **key** — a code string hidden at a location, held
by an agent, or encrypted in the level text — which the team sends to the engine.
The right key moves the team to the next level; **hints** are released
automatically as time on the level passes, so a stuck team eventually gets
unstuck, at the cost of time. The game is a race: the winner is the team with the
lowest total time, adjusted by **bonuses** and **penalties**. This repository is
the web front-end: the archive, the live play screen, the scenario editor and the
admin panel.

## How the language maps onto this app

| Area of the language | Where it lives here |
| --- | --- |
| The shared model, as the API returns it | `src/app/domain/game.models.ts` |
| Archive of games, game card | `src/app/games/`, `src/app/game/`, `src/app/game_scenario.part/`, `src/app/game_log.part/` |
| Live play — keys, hints, waivers, spy | `src/app/game_play/` |
| Scenario authoring | `src/app/constructor/`, `src/app/scenario_graph.part/` |
| Results and charts | `src/app/game_chart.part/`, `src/app/game_chart_page/` |
| Teams and players | `src/app/team/`, `src/app/teams/`, `src/app/team_card/`, `src/app/player_card/` |
| Requests and inbox | `src/app/notifications/` |
| Engine administration | `src/app/admin/` |
| Identity | `src/app/auth/`, `src/app/profile/` |

Routes use the same nouns (`/games`, `/games/running`, `/games/constructor`,
`/teams`, `/players`, `/notifications`) — keep new routes in the language too.

---

## People and identity

| Term | Русский | Meaning | Where |
| --- | --- | --- | --- |
| **User** | Пользователь | A Telegram account. Purely an external identity — no game meaning on its own. | `auth/user.service.ts` |
| **Player** | Игрок | A person as the domain knows them: the identity everything else hangs off. May be linked to Telegram, to a forum account, to an email, or to none. | `Player` in `domain/game.models.ts` |
| **`name_mention`** | — | The display name for a player, already resolved by the API. Render it as given; don't re-derive a name from username/first name. | `Player.name_mention` |
| **Dummy player** | — | A player imported from the old forum with nobody behind it yet. Merged into a live player later. | admin merge screens |
| **Author** | Автор | A player allowed to write games (`can_be_author`). Granted by another author — see *promotion*. | `Player.can_be_author` |
| **Promotion** | Аппрув | An author invites a player to become an author. Arrives as a request. | `notifications/` |
| **Superuser** | Админ движка | An operator of the engine itself, above the game roles. Gates `/admin`. | `admin/`, `app.routes.ts` |
| **Merge (player / team)** | Слияние | Folding an imported forum player or team into a live one, so one person or team has one history. Admin-approved. | `admin/merge/players`, `admin/merge/teams` |
| **Timeline** | История команд | The manually built sequence of team memberships used when merging players. | admin merge screens |
| **One-time token** | Одноразовая ссылка | A short-lived link that logs a player in without a password. | `auth/one-time-token` route |

## Team

| Term | Русский | Meaning | Where |
| --- | --- | --- | --- |
| **Team** | Команда | The unit that plays. Has a name, a captain, a description. Teams play, players don't. | `Team` in `domain/game.models.ts` |
| **Team player** | Участник команды | A player's membership in a team over an interval, with a role, an emoji and permissions. A player is in at most one team at a time. | `team/`, `team_card/` |
| **Captain** | Капитан | The team's head: submits waivers, manages membership, implicitly holds every team permission. | `Team.captain`, `ui/role-emoji.ts` |
| **Role** | Роль | Free text for what a member does in the field: `полевой`, `водитель`, `мозг`, `капитан`… Each has a default emoji. | `ui/role-emoji.ts` |
| **Team permission** | Полномочие | A right delegated by the captain: manage waivers, manage players, change the team name, add/remove players. The captain has all of them regardless. The labels are the bot's, see below. | `team/` |

## Game

| Term | Русский | Meaning | Where |
| --- | --- | --- | --- |
| **Game** | Игра | The aggregate root: an author, a name, an ordered list of levels, a status, a start time, results. | `FullGame` in `domain/game.models.ts` |
| **Game status** | Статус игры | Where the game is in its lifecycle — see below. Drives what the UI offers. | `FullGame.status` |
| **Game number** | Номер игры | The game's place in the archive; only played games have one. | games list |
| **Organizer (org)** | Организатор (орг) | A player who runs a game rather than playing it. The author is the **primary organizer** with every right; others are **secondary organizers** with explicit permissions and **nothing granted by default**. | `game_play/` |
| **Org permission** | Полномочие орга | What a secondary organizer may do: spy, see the key log, validate waivers, view the scenario. **Nothing is granted by default.** The labels are the bot's, see below. | `game_play.component.html`, `constructor/organizers.models.ts` |

### Game statuses

| Status | Русский | Meaning |
| --- | --- | --- |
| `underconstruction` | в процессе создания | Being written. Editable. |
| `ready` | полностью готова | Finished scenario, not yet collecting waivers. **Not used any more** — kept for old games; a game goes straight from `underconstruction` to `getting_waivers`. |
| `getting_waivers` | сбор вейверов | Teams are declaring who plays. Still editable. |
| `started` | началась | Being played. |
| `finished` | все команды финишировали | Every team has passed the last level; results not yet closed. |
| `complete` | завершена | **Terminal.** Closed and archived; the game gets its number here. This is also the status that makes a game public: any player may read the game, its whole scenario, its key log and its results, with no organizer permission involved — which is what the archive and the game card rely on. |

**`finished` is not `complete`** — the distinction is visible to users, so don't
collapse the two in copy or in conditionals.

## Scenario — what an author writes

| Term | Русский | Meaning | Where |
| --- | --- | --- | --- |
| **Level** | Уровень | One stage of a game: a puzzle, its hints, and the conditions that end it. Gets a `number_in_game` when linked into a game. | `Level` |
| **Scenario** | Сценарий | The level's content proper: time hints plus conditions. What the editor edits and the archive shows. | `Scenario`, `game_scenario.part/`, `constructor/` |
| **`name_id`** | — | The author-chosen id of a level (`[a-zA-Z0-9_-]+`), used to route between levels. | `Level.name_id` |
| **Puzzle** | Загадка уровня | The hint released at minute 0 — the level's starting point. Not a separate concept: it is simply the first time hint, and every level has one. | `TimeHint` with `time === 0` |
| **Time hint** | Подсказка | A batch of content released this many minutes after the team reached the level. Rendered as `Подсказка N мин.` | `TimeHint`, `hint.part/` |
| **Hint part** | Часть подсказки | One piece of a hint's content: text, photo, video, audio, document, GPS point, venue, contact, sticker… A hint is a list of parts. | `HintPart`, `HintType` |
| **Key** | Ключ | The code string a team submits. Starts with `SH` or `СХ`, then uppercase Latin/Cyrillic letters and digits — e.g. `SHHELLO99`, `СХПРИВЕТ13`. | `game_play/`, `constructor/` |
| **Master key** | Мастер-ключ | The key that completes the level. Modelled as the win condition (`WIN_KEY`): a set of keys, **all** required, in any order. At most one per level. | `ScenarioConditionType.winKey` |
| **Effects key** | Ключ с эффектами | A key that triggers effects instead of (or as well as) completing the level. Any number per level. | `ScenarioConditionType.effectsKey` |
| **Timer** | Таймер | Time from the start of the level at which effects fire. Any number per level; at most one may end the level. | `ScenarioConditionType.effectsTimer`, `action_time` |
| **Condition** | Условие | The general form of "when X, do Y" in a level — win key, effects key, or effects timer. | `ScenarioCondition` |
| **Effects** | Эффекты | What a condition does: bonus minutes (or a penalty), hints, completing the level, and optionally routing to another level. | `Effect`, `Effects`, `effects.part/` |
| **Routed level-up** | Переход на уровень | Completing the level *and* jumping to a specific level rather than the next in order. This is how a non-linear game is built; the graph view draws it. | `Effect.next_level`, `scenario_graph.part/` |
| **File GUID** | GUID файла | A media file referenced by a hint. The scenario carries the GUID; the bytes come from the CDN. | `HintPart.file_guid`, `thumb_guid` |
| **Spoiler** | Спойлер | A media hint part the author chose to deliver covered: the player sees a blurred still and uncovers it with a tap, exactly as in Telegram. The caption stays visible. Photo, video and animation only; absent or `null` means no spoiler. | `HintPart.has_spoiler`, `SPOILER_HINT_TYPES`, `hint.part/`, `constructor/hint-editor.component` |

`Effects.normalize` and `HintPart.create` exist because the payload is loosely
typed at the boundary. Extend those helpers rather than spreading `any` handling —
the language should be enforced in one place.

## Play — what happens during a game

| Term | Русский | Meaning | Where |
| --- | --- | --- | --- |
| **Level time** | Время уровня | The record that a team reached a given level at a given moment. A team's progress *is* its list of level times. | `LevelTime` |
| **Level up** | Переход на следующий уровень | A team leaving its current level for the next (or a routed) one. | `Effect.level_up` |
| **Key log** | Лог ключей | Every key ever submitted, right or wrong, with who typed it and when. Visible to organizers with the permission, and shown on the game card. | `KeyTime`, `Keys`, `game_log.part/` |
| **Key type** | Тип ключа | How a submitted key was judged: `wrong`, `simple` (correct), `bonus` (legacy), `effects`. | `KeyType` |
| **Duplicate key** | Повтор | A key this team has already submitted. Recorded, changes nothing. | `KeyTime.is_duplicate` |
| **Spy** | Шпион | An organizer's live view of where every team is and which hint it is on. Needs the `can_spy` permission. | `game_play.component.html` |

## Results and statistics

| Term | Русский | Meaning | Where |
| --- | --- | --- | --- |
| **Game stat** | Статистика игры | Per team, the list of level times — plus the teams' bonuses. The raw material for every results view. | `GameStat` |
| **Bonus** | Бонус | Minutes taken off a team's result, awarded by effects. | `bonus_minutes` > 0 |
| **Penalty** | Штраф | Minutes added to a team's result. The same field, negative — there is no separate penalty concept, only a different sign and a different word in the UI. | `bonus_minutes` < 0 |
| **Bonus event** | — | One bonus or penalty as it happened: when, from which effects, from a key or a timer (`BonusSource`), on which level. `level_number: null` means it counts only towards the total. | `BonusEvent`, `BonusSource` |
| **Adjusted time** | Время с учётом бонусов | A result recomputed with bonuses applied. The API deliberately sends **raw times plus the bonuses**, never adjusted totals, so the UI can switch display modes without a request. Computing it is this app's job. | `game_log.part/game_log.part.component.ts` |
| **Time mode** | — | UI-local: how a results table shows times — `raw`, `adjusted` (bonuses applied), or `expression` (the arithmetic spelled out). Not a domain concept; don't send it to the API. | `TimeMode` in `game_log.part/` |

## Waivers

| Term | Русский | Meaning | Where |
| --- | --- | --- | --- |
| **Waiver** | Вейвер | One player's confirmed participation in one game with one team. The answer to "who is allowed to play". | `GameWaivers`, `VotedPlayer` |
| **Vote** | Голос | A player's own answer during collection, before the captain approves: `yes`, `no`, `think`. | `game_play/` |
| **Played** | — | The final state of a waiver: `yes`, `no`, `think`, `revoked` (не допущен капитаном), `not_allowed` (не допущен организаторами). | `game_play.component.ts` |
| **Draft waivers** | Черновик вейверов | The votes collected so far, not yet approved by the captain. | `game_play/`, `admin/waivers` |
| **Submit waivers** | Подать вейверы команды | The captain fixing the team's final list, after which it goes to the organizers. | `game_play.component.html` |

## Requests and notifications

| Term | Русский | Meaning | Where |
| --- | --- | --- | --- |
| **Action request** | Заявка | A user-to-user request needing someone's decision: `pending` → `accepted` / `declined` / `cancelled` / `expired`. Types: team join invite, team join request, org invite, team merge, player merge, promotion. | `notifications/` |
| **Notification** | Уведомление | One inbox item for exactly one recipient — the record that something happened. A request produces notifications; a notification is not itself actionable. | `notifications/`, `notification-render.ts` |
| **Severity** | Важность | How much a notification matters (`low` / `normal` / `important`); drives UI emphasis and push urgency. | `notifications/` |
| **Push** | Пуш | A web push notification delivered through the service worker. | `push/`, `src/push-sw.js` |

## Search

| Term | Русский | Meaning | Where |
| --- | --- | --- | --- |
| **Hit** | Находка | One search result, carrying the field it matched and a snippet for highlighting. | `search/` |
| **Snippet** | — | The excerpt around a match; highlighted rather than re-searched client-side. | `ui/highlight-query.pipe.ts` |

---

## Permission labels

A permission is one thing with one name. A player who sees «Шпионить» in the bot
must see «Шпионить» here too, and the user documentation describes exactly these
words — so when a label changes, it changes in the bot, here and in the docs
together.

| Field | Русский |
| --- | --- |
| `can_manage_waivers` | Подавать вейверы |
| `can_manage_players` | Управлять игроками |
| `can_change_team_name` | Переименовывать команду |
| `can_add_players` | Добавлять игроков |
| `can_remove_players` | Удалять игроков |
| `can_spy` | Шпионить |
| `can_see_log_keys` | Смотреть лог ключей |
| `can_validate_waivers` | Принимать вейверы |
| `view_scenario` | Смотреть сценарий |

Game statuses work the same way: their Russian names come from the engine
(`status_desc` in `core/models/enums/game_status.py`) and live in `STATUS_LABELS`.
Note that **finished** is «все команды финишировали» and **complete** is
«завершена» — calling `finished` «завершена» merges two different states, and
«опубликована» is publication, a separate thing.

## Naming rules that follow from the language

- **Domain types live in `domain/game.models.ts`** and mirror the API payload
  field-for-field (`snake_case` on the wire is kept as-is). Don't invent a parallel
  vocabulary in a component.
- **Components are named for the domain thing they show** — `GamePlayComponent`,
  `PlayerCardComponent` — and `.part` components for the piece they render
  (`hint.part`, `effects.part`, `game_log.part`).
- **`level_number` counts from 0** in the model and is shown as `+ 1` to people.
  Convert in the template or the component, never by renaming the field.
- **Minutes are the domain's unit of time** for hints, timers and bonuses.
- **`org` is an acceptable short form of organizer** — it is what organizers call
  themselves — and it is the only abbreviation the language sanctions.

## Words we don't use

Each of these has shown up in review or in an old name. They are ambiguous or
belong to a neighbouring game, and the right-hand column is what to say instead —
in code and in Russian UI copy alike.

| Not this | Say this | Why |
| --- | --- | --- |
| Quest, task, stage, mission | **Level** — уровень | The domain word is уровень; the others come from other games. |
| Answer, password | **Key** — ключ | A key has a defined format and a life in the key log. |
| Code / код | **Key** — ключ | People do say *код* out loud, and that's fine in speech — but it isn't the term. In code and copy it's a key, because only a key has the `SH`/`СХ` format and a row in the key log. |
| Registration, application, sign-up | **Waiver** — вейвер | Вейвер is the domain word and covers the vote → approve flow. |
| Admin (for a game) | **Organizer** / **org** — организатор, орг | *Admin* means the engine's superuser, who owns `/admin`. A game has organizers. |
| Moderator | **Organizer** or **superuser** | Neither role exists under that name. |
| Level text / текст уровня | **Puzzle** — загадка уровня | Say *текст уровня* all you like in conversation; it's the popular name and it's exact whenever the puzzle happens to be text. In UI copy use *загадка уровня*, because a puzzle can just as well be a photo, a video or an audio file, and because there is no separate "level text" in the model — it is the 0-minute hint. |
| Clue, tip | **Hint** — подсказка | One word for the thing released on a timer. |
| Fine, malus | **Penalty** — штраф | A penalty is a negative bonus, not another field. |
| Group, squad, crew | **Team** — команда | Group means a Telegram chat here. |
| Member | **Team player** — участник команды | Membership is an interval with permissions, not a flag. |
| Finished = complete | **Finished** ≠ **complete** | Finished means all teams passed the last level; complete means closed and numbered. |

## Where to read further

- `AGENTS.md` — how to write code in this repository (standalone components,
  `HttpAdapter`, theming, strict TypeScript).
- The engine's `context.md` — the same glossary against the server-side model.
- The engine's `docs/modules/ROOT/pages/author/` — the authoritative description,
  in Russian, of how a level scenario is put together and how non-linear games are
  built.
