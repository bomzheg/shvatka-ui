/*
 * Shvatka Design System — Figma plugin
 *
 * Finishes the design system that was started over the Figma MCP server:
 * builds the Header component set and the five key screens (desktop + mobile)
 * on top of the tokens and components already in the file.
 *
 * Runs entirely inside your Figma client, so it costs no MCP tool calls.
 * Re-running is safe: anything this plugin made before is removed and rebuilt.
 */

const LOG = [];
const note = (m) => LOG.push(m);

// ---------------------------------------------------------------- constants
const INTER = (style) => ({ family: 'Inter', style });
const FONT_STYLES = ['Regular', 'Medium', 'Semi Bold', 'Bold'];

const MADE_BY_PLUGIN = 'shvatka-plugin';   // name prefix marking our own nodes

const hex = (h) => {
  const n = h.replace('#', '');
  return {
    r: parseInt(n.slice(0, 2), 16) / 255,
    g: parseInt(n.slice(2, 4), 16) / 255,
    b: parseInt(n.slice(4, 6), 16) / 255,
  };
};
const solid = (h, opacity) => {
  const p = { type: 'SOLID', color: hex(h) };
  if (opacity !== undefined) p.opacity = opacity;
  return p;
};

// Fallback hexes, used when a token is missing and as the paint's literal value.
const LIGHT = {
  'bg/start': '#f1f6f3', 'bg/end': '#eef2ff', 'surface': '#ffffff',
  'text/primary': '#1f2937', 'text/muted': '#4b5563', 'border/default': '#d1d5db',
  'border/card': '#d1e7d7', 'header/bg': '#205d35', 'header/text': '#f6fff8',
  'accent': '#2f8f4e', 'accent/contrast': '#ffffff', 'heading/accent': '#17603a',
  'status/success': '#2e7d32', 'status/danger': '#c62828', 'status/info': '#1565c0',
};

// -------------------------------------------------------------- token lookup
const TOKENS = { color: {}, spacing: {}, radius: {} };
const TS = {};      // text styles by name
const ES = {};      // effect styles by name

async function loadTokens() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const byName = {};
  for (const c of collections) byName[c.name] = c;

  const ids = [];
  for (const [name, bucket, strip] of [
    ['Color Light', 'color', ''],
    ['Spacing', 'spacing', 'spacing/'],
    ['Radius', 'radius', 'radius/'],
  ]) {
    const collection = byName[name];
    if (!collection) { note('collection "' + name + '" missing'); continue; }
    for (const id of collection.variableIds) ids.push({ id, bucket, strip });
  }

  for (const entry of ids) {
    const v = await figma.variables.getVariableByIdAsync(entry.id);
    if (!v) continue;
    const key = entry.strip ? v.name.replace(entry.strip, '') : v.name;
    TOKENS[entry.bucket][key] = v;
  }

  for (const s of await figma.getLocalTextStylesAsync()) TS[s.name] = s;
  for (const s of await figma.getLocalEffectStylesAsync()) ES[s.name] = s;

  note('tokens: ' + Object.keys(TOKENS.color).length + ' colour, ' +
       Object.keys(TOKENS.spacing).length + ' spacing, ' +
       Object.keys(TOKENS.radius).length + ' radius, ' +
       Object.keys(TS).length + ' text styles');
}

/** A paint bound to a colour token, falling back to the literal hex. */
function paint(tokenName) {
  const fallback = LIGHT[tokenName] || '#000000';
  const v = TOKENS.color[tokenName];
  if (!v) return solid(fallback);
  return figma.variables.setBoundVariableForPaint(solid(fallback), 'color', v);
}

function bindPad(node, token, sides) {
  const v = TOKENS.spacing[token];
  const fields = sides || ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'];
  for (const f of fields) {
    if (v) node.setBoundVariable(f, v); else node[f] = 0;
  }
}

function bindRadius(node, token) {
  const v = TOKENS.radius[token];
  const corners = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
  for (const c of corners) {
    if (v) node.setBoundVariable(c, v);
  }
}

// ------------------------------------------------------------------ builders
function frame(name, dir, spacing) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = dir;
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.itemSpacing = spacing || 0;
  f.fills = [];
  f.paddingTop = 0; f.paddingBottom = 0; f.paddingLeft = 0; f.paddingRight = 0;
  return f;
}

async function text(chars, styleName, tokenName, name) {
  const t = figma.createText();
  t.fontName = INTER('Regular');
  t.characters = chars;
  if (styleName && TS[styleName]) await t.setTextStyleIdAsync(TS[styleName].id);
  if (tokenName) t.fills = [paint(tokenName)];
  if (name) t.name = name;
  return t;
}

/** Fixed-width wrapping text — a FILL text still needs HEIGHT auto-resize. */
function wrap(t, width) {
  t.textAutoResize = 'HEIGHT';
  if (width) t.resize(width, t.height);
  return t;
}

function pill(label, bgToken, fgToken) {
  const p = frame('chip/' + label, 'HORIZONTAL', 0);
  p.fills = [paint(bgToken)];
  p.paddingTop = 4; p.paddingBottom = 4; p.paddingLeft = 10; p.paddingRight = 10;
  bindRadius(p, 'full');
  return { node: p, fg: fgToken };
}

// ------------------------------------------------------- page / node helpers
async function pageNamed(name) {
  const p = figma.root.children.find((x) => x.name === name);
  if (!p) throw new Error('Page "' + name + '" not found. Run this in the Shvatka UI — Design System file.');
  return p;
}

function findSet(page, name) {
  return page.children.find((n) => n.type === 'COMPONENT_SET' && n.name === name) || null;
}

function clearOurNodes(page) {
  let removed = 0;
  for (const child of page.children.slice()) {
    if (child.getPluginData && child.getPluginData('owner') === MADE_BY_PLUGIN) {
      child.remove();
      removed++;
    }
  }
  return removed;
}

function claim(node) {
  node.setPluginData('owner', MADE_BY_PLUGIN);
  return node;
}

// ============================================================ EXACT VALUES ==
// Every number below is lifted from the app's SCSS (1rem = 16px) and checked
// against screenshots of the running app.
const APP = {
  shellMaxWidth: 1100,          // .app-shell  width: min(1100px, 100% - 2rem)
  contentRadius: 16,            // .app-content border-radius (12 on mobile)
  contentRadiusMobile: 12,
  contentPadDesktop: 24,        // clamp(1rem, 2vw, 1.5rem) at 1280
  contentPadMobile: 14,         // 0.9rem
  headerMinHeight: 64,          // .main-header min-height
  headerPadY: 12, headerPadX: 16,
  stripFont: 14.4,              // .active-game-banner 0.9rem
  stripPadY: 8, stripPadX: 16,
  brandFont: 19.2,              // .home-link 1.2rem/700
  navGap: 12,                   // .desktop-nav gap .75rem
  navPadY: 7, navPadX: 12,      // .nav-link .45rem .75rem
  gameRowRadius: 12,            // .games-list-item
  gameRowPad: 13,               // .games-list-item a padding .8rem
  gameRowGap: 12,
  badge: 32,                    // .game-number min 2rem
  yearFont: 18.4,               // .games-year-heading 1.15rem
  tabRadius: 8,                 // .scenario-tab border-radius
  detailsRadius: 12,            // game detail <details>
  panelMaxWidth: 640,           // .key-result-panel max-width
};
// Literal colours the app hardcodes outside the token set.
const RAW = {
  badgeBg: '#e7f7ec', badgeText: '#17603a',
  rowBorder: '#d1e7d7', yearText: '#17603a',
  detailsBorder: '#e5e7eb', tabBorder: '#cbd5e1', tabBg: '#e5e7eb', tabText: '#111827',
  panelBorder: '#94a3b8', rule: '#9ca3af',
  muted: '#6b7280', danger: '#b91c1c',
  chipIndigo: '#6366f1',
};

