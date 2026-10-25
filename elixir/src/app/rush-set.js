// ---- snare rush settings: the rush's break points and glides, in a popup opened from the button above the dial ----
// Saved with each preset (song.rushSet) and kept in this browser as the working values between reloads; the defaults are the player's own (Player.rs)
const RUSH_DFLT = { start: 75, p32: 80, top: 4, hats: 80, only: 98, kicks: 90, first: 95, hp: 90, hpTop: 1500, rollMs: 40, hpMs: 40 };
const rushSet = { ...RUSH_DFLT };
const saveRushSet = () => { try { localStorage.setItem('elexir-rush', JSON.stringify(rushSet)); } catch (e) { /* not kept */ } };
// straight to the player, not held for the bar like a preset
function sendRushSet() {
  const m = { type: 'rushSet', set: { ...rushSet } };
  if (node) node.port.postMessage(m); else if (fallback) fallback.msg(m); else pending.push(m);
}
// [key, label, min, max, step, readout]; the clamps keep the break points in order
const pct = (v) => `${v}%`, ms = (v) => `${v} ms`;
const RUSH_ROWS = [
  ['roll'],
  ['start', 'roll starts (16ths)', 0, 98, 1, pct],
  ['p32', '1/32 point, free roll from', 1, 99, 1, pct],
  ['top', 'top speed at 100%'],
  ['rollMs', 'roll glide', 0, 500, 5, ms],
  ['drums'],
  ['hats', 'hats gone by', 1, 100, 1, pct],
  ['only', 'only snare from', 1, 100, 1, pct],
  ['kicks', 'all four beat kicks until', 0, 100, 1, pct],
  ['first', 'first kick only until', 0, 100, 1, pct],
  ['filter'],
  ['hp', 'filter starts', 0, 99, 1, pct],
  ['hpTop', 'filter top cutoff', 300, 5000, 50, (v) => (v < 1000 ? `${v} Hz` : `${+(v / 1000).toFixed(2)} kHz`)],
  ['hpMs', 'filter glide', 0, 500, 5, ms],
];
const rushClamp = { start: (v) => Math.min(v, rushSet.p32 - 1), p32: (v) => Math.max(v, rushSet.start + 1),
  kicks: (v) => Math.min(v, rushSet.first), first: (v) => Math.max(v, rushSet.kicks) };
// settings from a preset or storage: the defaults, then each known value rounded to its step, in range and in order
function setRushSet(src) {
  Object.assign(rushSet, RUSH_DFLT);
  const ok = (v) => typeof v === 'number' && Number.isFinite(v);
  for (const [k, label, min, max, step] of RUSH_ROWS) {
    if (!label || !src || !ok(src[k])) continue;
    rushSet[k] = k === 'top' ? Math.min(4, Math.max(2, Math.round(src[k]))) : Math.min(max, Math.max(min, Math.round(src[k] / step) * step));
  }
  if (rushSet.p32 <= rushSet.start) { rushSet.p32 = Math.min(99, rushSet.start + 1); rushSet.start = rushSet.p32 - 1; }
  if (rushSet.first < rushSet.kicks) rushSet.first = rushSet.kicks;
}
try { setRushSet(JSON.parse(localStorage.getItem('elexir-rush') || '{}')); } catch (e) { /* defaults */ }
// a preset's settings: they replace the working ones, here and in the player
function useRushSet(src) {
  setRushSet(src); saveRushSet(); sendRushSet();
  if (rushDlg.open) rushDraws.forEach((d) => d());
}
const rushDraws = [];
for (const [k, label, min, max, step, show] of RUSH_ROWS) {
  const box = $('rs-opts');
  if (!label) { box.insertAdjacentHTML('beforeend', `<h3>${k}</h3>`); continue; }
  const lab = document.createElement('label'); lab.className = 'rlab'; lab.textContent = label; lab.htmlFor = 'rs-' + k;
  box.append(lab);
  if (k === 'top') {
    const r = document.createElement('div'); r.className = 'radios'; r.id = 'rs-' + k; box.append(r);
    const draw = () => radios(r, 'rs-top', ['1/64', '1/128', '1/256'], () => rushSet.top - 2, (i) => { rushSet.top = i + 2; saveRushSet(); sendRushSet(); });
    draw(); rushDraws.push(draw); continue;
  }
  const inp = document.createElement('input'), out = document.createElement('output');
  Object.assign(inp, { type: 'range', id: 'rs-' + k, min, max, step });
  box.append(inp, out);
  const draw = () => { inp.value = rushSet[k]; out.textContent = show(rushSet[k]); };
  inp.addEventListener('input', () => {
    const v = rushClamp[k] ? rushClamp[k](Number(inp.value)) : Number(inp.value);
    rushSet[k] = v; draw(); saveRushSet(); sendRushSet();
  });
  draw(); rushDraws.push(draw);
}
sendRushSet();
const rushDlg = $('rush-set'), rushBtn = document.createElement('button');
Object.assign(rushBtn, { type: 'button', className: 'btn ghost rs-open', textContent: 'set', title: 'Snare rush settings: break points and glides' });
rushBtn.setAttribute('aria-haspopup', 'dialog');
$('pk-pattern').querySelector('[data-k="rush"]').append(rushBtn);
rushBtn.addEventListener('click', () => { rushDraws.forEach((d) => d()); rushDlg.showModal(); });
$('rush-set-close').addEventListener('click', () => rushDlg.close());
rushDlg.addEventListener('click', (e) => { if (e.target === rushDlg) rushDlg.close(); });
$('rs-reset').addEventListener('click', () => { Object.assign(rushSet, RUSH_DFLT); rushDraws.forEach((d) => d()); saveRushSet(); sendRushSet(); });
