// ---- Faderfox PC4: 24 knobs (CC 1-24, four rows of six), each can drive one perform control ----
const PC4_CTRL = [
  { id: 'energy', label: 'energy', perf: 'energy' },
  { id: 'beat', label: 'beat', perf: 'beat' },
  { id: 'fills', label: 'fills', perf: 'fills' },
  { id: 'tempo', label: 'tempo', perf: 'tempo' },
  { id: 'velocity', label: 'velocity', perf: 'vel' },
  { id: 'accent', label: 'accent', perf: 'accent' },
  { id: 'swing', label: 'swing', perf: 'swing' },
  { id: 'fm', label: 'fm depth', macro: 'fm', min: 0, max: 200 },
  { id: 'decay', label: 'decay', macro: 'decay', min: 0, max: 200 },
  { id: 'pitch', label: 'pitch', macro: 'pitch', min: 0, max: 48 },
  { id: 'filter', label: 'filter', macro: 'filter', min: 0, max: 200 },
];
const PC4_DEFAULT = [...PC4_CTRL.map((c) => c.id), ...Array(24 - PC4_CTRL.length).fill(null)]; // knob n = CC n
const pc4Ctrl = (id) => PC4_CTRL.find((c) => c.id === id);
const pc4Range = (c) => (c.macro ? [c.min, c.max] : PERF_RANGE[c.perf].slice(0, 2));
const pc4Read = (c) => (c.macro ? macro[c.macro] : perfGet(c.perf));
// the same writes the on-screen knobs make
function pc4Write(c, v) {
  if (c.macro) { setMacro(c.macro, v); drawMacros(); } else setPerf(c.perf, v);
}
let pc4Map = [...PC4_DEFAULT];
try { const s = JSON.parse(localStorage.getItem('elexir-pc4')); if (Array.isArray(s) && s.length === 24) pc4Map = s; } catch (e) { /* no storage: the default map */ }
const pc4Save = () => { try { localStorage.setItem('elexir-pc4', JSON.stringify(pc4Map)); } catch (e) { /* not kept */ } };
let pc4Sel = null; // a control picked from the tiles, waiting for a click on a knob
const pc4Knobs = [], pc4TileEls = {};
const pc4Grid = $('pc4-grid'), pc4Tiles = $('pc4-tiles');
for (let n = 1; n <= 24; n++) {
  const el = document.createElement('div');
  el.className = 'pc4-knob'; el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-label', `knob CC ${n}`);
  el.innerHTML = '<span class="pc4-cc">CC ' + n + '</span><span class="pc4-dial"><span class="pc4-ptr"></span></span><span class="pc4-label"></span>';
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); pc4Assign(n, e.dataTransfer.getData('text/plain') || pc4Sel); });
  el.addEventListener('click', () => { if (pc4Sel) pc4Assign(n, pc4Sel); });
  el.addEventListener('dblclick', () => pc4Assign(n, null));
  el.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && pc4Sel) { e.preventDefault(); pc4Assign(n, pc4Sel); } });
  pc4Grid.append(el); pc4Knobs.push(el);
}
for (const c of PC4_CTRL) {
  const t = document.createElement('div');
  t.className = 'pc4-tile'; t.draggable = true; t.tabIndex = 0; t.setAttribute('role', 'button');
  t.innerHTML = '<span class="pc4-tname"></span><span class="pc4-badge"></span>';
  t.querySelector('.pc4-tname').textContent = c.label;
  t.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'copy'; });
  t.addEventListener('dragend', () => { pc4Sel = null; drawPc4(); });
  t.addEventListener('click', () => { pc4Sel = pc4Sel === c.id ? null : c.id; drawPc4(); });
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); } });
  pc4Tiles.append(t); pc4TileEls[c.id] = t;
}
function pc4Assign(n, id) {
  pc4Sel = null;
  if (id) pc4Map = pc4Map.map((x, i) => (x === id && i !== n - 1 ? null : x)); // a control sits on one knob at a time
  pc4Map[n - 1] = id || null;
  pc4Save(); drawPc4();
}
// the knob's pointer shows where its control is now
function pc4Point(n) {
  const c = pc4Ctrl(pc4Map[n - 1]);
  let t = 0;
  if (c) { const [lo, hi] = pc4Range(c); t = (pc4Read(c) - lo) / ((hi - lo) || 1); }
  pc4Knobs[n - 1].querySelector('.pc4-ptr').style.transform = `rotate(${-135 + 270 * Math.min(1, Math.max(0, t))}deg)`;
}
function drawPc4() {
  pc4Knobs.forEach((el, i) => {
    const c = pc4Ctrl(pc4Map[i]);
    el.classList.toggle('empty', !c);
    el.querySelector('.pc4-label').textContent = c ? c.label : 'empty';
    pc4Point(i + 1);
  });
  for (const c of PC4_CTRL) {
    const t = pc4TileEls[c.id], n = pc4Map.indexOf(c.id);
    t.classList.toggle('used', n >= 0); t.classList.toggle('sel', pc4Sel === c.id);
    t.querySelector('.pc4-badge').textContent = n >= 0 ? `CC ${n + 1}` : '';
  }
}
function pc4Midi(cc, val) {
  if (cc < 1 || cc > 24) return;
  const c = pc4Ctrl(pc4Map[cc - 1]);
  if (c) { const [lo, hi] = pc4Range(c); pc4Write(c, Math.round(lo + (hi - lo) * val / 127)); }
  pc4Point(cc);
  const el = pc4Knobs[cc - 1];
  el.classList.add('hit'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('hit'), 120);
}
const pc4Dlg = $('pc4');
$('pc4-open').addEventListener('click', () => { drawPc4(); pc4Dlg.showModal(); startMidi(); });
$('pc4-close').addEventListener('click', () => pc4Dlg.close());
pc4Dlg.addEventListener('click', (e) => { if (e.target === pc4Dlg) pc4Dlg.close(); }); // a click on the backdrop
pc4Dlg.addEventListener('close', () => { pc4Sel = null; });
$('pc4-reset').addEventListener('click', () => { pc4Map = [...PC4_DEFAULT]; pc4Save(); drawPc4(); });
drawPc4();
if (pc4Map.some(Boolean)) startMidi(); // the mapped knobs work from load, not just with the popup open