const icon = (svg, colorToken, size) => {
  const node = figma.createNodeFromSvg(svg);
  node.name = 'icon';
  // resize() would stretch the frame and leave the vectors at viewBox size;
  // rescale() scales the geometry with it.
  if (node.width > 0 && Math.abs(node.width - size) > 0.01) node.rescale(size / node.width);
  for (const n of node.findAll(() => true)) {
    if ('fills' in n && n.fills !== figma.mixed && n.fills.length) n.fills = [paint(colorToken)];
    if ('strokes' in n && n.strokes.length) n.strokes = [paint(colorToken)];
  }
  return node;
};

// Lifted verbatim from src/assets/svg-icons — the same glyphs the app masks
// into its hint markers and chips.
const SVG_BULB = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M423.5-103.5Q400-127 400-160h160q0 33-23.5 56.5T480-80q-33 0-56.5-23.5ZM320-200v-80h320v80H320Zm10-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Zm24-80h252q45-32 69.5-79T700-580q0-92-64-156t-156-64q-92 0-156 64t-64 156q0 54 24.5 101t69.5 79Zm126 0Z"/></svg>';
const SVG_TIMER = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M360-840v-80h240v80H360Zm80 440h80v-240h-80v240Zm-99.5 291.5Q275-137 226-186t-77.5-114.5Q120-366 120-440t28.5-139.5Q177-645 226-694t114.5-77.5Q406-800 480-800q62 0 119 20t107 58l56-56 56 56-56 56q38 50 58 107t20 119q0 74-28.5 139.5T734-186q-49 49-114.5 77.5T480-80q-74 0-139.5-28.5ZM678-242q82-82 82-198t-82-198q-82-82-198-82t-198 82q-82 82-82 198t82 198q82 82 198 82t198-82ZM480-440Z"/></svg>';
const SVG_KEY = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M223.5-423.5Q200-447 200-480t23.5-56.5Q247-560 280-560t56.5 23.5Q360-513 360-480t-23.5 56.5Q313-400 280-400t-56.5-23.5ZM280-240q-100 0-170-70T40-480q0-100 70-170t170-70q67 0 121.5 33t86.5 87h352l120 120-180 180-80-60-80 60-85-60h-47q-32 54-86.5 87T280-240Zm0-80q56 0 98.5-34t56.5-86h125l58 41 82-61 71 55 75-75-40-40H435q-14-52-56.5-86T280-640q-66 0-113 47t-47 113q0 66 47 113t113 47Z"/></svg>';
const SVG_SPARK = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="m760-600-50-110-110-50 110-50 50-110 50 110 110 50-110 50-50 110Zm0 560-50-110-110-50 110-50 50-110 50 110 110 50-110 50-50 110ZM360-160 260-380 40-480l220-100 100-220 100 220 220 100-220 100-100 220Zm0-194 40-86 86-40-86-40-40-86-40 86-86 40 86 40 40 86Zm0-126Z"/></svg>';
const SVG_PIN = '<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Z"/></svg>';

/** Same as icon(), but coloured with a literal hex instead of a token. */
const iconLiteral = (svg, colorHex, size) => {
  const node = figma.createNodeFromSvg(svg);
  node.name = 'icon';
  if (node.width > 0 && Math.abs(node.width - size) > 0.01) node.rescale(size / node.width);
  for (const n of node.findAll(() => true)) {
    if ('fills' in n && n.fills !== figma.mixed && n.fills.length) n.fills = [{ type: 'SOLID', color: hex(colorHex) }];
  }
  return node;
};

const SVG_SEARCH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>';
const SVG_BELL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>';
const SVG_SUN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM2 13h2a1 1 0 0 0 0-2H2a1 1 0 0 0 0 2zm18 0h2a1 1 0 0 0 0-2h-2a1 1 0 0 0 0 2zM11 2v2a1 1 0 0 0 2 0V2a1 1 0 0 0-2 0zm0 18v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-2 0z"/></svg>';
const SVG_MOON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12.3 4.9c.4-.2.3-.8-.1-.9a8 8 0 1 0 9.8 9.8c-.1-.4-.7-.5-.9-.1a6.5 6.5 0 0 1-8.8-8.8z"/></svg>';
const SVG_USER = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/></svg>';

const white = (o) => ({ type: 'SOLID', color: hex('#ffffff'), opacity: o });

