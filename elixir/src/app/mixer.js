// ---- mixer ----
const MASTER0 = { comp: true, thresh: -12, ratio: 3, attack: 5, release: 120, makeup: 0, duck: 0.4, duckRelease: 150, duckFx: false };
const master = { ...MASTER0 };
const CH = ['DRUM 1', 'DRUM 2', 'DRUM 3', 'SNARE', 'CYMBAL', 'HIHAT'];
// sends per voice: fx = echo (the engine's FX bus), dist = distortion, ring = ring mod, 0..100
const mix = { fx: new Array(6).fill(0), dist: new Array(6).fill(0), ring: new Array(6).fill(0) };
const FX3_0 = { echo: { pct: 100 }, dist: { type: 0, p: [70, 64, 80, 90] }, ring: { wave: 0, freq: 40 } };
const fx3 = structuredClone(FX3_0);
const fx3Snapshot = () => ({ params: structuredClone(fx3), dsend: mix.dist.slice(), ring: mix.ring.slice() });
const stripsEl = $('strips');
const fxButtons = [];
// small slider for the groove's per-track swing share and push, 0..100
function miniSlider(label, aria, get, set, dflt, max = 100, show = (v) => v + '%', center = false) {
  const el = document.createElement('div'); el.className = 'sdial';
  const put = (v) => { v = Math.max(0, Math.min(max, Math.round(v))); if (v !== get()) { set(v); draw(); } };
  const s = slider(aria, { max, get, show, center: center ? Math.floor(max / 2) : undefined, put });
  const dial = s.el;
  el.append(dial); el.insertAdjacentHTML('beforeend', `<span>${label}</span>`);
  const draw = () => { s.draw(); dial.title = `${label} ${show(get())}`; };
  stepKeys(dial, get, put);
  dial.addEventListener('dblclick', () => put(dflt));
  draw();
  return { el, draw };
}
// small dial for the mixer's sends, 0..100
function miniDial(label, aria, get, set, dflt, max = 100, show = (v) => v + '%', center = false) {
  const el = document.createElement('div'); el.className = 'sdial';
  el.innerHTML = `<svg class="dial" viewBox="0 0 64 64" tabindex="0" role="slider" aria-label="${aria}" aria-valuemin="0" aria-valuemax="${max}">
      <path class="track" d="${arc(27, A0, A1)}"/><path class="val"/><line class="ptr" x1="32" y1="32" x2="32" y2="14"/></svg><span>${label}</span>`;
  const dial = el.querySelector('svg'), val = el.querySelector('.val'), ptr = el.querySelector('.ptr');
  const draw = () => {
    const v = get(), a = A0 + (A1 - A0) * v / max, from = center ? (A0 + A1) / 2 : A0;
    val.setAttribute('d', Math.abs(a - from) > 0.02 ? arc(27, Math.min(a, from), Math.max(a, from)) : '');
    ptr.setAttribute('x2', (32 + 17 * Math.cos(a)).toFixed(2)); ptr.setAttribute('y2', (32 + 17 * Math.sin(a)).toFixed(2));
    dial.setAttribute('aria-valuenow', v); dial.setAttribute('aria-valuetext', show(v)); dial.title = `${label} ${show(v)}`;
  };
  const put = (v) => { v = Math.max(0, Math.min(max, Math.round(v))); if (v !== get()) { set(v); draw(); } };
  dragY(dial, get, put, 0.6, { start: () => dial.focus() });
  stepKeys(dial, get, put);
  dial.addEventListener('dblclick', () => put(dflt));
  draw();
  return { el, draw };
}
// level meters: one LED per 5 px, -36 dB at the bottom to 0 dB at the top; the peak falls at 24 dB/s and
// the top LED reached holds for 0.7 s. The player sends each voice's peak; one frame loop draws them all
const LVM_FLOOR = -36, lvms = [];
let lvmRaf = 0, lvmT = 0;
function lvMeter(box) {
  const m = { box, lit: box.querySelector('b'), pk: box.querySelector('s'), n: 0, in: 0, db: LVM_FLOOR, hold: LVM_FLOOR, ht: 0, shown: -1, held: -1 };
  // fit a whole number of LEDs and give the top any spare pixels
  new ResizeObserver(() => {
    const h = box.clientHeight - 4;
    m.n = Math.max(0, Math.floor((h + 2) / 5));
    box.style.setProperty('--lt', (2 + h - (5 * m.n - 2)) + 'px');
    m.shown = m.held = -1; lvmDraw(m);
  }).observe(box);
  lvms.push(m);
}
function lvmDraw(m) {
  const leds = (db) => db <= LVM_FLOOR ? 0 : Math.min(m.n, Math.ceil((db - LVM_FLOOR) / -LVM_FLOOR * m.n));
  const a = leds(m.db), h = leds(m.hold);
  if (a !== m.shown) { m.shown = a; m.lit.style.clipPath = `inset(${(m.n - a) * 5}px 0 0 0)`; }
  if (h !== m.held) {
    m.held = h;
    m.pk.style.display = h > a ? 'block' : 'none';
    if (h) { m.pk.style.bottom = (2 + (h - 1) * 5) + 'px'; m.pk.className = h > m.n * 0.917 ? 'r' : h > m.n * 0.667 ? 'y' : ''; }
  }
}
function lvmFrame(t) {
  const dt = lvmT ? Math.min(0.1, (t - lvmT) / 1000) : 0; lvmT = t;
  let live = false;
  for (const m of lvms) {
    const db = m.in > 0 ? 20 * Math.log10(m.in) : -99; m.in = 0;
    m.db = Math.max(db, m.db - 24 * dt, LVM_FLOOR);
    if (m.db >= m.hold) { m.hold = m.db; m.ht = t; }
    else if (t - m.ht > 700) m.hold = Math.max(LVM_FLOOR, m.hold - 24 * dt);
    lvmDraw(m);
    if (m.db > LVM_FLOOR || m.hold > LVM_FLOOR) live = true;
  }
  lvmRaf = live ? requestAnimationFrame(lvmFrame) : 0;
  if (!live) lvmT = 0;
}
function lvmFeed(l) {
  for (let n = 0; n < lvms.length; n++) lvms[n].in = Math.max(lvms[n].in, l[n]);
  if (!lvmRaf) lvmRaf = requestAnimationFrame(lvmFrame);
}
CH.forEach((name, n) => {
  const vol = PAR.VOL1 + n, pan = PAR.PAN1 + n;
  const el = document.createElement('div'); el.className = 'strip'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', name);
  el.innerHTML = `    <span class="name">${name}</span><span class="sends"></span>
    <div class="fbox"><div class="fader" tabindex="0" role="slider" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="127" aria-label="${name} level"><i class="tri"></i><span class="lvm" aria-hidden="true"><b></b><s></s></span></div></div>
    <div class="sfoot"><button class="vr" type="button" title="${name}: a random sound from the built-in kits, varied by 10%" aria-label="New random sound for ${name}">r</button><button class="va" type="button" title="${name}: vary the current sound by 10%" aria-label="Vary ${name} by 10%">a</button></div>
`;
  const fader = el.querySelector('.fader'), nameEl = el.querySelector('.name');
  // the level meter is the fader: a triangle beside it points at the level, at the height the old fader's cap
  // sat (its centre 5 px in from either end). value works like an input's, so kit loads and knob edits move it
  let level = values[vol];
  Object.defineProperty(fader, 'value', {
    get: () => String(level),
    set: (v) => { level = Number(v); fader.style.setProperty('--p', level / 127); fader.setAttribute('aria-valuenow', level); },
  });
  fader.value = level;
  // pan is a small dial; mixInputs gets an input-like stand-in so kit loads and knob edits redraw it
  const panD = miniDial('pan', `${name} pan`, () => values[pan], (v) => setValue(pan, v, true), 63, 127,
    (v) => (v === 63 ? 'C' : v < 63 ? 'L' + (63 - v) : 'R' + (v - 63)), true);
  const panEl = { value: values[pan], addEventListener() {}, dispatchEvent: () => panD.draw() };
  mixInputs[vol] = fader; mixInputs[pan] = panEl;
  // fine control: dragging the meter or the triangle moves the level relative to where it was, 0.4 per pixel
  // (Shift: 0.1), so a short fader still has a long throw; the name shows the level while it moves; wheel and
  // arrow keys step by 1, page keys by 10
  const showLevel = (on) => { nameEl.textContent = on ? `${fader.value}` : name; nameEl.classList.toggle('lvl', on); };
  const setLevel = (v) => {
    v = Math.max(0, Math.min(127, Math.round(v)));
    if (v === level) return;
    fader.value = v; setValue(vol, v, true); fader.title = `${name} level ${v}`; showLevel(true);
  };
  dragY(fader, () => level, setLevel, 0.4, {
    start: (e) => { e.preventDefault(); fader.focus(); showLevel(true); }, end: () => { showLevel(false); buildKnobs(); } });
  stepKeys(fader, () => level, (v) => {
    setLevel(v); clearTimeout(fader._t); fader._t = setTimeout(() => { showLevel(false); buildKnobs(); }, 700);
  }, { wheel: 1 });
  fader.addEventListener('sync', () => { fader.title = `${name} level ${fader.value}`; });
  fader.addEventListener('dblclick', () => { setValue(vol, initValues[vol], true); buildKnobs(); });
  const sends = el.querySelector('.sends'), out6 = PAR.AUDIO_OUT1 + n;
  // echo send: above 0 the voice's AUDIO_OUT is the FX bus (6), at 0 the main stereo out (0)
  const fxd = miniDial('echo', `${name} echo send`, () => mix.fx[n], (v) => {
    mix.fx[n] = v;
    const out = v > 0 ? LXR.MIXER_ROUTING_FX_BUS : 0;
    if (values[out6] !== out) setValue(out6, out, true);
    sendMix();
  }, 0);
  const dd = miniDial('dist', `${name} distortion send`, () => mix.dist[n], (v) => { mix.dist[n] = v; sendMix(); }, 0);
  const rd = miniDial('ring', `${name} ring mod send`, () => mix.ring[n], (v) => { mix.ring[n] = v; sendMix(); }, 0);
  sends.append(panD.el, fxd.el, dd.el, rd.el);
  // r: randomise this voice's sound (same depth and wild settings as the randomise card)
  el.querySelector('.vr').addEventListener('click', async () => { await startAudio(); newVoice(n); setDirty(true); });
  el.querySelector('.va').addEventListener('click', async () => { await startAudio(); alterVoice(n); setDirty(true); });
  const redraw = () => { fxd.draw(); dd.draw(); rd.draw(); };
  // after a kit load (useKit sets the sends): redraw, and route the echo bus to match
  fxButtons[n] = () => {
    const out = mix.fx[n] > 0 ? LXR.MIXER_ROUTING_FX_BUS : 0;
    if (values[out6] !== out) setValue(out6, out, true);
    redraw();
  };
  fxButtons[n]();
  lvMeter(el.querySelector('.lvm'));
  stripsEl.appendChild(el);
});

