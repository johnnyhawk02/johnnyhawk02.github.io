// ---- UI state ----
let track = 0;
const $ = (id) => document.getElementById(id);

const voicesEl = $('voices');
TRACKS.forEach((t, i) => {
  const b = document.createElement('button');
  b.className = 'vbtn'; b.type = 'button'; b.dataset.track = i;
  b.innerHTML = `<i></i>${t.name}<kbd>${i + 1}</kbd>`;
  b.setAttribute('aria-pressed', i === track);
  b.addEventListener('click', () => { selectTrack(i); });
  voicesEl.appendChild(b);
});

function selectTrack(i) {
  track = i;
  voicesEl.querySelectorAll('.vbtn').forEach((b, k) => b.setAttribute('aria-pressed', k === i));
  gridEl.querySelectorAll('.row-name').forEach((b, k) => b.classList.toggle('active', k === i));
  $('lcd-name').textContent = TRACKS[i].name; $('rand-name').textContent = TRACKS[i].name;
  buildKnobs(); drawScope();
}

function visiblePages() {
  return VOICE_PAGES[TRACKS[track].voice].groups.filter((g) => g.params.length || g.name === 'LFO');
}

function detail(text) { $('lcd-detail').innerHTML = text; }

// ---- performance macros: global offsets on top of the kit, sent to the engine only (the kit keeps its own values) ----
// fm, decay and filter go from -100% (every voice's value down to 0) through 0 (as the kit) to +100% (all the way up);
// pitch moves every voice's coarse tune by up to two octaves either way
const MACROS = {
  fm: ['FMAMNT1', 'FMAMNT2', 'FMAMNT3', 'MOD_OSC_GAIN1_CYM', 'MOD_OSC_GAIN2_CYM', 'MOD_OSC_GAIN1', 'MOD_OSC_GAIN2'],
  decay: ['VELOD1', 'VELOD2', 'VELOD3', 'VELOD4', 'VELOD5', 'VELOD6_CLOSED', 'VELOD6_OPEN'],
  pitch: ['COARSE1', 'COARSE2', 'COARSE3', 'COARSE4', 'COARSE5', 'COARSE6'],
  filter: ['FILTER_FREQ_1', 'FILTER_FREQ_2', 'FILTER_FREQ_3', 'FILTER_FREQ_4', 'FILTER_FREQ_5', 'FILTER_FREQ_6'],
};
const MACRO0 = { fm: 100, decay: 100, pitch: 24, filter: 100 }; // knob positions: 100 (24 for pitch) is the middle
const macro = { ...MACRO0 };
const macroOf = {};
for (const m in MACROS) for (const n of MACROS[m]) if (PAR[n] !== undefined) macroOf[PAR[n]] = m;
function eff(par, v) {
  const m = macroOf[par];
  if (!m || macro[m] === MACRO0[m]) return v;
  const max = spec(par).max;
  if (m === 'pitch') return Math.max(0, Math.min(max, v + macro.pitch - 24));
  const k = (macro[m] - 100) / 100;
  return Math.round(k > 0 ? v + (max - v) * k : v * (1 + k));
}
const effValues = () => Array.from(values, (v, par) => eff(par, v));
function sendMacros() { for (const par in macroOf) send({ type: 'param', par: Number(par), value: eff(Number(par), values[par]) }); }
function setValue(par, v, quiet) {
  values[par] = v;
  if (mixInputs[par] && Number(mixInputs[par].value) !== v) { mixInputs[par].value = v; mixInputs[par].dispatchEvent(new Event('sync')); }
  if (!quiet) for (const k in homes) delete homes[k]; // a knob edit makes the current sound the new home
  send({ type: 'param', par, value: eff(par, v) });
  if (!quiet) scheduleScope();
}

