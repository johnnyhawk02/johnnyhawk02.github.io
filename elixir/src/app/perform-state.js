// ---- perform state: the perform dials (pattern card, PC4, presets) read and write here ----
// The groove type and depth are the groove's; tempo is shown in the header's field too
const perf = { energy: 60, beat: 0, fills: 40, tempo: 118, vel: 100, accent: 6, rush: 0 }; // rush is a live move: not in presets
// [min, max, default] of each, as the knobs and the PC4 map them
const PERF_RANGE = { energy: [0, 100, 60], beat: [0, 31, 0], fills: [0, 100, 40], tempo: [40, 240, 118], rush: [0, 100, 0], vel: [1, 127, 100], accent: [0, 6, 6],
  groove: [0, GROOVE_TYPES.length - 1, 0], depth: [0, 100, 100] };
const clampTempo = (v) => Math.max(PERF_RANGE.tempo[0], Math.min(PERF_RANGE.tempo[1], v));
const perfGet = (k) => (k === 'groove' ? grooveIdx() : k === 'depth' ? groove.depth : perf[k]);
const perfDraws = []; // the perform knobs' redraws
const drawPerf = () => perfDraws.forEach((d) => d());
// a change to one of them, and what follows from it
function setPerf(k, v) {
  if (k === 'groove' || k === 'depth') { // drawGroove redraws the knobs
    if (k === 'groove') groove.type = GROOVE_TYPES[v].name; else groove.depth = v;
    drawGroove(); sendSeq(); return;
  }
  perf[k] = v;
  if (k === 'tempo') { $('tempo').value = v; sendSeq(); }
  else if (k === 'vel' || k === 'accent') sendSeq();
  else if (k === 'rush') send({ type: 'rush', v });
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
  if (k === 'rush') return v ? `${v}%` : 'off';
  if (k === 'groove') return GROOVE_TYPES[v].name;
  return `${v}%`;
}
