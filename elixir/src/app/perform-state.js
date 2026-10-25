// ---- perform state: the perform dials (pattern card, PC4, presets) read and write here ----
// Swing is the groove's; tempo is shown in the header's field too
const perf = { energy: 60, beat: 0, fills: 40, tempo: 118, vel: 100, accent: 6 };
// [min, max, default] of each, as the knobs and the PC4 map them
const PERF_RANGE = { energy: [0, 100, 60], beat: [0, 15, 0], fills: [0, 100, 40], tempo: [70, 170, 118], vel: [1, 127, 100], accent: [0, 6, 6], swing: [50, 75, 50] };
const perfGet = (k) => (k === 'swing' ? groove.swing : perf[k]);
const perfDraws = []; // the perform knobs' redraws
const drawPerf = () => perfDraws.forEach((d) => d());
// a change to one of them, and what follows from it
function setPerf(k, v) {
  if (k === 'swing') { groove.swing = v; drawGroove(); sendSeq(); return; } // drawGroove redraws the knobs
  perf[k] = v;
  if (k === 'tempo') { $('tempo').value = v; sendSeq(); }
  else if (k === 'vel' || k === 'accent') sendSeq();
  else { generate(); if (k === 'beat') drawUserTools(); }
  drawPerf();
}
// the readout: a word, then the detail (driving · 82%)
function perfText(k) {
  const v = perfGet(k);
  if (k === 'energy') return `${ENERGY_NAMES.find(([x]) => v < x)[1]} · ${v}%`;
  if (k === 'beat') {
    const st = STYLES[styleIdx];
    return `${st.grooves[v].name.toLowerCase()} · ${st.user ? (st.grooves.length ? userSlot() + 1 : 0) : v + 1}/${st.grooves.length}`;
  }
  if (k === 'fills') { const f = fillNow(); return f ? `every ${f.every} · ${f.len} steps` : 'off'; }
  if (k === 'tempo') return `${v} bpm`;
  if (k === 'vel') return `${v} / 127`;
  if (k === 'accent') return `+${v} dB`;
  return v === 50 ? 'straight · 50%' : `${v >= 66 && v <= 67 ? 'triplet' : v < 60 ? 'light' : v < 66 ? 'medium' : 'heavy'} · ${v}%`;
}
