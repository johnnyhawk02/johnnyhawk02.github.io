// Each style's fill, over the last `len` steps of the fill bar: it returns the hits (track x step) and the
// tracks that give way to it there. A crash marks the first bar after each fill.
const blankFill = () => Array.from({ length: 7 }, () => new Array(16).fill(0));
const STYLES = [
  { name: 'electro', grooves: GROOVES, fill(f) {
    // snare roll (16ths when busy, 8ths otherwise), toms falling from high to low in the gaps, a kick to start it
    const on = blankFill(), start = 16 - f.len;
    for (let s = start; s < 16; s++) {
      const r = s - start, half = r < f.len / 2;
      if (r % 2 === 0 || f.busy && s >= 14) on[3][s] = 1;
      else on[half ? 2 : 1][s] = 1;
    }
    on[0][start] = 1;
    if (!f.busy) on[1][15] = 1;
    return { on, yields: [0, 1, 2, 3] };
  } },
  { name: 'techno', grooves: TECHNO, fill(f) {
    // a snare build (8ths, or 16ths when busy) with an open hat at the end; a busy fill drops the kick out
    const on = blankFill(), start = 16 - f.len;
    for (let s = start; s < 16; s++) if (f.busy || (s - start) % 2 === 0) on[3][s] = 1;
    on[6][15] = 1;
    return { on, yields: f.busy ? [0, 1, 2, 3] : [1, 2, 3] };
  } },
  { name: 'broken beat', grooves: BROKEN, fill(f) {
    // threes across the bar: snare, a kick when busy, then a tom (high, then low)
    const on = blankFill(), start = 16 - f.len;
    for (let s = start; s < 16; s++) {
      const r = s - start;
      if (r % 3 === 0) on[3][s] = 1;
      else if (r % 3 === 2) on[r < f.len / 2 ? 2 : 1][s] = 1;
      else if (f.busy) on[0][s] = 1;
    }
    on[0][start] = 1;
    if (f.busy) on[3][15] = 1;
    return { on, yields: [0, 1, 2, 3] };
  } },
  { name: 'IDM', grooves: IDM, fill(f) {
    // a stutter: the kick repeats through the first half and the snare through the second (every 16th when busy,
    // 8ths otherwise), with the high tom on the last step; a busy fill cuts the closed hat too
    const on = blankFill(), start = 16 - f.len;
    for (let s = start; s < 16; s++) {
      const r = s - start;
      if (!f.busy && r % 2 && f.len > 2) continue;
      on[r < f.len / 2 ? 0 : 3][s] = 1;
    }
    on[2][15] = 1;
    return { on, yields: f.busy ? [0, 1, 2, 3, 5] : [0, 1, 2, 3] };
  } },
];
let styleIdx = 0; // saved with presets by name; presets from before the styles were electro
// user: patterns saved from the steps tab (up to 16, in localStorage). Beat spreads them over its range;
// energy brings hits in by their place (kick and snare on the beat or accented first, then hats, then the rest,
// the whole pattern from 50%), and fills plays the electro fill over it. Each keeps its accents and bar conditions.
let userPats = [];
try { userPats = JSON.parse(localStorage.getItem('elexir-user-patterns') || '[]'); } catch (e) {}
const storeUserPats = () => { try { localStorage.setItem('elexir-user-patterns', JSON.stringify(userPats)); } catch (e) {} };
const userSlot = () => Math.min(userPats.length - 1, Math.floor(Number($('beat').value) * userPats.length / 16));
const slotBeat = (i) => Math.ceil(i * 16 / userPats.length);
function userGroove(u) {
  const g = { name: u.name, cond: u.bar, acc: u.acc };
  ROW.forEach((r, t) => {
    g[r] = u.on[t].map((on, s) => !on ? '.' : String(t === 0 || t === 3 ? (s % 4 === 0 || u.acc[t][s] ? 1 : 3) : t === 5 ? (s % 2 ? 4 : 2) : t === 1 || t === 2 ? 5 : 4));
  });
  return g;
}
const EMPTY_GROOVE = { name: 'none saved', ...Object.fromEntries(['k', 'lo', 'hi', 's', 'cy', 'ch', 'oh'].map((r) => [r, '................'])) };
STYLES.push({ name: 'user', user: true,
  get grooves() { const gs = userPats.map(userGroove); return new Proxy(gs, { get: (a, k) => (/^\d+$/.test(k) ? (a.length ? a[userSlot()] : EMPTY_GROOVE) : a[k]) }); },
  fill: STYLES[0].fill });