// ================================================================== HEADER ==
async function buildHeader(componentsPage) {
  const old = findSet(componentsPage, 'Header');
  if (old) old.remove();

  const variants = [];
  for (const bp of ['Desktop', 'Mobile']) {
    const desktop = bp === 'Desktop';
    const width = desktop ? 1280 : 390;

    const c = figma.createComponent();
    c.name = 'Breakpoint=' + bp;
    c.layoutMode = 'VERTICAL';
    c.itemSpacing = 0;
    c.resize(width, APP.headerMinHeight);
    c.primaryAxisSizingMode = 'AUTO';
    c.counterAxisSizingMode = 'FIXED';
    c.fills = [];
    componentsPage.appendChild(c);

    // --- active game strip (sits above the header) ---
    const strip = frame('active-game-strip', 'HORIZONTAL', 0);
    strip.fills = [paint('header/bg')];
    strip.paddingTop = APP.stripPadY; strip.paddingBottom = APP.stripPadY;
    strip.paddingLeft = APP.stripPadX; strip.paddingRight = APP.stripPadX;
    c.appendChild(strip);
    strip.layoutSizingHorizontal = 'FILL';
    const stripText = await text('Полночный экспресс: идёт игра', null, 'header/text', 'banner');
    stripText.fontSize = APP.stripFont;
    strip.appendChild(stripText);

    // --- the header bar itself ---
    const bar = frame('main-header', 'HORIZONTAL', desktop ? APP.navGap : 12);
    bar.counterAxisAlignItems = 'CENTER';
    bar.paddingTop = APP.headerPadY; bar.paddingBottom = APP.headerPadY;
    bar.paddingLeft = APP.headerPadX; bar.paddingRight = APP.headerPadX;
    bar.fills = [paint('header/bg')];
    c.appendChild(bar);
    bar.layoutSizingHorizontal = 'FILL';
    try { bar.minHeight = APP.headerMinHeight; } catch (e) { /* older API: padding alone carries it */ }

    if (!desktop) {
      const burger = figma.createFrame();
      burger.name = 'mobile-menu-button';
      burger.resize(22, 16);
      burger.fills = [];
      bar.appendChild(burger);
      for (let i = 0; i < 3; i++) {
        const line = figma.createRectangle();
        line.resize(22, 2.5);
        line.y = i * 6.5;
        line.cornerRadius = 2;
        line.fills = [paint('header/text')];
        burger.appendChild(line);
      }
    }

    const brand = await text('Схватка', null, 'header/text', 'home-link');
    brand.fontName = INTER('Bold');
    brand.fontSize = APP.brandFont;
    bar.appendChild(brand);

    if (desktop) {
      const nav = frame('desktop-nav', 'HORIZONTAL', APP.navGap);
      nav.counterAxisAlignItems = 'CENTER';
      bar.appendChild(nav);
      const links = ['Прошедшие игры', 'Команды', 'Текущая игра', 'Мои игры', 'Команда'];
      for (const label of links) {
        const active = label === 'Прошедшие игры';
        const l = frame('nav-link', 'HORIZONTAL', 0);
        l.paddingTop = APP.navPadY; l.paddingBottom = APP.navPadY;
        l.paddingLeft = APP.navPadX; l.paddingRight = APP.navPadX;
        // .nav-link.active { background: rgba(255,255,255,.18) }
        l.fills = active ? [white(0.18)] : [];
        bindRadius(l, 'full');
        nav.appendChild(l);
        const t = await text(label, null, 'header/text');
        t.fontSize = 15;
        l.appendChild(t);
      }
    }

    const spacer = figma.createFrame();
    spacer.name = 'spacer'; spacer.fills = []; spacer.resize(8, 8);
    bar.appendChild(spacer);
    spacer.layoutSizingHorizontal = 'FILL';

    if (desktop) {
      // .header-search — pill, translucent, icon button on the right
      const search = frame('header-search', 'HORIZONTAL', 4);
      search.counterAxisAlignItems = 'CENTER';
      search.paddingTop = 2; search.paddingBottom = 2;
      search.paddingLeft = 12; search.paddingRight = 4;
      search.fills = [white(0.16)];
      bindRadius(search, 'full');
      bar.appendChild(search);
      const ph = await text('Поиск', null, 'header/text', 'placeholder');
      ph.fontSize = 14.4; ph.opacity = 0.7;
      search.appendChild(ph);
      ph.layoutSizingHorizontal = 'FIXED';
      ph.resize(144, ph.height);          // .header-search__input width: 9rem
      const sBtn = frame('search-button', 'HORIZONTAL', 0);
      sBtn.paddingTop = 4; sBtn.paddingBottom = 4; sBtn.paddingLeft = 4; sBtn.paddingRight = 4;
      bindRadius(sBtn, 'full');
      search.appendChild(sBtn);
      sBtn.appendChild(icon(SVG_SEARCH, 'header/text', 18));

      // .theme-toggle — sun | Авто | moon, active option filled with the accent
      const theme = frame('theme-toggle', 'HORIZONTAL', 2);
      theme.counterAxisAlignItems = 'CENTER';
      theme.paddingTop = 3; theme.paddingBottom = 3; theme.paddingLeft = 3; theme.paddingRight = 3;
      theme.fills = [white(0.16)];
      bindRadius(theme, 'full');
      bar.appendChild(theme);
      for (const mode of ['light', 'auto', 'dark']) {
        const active = mode === 'auto';
        const opt = frame('theme-option/' + mode, 'HORIZONTAL', 5);
        opt.counterAxisAlignItems = 'CENTER';
        opt.paddingTop = 5; opt.paddingBottom = 5; opt.paddingLeft = 8; opt.paddingRight = 8;
        opt.fills = active ? [paint('accent')] : [];
        bindRadius(opt, 'full');
        theme.appendChild(opt);
        if (mode === 'light') opt.appendChild(icon(SVG_SUN, 'header/text', 17));
        if (mode === 'dark') opt.appendChild(icon(SVG_MOON, 'header/text', 17));
        if (mode === 'auto') {
          const t = await text('Авто', null, 'accent/contrast');
          t.fontName = INTER('Semi Bold'); t.fontSize = 13.6;
          opt.appendChild(t);
        }
      }
    }

    bar.appendChild(icon(SVG_BELL, 'header/text', 22));

    if (desktop) {
      const user = frame('user-section', 'HORIZONTAL', 8);
      user.counterAxisAlignItems = 'CENTER';
      bar.appendChild(user);
      user.appendChild(icon(SVG_USER, 'header/text', 22));
      const name = await text('Юрий Чебышев', null, 'header/text');
      name.fontSize = 15;
      user.appendChild(name);

      const logout = frame('logout', 'HORIZONTAL', 0);
      logout.paddingTop = 7; logout.paddingBottom = 7;
      logout.paddingLeft = 14; logout.paddingRight = 14;
      logout.fills = [white(0.18)];
      bindRadius(logout, 'full');
      bar.appendChild(logout);
      const lt = await text('Выйти', null, 'header/text');
      lt.fontName = INTER('Bold'); lt.fontSize = 15;
      logout.appendChild(lt);
    }

    variants.push(c);
  }

  const set = figma.combineAsVariants(variants, componentsPage);
  set.name = 'Header';
  set.description = 'App shell header (header.component.html/scss). Includes the active-game strip above the bar. Bar: min-height 64, padding .75rem 1rem, translucent white pills for nav-active / search / theme toggle. Mobile keeps only burger, brand and the bell.';
  set.layoutMode = 'VERTICAL';
  set.primaryAxisSizingMode = 'AUTO';
  set.counterAxisSizingMode = 'AUTO';
  set.itemSpacing = 24;
  set.paddingTop = 32; set.paddingBottom = 32; set.paddingLeft = 32; set.paddingRight = 32;
  set.x = 120; set.y = 1500;
  note('Header rebuilt (2 variants)');
  return set;
}

// ================================================================ GAME ROW ==
async function buildGameRow(componentsPage) {
  const old = findSet(componentsPage, 'Game Row');
  if (old) old.remove();

  const variants = [];
  for (const state of ['Default', 'Hover', 'Disabled']) {
    const c = figma.createComponent();
    c.name = 'State=' + state;
    c.layoutMode = 'HORIZONTAL';
    c.counterAxisAlignItems = 'CENTER';
    c.itemSpacing = APP.gameRowGap;
    c.paddingTop = APP.gameRowPad; c.paddingBottom = APP.gameRowPad;
    c.paddingLeft = APP.gameRowPad; c.paddingRight = APP.gameRowPad;
    c.fills = [paint('surface')];
    c.strokes = [{ type: 'SOLID', color: hex(RAW.rowBorder) }];
    c.strokeWeight = 1;
    c.resize(640, 58);
    c.primaryAxisSizingMode = 'FIXED';
    c.counterAxisSizingMode = 'AUTO';
    bindRadius(c, 'lg');
    componentsPage.appendChild(c);

    // .game-number — a round light-green badge, not plain text
    const badge = frame('game-number', 'HORIZONTAL', 0);
    badge.primaryAxisAlignItems = 'CENTER';
    badge.counterAxisAlignItems = 'CENTER';
    badge.fills = [{ type: 'SOLID', color: hex(RAW.badgeBg) }];
    badge.cornerRadius = 999;
    c.appendChild(badge);
    badge.resize(APP.badge, APP.badge);
    badge.layoutSizingHorizontal = 'FIXED';
    badge.layoutSizingVertical = 'FIXED';
    const num = await text('48', null, null, 'number');
    num.fontName = INTER('Bold');
    num.fontSize = 15;
    num.fills = [{ type: 'SOLID', color: hex(RAW.badgeText) }];
    badge.appendChild(num);

    const name = await text('Ночь длинных ножей', 'Body/Default', 'text/primary', 'game-name');
    c.appendChild(name);
    name.layoutSizingHorizontal = 'FILL';

    const date = await text('14.06.2025', null, null, 'game-start-at');
    date.fontSize = 13.6;                         // .game-start-at .85rem
    date.fills = [{ type: 'SOLID', color: hex(RAW.muted) }];
    c.appendChild(date);

    if (state === 'Hover' && ES['Shadow/Card Hover']) await c.setEffectStyleIdAsync(ES['Shadow/Card Hover'].id);
    if (state === 'Disabled') c.opacity = 0.8;    // .games-list-item-disabled

    variants.push(c);
  }

  const set = figma.combineAsVariants(variants, componentsPage);
  set.name = 'Game Row';
  set.description = 'A row in the past-games list (games.component.html/scss): round #e7f7ec number badge, name, right-aligned date. Border #d1e7d7, radius 12, padding .8rem. Hover lifts with Shadow/Card Hover; Disabled is .8 opacity.';
  set.layoutMode = 'VERTICAL';
  set.primaryAxisSizingMode = 'AUTO';
  set.counterAxisSizingMode = 'AUTO';
  set.itemSpacing = 20;
  set.paddingTop = 32; set.paddingBottom = 32; set.paddingLeft = 32; set.paddingRight = 32;
  set.x = 640; set.y = 900;
  note('Game Row rebuilt with number badge');
  return set;
}

