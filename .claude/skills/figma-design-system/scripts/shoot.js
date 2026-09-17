/*
 * Renders the running app so a Figma screen can be built from pixels instead of
 * from markup. See ../SKILL.md — "Never design a screen you have not rendered".
 *
 *   OUT=./shots CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node shoot.js
 *
 * Add fixtures below for the screens you need; the heavy ones (FullGame,
 * CurrentHints, Keys, the constructor's editor) are exactly the ones worth
 * doing properly.
 */
const { chromium } = require('playwright');
const path = require('path');
const zlib = require('zlib');

const OUT = process.env.OUT || '.';
const BASE = process.env.BASE || 'http://127.0.0.1:4200';
// The npm playwright and the preinstalled browser are different builds, so point
// at the binary rather than letting Playwright download a matching one.
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const GAMES = { content: [
  { id: 48, name: 'Ночь длинных ножей', number: 48, start_at: '2025-06-14T21:00:00Z' },
  { id: 47, name: 'Забытый маяк',       number: 47, start_at: '2025-03-22T20:00:00Z' },
  { id: 46, name: 'Тени над городом',   number: 46, start_at: '2025-01-18T21:00:00Z' },
  { id: 45, name: 'Последний рубеж',    number: 45, start_at: '2024-11-09T21:00:00Z' },
  { id: 44, name: 'Код да Винчи',       number: 44, start_at: '2024-07-27T20:00:00Z' },
]};

const ME = {
  id: 1, username: 'bomzheg', name_mention: 'Юрий Чебышев', can_be_author: true,
  tg: { tg_id: 1, username: 'bomzheg', first_name: 'Юрий', last_name: 'Чебышев' },
  forum: null,
  email: { email: 'player@example.com', is_verified: true },
  is_admin: true, pending_email: null,
};

const ACTIVE = {
  id: 49, name: 'Полночный экспресс', status: 'started', start_at: '2026-09-20T21:00:00Z', number: 49,
  author: { id: 1, can_be_author: true, name_mention: 'Юрий Чебышев' },
};

// ---------------------------------------------------------------- constructor
const AUTHOR = { id: 1, can_be_author: true, name_mention: 'Юрий Чебышев' };

// GET /games/my — the author's drafts. A complete game is not listed.
const MY_GAMES = { content: [
  { id: 50, author: AUTHOR, name: 'Полночный экспресс', status: 'underconstruction', start_at: null, number: null },
  { id: 49, author: AUTHOR, name: 'Тайна старой водонапорной башни', status: 'ready', start_at: '2026-10-11T21:00:00Z', number: null },
  { id: 48, author: AUTHOR, name: 'Ночь длинных ножей', status: 'getting_waivers', start_at: '2026-09-27T21:00:00Z', number: null },
]};

const PHOTO_GUID = '7c1f0a2e-3b44-4d51-9c8e-51a0b2d9e77c';

const hintText = (text) => ({ type: 'text', text });
const level = (nameId, n, winKeys, autoFinish, timeHints, extra) => ({
  db_id: 100 + n, name_id: nameId, author: AUTHOR, game_id: 50, number_in_game: n,
  scenario: {
    id: nameId,
    time_hints: timeHints,
    conditions: [
      { type: 'WIN_KEY', keys: winKeys },
      { type: 'EFFECTS_TIMER', action_time: autoFinish, effects: [{ id: 'e' + n, level_up: true }] },
    ].concat(extra || []),
  },
});

// GET /games/my/50 — a draft mid-edit: three levels, keys, timers, hints.
const MY_GAME = {
  id: 50, author: AUTHOR, name: 'Полночный экспресс', status: 'underconstruction',
  start_at: '2026-10-11T21:00:00Z',
  // The server answers with the game's files; without them the editor falls
  // back to "файл 7c1f0a2e…", which is not what an author's list looks like.
  files: [
    { guid: PHOTO_GUID, original_filename: 'ploshchad', extension: '.jpg', content_type: 'photo' },
  ],
  levels: [
    level('start', 1, ['SH50A', 'СХ50А'], 45, [
      { time: 0, hint: [hintText('Ищите то, что отбивает часы над площадью.')] },
      { time: 15, hint: [hintText('Циферблат смотрит на север.'), { type: 'photo', file_guid: PHOTO_GUID, caption: 'Вид с площади' }] },
    ], [
      { type: 'EFFECTS_KEY', keys: ['SHBONUS'], effects: [{ id: 'k1', bonus_minutes: 10, hints_: [hintText('Бонусная подсказка: загляните за ограду.')] }] },
    ]),
    level('bridge', 2, ['SH50B'], 40, [
      { time: 0, hint: [hintText('Мост помнит больше, чем говорит.')] },
    ], []),
    level('final', 3, ['SH50C', 'СХ50В'], 60, [
      { time: 0, hint: [hintText('Последний уровень — возвращайтесь к началу.')] },
    ], []),
  ],
};

