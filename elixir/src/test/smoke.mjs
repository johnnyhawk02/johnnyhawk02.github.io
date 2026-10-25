// Smoke test for the built page: loads every built-in preset, a set of presets in older saved shapes,
// and presets saved from the page itself, and records for each the app state and a hash of four bars
// of audio rendered offline by the page's own Player. Run against a baseline to check a refactor
// changed nothing:
//   node test/smoke.mjs [page.html] > out.json      (default: index.html)
//   node test/smoke.mjs index.html --check test/baseline.json
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const checkAt = args.indexOf('--check');
const baseline = checkAt >= 0 ? JSON.parse(readFileSync(args[checkAt + 1], 'utf8')) : null;
const page_ = resolve(args.find((a, i) => !a.startsWith('--') && i !== checkAt + 1) || 'index.html');

// presets as older versions of the page saved them
const kit = JSON.parse(readFileSync(new URL('../presets/elixir-favourites.json', import.meta.url))).presets[0].kit.map((v, i) => (i % 5 ? v : (v + 3) % 128));
const pat = (n) => Array.from({ length: 7 }, (_, t) => Array.from({ length: 16 }, (_, s) => ((s + t) % n === 0 ? 1 : 0)));
const zero = () => Array.from({ length: 7 }, () => new Array(16).fill(0));
const song = { energy: 70, beat: 3, fills: 50, tempo: 124, vel: 90, accent: 4, view: 'perform', master: { comp: false, thresh: -20 }, mute: [], solo: [],
  pattern: { on: pat(3), acc: zero(), bar: zero() } };
const LEGACY = [
  { name: 'Old nofx', kit, xm: { amt: new Array(36).fill(0), target: ['fm', 'fm', 'fm', 'filter', 'fm', 'ring'] }, fx: [10, 0, 0, 0, 0, 0], dpos: 0.5, song },
  { name: 'Old distflag', kit, fx: [0, 0, 0, 0, 0, 0], fx3: { params: { echo: { width: 64 }, dist: { type: 1, p: [1, 2, 3, 4] }, ring: { wave: 2, freq: 9 } }, dist: [1, 0, 1, 0, 0, 0], ring: [0, 5, 0, 0, 0, 0] }, song: { ...song, view: 'steps' } },
  { name: 'Old steps', kit, fx3: { params: { echo: { pct: 150 }, dist: { type: 0, p: [70, 64, 80, 90] }, ring: { wave: 0, freq: 40 } }, dsend: [0, 0, 0, 50, 0, 0], ring: [0, 0, 0, 0, 0, 0] },
    song: { ...song, patternOn: false, steps: { on: pat(5), acc: zero(), bar: zero() }, groove: { swing: 60, share: new Array(7).fill(80), push: new Array(7).fill(40) }, macro: { fm: 150 } } },
  { name: 'Old style', kit, fx3: { params: { echo: { pct: 100 }, dist: { type: 0, p: [70, 64, 80, 90] }, ring: { wave: 0, freq: 40 } }, dsend: [0, 0, 0, 0, 0, 0], ring: [0, 0, 0, 0, 0, 0] },
    song: { ...song, style: 'techno', source: 'steps', stepPages: [{ on: pat(2), acc: zero(), bar: zero() }, { on: pat(4), acc: zero(), bar: zero() }] } },
];
const USER_PATS = [{ name: 'user 1', on: pat(3), acc: zero(), bar: zero() }];

