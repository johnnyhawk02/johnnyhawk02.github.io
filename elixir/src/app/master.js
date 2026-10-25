// ---- master: compressor and drum 1 sidechain, each in its own card with an on button ----
const RATIOS = [1.5, 2, 3, 4, 6, 8, 20];
const mKnob = (label, key, lo, hi, step, show, box) => box.appendChild(dialKnob(label, {
  max: Math.round((hi - lo) / step), show: (v) => show(lo + v * step), get: () => Math.round((master[key] - lo) / step),
  set: (v) => { master[key] = lo + v * step; sendMix(); }, dflt: () => Math.round((MASTER0[key] - lo) / step) }));
// an analogue-style needle meter: rests at 0 on the right and swings left by the dB pulled down (to 20),
// on a log-ish scale, with a damped spring for the needle so it moves like a real one
const meterVu = (name, aria) => {
  const el = document.createElement('div'); el.className = 'vu';
  const CX = 30, CY = 47, pos = (db) => Math.log1p(Math.max(0, Math.min(20, db))) / Math.log1p(20), ang = (db) => 40 - 80 * pos(db);
  const pt = (db, r) => { const a = ang(db) * Math.PI / 180; return [(CX + r * Math.sin(a)).toFixed(2), (CY - r * Math.cos(a)).toFixed(2)]; };
  const arc = (a, b, r) => { const [x0, y0] = pt(a, r), [x1, y1] = pt(b, r); return `M${x0} ${y0}A${r} ${r} 0 0 0 ${x1} ${y1}`; };
  let tk = '';
  for (const d of [0, 1, 2, 3, 4, 6, 8, 10, 15, 20]) { const big = [0, 4, 10, 20].includes(d), [x0, y0] = pt(d, 33), [x1, y1] = pt(d, big ? 29.5 : 31); tk += `<line class="tk" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`; }
  for (const d of [0, 4, 10, 20]) { const [x, y] = pt(d, 37.5); tk += `<text x="${x}" y="${(+y + 1.8).toFixed(2)}">${d}</text>`; }
  const clip = 'vuc' + (++meterVu.n);
  el.innerHTML = `<span>${name}</span><svg viewBox="0 0 60 40" role="img" aria-label="${aria}">
    <defs><clipPath id="${clip}"><rect x="1" y="1" width="58" height="38" rx="3.5"/></clipPath></defs>
    <rect class="face" x=".5" y=".5" width="59" height="39" rx="4"/>
    <g clip-path="url(#${clip})"><path class="scale" d="${arc(0, 20, 33)}"/><path class="hot" d="${arc(10, 20, 33.8)}"/>${tk}
    <text class="unit" x="30" y="29">dB</text><line class="needle" x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - 35}" transform="rotate(40 ${CX} ${CY})"/>
    <circle class="hub" cx="${CX}" cy="${CY}" r="10"/></g></svg>`;
  const needle = el.querySelector('.needle');
  let x = 0, v = 0, target = 0, last = 0, raf = 0;
  // quick to swing out, slower to fall back, with a touch of overshoot
  const UP = 2 * Math.PI * 3.4, DOWN = 2 * Math.PI * 1.6, Z = 0.72;
  const tick = (t) => {
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016), W = target > x ? UP : DOWN; last = t;
    v += (W * W * (target - x) - 2 * Z * W * v) * dt; x += v * dt;
    if (Math.abs(target - x) < 0.002 && Math.abs(v) < 0.01) { x = target; v = 0; raf = 0; last = 0; }
    else raf = requestAnimationFrame(tick);
    needle.setAttribute('transform', `rotate(${(40 - 80 * x).toFixed(2)} ${CX} ${CY})`);
  };
  return { el, set(db) { target = pos(db); if (!raf) raf = requestAnimationFrame(tick); } };
};
meterVu.n = 0;
const grVu = meterVu('reduction', 'compressor gain reduction meter'), duckVu = meterVu('ducking', 'sidechain ducking meter');
// each card's on button reads on or off, and an off card's faders are dimmed
const showOn = (id, on) => { $(id + '-on').setAttribute('aria-pressed', on); $(id + '-on').textContent = on ? 'on' : 'off'; $(id + '-on').closest('.card').classList.toggle('off', !on); };
function buildMaster() {
$('comp-knobs').innerHTML = ''; $('duck-knobs').innerHTML = '';
showOn('comp', master.comp); showOn('duck', master.duckOn); $('duck-fx').checked = master.duckFx;
mKnob('threshold', 'thresh', -40, 0, 1, (v) => v + ' dB', $('comp-knobs'));
$('comp-knobs').appendChild(dialKnob('ratio', { max: RATIOS.length - 1, show: (v) => RATIOS[v] + ':1', get: () => RATIOS.indexOf(master.ratio),
  set: (v) => { master.ratio = RATIOS[v]; sendMix(); }, dflt: () => RATIOS.indexOf(MASTER0.ratio) }));
mKnob('attack', 'attack', 1, 50, 1, (v) => v + ' ms', $('comp-knobs'));
mKnob('release', 'release', 20, 500, 10, (v) => v + ' ms', $('comp-knobs'));
mKnob('makeup', 'makeup', 0, 12, 1, (v) => '+' + v + ' dB', $('comp-knobs'));
mKnob('duck', 'duck', 0, 1, 0.01, (v) => Math.round(v * 100) + '%', $('duck-knobs'));
mKnob('release', 'duckRelease', 30, 600, 10, (v) => v + ' ms', $('duck-knobs'));
$('comp-knobs').after(grVu.el); $('duck-knobs').after(duckVu.el);
}
buildMaster();
$('comp-on').addEventListener('click', () => { master.comp = !master.comp; showOn('comp', master.comp); sendMix(); });
$('duck-on').addEventListener('click', () => { master.duckOn = !master.duckOn; showOn('duck', master.duckOn); sendMix(); });
$('duck-fx').addEventListener('change', () => { master.duckFx = $('duck-fx').checked; sendMix(); });
sendMix();