// GET /users/1/details + /teams/3/players — the author's team, which the
// organizers editor offers as one-click "add a teammate" chips.
const AUTHOR_PROFILE = {
  id: 1, username: 'bomzheg', can_be_author: true,
  tg: { tg_id: 1, username: 'bomzheg', first_name: 'Юрий', last_name: 'Чебышев' },
  player_in_team: {
    id: 11, team: { id: 3, name: 'Полуночники' },
    date_joined: '2024-02-01T10:00:00Z', role: 'капитан', emoji: '🚂',
  },
};

const TEAM_PLAYERS = { items: [
  { team_player_id: 11, id: 1, username: 'bomzheg', can_be_author: true, emoji: '🚂',
    role: 'капитан', permissions: {}, date_joined: '2024-02-01T10:00:00Z', played_games_count: 12 },
  { team_player_id: 12, id: 3, username: 'mmorozova', can_be_author: true, emoji: '🦉',
    role: 'игрок', permissions: {}, date_joined: '2024-03-04T10:00:00Z', played_games_count: 7 },
  { team_player_id: 13, id: 4, username: 'ilyin', can_be_author: false, emoji: '🧭',
    role: 'игрок', permissions: {}, date_joined: '2024-05-19T10:00:00Z', played_games_count: 4 },
]};

const ORGANIZERS = { content: [
  { org_id: null, player: AUTHOR, deleted: false,
    can_spy: true, can_see_log_keys: true, can_validate_waivers: true, view_scenario: true },
  { org_id: 7, player: { id: 2, can_be_author: true, name_mention: 'Анна Ковалёва' }, deleted: false,
    can_spy: true, can_see_log_keys: false, can_validate_waivers: true, view_scenario: true },
]};

/** A flat PNG, so a hint's file previews instead of showing a broken image. */
function placeholderPng(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;                                   // filter byte per scanline
    for (let x = 0; x < w; x++) { raw[o++] = 0xcf; raw[o++] = 0xdd; raw[o++] = 0xd2; }
  }
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc = (b) => {
    let c = 0xffffffff;
    for (const x of b) c = table[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// name → [route, optional action run after the page settles]
const ROUTES = [
  ['home', '/'],
  ['games', '/games'],
  ['profile', '/profile'],
  ['constructor', '/games/constructor'],
  ['game-editor', '/games/constructor/50'],
  // The level card is collapsed by default, so the form that is the whole point
  // of the editor only shows once a level is opened.
  ['game-editor-open', '/games/constructor/50', async (page) => {
    await page.locator('.level-card .level-summary').first().click();
    await page.waitForTimeout(600);
  }],
];

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME });
  const out = [];

  for (const [label, w, h] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    await page.route('**/api/**', (route) => {
      const u = new URL(route.request().url());
      const p = u.pathname.replace(/^\/api/, '');
      const json = (body, status = 200) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

      if (p === '/users/me') return json(ME);
      if (p === '/games') return json(GAMES);
      if (p === '/games/active') return json(ACTIVE);
      if (p === '/games/my') return json(MY_GAMES);
      if (p === '/games/my/50') return json(MY_GAME);
      if (p === '/docs/pages') return json([]);
      if (p.endsWith('/organizers')) return json(ORGANIZERS);
      if (p === '/users/1/details') return json(AUTHOR_PROFILE);
      if (p === '/teams/3/players') return json(TEAM_PLAYERS);
      if (p === '/notifications' || p.startsWith('/notifications')) return json({ content: [] });
      if (p.endsWith('/release')) return json(null);
      return json({ type: 'NotFound', text: 'нет данных' }, 404);
    });
    // Gravatar is an outbound call the sandbox blocks; fail it fast so the
    // avatar falls back to its initial instead of hanging the page.
    await page.route('**gravatar.com/**', (route) => route.abort());
    // The CDN holds a game's files. A 404 here raises the error snackbar over
    // the screen you are shooting, so answer with a picture.
    await page.route('**/cdn/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: placeholderPng(240, 160) }));

    for (const [name, route, after] of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      if (after) await after(page);
      const file = path.join(OUT, `${name}-${label}.png`);
      await page.screenshot({ path: file, fullPage: true });
      out.push(file);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(out.join('\n'));
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
