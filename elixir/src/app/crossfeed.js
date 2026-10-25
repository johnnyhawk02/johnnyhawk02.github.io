// ---- crossfeed matrix ----
const XN = ['drum 1', 'drum 2', 'drum 3', 'snare', 'cymbal', 'hihat'];
const xm = { amt: new Array(36).fill(0), target: ['fm', 'fm', 'fm', 'filter', 'fm', 'ring'] };
const xgrid = $('xgrid');
const xDepth = () => Number($('xdepth').value) / 100;
const sendX = () => send({ type: 'xmod', amt: xm.amt.map((a) => a / 100 * xDepth()), target: xm.target.slice() });
xgrid.appendChild(document.createElement('span'));
XN.forEach((name, d) => {
  const col = document.createElement('div'); col.className = 'col';
  col.innerHTML = `<span class="full">${name}</span><span class="short">${['d1', 'd2', 'd3', 'sn', 'cy', 'hh'][d]}</span>`;
  const sel = document.createElement('select'); sel.setAttribute('aria-label', `What crossfeed into ${name} modulates`);
  for (const t of ['fm', 'filter', 'ring']) sel.appendChild(new Option(t, t));
  sel.value = xm.target[d];
  sel.addEventListener('change', () => { xm.target[d] = sel.value; sendX(); });
  col.appendChild(sel); xgrid.appendChild(col);
});
const xcells = [];
XN.forEach((src, sIdx) => {
  const lab = document.createElement('span'); lab.className = 'lab'; lab.innerHTML = `<span class="full">${src}</span><span class="short">${['d1', 'd2', 'd3', 'sn', 'cy', 'hh'][sIdx]}</span>`; xgrid.appendChild(lab);
  XN.forEach((dst, d) => {
    const k = sIdx * 6 + d, c = document.createElement('button');
    c.type = 'button'; c.className = 'xcell' + (sIdx === d ? ' diag' : ''); c.setAttribute('role', 'slider');
    c.setAttribute('aria-label', `${src} into ${dst}`); c.setAttribute('aria-valuemin', -100); c.setAttribute('aria-valuemax', 100);
    const draw = () => {
      const a = xm.amt[k], col = a >= 0 ? 'var(--blue)' : 'var(--led)';
      // the cell fills up like a level meter: blue for positive, red for negative amounts
      const h = Math.abs(a);
      c.style.background = a ? `linear-gradient(to top, ${col} ${h}%, color-mix(in srgb, var(--ink) 7%, transparent) ${h}%)` : '';
      c.style.color = h > 60 ? '#fff' : '';
      c.textContent = a ? String(a) : '';
      c.setAttribute('aria-valuenow', a);
    };
    const set = (v) => { v = Math.max(-100, Math.min(100, Math.round(v))); if (v === xm.amt[k]) return; xm.amt[k] = v; draw(); sendX(); };
    dragY(c, () => xm.amt[k], set, 1.2);
    stepKeys(c, () => xm.amt[k], set, { small: 5, big: 25, wheel: 5 });
    c.addEventListener('keydown', (e) => { if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '0') set(0); });
    c.addEventListener('dblclick', () => set(0));
    draw(); xcells.push(draw); xgrid.appendChild(c);
  });
});
$('xclear').addEventListener('click', () => { xm.amt.fill(0); xcells.forEach((d) => d()); sendX(); });
$('xdepth').addEventListener('input', () => { $('xdepth-out').textContent = $('xdepth').value + '%'; sendX(); });
// a sparse random patch: 3 to 6 connections, mostly positive, and a fresh target for each column that gets one
const xSelects = [...xgrid.querySelectorAll('select')];
function randomiseX() {
  xm.amt.fill(0);
  const n = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(rnd() * 36);
    xm.amt[k] = (rnd() < 0.3 ? -1 : 1) * 5 * Math.round((25 + rnd() * 75) / 5);
  }
  for (let d = 0; d < 6; d++) {
    if (![0, 1, 2, 3, 4, 5].some((sIdx) => xm.amt[sIdx * 6 + d])) continue;
    const r = rnd();
    xm.target[d] = r < 0.5 ? 'fm' : r < 0.75 ? 'filter' : 'ring';
    xSelects[d].value = xm.target[d];
  }
  xcells.forEach((d) => d()); sendX();
}
$('xrand').addEventListener('click', async () => { await startAudio(); randomiseX(); setDirty(true); });
$('xrand2').addEventListener('click', () => $('xrand').click());