const knobsEl = $('knobs');
function buildKnobs() {
  knobsEl.innerHTML = '';
  const voice = TRACKS[track].voice;
  // every page of the voice at once, one card each, sized by how many controls it holds
  for (const g of visiblePages()) {
    const card = document.createElement('div'); card.className = 'card pcard';
    const h = document.createElement('h2'); h.textContent = PAGE_NAMES[g.name.replace(/ \(.*\)/, '')] || g.name;
    const box = document.createElement('div'); box.className = 'knobs';
    card.append(h, box);
    const seen = {};
    let n = 0;
    for (const [text, parName] of g.params) {
      const par = PAR[parName];
      if (text === 'VEL_DEST') { box.appendChild(targetSelect('VELOCITY TARGET', par, voice, false)); n += 2; continue; }
      seen[text] = (seen[text] || 0) + 1;
      const dup = g.params.filter((p) => p[0] === text).length > 1;
      box.appendChild(knob((LABELS[text] || text) + (dup ? ' ' + seen[text] : ''), par)); n++;
    }
    if (g.name === 'LFO') { box.appendChild(targetSelect('LFO TARGET', PAR.TARGET_LFO1 + voice, voice, true)); n += 2; }
    card.style.flex = `${n} 1 min(100%, calc(var(--kw, 66px) * ${n} + 32px))`;
    box.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
    knobsEl.appendChild(card);
  }
}

// a select over modTargets: velocity targets stay in the voice, LFO targets can reach any voice
function targetSelect(label, par, voice, anyVoice) {
  const wrap = document.createElement('div'); wrap.className = 'sel';
  const id = 'sel-' + par;
  wrap.innerHTML = `<label for="${id}">${label}</label>`;
  const s = document.createElement('select'); s.id = id;
  const none = new Option('none', 0); s.appendChild(none);
  const groups = anyVoice ? [0, 1, 2, 3, 4, 5] : [voice];
  const vnames = ['Drum 1', 'Drum 2', 'Drum 3', 'Snare', 'Cymbal', 'Hihat'];
  for (const v of groups) {
    const og = document.createElement('optgroup'); og.label = vnames[v];
    const [a, b] = MOD_TARGET_VOICE_RANGES[v];
    for (let i = a; i <= b; i++) {
      const [t, p] = MOD_TARGETS[i];
      if (t.startsWith('FX_') || t === 'VEL_DEST') continue;
      const pageName = VOICE_PAGES[v].groups.find((gr) => gr.params.some((x) => PAR[x[1]] === p));
      const pre = pageName ? (PAGE_NAMES[pageName.name.replace(/ \(.*\)/, '')] || '') + ' ' : '';
      og.appendChild(new Option(pre + (LABELS[t] || t).toLowerCase(), i));
    }
    s.appendChild(og);
  }
  s.value = values[par];
  s.addEventListener('change', () => {
    setValue(par, Number(s.value));
    if (anyVoice) setValue(PAR.VOICE_LFO1 + voice, voiceOfTarget(Number(s.value)) + 1, true);
  });
  wrap.appendChild(s);
  return wrap;
}
const voiceOfTarget = (i) => Math.max(0, MOD_TARGET_VOICE_RANGES.findIndex(([a, b]) => i >= a && i <= b));

