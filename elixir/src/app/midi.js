// ---- pattern on/off and MIDI in ----
// Off: the sequencer keeps time but triggers nothing; MIDI note-ons (any channel, General MIDI drum notes) play the voices
const MIDI_NOTES = { 35: 0, 36: 0, 41: 1, 43: 1, 45: 1, 47: 2, 48: 2, 50: 2, 38: 3, 40: 3, 49: 4, 51: 4, 55: 4, 57: 4, 42: 5, 44: 5, 46: 6 };
let midiAccess = null;
function midiStatus() {
  const st = $('midi-status');
  if (!navigator.requestMIDIAccess) { st.textContent = 'MIDI in: not available in this browser (try Chrome or Edge)'; st.className = 'midi-status none'; return; }
  if (!midiAccess) { st.textContent = 'MIDI in: waiting for permission'; st.className = 'midi-status'; return; }
  const ins = [...midiAccess.inputs.values()].map((i) => i.name);
  st.textContent = ins.length ? `MIDI in: ${ins.join(', ')}` : 'MIDI in: no device connected';
  st.className = 'midi-status ' + (ins.length ? 'live' : 'none');
}
function onMidi(e) {
  const [st, note, vel] = e.data;
  if ((st & 0xf0) === 0xb0) return pc4Midi(note, vel); // control change: the PC4 knobs
  if ((st & 0xf0) !== 0x90 || !vel) return; // note-on only (note-on at velocity 0 is a note-off)
  const t = MIDI_NOTES[note];
  if (t === undefined) return;
  startAudio().then(() => send({ type: 'trig', voice: t, vel }));
  flash(voicesEl.children[t]);
  const dd = document.querySelectorAll('.midi-map dd')[t]; // the map lists the tracks in order
  if (dd) { dd.classList.add('hit'); clearTimeout(dd._t); dd._t = setTimeout(() => dd.classList.remove('hit'), 120); }
}
async function startMidi() {
  if (midiAccess || !navigator.requestMIDIAccess) { midiStatus(); return; }
  midiStatus();
  try {
    midiAccess = await navigator.requestMIDIAccess();
    const hook = () => { for (const i of midiAccess.inputs.values()) i.onmidimessage = onMidi; midiStatus(); };
    midiAccess.onstatechange = hook; hook();
  } catch (err) { $('midi-status').textContent = 'MIDI in: permission refused'; $('midi-status').className = 'midi-status none'; }
}
function setSource(src) {
  source = src;
  document.querySelectorAll('[data-src]').forEach((b) => b.setAttribute('aria-checked', b.dataset.src === src));
  setPatternOn(src !== 'off');
}
document.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => setSource(b.dataset.src)));
function setPatternOn(on) {
  patternOn = on;
  document.querySelector('.pattern-card').classList.toggle('midi', !on);
  $('midi-info').hidden = on;
  if (!on) startMidi();
  sendSeq();
}
