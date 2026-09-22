/*
 * A permissive stand-in for the Figma Plugin API — enough to run code.js in
 * node and catch typos, missing helpers and bad call order. It does not check
 * layout semantics; it checks that the script runs end to end.
 */
const made = [];
function node(type) {
  const self = {
    type, name: '', children: [], width: 100, height: 40, x: 0, y: 0,
    fills: [], strokes: [], characters: '', fontName: { family: 'Inter', style: 'Regular' },
    _plugin: {},
    appendChild(c) { if (!c) throw new Error('appendChild(undefined)'); c.parent = self; self.children.push(c); },
    insertChild(i, c) { c.parent = self; self.children.splice(i, 0, c); },
    resize(w, h) { self.width = w; self.height = h; },
    rescale(f) { self.width *= f; self.height *= f; },
    remove() { if (self.parent) self.parent.children = self.parent.children.filter((x) => x !== self); },
    findAll(fn) { const out = []; const walk = (n) => n.children.forEach((c) => { if (!fn || fn(c)) out.push(c); walk(c); }); walk(self); return out; },
    findOne(fn) { return self.findAll(fn)[0] || null; },
    setPluginData(k, v) { self._plugin[k] = v; },
    getPluginData(k) { return self._plugin[k] || ''; },
    setBoundVariable() {},
    async setTextStyleIdAsync() {},
    async setEffectStyleIdAsync() {},
    createInstance() { const i = node('INSTANCE'); i.children = self.children; return i; },
  };
  made.push(self);
  return self;
}

const page = (name) => { const p = node('PAGE'); p.name = name; return p; };
const pages = [page('Foundations'), page('Components'), page('Screens')];

const variable = (name) => ({ id: 'v:' + name, name });
const collections = [
  { name: 'Color Light', variableIds: ['bg/start', 'bg/end', 'surface', 'text/primary', 'text/muted',
    'border/default', 'border/card', 'header/bg', 'header/text', 'accent', 'accent/contrast',
    'heading/accent', 'status/success', 'status/danger', 'status/info'] },
  { name: 'Spacing', variableIds: ['spacing/xs', 'spacing/sm', 'spacing/md', 'spacing/lg', 'spacing/xl'] },
  { name: 'Radius', variableIds: ['radius/sm', 'radius/md', 'radius/lg', 'radius/xl', 'radius/full'] },
];

const textStyles = ['Heading/H1', 'Heading/H2', 'Heading/H3', 'Body/Default', 'Body/Small',
  'Body/Caption', 'Label/Default', 'Mono/Default'].map((n) => ({ id: 's:' + n, name: n }));
const effectStyles = ['Shadow/Card', 'Shadow/Card Hover', 'Shadow/Hero Image'].map((n) => ({ id: 'e:' + n, name: n }));

global.figma = {
  root: { children: pages },
  currentPage: pages[2],
  mixed: Symbol('mixed'),
  variables: {
    async getLocalVariableCollectionsAsync() { return collections; },
    async getVariableByIdAsync(id) { return variable(id); },
    setBoundVariableForPaint(paint) { return paint; },
  },
  async getLocalTextStylesAsync() { return textStyles; },
  async getLocalEffectStylesAsync() { return effectStyles; },
  async loadAllPagesAsync() {},
  async loadFontAsync() {},
  async setCurrentPageAsync(p) { this.currentPage = p; },
  createFrame: () => node('FRAME'),
  createText: () => node('TEXT'),
  createRectangle: () => node('RECTANGLE'),
  createEllipse: () => node('ELLIPSE'),
  createLine: () => node('LINE'),
  createComponent: () => node('COMPONENT'),
  createNodeFromSvg: (svg) => {
    if (!/^<svg[\s>]/.test(svg)) throw new Error('createNodeFromSvg got a non-svg string');
    const n = node('FRAME'); n.width = 24; n.height = 24;
    const path = node('VECTOR'); path.fills = [{}]; path.strokes = [];
    n.appendChild(path);
    return n;
  },
  combineAsVariants(variants, parent) {
    const set = node('COMPONENT_SET');
    variants.forEach((v) => set.appendChild(v));
    set.defaultVariant = variants[0];
    parent.appendChild(set);
    return set;
  },
  viewport: { scrollAndZoomIntoView() {} },
  closePlugin(msg) { console.log('closePlugin:', msg); global.__closed = msg; },
};

require(require('path').join(__dirname, '..', 'plugin', 'code.js'));

setTimeout(() => {
  if (!global.__closed) { console.error('plugin never closed'); process.exit(1); }
  if (/failed/i.test(global.__closed)) process.exit(1);
  const screens = pages[2].children;
  console.log('screens on the Screens page:', screens.length);
  for (const s of screens) console.log(' -', s.name, Math.round(s.width) + 'x' + Math.round(s.height));
}, 800);