const A0 = Math.PI * 0.75, A1 = Math.PI * 2.25;
const arc = (r, a, b) => {
  const x0 = 32 + r * Math.cos(a), y0 = 32 + r * Math.sin(a), x1 = 32 + r * Math.cos(b), y1 = 32 + r * Math.sin(b);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${b - a > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
// a vertical slider: o = { max, get, put, show, center, detents, snap }. Click the track to jump there,
// drag the cap (Shift: fine)
function slider(aria, o) {
  const el = document.createElement('div'); el.className = 'sl'; el.tabIndex = 0;
  el.setAttribute('role', 'slider'); el.setAttribute('aria-label', aria); el.setAttribute('aria-orientation', 'vertical');
  el.setAttribute('aria-valuemin', 0); el.setAttribute('aria-valuemax', o.max);
  el.innerHTML = '<i class="rail"><i class="fill"></i><b class="thumb"></b></i>';
  const rail = el.firstChild, snap = o.snap || ((v) => v);
  for (const [v, major] of o.detents || []) {
    const t = document.createElement('i'); t.className = major ? 'tick major' : 'tick';
    t.style.bottom = (100 * v / o.max) + '%'; rail.prepend(t);
  }
  const draw = () => {
    const v = Math.min(o.get(), o.max), f = o.max ? v / o.max : 0, c = o.center !== undefined ? o.center / o.max : 0;
    el.style.setProperty('--p', f); el.style.setProperty('--a', Math.min(c, f)); el.style.setProperty('--w', Math.abs(f - c));
    el.setAttribute('aria-valuenow', v); el.setAttribute('aria-valuetext', o.show(v));
  };
  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    const r = rail.getBoundingClientRect(), py = r.bottom - r.height * Math.min(o.get(), o.max) / o.max;
    el.setPointerCapture(e.pointerId); el.focus({ preventScroll: true }); e.preventDefault();
    // a press off the cap jumps there
    drag = { last: e.clientY, h: r.height || 1, acc: o.get() };
    if (Math.abs(e.clientY - py) > 6) { drag.acc = Math.max(0, Math.min(o.max, (r.bottom - e.clientY) / r.height * o.max)); o.put(snap(drag.acc)); }
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.acc += (drag.last - e.clientY) * o.max / drag.h * (e.shiftKey ? 0.25 : 1); drag.last = e.clientY;
    o.put(snap(Math.max(0, Math.min(o.max, drag.acc))));
  });
  el.addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('pointercancel', () => { drag = null; });
  return { el, draw };
}
// a knob over any value: o = { max, get, set, show, dflt, changed }
function dialKnob(label, o) {
  const el = document.createElement('div'); el.className = 'knob';
  const id = 'k' + (++dialKnob.n);
  // optional detents ([value, major]): tick marks beside the slider, and a drag catches on them
  const det = (o.detents || []).map(([v]) => v).sort((a, b) => a - b);
  const CATCH = Math.max(1, o.max * 0.008);
  const snap = (v) => { for (const d of det) if (Math.abs(v - d) <= CATCH) return d; return v; };
  const nextDetent = (dir) => {
    const v = o.get();
    return dir > 0 ? (det.find((d) => d > v) ?? o.max) : ([...det].reverse().find((d) => d < v) ?? 0);
  };
  const s = slider(label, { max: o.max, get: o.get, show: o.show, center: o.center, detents: o.detents, snap, put: (v) => set(v) });
  const dial = s.el; dial.id = id;
  el.innerHTML = `<label for="${id}">${label}</label><output></output>`;
  const out = el.querySelector('output');
  el.insertBefore(dial, out);
  const draw = () => {
    s.draw(); out.textContent = o.show(Math.min(o.get(), o.max));
    el.classList.toggle('changed', !!(o.changed && o.changed()));
  };
  const set = (v) => {
    v = Math.max(0, Math.min(o.max, Math.round(v)));
    if (v === o.get()) return;
    o.set(v); draw();
    detail(`${label} <em>${o.show(v)}</em>`);
  };
  // with detents, the wheel and arrow keys step from one to the next (Shift + arrow: fine steps)
  const step = (dir, fine) => set(det.length && o.jump !== false && !fine ? nextDetent(dir) : o.get() + dir);
  dial.addEventListener('wheel', (e) => { e.preventDefault(); step(e.deltaY < 0 ? 1 : -1, false); }, { passive: false });
  dial.addEventListener('keydown', (e) => {
    const big = o.max > 20 ? 8 : 1;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { step(1, e.shiftKey); e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { step(-1, e.shiftKey); e.preventDefault(); }
    else if (e.key === 'PageUp') { set(o.get() + big); e.preventDefault(); }
    else if (e.key === 'PageDown') { set(o.get() - big); e.preventDefault(); }
  });
  dial.addEventListener('dblclick', () => set(o.dflt()));
  dial.addEventListener('focus', () => detail(`${label} <em>${o.show(o.get())}</em>`));
  draw();
  el.draw = draw;
  return el;
}
dialKnob.n = 0;
// a knob over one of the voice's parameters
function knob(label, par, quiet) {
  const sp = spec(par);
  return dialKnob(label, { max: sp.max, show: sp.show, get: () => values[par], set: (v) => setValue(par, v, quiet),
    dflt: () => initValues[par], changed: () => values[par] !== initValues[par] });
}