const userStyle = () => STYLES.findIndex((st) => st.user);
// a user pattern is page 1 (on, acc, bar) plus, when there are more, all its pages
const copyGrid = () => ({ ...copyPage(pages[0]), pages: pageCount > 1 ? pages.slice(0, pageCount).map(copyPage) : undefined });
const sameGrid = (a, b) => ['on', 'acc', 'bar', 'pages'].every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
// make a pattern (from a preset) one of the user patterns, unless it already is; returns its slot
function ensureUserPat(u) {
  let i = userPats.findIndex((x) => sameGrid(x, u));
  if (i < 0 && userPats.length < 16) {
    const names = new Set(userPats.map((x) => x.name));
    userPats.push({ name: names.has(u.name) || !u.name ? nextUserName() : u.name, on: u.on, acc: u.acc, bar: u.bar, pages: u.pages }); storeUserPats(); i = userPats.length - 1;
  }
  return i;
}
// user patterns get a one-word alien name, like the preset names but single
function nextUserName() {
  for (let i = 0; i < 50; i++) { const n = alienName().replace(/'/g, ''); if (!userPats.some((x) => x.name === n)) return n; }
  return alienName();
}
function useUserSlot(i) { setStyle(userStyle()); $('beat').value = slotBeat(i); $('beat').dispatchEvent(new Event('sync')); }
function drawUserTools() {
  const on = STYLES[styleIdx].user && userPats.length > 0;
  $('up-cur').textContent = on ? `${userPats[userSlot()].name} · ${userSlot() + 1}/${userPats.length}` : userPats.length ? `${userPats.length} saved` : '';
  $('up-over').disabled = $('up-del').disabled = !on;
  $('up-save').disabled = userPats.length >= 16;
}
$('up-save').addEventListener('click', () => {
  if (userPats.length >= 16) return;
  userPats.push({ name: nextUserName(), ...copyGrid() }); storeUserPats();
  useUserSlot(userPats.length - 1); drawUserTools();
});
$('up-over').addEventListener('click', () => {
  if (!STYLES[styleIdx].user || !userPats.length) return;
  Object.assign(userPats[userSlot()], copyGrid()); storeUserPats(); drawUserTools();
});
$('up-del').addEventListener('click', () => {
  if (!STYLES[styleIdx].user || !userPats.length) return;
  const i = userSlot(); userPats.splice(i, 1); storeUserPats();
  if (userPats.length) useUserSlot(Math.min(i, userPats.length - 1));
  drawUserTools();
});
const styleIndex = (name) => Math.max(0, STYLES.findIndex((st) => st.name === name));
function setStyle(i) {
  styleIdx = (i + STYLES.length) % STYLES.length;
  $('style-name').textContent = STYLES[styleIdx].name;
  drawUserTools();
}
const ROW = ['k', 'lo', 'hi', 's', 'cy', 'ch', 'oh'];
const ENERGY_NAMES = [[1, 'empty'], [15, 'minimal'], [35, 'low'], [60, 'groove'], [85, 'driving'], [101, 'peak']];
function fillShape(fills) {
  if (!fills) return null;
  return { every: fills < 34 ? 8 : fills < 67 ? 4 : 2, len: 2 * Math.round(1 + fills / 100 * 3), busy: fills >= 50 };
}
function generate() {
  const st = STYLES[styleIdx], energy = Number($('energy').value), g = st.grooves[Number($('beat').value)], fills = Number($('fills').value);
  const T = energy ? 1 + energy / 100 * 8 : 0, fill = T >= 2 ? fillShape(fills) : null; // fills once there is a groove
  const { on: fillOn, yields } = fill ? st.fill(fill) : { on: blankFill(), yields: [] };
  const u = st.user && userPats.length ? userPats[userSlot()] : null;
  if (u && u.pages) {
    pattern.pages = u.pages.map((pg) => { const P = blankPage(); genPage(userGroove({ name: u.name, ...pg }), P, energy, T, fill, fillOn, yields); return P; });
    copyInto(pattern, pattern.pages[0]);
  } else { delete pattern.pages; genPage(g, pattern, energy, T, fill, fillOn, yields); }
  $('energy-out').innerHTML = `<b>${ENERGY_NAMES.find(([v]) => energy < v)[1]}</b> · ${energy}%`;
  $('beat-out').innerHTML = `<b>${g.name.toLowerCase()}</b> · ${st.user ? (st.grooves.length ? userSlot() + 1 : 0) : Number($('beat').value) + 1}/${st.grooves.length}`;
  $('fills-out').innerHTML = fill ? `<b>every ${fill.every}</b> · ${fill.len} steps` : `<b>off</b>`;
  sendSeq();
}
function genPage(g, pattern, energy, T, fill, fillOn, yields) {
  for (const a of [pattern.on, pattern.acc, pattern.bar]) a.forEach((r) => r.fill(0));
  for (let t = 0; t < 7; t++) {
    const lv = g[ROW[t]], alt = (g.alt && g.alt[ROW[t]]) || '';
    for (let s = 0; s < 16; s++) {
      const c = lv[s], reg = c !== '.' && Number(c) <= T;
      const win = fill && s >= 16 - fill.len, inFill = win && yields.includes(t); // these tracks give way to the fill
      const fil = !!fillOn[t][s];
      let on = 0, cond = 0;
      if (inFill) { if (reg && fil) on = 1; else if (reg) { on = 1; cond = -fill.every; } else if (fil) { on = 1; cond = fill.every; } }
      else if (reg) { on = 1; cond = g.cond ? g.cond[t][s] : 0; }
      else if (win && fil) { on = 1; cond = fill.every; }
      // the second bar's extra hits, outside the fill
      else if (!win && alt[s] && alt[s] !== '.' && Number(alt[s]) <= T) { on = 1; cond = 2; }
      // crash on the first bar after each fill, once there is enough energy
      if (fill && t === 4 && s === 0 && !on && T >= 3) { on = 1; cond = 100 + fill.every; }
      pattern.on[t][s] = on; pattern.bar[t][s] = cond;
      pattern.acc[t][s] = on && ((g.acc ? reg && !!g.acc[t][s] : c === '1' && energy >= 55) || (t === 6 && energy >= 85) || (fil && cond > 0 && (s % 4 === 0 || s === 15))) ? 1 : 0;
    }
  }
}