// ================================================================= SCREENS ==
/** Light the nav pill for this route; every other link goes flat. */
function setHeaderActive(inst, label) {
  for (const link of inst.findAll((n) => n.name === 'nav-link')) {
    const t = link.findOne((n) => n.type === 'TEXT');
    const on = !!label && !!t && t.characters === label;
    link.fills = on ? [white(0.18)] : [];
  }
}

/** Screen = gradient page, header, the 1100px content panel, version footer. */
async function screenShell(name, desktop, headerSet, activeNav) {
  const width = desktop ? 1280 : 390;
  const s = figma.createFrame();
  s.name = name;
  s.layoutMode = 'VERTICAL';
  s.itemSpacing = 0;
  s.clipsContent = true;
  s.resize(width, 200);
  s.primaryAxisSizingMode = 'AUTO';
  s.counterAxisSizingMode = 'FIXED';
  s.counterAxisAlignItems = 'CENTER';
  s.fills = [{
    type: 'GRADIENT_LINEAR',
    gradientTransform: [[0, 1, 0], [-1, 0, 1]],
    gradientStops: [
      { position: 0, color: Object.assign({}, hex(LIGHT['bg/start']), { a: 1 }) },
      { position: 1, color: Object.assign({}, hex(LIGHT['bg/end']), { a: 1 }) },
    ],
  }];
  claim(s);

  if (headerSet) {
    const variant = headerSet.children.find((v) => v.name.indexOf(desktop ? 'Desktop' : 'Mobile') !== -1);
    if (variant) {
      const inst = variant.createInstance();
      s.appendChild(inst);
      inst.layoutSizingHorizontal = 'FILL';
      setHeaderActive(inst, activeNav);
    }
  }

  // .app-shell — margin 1rem auto 2rem
  const shell = frame('app-shell', 'VERTICAL', 0);
  shell.paddingTop = desktop ? 16 : 8;
  shell.paddingBottom = 32;
  s.appendChild(shell);
  shell.layoutSizingHorizontal = 'FILL';
  shell.counterAxisAlignItems = 'CENTER';

  // .app-content — the rounded surface panel everything lives in
  const panel = frame('app-content', 'VERTICAL', desktop ? 16 : 12);
  const pad = desktop ? APP.contentPadDesktop : APP.contentPadMobile;
  panel.paddingTop = pad; panel.paddingBottom = pad;
  panel.paddingLeft = pad; panel.paddingRight = pad;
  panel.fills = [Object.assign({}, paint('surface'), { opacity: 0.92 })];
  panel.effects = [{
    type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.08 },
    offset: { x: 0, y: 10 }, radius: 30, spread: 0, visible: true, blendMode: 'NORMAL',
  }];
  shell.appendChild(panel);
  panel.layoutSizingHorizontal = 'FIXED';
  panel.resize(desktop ? APP.shellMaxWidth : width - 16, panel.height);
  const r = TOKENS.radius[desktop ? 'xl' : 'lg'];
  if (r) for (const k of ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius']) panel.setBoundVariable(k, r);

  // .version-footer
  const footer = frame('version-footer', 'VERTICAL', 0);
  footer.counterAxisAlignItems = 'CENTER';
  footer.paddingTop = 16;
  shell.appendChild(footer);
  footer.layoutSizingHorizontal = 'FILL';
  const fv = await text('FE unknown\nBE n/a', null, 'text/muted', 'version');
  fv.fontSize = 12.5;
  fv.textAlignHorizontal = 'CENTER';
  fv.opacity = 0.85;
  footer.appendChild(fv);

  return { screen: s, panel: panel };
}

// -- Home --------------------------------------------------------------------
async function screenHome(headerSet, desktop) {
  const { screen, panel } = await screenShell((desktop ? 'Desktop' : 'Mobile') + ' / Home', desktop, headerSet, null);

  const home = frame('home', 'VERTICAL', 16);
  home.counterAxisAlignItems = 'CENTER';
  home.paddingTop = desktop ? 32 : 16; home.paddingBottom = desktop ? 32 : 16;
  panel.appendChild(home);
  home.layoutSizingHorizontal = 'FILL';

  const info = frame('main-info', desktop ? 'HORIZONTAL' : 'VERTICAL', 20);
  info.counterAxisAlignItems = 'CENTER';
  home.appendChild(info);
  info.layoutSizingHorizontal = 'FILL';

  const logoSize = desktop ? 320 : 280;
  const logo = figma.createFrame();
  logo.name = 'side-image';
  logo.resize(logoSize, logoSize);
  logo.cornerRadius = Math.round(logoSize * 0.24);   // border-radius: 24%
  logo.fills = [{
    type: 'GRADIENT_LINEAR',
    gradientTransform: [[0.7, 0.7, 0], [-0.7, 0.7, 0.5]],
    gradientStops: [
      { position: 0, color: Object.assign({}, hex('#1f2937'), { a: 1 }) },
      { position: 1, color: Object.assign({}, hex('#06110a'), { a: 1 }) },
    ],
  }];
  if (ES['Shadow/Hero Image']) await logo.setEffectStyleIdAsync(ES['Shadow/Hero Image'].id);
  info.appendChild(logo);

  const copy = frame('text-content', 'VERTICAL', 12);
  copy.counterAxisAlignItems = 'CENTER';
  info.appendChild(copy);
  copy.layoutSizingHorizontal = 'FILL';

  const h1 = await text('Добро пожаловать в Shvatka', 'Heading/H1', 'text/primary');
  copy.appendChild(h1);
  h1.layoutSizingHorizontal = 'FILL';
  h1.textAlignHorizontal = 'CENTER';
  wrap(h1);

  const p = await text(
    'Следите за активной игрой, просматривайте сценарии и проверяйте результаты в адаптивном интерфейсе.',
    'Body/Default', 'text/muted');
  copy.appendChild(p);
  p.layoutSizingHorizontal = 'FILL';
  p.textAlignHorizontal = 'CENTER';
  wrap(p);

  return screen;
}

// -- Games list --------------------------------------------------------------
async function screenGames(headerSet, rowSet, desktop) {
  const { screen, panel } = await screenShell((desktop ? 'Desktop' : 'Mobile') + ' / Games', desktop, headerSet, 'Прошедшие игры');

  const data = [
    ['2025', [['48', 'Ночь длинных ножей', '14.06.2025'], ['47', 'Забытый маяк', '22.03.2025'], ['46', 'Тени над городом', '18.01.2025']]],
    ['2024', [['45', 'Последний рубеж', '09.11.2024'], ['44', 'Код да Винчи', '27.07.2024']]],
  ];

  for (const [year, games] of data) {
    const group = frame('games-year-group', 'VERTICAL', 0);
    group.itemSpacing = 0;
    panel.appendChild(group);
    group.layoutSizingHorizontal = 'FILL';

    const heading = await text(year, null, null, 'games-year-heading');
    heading.fontName = INTER('Bold');
    heading.fontSize = APP.yearFont;
    heading.fills = [{ type: 'SOLID', color: hex(RAW.yearText) }];
    group.appendChild(heading);

    // border-bottom: 2px solid #d1e7d7, padding-bottom .3rem, margin-bottom .6rem
    const spacerTop = figma.createFrame();
    spacerTop.name = 'heading-pad'; spacerTop.fills = []; spacerTop.resize(10, 5);
    group.appendChild(spacerTop);
    spacerTop.layoutSizingHorizontal = 'FILL';

    const rule = figma.createRectangle();
    rule.name = 'heading-rule';
    rule.resize(100, 2);
    rule.fills = [{ type: 'SOLID', color: hex(RAW.rowBorder) }];
    group.appendChild(rule);
    rule.layoutSizingHorizontal = 'FILL';

    const list = frame('games-list', 'VERTICAL', APP.gameRowGap);
    list.paddingTop = 10;
    group.appendChild(list);
    list.layoutSizingHorizontal = 'FILL';

    for (const [num, name, date] of games) {
      if (!rowSet) break;
      const inst = rowSet.defaultVariant.createInstance();
      list.appendChild(inst);
      inst.layoutSizingHorizontal = 'FILL';
      const texts = inst.findAll((n) => n.type === 'TEXT');
      if (texts.length >= 3) {
        texts[0].characters = num;
        texts[1].characters = name;
        texts[2].characters = date;
      }
    }

    const gap = figma.createFrame();
    gap.name = 'group-gap'; gap.fills = []; gap.resize(10, 12);
    group.appendChild(gap);
    gap.layoutSizingHorizontal = 'FILL';
  }
  return screen;
}

