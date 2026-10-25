// ---- sequencer: per step on, accent and bar condition (0 = every bar, 2 or 4) ----
const blank = () => Array.from({ length: 7 }, () => new Array(16).fill(0));
const pattern = { on: blank(), acc: blank(), bar: blank() }; // the perform tab's pattern, built by the generator
// the steps tab's own grid: it plays while that tab is open, and only takes the perform pattern in on "grab from perform"
// It has up to 8 pages of 16 steps, played one bar each in turn; `grid` is the page being edited
const blankPage = () => ({ on: blank(), acc: blank(), bar: blank() });
const pages = Array.from({ length: 8 }, blankPage);
let grid = pages[0], editPage = 0, pageCount = 1;
const copyInto = (dst, src) => { for (const k of ['on', 'acc', 'bar']) src[k].forEach((r, t) => dst[k][t].splice(0, 16, ...r)); };
const copyPage = (P) => ({ on: P.on.map((r) => r.slice()), acc: P.acc.map((r) => r.slice()), bar: P.bar.map((r) => r.slice()) });
// example beat to start from: [track, steps, accented steps, {step: bar}]
[[0, [0, 7, 10], [0], { 13: 4 }], [1, [14], [], { 14: 2 }], [2, [11, 15], [], { 15: 4 }], [3, [4, 12], [12], {}], [4, [0], [], { 0: 4 }],
  [5, [2, 6, 8, 10, 14], [6, 14], {}], [6, [15], [], { 15: 2 }]]
  .forEach(([t, steps, acc, bars]) => {
    steps.forEach((s) => { grid.on[t][s] = 1; });
    acc.forEach((s) => { grid.acc[t][s] = 1; });
    for (const [s, b] of Object.entries(bars)) { grid.on[t][s] = 1; grid.bar[t][s] = b; }
  });
const gridEl = $('grid');
const cells = [];
let mode = 'step';
let barCond = 2; // the trig condition a click sets while a trig button is down
function setMode(m, cond) {
  mode = m; if (cond !== undefined) barCond = cond;
  document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.mode === m));
  document.querySelectorAll('[data-cond]').forEach((x) => x.setAttribute('aria-pressed', m === 'bar' && Number(x.dataset.cond) === barCond));
}
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
document.querySelectorAll('[data-cond]').forEach((b) => b.addEventListener('click', () => setMode('bar', Number(b.dataset.cond))));
// every bar condition the generators and presets use: n plays on the last bar of every n (the fill bar),
// ≠n on every bar but that one, 1/n only on the first bar of every n (the bar after a fill)
const BAR_CONDS = [[2, 'bar 2 of 2'], [4, 'bar 4 of 4'], [8, 'bar 8 of 8'], [-2, 'not bar 2 of 2'], [-4, 'not bar 4 of 4'], [-8, 'not bar 8 of 8'],
  [102, 'bar 1 of 2'], [104, 'bar 1 of 4'], [108, 'bar 1 of 8']];
