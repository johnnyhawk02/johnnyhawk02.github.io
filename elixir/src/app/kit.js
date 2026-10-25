/*@SOURCES@*/
const { PAR, PARAM_DTYPES, MOD_TARGETS, MOD_TARGET_VOICE_RANGES, VOICE_PAGES, INIT_KIT, OSC_WAVE_NAMES, FILTER_TYPE_NAMES, LFO_SYNC_NAMES } = LXR;

const mixInputs = {}; // parameter number -> mixer control, kept in step with knob edits and kit loads
// ---- kit state (parameter values 0..127 by parameter number) ----
const initValues = new Uint8Array(PAR.END_OF_SOUND_PARAMETERS);
for (let i = 8; i < PAR.END_OF_SOUND_PARAMETERS; i++) initValues[i - 8] = INIT_KIT[i];
// the FX slot is always the delay here; a kit with another effect gets a plain delay setting
function asDelay(kit) {
  if (kit[PAR.FX_TYPE] !== LXR.FX_DELAY) { kit[PAR.FX_TYPE] = LXR.FX_DELAY; kit[PAR.FX_P3] = 90; kit[PAR.FX_P4] = 50; }
  return kit;
}
asDelay(initValues);
const values = initValues.slice();
const factoryInit = initValues.slice();
/*@KITS@*/
/*@PRESETS@*/

const TRACKS = [
  { name: 'DRUM 1', voice: 0 }, { name: 'DRUM 2', voice: 1 }, { name: 'DRUM 3', voice: 2 }, { name: 'SNARE', voice: 3 },
  { name: 'CYMBAL', voice: 4 }, { name: 'CL HAT', voice: 5 }, { name: 'OP HAT', voice: 5 },
];
const PAGE_NAMES = { 'Oscillator': 'OSC', 'Amp EG': 'AMP EG', 'Modulation': 'MOD', 'FM': 'FM', 'transient sample': 'TRANSIENT', 'filter': 'FILTER', 'LFO': 'LFO', 'MIX': 'MIX' };
const LABELS = {
  COARSE: 'COARSE', FINE: 'FINE', WAVEFORM: 'WAVE', PWM: 'PWM', ATTACK: 'ATTACK', DECAY: 'DECAY', DECAY_CLOSED: 'DEC CL',
  DECAY_OPEN: 'DEC OP', EG_SLOPE: 'SLOPE', REPEAT: 'REPEAT', PITCH_DECAY: 'P DECAY', MOD_AMOUNT: 'P AMOUNT', VEL_DEST: 'VELOCITY TARGET',
  VEL_AMT: 'VEL AMT', VEL_MOD_VOL: 'VEL VOL', FM_AMOUNT: 'FM AMT', FM_FREQ: 'FM FREQ', MODE: 'MODE', MOD_OSC1_FREQ: 'FREQ 1',
  MOD_OSC2_FREQ: 'FREQ 2', MOD_OSC1_GAIN: 'GAIN 1', MOD_OSC2_GAIN: 'GAIN 2', TRANSIENT_WAVE: 'SAMPLE', TRANSIENT_VOLUME: 'VOLUME',
  TRANSIENT_FREQ: 'PITCH', FILTER_F: 'FREQ', FILTER_RESO: 'RESO', FILTER_TYPE: 'TYPE', FILTER_DRIVE: 'DRIVE', FREQ_LFO: 'RATE',
  SYNC_LFO: 'SYNC', MOD_LFO: 'AMOUNT', WAVE_LFO: 'WAVE', RETRIGGER_LFO: 'RETRIG', OFFSET_LFO: 'OFFSET', VOLUME: 'VOLUME', PAN: 'PAN',
  SAMPLE_RATE: 'S RATE', DRIVE: 'DRIVE', NOISE: 'NOISE', MIX: 'MIX',
};
const TRANSIENT_NAMES = ['Snap', 'Offset', 'Click', 'Click 2', 'Tick', 'Kick', 'Rim', 'Drop', 'Hat', 'Clap', 'Kick 2', 'Snare', 'Tom', 'Snap 2'];
const LFO_WAVES = ['sin', 'tri', 'saw up', 'saw dn', 'square', 'random', 'exp up', 'exp dn'];
const AROUND_60 = new Set(['COARSE1', 'COARSE2', 'COARSE3', 'COARSE4', 'COARSE5', 'COARSE6', 'FM_FREQ1', 'FM_FREQ2', 'FM_FREQ3',
  'MOD_OSC_F1_CYM', 'MOD_OSC_F2_CYM', 'MOD_OSC_F1', 'MOD_OSC_F2'].map((n) => PAR[n]));

// knob range and readout for a parameter, from the firmware's parameter_dtypes table
function spec(par) {
  const t = PARAM_DTYPES[par] || '0B127';
  const menu = (names) => ({ max: names.length - 1, show: (v) => names[v] ?? String(v) });
  switch (t) {
    case 'PM63': return { max: 127, show: (v) => { const x = v - (AROUND_60.has(par) ? 60 : 63); return (x > 0 ? '+' : '') + x; } };
    case 'ON_OFF': case '0b1': return menu(['off', 'on']);
    case 'menu:WAVEFORM': return menu(OSC_WAVE_NAMES.map((s) => s.toLowerCase()));
    case 'menu:FILTER': return menu(FILTER_TYPE_NAMES);
    case 'menu:TRANS': return menu(TRANSIENT_NAMES);
    case 'menu:LFO_WAVES': return menu(LFO_WAVES);
    case 'menu:SYNC_RATES': return menu(LFO_SYNC_NAMES.map((s) => s.toLowerCase()));
    case 'menu:RETRIGGER': return menu(['off', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6']);
    case 'menu:MIX_FM': return menu(['FM', 'mix']);
    default: return { max: 127, show: (v) => String(v) };
  }
}