// -- Game detail -------------------------------------------------------------
async function screenGameDetail(headerSet, desktop) {
  const { screen, panel } = await screenShell(
    (desktop ? 'Desktop' : 'Mobile') + ' / Game detail', desktop, headerSet, 'Прошедшие игры');

  const crumbs = await text('Игры  ›  Ночь длинных ножей', 'Body/Caption', 'text/muted', 'breadcrumbs');
  panel.appendChild(crumbs);

  const name = await text('Ночь длинных ножей', 'Heading/H1', 'text/primary', 'game-name');
  panel.appendChild(name);
  name.layoutSizingHorizontal = 'FILL';
  name.textAlignHorizontal = 'CENTER';
  wrap(name);

  const start = frame('game-start-at', 'HORIZONTAL', 6);
  start.primaryAxisAlignItems = 'CENTER';
  panel.appendChild(start);
  start.layoutSizingHorizontal = 'FILL';
  const sl = await text('Начало:', null, null);
  sl.fontSize = 15.2; sl.fills = [{ type: 'SOLID', color: hex(RAW.muted) }];
  start.appendChild(sl);
  const sv = await text('14.06.2025 21:00', null, 'text/primary');
  sv.fontName = INTER('Semi Bold'); sv.fontSize = 15.2;
  start.appendChild(sv);

  for (const [summary, kind] of [['Релиз игры', 'release'], ['Сценарий', 'scenario']]) {
    const det = detailsBlock(panel, summary, true);

    if (kind === 'release') {
      const body = await text('Промо игры, каким её анонсировали до старта.', 'Body/Small', 'text/muted');
      det.appendChild(body);
      body.layoutSizingHorizontal = 'FILL';
      wrap(body);
      continue;
    }

    // .scenario-tabs — flex 1 1 auto, so all three share the width equally
    const tabs = frame('scenario-tabs', 'HORIZONTAL', 6);
    det.appendChild(tabs);
    tabs.layoutSizingHorizontal = 'FILL';
    for (const [label, active] of [['Ключи и таймеры', true], ['Сценарий', false], ['Граф переходов', false]]) {
      const tab = frame('scenario-tab', 'HORIZONTAL', 0);
      tab.primaryAxisAlignItems = 'CENTER';
      tab.counterAxisAlignItems = 'CENTER';
      tab.paddingTop = 6; tab.paddingBottom = 6; tab.paddingLeft = 11; tab.paddingRight = 11;
      tab.cornerRadius = APP.tabRadius;
      tab.strokeWeight = 1;
      tab.fills = active ? [paint('accent')] : [{ type: 'SOLID', color: hex(RAW.tabBg) }];
      tab.strokes = active ? [paint('accent')] : [{ type: 'SOLID', color: hex(RAW.tabBorder) }];
      tabs.appendChild(tab);
      tab.layoutSizingHorizontal = 'FILL';
      const t = await text(label, null, null);
      t.fontName = INTER('Semi Bold'); t.fontSize = 14;
      t.fills = active ? [paint('accent/contrast')] : [{ type: 'SOLID', color: hex(RAW.tabText) }];
      tab.appendChild(t);
    }

    // .scn-compact — the "Ключи и таймеры" tab: one line of chips per level
    const compact = frame('scn-compact', 'VERTICAL', 7);
    det.appendChild(compact);
    compact.layoutSizingHorizontal = 'FILL';

    const levels = [
      ['Уровень 1', ['SH48A', 'СХ48А'], '45 мин', true],
      ['Уровень 2', ['SH48B', 'СХ48Б'], '40 мин', true],
      ['Уровень 3', ['SH48C', 'SH48D', 'СХ48В'], '60 мин', false],
    ];
    for (let i = 0; i < levels.length; i++) {
      const [label, keys, timer, hasEffect] = levels[i];
      const lvl = frame('scn-compact-level', 'VERTICAL', 4);
      lvl.paddingBottom = 6;
      compact.appendChild(lvl);
      lvl.layoutSizingHorizontal = 'FILL';

      const num = await text(label, null, 'text/primary', 'scn-compact-num');
      num.fontName = INTER('Semi Bold'); num.fontSize = 13.6;
      lvl.appendChild(num);

      const group = frame('scn-group', 'HORIZONTAL', 5);
      group.layoutWrap = 'WRAP';
      group.counterAxisSpacing = 5;
      group.counterAxisAlignItems = 'CENTER';
      lvl.appendChild(group);
      group.layoutSizingHorizontal = 'FILL';

      for (const k of keys) await scnChip(group, k, 'key');
      await scnChip(group, timer, 'timer');
      if (hasEffect) await scnChip(group, 'эффект', 'effect');

      if (i < levels.length - 1) {
        const div = figma.createRectangle();
        div.name = 'divider';
        div.resize(100, 1);
        div.fills = [{ type: 'SOLID', color: hex('#94a3b8'), opacity: 0.25 }];
        lvl.appendChild(div);
        div.layoutSizingHorizontal = 'FILL';
      }
    }
  }
  await flushSummaries();
  return screen;
}

/** .scn-chip / .scn-chip-timer / .scn-effect-toggle */
async function scnChip(parent, label, kind) {
  const c = frame('scn-chip' + (kind === 'key' ? '' : '-' + kind), 'HORIZONTAL', 3);
  c.counterAxisAlignItems = 'CENTER';
  c.paddingTop = 1; c.paddingBottom = 1; c.paddingLeft = 7; c.paddingRight = 7;
  c.cornerRadius = 999;
  if (kind === 'effect') c.fills = [{ type: 'SOLID', color: hex('#a855f7'), opacity: 0.15 }];
  else if (kind === 'timer') c.fills = [{ type: 'SOLID', color: hex('#3b82f6'), opacity: 0.12 }];
  else c.fills = [{ type: 'SOLID', color: hex('#0f172a'), opacity: 0.08 }];
  parent.appendChild(c);

  if (kind === 'key') c.appendChild(iconLiteral(SVG_KEY, '#1f2937', 13));
  if (kind === 'timer') c.appendChild(iconLiteral(SVG_TIMER, '#1e40af', 13));
  if (kind === 'effect') c.appendChild(iconLiteral(SVG_SPARK, '#7e22ce', 12));

  const t = await text(label, null, null);
  if (kind === 'effect') {
    t.fontSize = 11.5;
    t.fills = [{ type: 'SOLID', color: hex('#7e22ce') }];
  } else {
    t.fontSize = 13.6;
    t.fills = [{ type: 'SOLID', color: hex(kind === 'timer' ? '#1e40af' : '#1f2937') }];
  }
  c.appendChild(t);
  return c;
}