const barText = (b) => (b > 100 ? `1/${b - 100}` : b < 0 ? `≠${-b}` : String(b));
function drawCell(r, s) {
  const c = cells[r][s], on = !!grid.on[r][s], acc = on && !!grid.acc[r][s], bar = on ? grid.bar[r][s] : 0;
  c.classList.toggle('on', on); c.classList.toggle('acc', acc);
  c.textContent = bar ? barText(bar) : '';
  c.setAttribute('aria-pressed', on);
  const cond = bar ? ', ' + (BAR_CONDS.find(([v]) => v === bar) || [0, 'bar ' + barText(bar)])[1] : '';
  c.setAttribute('aria-label', `${TRACKS[r].name} step ${s + 1}` + (acc ? ', accent' : '') + cond);
}
function clickCell(r, s, e) {
  const m = e.metaKey || e.ctrlKey ? 'cycle' : e.shiftKey ? 'acc' : mode;
  const P = grid;
  if (m === 'step') { P.on[r][s] ^= 1; if (!P.on[r][s]) { P.acc[r][s] = 0; P.bar[r][s] = 0; } }
  else if (m === 'acc') { if (!P.on[r][s]) { P.on[r][s] = 1; P.acc[r][s] = 1; } else P.acc[r][s] ^= 1; }
  else if (m === 'cycle') { // Cmd-click steps through every condition, then back to every bar
    const seq = [0, ...BAR_CONDS.map(([v]) => v)];
    if (!P.on[r][s]) { P.on[r][s] = 1; P.bar[r][s] = seq[1]; } else P.bar[r][s] = seq[(seq.indexOf(P.bar[r][s]) + 1) % seq.length];
  } else { // with a trig button down, a click sets that condition (again: back to every bar)
    const b = barCond;
    if (!P.on[r][s]) { P.on[r][s] = 1; P.bar[r][s] = b; } else P.bar[r][s] = P.bar[r][s] === b ? 0 : b;
  }
  drawCell(r, s); sendSeq();
}
for (let i = 0; i < 17; i++) gridEl.appendChild(document.createElement('span'));
TRACKS.forEach((t, r) => {
  const name = document.createElement('button');
  name.className = 'row-name' + (r === track ? ' active' : ''); name.type = 'button'; name.textContent = t.name;
  name.addEventListener('click', () => { selectTrack(r); setTab('sound'); });
  gridEl.appendChild(name);
  cells[r] = [];
  for (let s = 0; s < 16; s++) {
    const c = document.createElement('button');
    c.type = 'button'; c.className = 'cell' + (s % 4 === 0 ? ' q' : '');
    c.addEventListener('click', (e) => clickCell(r, s, e));
    c.addEventListener('contextmenu', (e) => { if (e.ctrlKey) e.preventDefault(); }); // macOS ctrl-click
    gridEl.appendChild(c);
    cells[r][s] = c;
    drawCell(r, s);
  }
});
// the groove on the steps tab: the same type and depth as the perform faders
const grooveSel = $('groove-type'), grooveDepth = $('gdepth');
GROOVE_TYPES.forEach((g, i) => grooveSel.appendChild(new Option(g.name, i)));
function drawGroove() {
  grooveSel.value = grooveIdx(); grooveDepth.value = groove.depth; $('gdepth-out').textContent = groove.depth + '%';
  drawPerf();
}
grooveSel.addEventListener('change', () => setPerf('groove', Number(grooveSel.value)));
grooveDepth.addEventListener('input', () => setPerf('depth', Number(grooveDepth.value)));
let playing = false, nowStep = -1;
let patternOn = true; // off: the sequencer stays quiet and MIDI notes play the voices
let source = 'perform'; // what plays: the perform pattern, the steps grid, or off (MIDI in); saved with presets
function sendSeq() {
  const P = source === 'steps' ? { ...copyPage(pages[0]), pages: pageCount > 1 ? pages.slice(0, pageCount).map(copyPage) : undefined }
    : { ...copyPage(pattern), pages: pattern.pages ? pattern.pages.map(copyPage) : undefined };
  send({ type: 'seq', pattern: P,
    bpm: perf.tempo, vel: perf.vel, patternOn, groove: grooveMsg(), accentDb: perf.accent, playing });
}
$('play').addEventListener('click', async () => {
  await startAudio();
  playing = !playing;
  $('play').setAttribute('aria-pressed', playing); $('play').textContent = playing ? 'STOP' : 'PLAY';
  if (!playing) { markStep(-1); markBar(-1); grVu.set(0); duckVu.set(0); }
  sendSeq();
});
$('grab').addEventListener('click', () => {
  // a single-page perform pattern lands on the page being edited; a paged one (a user pattern) replaces the pages
  if (pattern.pages) { pattern.pages.forEach((P, i) => copyInto(pages[i], P)); pageCount = pattern.pages.length; editPage = Math.min(editPage, pageCount - 1); grid = pages[editPage]; }
  else copyInto(grid, pattern);
  drawGrid(); sendSeq();
});
const drawGrid = () => { cells.forEach((row, r) => row.forEach((_, s) => drawCell(r, s))); drawPages(); };
function drawPages() {
  document.querySelectorAll('[data-page]').forEach((b) => {
    const i = Number(b.dataset.page);
    b.setAttribute('aria-pressed', i === editPage); b.classList.toggle('off', i >= pageCount);
  });
  $('page-len').value = pageCount;
}
function setPageCount(n) {
  // new pages start as copies of the last one
  for (let i = pageCount; i < n; i++) copyInto(pages[i], pages[pageCount - 1]);
  pageCount = n; if (editPage >= n) { editPage = n - 1; grid = pages[editPage]; }
  drawGrid(); sendSeq();
}
document.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => {
  const i = Number(b.dataset.page);
  if (i >= pageCount) setPageCount(i + 1);
  editPage = i; grid = pages[i]; drawGrid();
}));
$('page-len').addEventListener('change', () => setPageCount(Number($('page-len').value)));
// expand: bake the bar conditions into 2, 4 or 8 pages (page n is bar n), then every step plays on every bar of its page
document.querySelectorAll('[data-expand]').forEach((b) => b.addEventListener('click', () => {
  const src = pages.slice(0, pageCount).map(copyPage), n = Number(b.dataset.expand);
  for (let p = 0; p < n; p++) {
    const S = src[p % src.length], D = pages[p];
    for (let t = 0; t < 7; t++) for (let s = 0; s < 16; s++) {
      const on = S.on[t][s] && barOk(S.bar[t][s], p);
      D.on[t][s] = on ? 1 : 0; D.acc[t][s] = on ? S.acc[t][s] : 0; D.bar[t][s] = 0;
    }
  }
  pageCount = n; if (editPage >= n) { editPage = 0; grid = pages[0]; }
  drawGrid(); sendSeq();
}));
$('clear').addEventListener('click', () => {
  for (const a of [grid.on, grid.acc, grid.bar]) a.forEach((r) => r.fill(0));
  cells.forEach((row, r) => row.forEach((_, s) => drawCell(r, s)));
  sendSeq();
});
