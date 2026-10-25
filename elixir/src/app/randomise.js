// ---- randomiser ----
// Every press starts again from the voice's "home" sound (what it was before the first
// randomise since the last knob edit), so repeated presses vary one sound instead of drifting.
// Drum-safe mode keeps each parameter inside a range that still sounds like a drum and leaves
// alone the ones that turn a drum into something else (waveforms, filter type, LFO, bit
// crush, repeat). Wild mode lets everything move over its full range.
const NO_RANDOM = /^(VOL\d|VEL_DEST|VOICE_LFO|TARGET_LFO|MIDI|AUDIO_OUT)/;
// [low, high] for drum-safe mode by parameter label; 'lock' = not randomised
const SAFE = {
  WAVEFORM: 'lock', PWM: 'lock', REPEAT: 'lock', MODE: 'lock', FILTER_TYPE: 'lock', PAN: 'lock', SAMPLE_RATE: 'lock',
  VEL_AMT: 'lock', VEL_MOD_VOL: 'lock',
  FREQ_LFO: 'lock', SYNC_LFO: 'lock', MOD_LFO: 'lock', WAVE_LFO: 'lock', RETRIGGER_LFO: 'lock', OFFSET_LFO: 'lock',
  COARSE: 'pitch', FINE: [48, 78], ATTACK: [0, 6], EG_SLOPE: [0, 127], NOISE: [0, 127], MIX: [0, 127],
  PITCH_DECAY: [2, 80], MOD_AMOUNT: [0, 110], FM_AMOUNT: [0, 50], FM_FREQ: [0, 127],
  MOD_OSC1_FREQ: [0, 127], MOD_OSC2_FREQ: [0, 127], MOD_OSC1_GAIN: [0, 127], MOD_OSC2_GAIN: [0, 127],
  TRANSIENT_WAVE: [0, 13], TRANSIENT_VOLUME: [0, 100], TRANSIENT_FREQ: [0, 127],
  FILTER_F: [45, 127], FILTER_RESO: [0, 60], FILTER_DRIVE: [0, 50], DRIVE: [30, 95],
};
// decay ranges differ per voice: kick/tom/snare, cymbal, closed and open hat
const DECAY = { 0: [3, 55], 1: [3, 55], 2: [3, 55], 3: [3, 50], 4: [20, 110] };
const safeRange = (text, voice, name) => {
  if (name.startsWith('PITCH_SLOPE')) return [0, 90]; // steep pitch curves end up inaudible
  if (name.startsWith('VOL_SLOPE')) return [0, 80];   // very slow amp slopes ring on
  if (text === 'DECAY') return DECAY[voice] || [3, 70];
  if (text === 'DECAY_CLOSED') return [2, 30];
  if (text === 'DECAY_OPEN') return [8, 70];
  return SAFE[text] || [0, 127];
};
let undoValues = null;
const homes = {};
function voiceParams(voice) {
  const out = [];
  for (const g of VOICE_PAGES[voice].groups) for (const [text, name] of g.params) if (!NO_RANDOM.test(name)) out.push([text, PAR[name], name]);
  return out;
}
let rngState = (Date.now() ^ 0x9e3779b9) >>> 0 || 1;
const rnd = () => { rngState ^= rngState << 13; rngState >>>= 0; rngState ^= rngState >>> 17; rngState ^= rngState << 5; rngState >>>= 0; return rngState / 4294967296; };
function randomise(voices = [TRACKS[track].voice]) {
  undoValues = values.slice();
  for (const voice of voices) randomiseVoice(voice);
  $('undo').disabled = false;
  buildKnobs(); drawScope();
}
function randomiseVoice(voice, fixedDepth) {
  const depth = fixedDepth ?? Number($('depth').value) / 100, wild = fixedDepth === undefined && $('wild').checked;
  const params = voiceParams(voice);
  if (!homes[voice]) homes[voice] = new Map(params.map(([, par]) => [par, values[par]]));
  const home = homes[voice];
  for (const [text, par, name] of params) {
    const { max } = spec(par), h = home.get(par);
    let range = wild ? [0, max] : safeRange(text, voice, name);
    let v = h;
    if (range === 'lock') v = h;
    else if (range === 'pitch') v = Math.round(h + (rnd() * 2 - 1) * depth * 12); // up to an octave either way
    else if (max < 20) { if (rnd() < depth) v = range[0] + Math.floor(rnd() * (Math.min(max, range[1]) - range[0] + 1)); }
    else {
      // the home value always stays reachable, even when it sits outside the safe range
      const lo = Math.min(range[0], h), hi = Math.max(range[1], h);
      v = Math.round(h + (rnd() * 2 - 1) * depth * (hi - lo));
      v = Math.max(lo, Math.min(hi, v));
    }
    v = Math.max(0, Math.min(max, v));
    if (v !== values[par]) setValue(par, v, true);
  }
}
// voice v takes its sound from a random built-in kit, then varies it by `vary` (0 = exactly the kit's)
function pickVoice(v, vary) {
  const k = sourceKits[Math.floor(rnd() * sourceKits.length)].kit;
  const keep = new Set([PAR.VOL1 + v, PAR.PAN1 + v]); // the mixer's level and pan stay
  for (const par of voiceOwned(v)) if (!keep.has(par) && values[par] !== k[par]) setValue(par, k[par], true);
  delete homes[v]; if (vary) randomiseVoice(v, vary); delete homes[v];
  for (const par of voiceOwned(v)) if (!keep.has(par)) initValues[par] = values[par];
}
// nudge voice v's current sound by 5%, centred on what's there each time
function alterVoice(v) { delete homes[v]; randomiseVoice(v, 0.05); delete homes[v]; }
// a randomise-card button: keep the sound for undo, change it, redraw
function randChange(fn) {
  undoValues = values.slice(); $('undo').disabled = false;
  fn(); buildKnobs(); drawScope(); setDirty(true);
}
$('rand').addEventListener('click', async () => { await startAudio(); randomise(); setDirty(true); });
// the perform randomise card: kit gives every drum voice a sound straight from a random built-in kit,
// alter nudges each current drum sound a little (5%) so it stays recognisable; mixer, FX and pattern stay
$('rand-all').addEventListener('click', async () => {
  await startAudio();
  if (sourceKits.length) randChange(() => { for (let v = 0; v < 6; v++) pickVoice(v, 0); });
});
$('alter').addEventListener('click', async () => { await startAudio(); randChange(() => { for (let v = 0; v < 6; v++) alterVoice(v); }); });
// per drum (rows built with the mixer strips): random is that voice from a random built-in kit, alter nudges it by 5%
async function randomOne(v) { await startAudio(); if (sourceKits.length) randChange(() => pickVoice(v, 0)); }
async function alterOne(v) { await startAudio(); randChange(() => alterVoice(v)); }
$('undo').addEventListener('click', () => {
  if (!undoValues) return;
  for (let p = 1; p < values.length; p++) if (values[p] !== undoValues[p]) setValue(p, undoValues[p], true);
  undoValues = null; $('undo').disabled = true;
  buildKnobs(); drawScope();
});
$('depth').addEventListener('input', () => { $('depth-out').textContent = $('depth').value + '%'; });