/** A <details> block: border #e5e7eb, radius 12, padding .75rem. */
function detailsBlock(parent, summary, centred) {
  const det = frame('details', 'VERTICAL', 10);
  det.fills = [paint('surface')];
  det.strokes = [{ type: 'SOLID', color: hex(RAW.detailsBorder) }];
  det.strokeWeight = 1;
  det.paddingTop = 12; det.paddingBottom = 12; det.paddingLeft = 12; det.paddingRight = 12;
  bindRadius(det, 'lg');
  parent.appendChild(det);
  det.layoutSizingHorizontal = 'FILL';
  pendingSummaries.push([det, summary, !!centred]);
  return det;
}
const pendingSummaries = [];
async function flushSummaries() {
  for (const [det, label, centred] of pendingSummaries.splice(0)) {
    const sum = await text('▾  ' + label, null, 'text/primary', 'summary');
    sum.fontName = INTER('Semi Bold'); sum.fontSize = 16;
    det.insertChild(0, sum);
    sum.layoutSizingHorizontal = 'FILL';
    if (centred) sum.textAlignHorizontal = 'CENTER';
  }
}


/**
 * .effect-tag pills. The only effects the app describes are bonus/penalty
 * minutes and bonus hints — nothing alters a level's timer.
 */
async function effectTags(parent, tags) {
  for (const [prefix, label] of tags) {
    const p = frame('effect-tag', 'HORIZONTAL', 3);
    p.counterAxisAlignItems = 'CENTER';
    p.paddingTop = 2; p.paddingBottom = 2; p.paddingLeft = 7; p.paddingRight = 7;
    p.cornerRadius = 999;
    p.fills = [{ type: 'SOLID', color: hex('#0f172a'), opacity: 0.08 }];
    parent.appendChild(p);
    if (prefix) {
      const pre = await text(prefix, null, 'text/primary', 'effect-tag-prefix');
      pre.fontName = INTER('Semi Bold'); pre.fontSize = 13.6;
      p.appendChild(pre);
    }
    p.appendChild(iconLiteral(prefix ? SVG_SPARK : SVG_BULB, '#1f2937', 12));
    const t = await text(label, null, 'text/primary');
    t.fontSize = 13.6;
    p.appendChild(t);
  }
}

// -- Game play ---------------------------------------------------------------
async function screenGamePlay(headerSet, desktop) {
  const { screen, panel } = await screenShell(
    (desktop ? 'Desktop' : 'Mobile') + ' / Game play', desktop, headerSet, 'Текущая игра');

  const rule = figma.createRectangle();
  rule.name = 'level-rule';
  rule.resize(100, 1.6);
  rule.fills = [{ type: 'SOLID', color: hex(RAW.rule) }];
  panel.appendChild(rule);
  rule.layoutSizingHorizontal = 'FILL';

  const lh = await text('Уровень №3 начался 21:47 (00:12:31)', 'Heading/H3', 'text/primary', 'level-header');
  panel.appendChild(lh);
  lh.layoutSizingHorizontal = 'FILL';
  lh.textAlignHorizontal = 'CENTER';
  wrap(lh);

  const keys = frame('level-keys', 'HORIZONTAL', 8);
  keys.primaryAxisAlignItems = 'CENTER';
  keys.counterAxisAlignItems = 'CENTER';
  panel.appendChild(keys);
  keys.layoutSizingHorizontal = 'FILL';

  const input = frame('key-input', 'HORIZONTAL', 0);
  input.paddingTop = 7; input.paddingBottom = 7; input.paddingLeft = 10; input.paddingRight = 10;
  input.fills = [paint('surface')];
  input.strokes = [{ type: 'SOLID', color: hex(RAW.tabBorder) }];
  input.strokeWeight = 1;
  input.cornerRadius = APP.tabRadius;
  keys.appendChild(input);
  input.layoutSizingHorizontal = 'FIXED';
  input.resize(desktop ? 260 : 180, input.height);
  const iv = await text('SH48A', null, 'text/primary', 'value');
  iv.fontSize = 15.2;
  input.appendChild(iv);
  iv.layoutSizingHorizontal = 'FILL';

  const btn = frame('submit', 'HORIZONTAL', 6);
  btn.counterAxisAlignItems = 'CENTER';
  btn.paddingTop = 7; btn.paddingBottom = 7; btn.paddingLeft = 13; btn.paddingRight = 13;
  btn.fills = [paint('accent')];
  btn.cornerRadius = APP.tabRadius;
  keys.appendChild(btn);
  const bt = await text('Отправить', null, 'accent/contrast');
  bt.fontName = INTER('Semi Bold'); bt.fontSize = 15;
  btn.appendChild(bt);

  // .key-result-panel.key-result-ok — tinted green, slate border, max-width 640
  const wrapper = frame('panel-wrap', 'VERTICAL', 0);
  wrapper.counterAxisAlignItems = 'CENTER';
  panel.appendChild(wrapper);
  wrapper.layoutSizingHorizontal = 'FILL';

  const pad = desktop ? APP.contentPadDesktop : APP.contentPadMobile;
  const res = frame('key-result-panel key-result-ok', 'VERTICAL', 5);
  res.counterAxisAlignItems = 'CENTER';
  res.paddingTop = 10; res.paddingBottom = 10; res.paddingLeft = 12; res.paddingRight = 12;
  res.fills = [{ type: 'SOLID', color: hex('#22c55e'), opacity: 0.2 }];
  res.strokes = [{ type: 'SOLID', color: hex(RAW.panelBorder) }];
  res.strokeWeight = 1;
  bindRadius(res, 'md');
  wrapper.appendChild(res);
  res.layoutSizingHorizontal = 'FIXED';
  res.resize(Math.min(APP.panelMaxWidth, panel.width - 2 * pad), res.height);

  for (const [label, value, token] of [['Результат:', 'Уровень пройден', 'text/primary'], ['Ключ:', 'SH48A', 'text/primary']]) {
    const row = frame('row', 'HORIZONTAL', 6);
    row.primaryAxisAlignItems = 'CENTER';
    res.appendChild(row);
    row.layoutSizingHorizontal = 'FILL';
    const l = await text(label, 'Body/Small', 'text/muted');
    row.appendChild(l);
    const v = await text(value, 'Body/Small', token);
    v.fontName = INTER('Semi Bold');
    row.appendChild(v);
  }
  // .typed-effects > .effect-tag — grey pills
  const tags = frame('typed-effects', 'HORIZONTAL', 4);
  tags.layoutWrap = 'WRAP'; tags.counterAxisSpacing = 4;
  res.appendChild(tags);
  await effectTags(tags, [['+', 'бонус 5 мин.'], [null, 'бонусные подсказки: 1']]);

  // ul.hints — each li carries an icon marker; the source decides which one
  const hints = frame('hints', 'VERTICAL', 9);
  hints.paddingLeft = 18;
  panel.appendChild(hints);
  hints.layoutSizingHorizontal = 'FILL';

  // The feed is scheduled hints plus the events that *brought* hints — a bonus
  // hint from a key, a timer or an effect. Nothing else appears here.
  const feed = [
    ['bulb', 'Подсказка 0 мин.',
      'Ищите там, где вода встречается с камнем, а фонарь светит только в одну сторону.', false, false, null],
    ['key', 'Ключ «SH48A» 12 мин. (21:59)',
      'Бонусная подсказка: считайте пролёты от моста, а не от угла набережной.', false, false,
      [['+', 'бонус 5 мин.'], [null, 'бонусные подсказки: 1']]],
    ['bulb', 'Подсказка 10 мин.',
      'Северная сторона набережной, третий пролёт от моста.', false, true, null],
    ['bulb', 'Последняя подсказка уровня 25 мин.',
      'Табличка с датой постройки. Считайте только цифры.', true, false, null],
  ];
  for (const [src, label, body, last, card, itemTags] of feed) {
    const li = frame('hint-item', 'HORIZONTAL', 6);
    li.counterAxisAlignItems = 'MIN';
    hints.appendChild(li);
    li.layoutSizingHorizontal = 'FILL';

    const glyph = src === 'timer' ? SVG_TIMER : src === 'key' ? SVG_KEY : SVG_BULB;
    li.appendChild(iconLiteral(glyph, last ? LIGHT['accent'] : LIGHT['text/primary'], 17));

    const col = frame('hint-body', 'VERTICAL', 3);
    li.appendChild(col);
    col.layoutSizingHorizontal = 'FILL';

    const h = await text(label, null, last ? 'accent' : 'text/primary', 'hint-header');
    h.fontSize = 15;
    if (last) h.fontName = INTER('Semi Bold');
    col.appendChild(h);

    const b = await text(body, 'Body/Small', 'text/primary');
    col.appendChild(b);
    b.layoutSizingHorizontal = 'FILL';
    wrap(b);

    if (itemTags) {
      const it = frame('typed-effects', 'HORIZONTAL', 4);
      it.layoutWrap = 'WRAP'; it.counterAxisSpacing = 4;
      col.appendChild(it);
      it.layoutSizingHorizontal = 'FILL';
      await effectTags(it, itemTags);
    }

    if (card) {
      // .hint-card — the balloon a gps/venue/document hint renders as
      const hc = frame('hint-card', 'HORIZONTAL', 12);
      hc.counterAxisAlignItems = 'CENTER';
      hc.paddingTop = 10; hc.paddingBottom = 10; hc.paddingLeft = 12; hc.paddingRight = 12;
      hc.fills = [paint('surface')];
      hc.strokes = [paint('border/default')];
      hc.strokeWeight = 1;
      bindRadius(hc, 'lg');
      col.appendChild(hc);
      hc.layoutSizingHorizontal = 'FIXED';
      hc.resize(Math.min(360, panel.width - 2 * pad - 24), hc.height);

      const ci = figma.createFrame();
      ci.name = 'hint-card-icon';
      ci.layoutMode = 'HORIZONTAL';
      ci.primaryAxisAlignItems = 'CENTER';
      ci.counterAxisAlignItems = 'CENTER';
      ci.resize(40, 40);
      ci.cornerRadius = 999;
      ci.fills = [paint('accent')];
      hc.appendChild(ci);
      ci.layoutSizingHorizontal = 'FIXED';
      ci.layoutSizingVertical = 'FIXED';
      ci.appendChild(iconLiteral(SVG_PIN, LIGHT['accent/contrast'], 22));

      const cb = frame('hint-card-body', 'VERTICAL', 2);
      hc.appendChild(cb);
      cb.layoutSizingHorizontal = 'FILL';
      const ct = await text('Точка на карте', null, 'text/primary', 'hint-card-title');
      ct.fontName = INTER('Semi Bold'); ct.fontSize = 15;
      cb.appendChild(ct);
      const cs = await text('59.93863, 30.31413', null, 'text/muted', 'hint-card-sub');
      cs.fontSize = 13.6;
      cb.appendChild(cs);
    }
  }

  // .play-spoilers — the three collapsed <details> under the current level
  const spoilers = frame('play-spoilers', 'VERTICAL', 10);
  spoilers.paddingTop = 18;
  panel.appendChild(spoilers);
  spoilers.layoutSizingHorizontal = 'FILL';

  detailsBlock(spoilers, 'Подсказки прошлых уровней', false);
  detailsBlock(spoilers, 'Последние игровые события', false);
  const log = detailsBlock(spoilers, 'Лог ключей', false);

  // typed keys: coloured status glyph, the key, and the violet effect pill
  for (const [status, key, effect] of [
    ['ok', 'SH48A', true],
    ['dup', 'SH48A', false],
    ['wrong', 'СХ48Г', false],
  ]) {
    const entry = frame('typed-key-entry', 'HORIZONTAL', 6);
    entry.counterAxisAlignItems = 'CENTER';
    log.appendChild(entry);
    entry.layoutSizingHorizontal = 'FILL';

    const colour = status === 'ok' ? '#22c55e' : status === 'dup' ? '#eab308' : '#ef4444';
    const mark = await text(status === 'wrong' ? '✕' : '✓', null, null, 'typed-key-status');
    mark.fontName = INTER('Semi Bold'); mark.fontSize = 14;
    mark.fills = [{ type: 'SOLID', color: hex(colour) }];
    entry.appendChild(mark);

    const kt = await text(key, null, 'text/primary', 'typed-key-label');
    kt.fontName = INTER('Semi Bold'); kt.fontSize = 15;
    entry.appendChild(kt);

    if (effect) {
      // .typed-key-hint-pill — rgba(168,85,247,.15) on #7e22ce, .72rem
      const pillNode = frame('typed-key-hint-pill', 'HORIZONTAL', 3);
      pillNode.counterAxisAlignItems = 'CENTER';
      pillNode.paddingTop = 1; pillNode.paddingBottom = 1;
      pillNode.paddingLeft = 6; pillNode.paddingRight = 6;
      pillNode.cornerRadius = 999;
      pillNode.fills = [{ type: 'SOLID', color: hex('#a855f7'), opacity: 0.15 }];
      entry.appendChild(pillNode);
      pillNode.appendChild(iconLiteral(SVG_SPARK, '#7e22ce', 11));
      const pt = await text('эффект', null, null);
      pt.fontSize = 11.5;
      pt.fills = [{ type: 'SOLID', color: hex('#7e22ce') }];
      pillNode.appendChild(pt);
    }

    const spacer2 = figma.createFrame();
    spacer2.name = 'spacer'; spacer2.fills = []; spacer2.resize(8, 8);
    entry.appendChild(spacer2);
    spacer2.layoutSizingHorizontal = 'FILL';

    const at = await text('21:5' + (status === 'ok' ? '2' : status === 'dup' ? '4' : '7'), null, 'text/muted');
    at.fontSize = 13.6;
    entry.appendChild(at);
  }

  await flushSummaries();
  return screen;
}

