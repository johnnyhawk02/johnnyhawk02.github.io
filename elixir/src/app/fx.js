// ---- FX bus: the firmware's FX page. P1..P4 mean different things per effect ----
// musical lengths as fractions of a bar: straight, dotted and triplet, 1/128 .. 1/1
const NOTES = [];
for (let k = 0; k <= 7; k++) {
  const d = 2 ** k;
  NOTES.push([1 / d, '1/' + d]);
  if (k > 0 && k < 7) NOTES.push([1.5 / d, '1/' + d + '.']);
  if (k > 0) NOTES.push([2 / 3 / d, '1/' + d + 't']);
}
const posOf = (frac) => 1 + Math.log2(frac) / 7;
function showDelay(v) {
  const frac = Math.pow(2, -7 * (1 - v / 1000));
  const [nf, name] = NOTES.reduce((a, b) => (Math.abs(Math.log2(b[0] / frac)) < Math.abs(Math.log2(a[0] / frac)) ? b : a));
  return `${Math.round(v / 10)}% ${Math.abs(nf / frac - 1) < 0.004 ? '' : '≈'}${name}`;
}
let delayPos = posOf(3 / 16);
// a kit's own delay time (TIME and RANGE, as the firmware computes it) as a synced position
function kitDelayPos() {
  const p1 = values[PAR.FX_P1] / 127, rng = values[PAR.FX_P2] / 127, pp = values[PAR.FX_DELAY_TYPE] === 1, fs = LXR.REAL_FS;
  const lerp = (a, b, x) => a * (1 - x) + b * x;
  const min = lerp(0.0006 * fs, 0.02 * fs, rng), max = lerp(0.02 * fs, pp ? 0x7fff * 0.48 : 0x7fff, rng);
  const secs = lerp(min, max, p1 * rng) / fs, bar = 240 / perf.tempo;
  return Math.max(0, Math.min(1, posOf(secs / bar)));
}
// randomise picks 1/2, 1/4, dotted 1/8, 1/8 or 1/16, or now and then (1 roll in 20) 1/128, and puts it up to
// 10 ms either side at 120 bpm. The time is a fraction of the bar, so the window is 1/200 of a bar at any
// tempo. 1/128 is the shortest the dial goes, so it only drifts up, by up to a fifth
function randomDelayPos() {
  if (rnd() < 1 / 20) return posOf((1 + rnd() * 0.2) / 128);
  const pool = [1 / 2, 1 / 4, 3 / 16, 1 / 8, 1 / 16];
  const fr = pool[Math.floor(rnd() * pool.length)];
  return Math.max(0, Math.min(1, posOf(fr + (rnd() * 2 - 1) * 0.005)));
}
// a row of radio buttons drawn as a segmented control
function radios(box, name, labels, get, set) {
  box.innerHTML = '';
  labels.forEach((l, i) => {
    const lab = document.createElement('label');
    lab.innerHTML = `<input type="radio" name="${name}" value="${i}"><span>${l}</span>`;
    const r = lab.querySelector('input');
    r.checked = get() === i;
    r.addEventListener('change', () => { if (r.checked) set(i); });
    box.appendChild(lab);
  });
}
// a small dropdown for an effect's type
function fxPick(sel, labels, get, set) {
  sel.innerHTML = labels.map((l, i) => `<option value="${i}">${l}</option>`).join('');
  sel.value = String(get());
  sel.onchange = () => set(Number(sel.value));
}
// a 0..127 knob over one of the page's own FX settings
const fx3Knob = (label, obj, key, dflt) => dialKnob(label, { max: 127, show: (v) => String(v), get: () => obj()[key],
  set: (v) => { obj()[key] = v; sendMix(); }, dflt: () => dflt });
function syncFx() {
  // 1: the firmware's delay on the engine's FX bus, always the delay here: tempo-synced time,
  // tone, feedback. 2 and 3: distortion and ring mod on their own buses (page settings)
  fxButtons.forEach((b) => b());
  fxPick($('r-echo'), LXR.DELAY_NAMES.map((n) => n.toLowerCase()), () => values[PAR.FX_DELAY_TYPE],
    (i) => setValue(PAR.FX_DELAY_TYPE, i, true));
  const ke = $('k-echo'); ke.innerHTML = '';
  // detents on the musical lengths: straight notes are the major ticks, dotted and triplet the small ones
  const detents = NOTES.map(([fr, name]) => [Math.round(posOf(fr) * 1000), !/[.t]$/.test(name)]).filter(([v]) => v >= 0 && v <= 1000);
  ke.append(dialKnob('time', { max: 1000, show: showDelay, detents, get: () => Math.round(delayPos * 1000),
    set: (v) => { delayPos = v / 1000; send({ type: 'delay', pos: delayPos }); }, dflt: () => Math.round(posOf(3 / 16) * 1000) }),
    knob('tone', PAR.FX_P3, true), knob('feedback', PAR.FX_P4, true), dialKnob('width', { max: 200, show: (v) => v + '%', detents: [[100, true]], jump: false, get: () => fx3.echo.pct,
      set: (v) => { fx3.echo.pct = v; sendMix(); }, dflt: () => FX3_0.echo.pct }));
  fxPick($('r-dist'), LXR.DIST_NAMES.map((n) => n.toLowerCase()), () => fx3.dist.type, (i) => { fx3.dist.type = i; sendMix(); });
  const kd = $('k-dist'); kd.innerHTML = '';
  ['drive', 'color', 'tone', 'volume'].forEach((l, i) => kd.append(fx3Knob(l, () => fx3.dist.p, i, FX3_0.dist.p[i])));
  fxPick($('r-ring'), LXR.OSC_WAVE_NAMES.map((n) => n.toLowerCase()), () => fx3.ring.wave, (i) => { fx3.ring.wave = i; sendMix(); });
  const kr = $('k-ring'); kr.innerHTML = '';
  kr.append(fx3Knob('freq', () => fx3.ring, 'freq', FX3_0.ring.freq));
}
syncFx();
function syncMixer() {
  syncFx();
  for (const par in mixInputs) { mixInputs[par].value = values[par]; mixInputs[par].dispatchEvent(new Event('sync')); }
}
function sendMix() {
  send({ type: 'mix', master: { ...master }, fx: mix.fx.map((v) => v / 100), echo: fx3.echo, dist: fx3.dist, ring: fx3.ring,
    sendD: mix.dist.map((v) => v / 100), sendR: mix.ring.map((v) => v / 100) });
}

