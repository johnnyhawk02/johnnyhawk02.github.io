// ---- the perform dials on the pattern card ----
// the readout keeps the word (driving, planet, every 4) where the knob is narrow
function perfKnob(k, label, opts = {}) {
  const [min, max, dflt] = PERF_RANGE[k];
  const kn = dialKnob(label, { max: max - min, show: () => (opts.short ? perfText(k).split('·')[0] : perfText(k)).trim(), get: () => perfGet(k) - min,
    set: (v) => setPerf(k, v + min), dflt: () => dflt - min, detents: opts.detents });
  kn.dataset.k = k; perfDraws.push(kn.draw);
  return kn;
}
$('pk-pattern').append(perfKnob('energy', 'energy', { short: true }), perfKnob('beat', 'beat', { short: true }),
  perfKnob('fills', 'fills', { short: true }), perfKnob('rush', 'rush'), perfKnob('tempo', 'tempo'));
$('pk-feel').append(perfKnob('vel', 'velocity'), perfKnob('accent', 'accent'), perfKnob('groove', 'groove'), perfKnob('depth', 'depth'));
// the header's tempo field
$('tempo').addEventListener('change', () => setPerf('tempo', clampTempo(Math.round(Number($('tempo').value)) || perf.tempo)));
const macroKnobs = [['fm', 'fm depth'], ['decay', 'decay'], ['pitch', 'pitch'], ['filter', 'filter']].map(([m, label]) => {
  const pitch = m === 'pitch', max = pitch ? 48 : 200, mid = MACRO0[m];
  return dialKnob(label, { max, center: mid, detents: pitch ? [[0, false], [12, false], [24, true], [36, false], [48, false]] : [[mid, true]], jump: false,
    show: (v) => (pitch ? (v === 24 ? '0 st' : (v > 24 ? '+' : '−') + Math.abs(v - 24) + ' st') : (v === 100 ? '0%' : (v > 100 ? '+' : '−') + Math.abs(v - 100) + '%')),
    get: () => macro[m], set: (v) => setMacro(m, v),
    dflt: () => mid, changed: () => macro[m] !== mid });
});
$('pk-macro').append(...macroKnobs);
function drawMacros() { macroKnobs.forEach((k) => k.draw()); }
drawGroove();