// -- Profile -----------------------------------------------------------------
async function screenProfile(headerSet, desktop) {
  const { screen, panel } = await screenShell((desktop ? 'Desktop' : 'Mobile') + ' / Profile', desktop, headerSet, null);

  // .hero — a tinted green card
  const hero = frame('hero', desktop ? 'HORIZONTAL' : 'VERTICAL', 16);
  hero.counterAxisAlignItems = desktop ? 'CENTER' : 'MIN';
  hero.paddingTop = 20; hero.paddingBottom = 20; hero.paddingLeft = 20; hero.paddingRight = 20;
  hero.fills = [{ type: 'SOLID', color: hex('#2f8f4e'), opacity: 0.1 }];
  hero.strokes = [{ type: 'SOLID', color: hex(RAW.rowBorder) }];
  hero.strokeWeight = 1;
  bindRadius(hero, 'xl');
  panel.appendChild(hero);
  hero.layoutSizingHorizontal = 'FILL';

  const av = figma.createFrame();
  av.name = 'hero__avatar';
  av.layoutMode = 'HORIZONTAL';
  av.primaryAxisAlignItems = 'CENTER';
  av.counterAxisAlignItems = 'CENTER';
  av.resize(64, 64);
  av.cornerRadius = 999;
  av.fills = [paint('accent')];
  hero.appendChild(av);
  av.layoutSizingHorizontal = 'FIXED';
  av.layoutSizingVertical = 'FIXED';
  const initial = await text('Ю', null, 'accent/contrast');
  initial.fontName = INTER('Semi Bold'); initial.fontSize = 27;
  av.appendChild(initial);

  const ident = frame('hero__identity', 'VERTICAL', 6);
  hero.appendChild(ident);
  ident.layoutSizingHorizontal = 'FILL';
  const nm = await text('Юрий Чебышев', 'Heading/H1', 'text/primary', 'hero__name');
  ident.appendChild(nm);
  const handle = await text('@bomzheg', 'Body/Small', 'text/muted', 'hero__handle');
  ident.appendChild(handle);

  // .chip — tinted, bordered, 0.75rem/600 — NOT a solid fill
  const chips = frame('hero__chips', 'HORIZONTAL', 8);
  ident.appendChild(chips);
  for (const [label, tint] of [['автор', '#2f8f4e'], ['админ', RAW.chipIndigo], ['Ночные волки', null]]) {
    const chip = frame('chip', 'HORIZONTAL', 0);
    chip.counterAxisAlignItems = 'CENTER';
    chip.paddingTop = 2; chip.paddingBottom = 2; chip.paddingLeft = 9; chip.paddingRight = 9;
    chip.cornerRadius = 999;
    chip.strokeWeight = 1;
    if (tint) {
      chip.fills = [{ type: 'SOLID', color: hex(tint), opacity: 0.15 }];
      chip.strokes = [{ type: 'SOLID', color: hex(tint), opacity: 0.45 }];
    } else {
      chip.fills = [{ type: 'SOLID', color: hex('#1f2937'), opacity: 0.06 }];
      chip.strokes = [paint('border/default')];
    }
    chips.appendChild(chip);
    const t = await text(label, null, 'text/primary');
    t.fontName = INTER('Semi Bold'); t.fontSize = 12;
    chip.appendChild(t);
  }

  if (desktop) {
    const pub = await text('Публичный профиль', 'Body/Small', 'accent', 'hero__public');
    hero.appendChild(pub);
  }

  // .stats — three equal bordered tiles
  const stats = frame('stats', 'HORIZONTAL', 12);
  panel.appendChild(stats);
  stats.layoutSizingHorizontal = 'FILL';
  for (const [value, label] of [['37', 'игр сыграно'], ['1 284', 'ключей введено'], ['68%', 'верных']]) {
    const stat = frame('stat', 'VERTICAL', 2);
    stat.counterAxisAlignItems = 'CENTER';
    stat.paddingTop = 14; stat.paddingBottom = 14; stat.paddingLeft = 12; stat.paddingRight = 12;
    stat.fills = [paint('surface')];
    stat.strokes = [paint('border/default')];
    stat.strokeWeight = 1;
    bindRadius(stat, 'lg');
    stats.appendChild(stat);
    stat.layoutSizingHorizontal = 'FILL';
    const v = await text(value, null, 'text/primary', 'stat__value');
    v.fontName = INTER('Semi Bold'); v.fontSize = 22;
    stat.appendChild(v);
    const l = await text(label, 'Body/Caption', 'text/muted', 'stat__label');
    stat.appendChild(l);
  }

  // .tabs — one bordered pill holding three segments, active one filled
  const tabs = frame('tabs', 'HORIZONTAL', 0);
  tabs.paddingTop = 4; tabs.paddingBottom = 4; tabs.paddingLeft = 4; tabs.paddingRight = 4;
  tabs.fills = [paint('surface')];
  tabs.strokes = [paint('border/default')];
  tabs.strokeWeight = 1;
  tabs.cornerRadius = 999;
  panel.appendChild(tabs);
  tabs.layoutSizingHorizontal = 'FILL';
  for (const [label, active] of [['Аккаунт', true], ['Вход', false], ['Уведомления', false]]) {
    const tab = frame('tabs__tab', 'HORIZONTAL', 0);
    tab.primaryAxisAlignItems = 'CENTER';
    tab.counterAxisAlignItems = 'CENTER';
    tab.paddingTop = 8; tab.paddingBottom = 8;
    tab.fills = active ? [paint('accent')] : [];
    tab.cornerRadius = 999;
    tabs.appendChild(tab);
    tab.layoutSizingHorizontal = 'FILL';
    const t = await text(label, null, active ? 'accent/contrast' : 'text/primary');
    t.fontName = INTER('Semi Bold'); t.fontSize = 15;
    tab.appendChild(t);
  }

  // settings card
  const card = frame('settings', 'VERTICAL', 10);
  card.paddingTop = 20; card.paddingBottom = 20; card.paddingLeft = 20; card.paddingRight = 20;
  card.fills = [paint('surface')];
  card.strokes = [paint('border/default')];
  card.strokeWeight = 1;
  bindRadius(card, 'lg');
  panel.appendChild(card);
  card.layoutSizingHorizontal = 'FILL';

  const ct = await text('Имя и пароль', 'Heading/H3', 'text/primary');
  card.appendChild(ct);
  const fl = await text('Имя пользователя', null, 'text/primary', 'field__label');
  fl.fontName = INTER('Semi Bold'); fl.fontSize = 14.4;
  card.appendChild(fl);

  const row = frame('field__row', desktop ? 'HORIZONTAL' : 'VERTICAL', 8);
  card.appendChild(row);
  row.layoutSizingHorizontal = 'FILL';
  const inp = frame('input', 'HORIZONTAL', 0);
  inp.paddingTop = 10; inp.paddingBottom = 10; inp.paddingLeft = 12; inp.paddingRight = 12;
  inp.fills = [paint('surface')];
  inp.strokes = [paint('border/default')];
  inp.strokeWeight = 1;
  bindRadius(inp, 'md');
  row.appendChild(inp);
  inp.layoutSizingHorizontal = 'FILL';
  const iv2 = await text('bomzheg', 'Body/Small', 'text/primary');
  inp.appendChild(iv2);
  iv2.layoutSizingHorizontal = 'FILL';

  const save = frame('button--primary', 'HORIZONTAL', 0);
  save.primaryAxisAlignItems = 'CENTER';
  save.counterAxisAlignItems = 'CENTER';
  save.paddingTop = 9; save.paddingBottom = 9; save.paddingLeft = 14; save.paddingRight = 14;
  save.fills = [paint('accent')];
  save.opacity = 0.6;                              // disabled until the name changes
  bindRadius(save, 'md');
  row.appendChild(save);
  const st = await text('Сохранить', null, 'accent/contrast');
  st.fontName = INTER('Semi Bold'); st.fontSize = 14.4;
  save.appendChild(st);

  const hint = await text('Под этим именем вас видят в командах и играх.', 'Body/Caption', 'text/muted', 'field__hint');
  card.appendChild(hint);
  hint.layoutSizingHorizontal = 'FILL';
  wrap(hint);

  return screen;
}

