// ---- big sliders for the perform controls, over the hidden inputs that hold the values ----
const tempoOut = document.createElement('output');
const showTempo = () => { tempoOut.innerHTML = `<b>${$('tempo').value}</b> bpm`; };
$('tempo').addEventListener('change', showTempo); $('tempo').addEventListener('input', showTempo); showTempo();
// the pattern card's knobs drive the hidden inputs, which the rest of the page listens to
function inputKnob(input, label, out, opts = {}) {
  const min = opts.min ?? Number(input.min), max = (opts.max ?? Number(input.max)) - min;
  // the readout keeps the word (driving, planet, every 4); the LCD-style detail line shows it all
  const k = dialKnob(label, { max, show: () => (opts.short ? out.textContent.split('·')[0] : out.textContent).trim(), get: () => Number(input.value) - min,
    set: (v) => { input.value = v + min; input.dispatchEvent(new Event('input')); if (opts.event) input.dispatchEvent(new Event(opts.event)); },
    dflt: () => opts.dflt - min, detents: opts.detents });
  k.dataset.k = input.id;
  for (const ev of ['sync', 'input', 'change']) input.addEventListener(ev, () => k.draw());
  new MutationObserver(() => k.draw()).observe(out, { childList: true, characterData: true, subtree: true });
  return k;
}
$('pk-pattern').append(inputKnob($('energy'), 'energy', $('energy-out'), { short: true, dflt: 60 }), inputKnob($('beat'), 'beat', $('beat-out'), { short: true, dflt: 0 }),
  inputKnob($('fills'), 'fills', $('fills-out'), { short: true, dflt: 40 }), inputKnob($('tempo'), 'tempo', tempoOut, { min: 70, max: 170, event: 'change', dflt: 118 }));
$('pk-feel').append(inputKnob($('level'), 'velocity', $('level-out'), { event: 'change', dflt: 100 }),
  inputKnob($('accent'), 'accent', $('accent-out'), { event: 'change', dflt: 6 }),
  inputKnob($('swing-p'), 'swing', $('swing-p-out'), { short: true, dflt: 50, detents: [[16, true]] }));
const macroKnobs = [['fm', 'fm depth'], ['decay', 'decay'], ['pitch', 'pitch'], ['filter', 'filter']].map(([m, label]) => {
  const pitch = m === 'pitch', max = pitch ? 48 : 200, mid = MACRO0[m];
  return dialKnob(label, { max, center: mid, detents: pitch ? [[0, false], [12, false], [24, true], [36, false], [48, false]] : [[mid, true]], jump: false,
    show: (v) => (pitch ? (v === 24 ? '0 st' : (v > 24 ? '+' : '−') + Math.abs(v - 24) + ' st') : (v === 100 ? '0%' : (v > 100 ? '+' : '−') + Math.abs(v - 100) + '%')),
    get: () => macro[m], set: (v) => { macro[m] = v; for (const n of MACROS[m]) if (PAR[n] !== undefined) send({ type: 'param', par: PAR[n], value: eff(PAR[n], values[PAR[n]]) }); },
    dflt: () => mid, changed: () => macro[m] !== mid });
});
$('pk-macro').append(...macroKnobs);
function drawMacros() { macroKnobs.forEach((k) => k.draw()); }
drawGroove();