const browser = await chromium.launch();
const errors = [];
async function open(storage) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript((storage) => {
    let s = 12345; Math.random = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    Date.now = () => 1700000000000;
    if (storage) { localStorage.clear(); for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v); }
    window.__all = [];
  }, storage);
  await page.goto('file://' + page_);
  // no audio device: messages stay in the page's queue, where the probe reads them
  await page.evaluate(() => { startAudio = async () => {}; });
  return page;
}
// the state of the page and four bars of its audio, rendered by a fresh Player fed every message sent so far
const probe = () => {
  window.__all.push(...pending.splice(0));
  const p = new Player(48000);
  let seq = null;
  for (const m of window.__all) { p.msg(m); const mm = m.type === 'atBar' ? m.m : m; if (mm.type === 'seq') seq = mm; }
  p.msg({ ...seq, playing: true });
  const n = Math.round(4 * 240 / seq.bpm * 48000), L = new Float32Array(n), R = new Float32Array(n);
  p.process(L, R);
  let h = 0, e = 0;
  for (let i = 0; i < n; i++) { const a = Math.round(L[i] * 1e5), b = Math.round(R[i] * 1e5); h = (Math.imul(h, 31) + a * 7 + b) | 0; e += L[i] * L[i] + R[i] * R[i]; }
  const s = songSnapshot();
  return { audio: h, energy: +e.toFixed(3), seq: JSON.stringify({ ...seq, playing: undefined }),
    values: Array.from(values).join(','), xm: JSON.stringify(xm), sends: JSON.stringify(fx3Snapshot()), echo: JSON.stringify(mix.fx), dpos: delayPos,
    song: JSON.stringify({ ...s, steps: undefined, patternOn: undefined, mute: undefined, solo: undefined, v: undefined }) };
};
const out = {};
const loadAll = async (page, tag, filter) => {
  const names = await page.evaluate((f) => kitList.map((k, i) => [i, k.name, !!k.builtin]).filter(([, , b]) => (f === 'builtin' ? b : !b)), filter);
  for (const [i, name] of names) out[`${tag}: ${name}`] = await page.evaluate((i) => { loadPreset(kitList[i]); return (0, eval)('(' + window.__probe + ')')(); }, i);
  return names.length;
};

// 1. built-in presets
let page = await open({});
await page.evaluate((p) => { window.__probe = p; }, probe.toString());
out['initial'] = await page.evaluate(() => (0, eval)('(' + window.__probe + ')')());
const nb = await loadAll(page, 'builtin', 'builtin');
// generator: every style and a few beats
for (let st = 0; st < 5; st++) for (const beat of [0, 7, 15]) {
  out[`gen ${st} ${beat}`] = await page.evaluate(([st, beat]) => {
    setStyle(st); $('beat').value = beat; $('beat').dispatchEvent(new Event('input')); return (0, eval)('(' + window.__probe + ')')();
  }, [st, beat]);
}
await page.close();

// 2. presets in older shapes, plus old user pattern names
page = await open({ 'elexir-presets-v2': JSON.stringify(LEGACY), 'elexir-user-patterns': JSON.stringify(USER_PATS) });
await page.evaluate((p) => { window.__probe = p; }, probe.toString());
const nl = await loadAll(page, 'legacy', 'saved');
out['user patterns'] = { names: await page.evaluate(() => JSON.stringify(userPats.map((u) => u.name))) };

// 3. presets saved now: a steps preset with pages, a user-style preset, a sound tweak; then a reload loads them
const clicks = ['[data-src="steps"]', '[data-page="2"]', '[data-expand="4"]', '#kit-save', '#up-save', '#new-kit', '#kit-save',
  '[data-src="perform"]', '#style-next', '#style-next', '#alter', '#kit-save'];
for (const sel of clicks) await page.evaluate(async (sel) => { document.querySelector(sel).click(); await new Promise((r) => setTimeout(r, 0)); }, sel);
const store = await page.evaluate(() => ({ p: localStorage.getItem('elexir-presets-v2'), u: localStorage.getItem('elexir-user-patterns') }));
await page.close();
page = await open({ 'elexir-presets-v2': store.p, 'elexir-user-patterns': store.u });
await page.evaluate((p) => { window.__probe = p; }, probe.toString());
const ns = await loadAll(page, 'saved', 'saved');
// the export a favourite would make round-trips to the same state
out['export'] = { json: await page.evaluate(() => JSON.stringify(kitList.filter((k) => k.saved).slice(-3).map(presetData).map((p) => ({ ...p, v: undefined, song: { ...p.song, steps: undefined, patternOn: undefined, mute: undefined, solo: undefined, v: undefined } })))) };
await page.close();
await browser.close();

console.error(`${nb} built-in, ${nl} legacy, ${ns} saved presets; ${errors.length} page errors`);
for (const e of errors) console.error('  error:', e);
if (!baseline) { console.log(JSON.stringify(out, null, 1)); process.exit(errors.length ? 1 : 0); }
let bad = errors.length;
for (const k of new Set([...Object.keys(baseline), ...Object.keys(out)])) {
  const a = baseline[k], b = out[k];
  if (!a || !b) { console.error(`${k}: ${a ? 'missing now' : 'new'}`); bad++; continue; }
  for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) { console.error(`${k}: ${f} differs`); bad++; }
  }
}
console.error(bad ? `${bad} differences` : 'all the same as the baseline');
process.exit(bad ? 1 : 0);