// ==================================================================== main ==
async function main() {
  await figma.loadAllPagesAsync();
  await Promise.all(FONT_STYLES.map((s) => figma.loadFontAsync(INTER(s))));
  await loadTokens();

  const componentsPage = await pageNamed('Components');
  const screensPage = await pageNamed('Screens');

  await figma.setCurrentPageAsync(componentsPage);
  const headerSet = await buildHeader(componentsPage);
  const rowSet = await buildGameRow(componentsPage);

  await figma.setCurrentPageAsync(screensPage);
  const cleared = clearOurNodes(screensPage);
  if (cleared) note('replaced ' + cleared + ' previous screen(s)');

  let built = 0;
  for (const desktop of [true, false]) {
    let x = 0;
    const y = desktop ? 0 : 2600;
    const makers = [
      () => screenHome(headerSet, desktop),
      () => screenGames(headerSet, rowSet, desktop),
      () => screenGameDetail(headerSet, desktop),
      () => screenGamePlay(headerSet, desktop),
      () => screenProfile(headerSet, desktop),
    ];
    for (const make of makers) {
      const s = await make();
      screensPage.appendChild(s);
      s.x = x; s.y = y;
      x += s.width + 80;
      built++;
    }
  }

  note('built ' + built + ' screens');
  const mine = screensPage.children.filter((n) => n.getPluginData('owner') === MADE_BY_PLUGIN);
  figma.currentPage.selection = mine;
  figma.viewport.scrollAndZoomIntoView(mine);
  figma.closePlugin('Shvatka DS — ' + LOG.join(' · '));
}

main().catch((e) => {
  figma.closePlugin('Shvatka DS failed: ' + (e && e.message ? e.message : String(e)));
});
