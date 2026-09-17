/*
 * Renders the running app so a Figma screen can be built from pixels instead of
 * from markup. See ../SKILL.md — "Never design a screen you have not rendered".
 *
 *   OUT=./shots CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node shoot.js
 *
 * Add fixtures below for the screens you need; the heavy ones (FullGame,
 * CurrentHints, Keys) are exactly the ones worth doing properly.
 */
const { chromium } = require('playwright');
const path = require('path');

const OUT = process.env.OUT || '.';
const BASE = process.env.BASE || 'http://127.0.0.1:4200';
// The npm playwright and the preinstalled browser are different builds, so point
// at the binary rather than letting Playwright download a matching one.
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROUTES = [['home', '/'], ['games', '/games'], ['profile', '/profile']];

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
      if (p === '/docs/pages') return json([]);
      if (p === '/notifications' || p.startsWith('/notifications')) return json({ content: [] });
      if (p.endsWith('/release')) return json(null);
      return json({ type: 'NotFound', text: 'нет данных' }, 404);
    });
    // Gravatar is an outbound call the sandbox blocks; fail it fast so the
    // avatar falls back to its initial instead of hanging the page.
    await page.route('**gravatar.com/**', (route) => route.abort());

    for (const [name, route] of ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const file = path.join(OUT, `${name}-${label}.png`);
      await page.screenshot({ path: file, fullPage: true });
      out.push(file);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(out.join('\n'));
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
