// LXR drum engine, ported to JavaScript from the LXR V2 firmware
// (github.com/erica-synths/lxr-desktop-app, Core/Src/Soundengine). GPL-3.0-only, like the original.
//
// The port follows the C code function by function and keeps its arithmetic exact: every
// single-precision step goes through Math.fround, double-precision steps stay as JS numbers,
// float-to-integer conversions saturate like the Cortex-M7's VCVT, and integer stores wrap
// like the C stores do. verify.mjs checks the output sample for sample against the original
// C compiled for the Cortex-M7.
//
// Engine facts: 44140 Hz sample rate, 64-sample blocks, 6 voices (3 drum/tom, snare, cymbal,
// hihat with closed + open triggers), mono per voice before panning.

import {
  SINE_TABLE, TRI_TABLE, REC_TABLE, SAW_TABLE, TRANSIENT_DATA, MIDI_NOTE_FREQ,
  INIT_KIT, PARAMETER_ORDER, PAR, CC, CC2,
} from './lxr-tables.js';
import { MOD_TARGETS } from './lxr-ui-data.js';

export { PAR, CC, CC2 };

export const REAL_FS = 44140;
export const BLOCK = 64; // OUTPUT_DMA_SIZE
export const NUM_VOICES = 6;

// ---------------------------------------------------------------------------------------
// Numeric helpers (C semantics)
// ---------------------------------------------------------------------------------------
const f = Math.fround;
const F_32767 = f(32767);
const F_2POW32 = f(4294967295); // (float)0xffffffff == 4294967296.0f

/** float/double -> int32 the way VCVT.S32 does it: truncate, saturate, NaN -> 0 */
function toI32(x) {
  if (x !== x) return 0;
  if (x >= 2147483647) return 2147483647;
  if (x <= -2147483648) return -2147483648;
  return Math.trunc(x);
}
/** float/double -> uint32 the way VCVT.U32 does it: truncate, saturate at 0 and 2^32-1 */
function toU32(x) {
  if (x !== x || x <= 0) return 0;
  if (x >= 4294967295) return 4294967295;
  return Math.trunc(x);
}
/** store a float into an int16_t (VCVT.S32, then the low 16 bits) */
const toI16 = (x) => (toI32(x) << 16) >> 16;
/** store into a uint8_t */
const toU8 = (x) => toU32(x) & 0xff;
/** __SSAT(x, 16) */
const ssat16 = (x) => (x > 32767 ? 32767 : x < -32768 ? -32768 : x);
/** one halfword of __QADD16 / __QSUB16 */
const qadd16 = (a, b) => ssat16(a + b);
const qsub16 = (a, b) => ssat16(a - b);

// fmaf(): a*b+c with a single rounding. a*b of two floats is exact in a double; the sum
// is then corrected for the one case where rounding the double sum to float goes wrong
// (the double sum lands exactly on a float rounding midpoint).
const fbuf = new Float32Array(1);
const ibuf = new Int32Array(fbuf.buffer);
function nextFloat(x, up) {
  fbuf[0] = x;
  if (x === 0) { ibuf[0] = up ? 1 : -2147483647; return fbuf[0]; }
  ibuf[0] += (x > 0) === up ? 1 : -1;
  return fbuf[0];
}
function fmaf(a, b, c) {
  a = f(a); b = f(b); c = f(c);
  const p = a * b;
  const s = p + c;
  const bb = s - p;
  const e = (p - (s - bb)) + (c - bb);
  const r = f(s);
  if (e === 0 || r === s || !isFinite(s)) return r;
  const other = nextFloat(r, s > r);
  if ((r + other) / 2 !== s) return r;
  // s sits exactly between r and other: the exact result is on the side e points to
  return (e > 0) === (other > r) ? other : r;
}

// Hardware RNG stand-in (HAL_RNG_GetRandomNumber). The LXR uses the STM32's true RNG; this
// is a xorshift32 shared by every voice, called in the same order as the firmware does.
export class Rng {
  constructor(seed = 0x12345678) { this.state = seed >>> 0; }
  next() {
    let x = this.state;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    this.state = x;
    return x;
  }
}

// ---------------------------------------------------------------------------------------
// Oscillator.c
// ---------------------------------------------------------------------------------------
export const SINE = 0, TRI = 1, SAW = 2, REC = 3, NOISE = 4, PWM = 5, NUM_OSC_WAVEFORMS = 6;
export const OSC_WAVE_NAMES = ['Sine', 'Tri', 'Saw', 'Rec', 'Noise', 'PWM'];
const SEQ_DEFAULT_NOTE = 60;
const SEMITONE_UP_MINUS_1 = f(f(1.0594630943592952645618252949463) - 1);

// the three band-limited wavetables, back to back like in flash (a read one past the end of
// row 10 of one table lands in the next table)
const WAVE_MEM = new Int16Array(TRI_TABLE.length * 3 + 1);
WAVE_MEM.set(TRI_TABLE, 0);
WAVE_MEM.set(REC_TABLE, TRI_TABLE.length);
WAVE_MEM.set(SAW_TABLE, TRI_TABLE.length * 2);
const TRI_BASE = 0, REC_BASE = TRI_TABLE.length, SAW_BASE = TRI_TABLE.length * 2;
// Reading one past the last saw row is an out-of-bounds read in the firmware (it happens for
// pitches above ~14 kHz); whatever the linker put next is read. By default this port wraps to
// the start of that row, which continues the waveform; verify.mjs sets it to what follows the
// table in the reference binary.
WAVE_MEM[WAVE_MEM.length - 1] = SAW_TABLE[10 * 1024];
export function setSawPastEndSample(v) { WAVE_MEM[WAVE_MEM.length - 1] = v; }

function makeOsc() {
  return {
    output: 0, pm: null, phaseInc: 0, phase: 0, freq: 0, waveform: 0, tableOffset: 0,
    pitchMod: 0, fmMod: 0, modNodeValue: 0, midiFreq: 0, baseNote: 0,
  };
}

const freq2PhaseIncr = (x) => toU32(f(f(f(4096 * x) / REAL_FS) * 1048576));
const freq2PhaseIncr1024 = (x) => toU32(f(f(f(1024 * x) / REAL_FS) * 4194304));
const freq2PhaseIncr32767 = (x) => toU32(f(f(f(1024 * x) / REAL_FS) * 131072));

// fast_log2() returns uint8 31-clz, so log2(0) is 255; freqToTableIndex() keeps the uint8 wrap
function freqToTableIndex(fr) {
  const log2 = (31 - Math.clz32(toU32(f(fr / 440)))) & 0xff;
  const midiNote = 12 * log2 + 70;
  return Math.trunc(midiNote / 12) & 0xff;
}

// interpolated table read: table[itg] + ((table[itg+1]-table[itg]) * frac) >> shift
function lerp(mem, idx, frac, shift) {
  const a = mem[idx];
  const d = mem[idx + 1] - a;
  return (a + Math.floor(d * frac / 2 ** shift)) << 16 >> 16;
}

function calcSineBlock(osc, buf, size, gain) {
  const pm = osc.pm;
  for (let i = 0; i < size; i++) {
    const phase = osc.phase, p = pm ? (phase + pm[i]) >>> 0 : phase;
    const out = lerp(SINE_TABLE, p >>> 20, p & 0xfffff, 20);
    osc.phase = (phase + osc.phaseInc) >>> 0;
    buf[i] = toI16(f(out * gain));
  }
}

function calcFmSineBlock(osc, mod, buf, size, gain) {
  const pm = osc.pm;
  for (let i = 0; i < size; i++) {
    const phase = osc.phase;
    const index = ((pm ? phase + pm[i] : phase) + ((toU32(f(mod[i] * osc.fmMod)) << 17) >>> 0)) >>> 0;
    const out = lerp(SINE_TABLE, index >>> 20, index & 0xfffff, 20);
    osc.phase = (phase + osc.phaseInc) >>> 0;
    buf[i] = toI16(f(out * gain));
  }
}

function calcFmBlock(osc, base, mod, buf, size, gain) {
  const row = base + osc.tableOffset * 1024, pm = osc.pm;
  for (let i = 0; i < size; i++) {
    const phase = osc.phase;
    const index = ((pm ? phase + pm[i] : phase) + ((toU32(f(mod[i] * osc.fmMod)) << 19) >>> 0)) >>> 0;
    const out = lerp(WAVE_MEM, row + (index >>> 22), index & 0x3fffff, 22);
    osc.phase = (phase + osc.phaseInc) >>> 0;
    osc.output = out;
    buf[i] = toI16(f(out * gain));
  }
}

// second saw shifted by pwm * half a cycle; the shift is added in float, like in C
const pwmShift = (phase, pwm) => toU32(f(f(phase) + f(pwm * 2147483648)));

function calcPwmFmBlock(osc, mod, buf, size, gain, pwm) {
  const row = SAW_BASE + osc.tableOffset * 1024, pm = osc.pm;
  for (let i = 0; i < size; i++) {
    const phase = osc.phase;
    const index = ((pm ? phase + pm[i] : phase) + ((toU32(f(mod[i] * osc.fmMod)) << 19) >>> 0)) >>> 0;
    const index2 = pwmShift(index, pwm);
    const a = lerp(WAVE_MEM, row + (index >>> 22), index & 0x3fffff, 22);
    const b = lerp(WAVE_MEM, row + (index2 >>> 22), index2 & 0x3fffff, 22);
    const out = qsub16(a, b);
    osc.phase = (phase + osc.phaseInc) >>> 0;
    osc.output = out;
    buf[i] = toI16(f(out * gain));
  }
}

function calcWavetableOscBlock(osc, base, buf, size, gain) {
  const row = base + osc.tableOffset * 1024, pm = osc.pm;
  for (let i = 0; i < size; i++) {
    const phase = osc.phase, p = pm ? (phase + pm[i]) >>> 0 : phase;
    const out = lerp(WAVE_MEM, row + (p >>> 22), p & 0x3fffff, 22);
    osc.phase = (phase + osc.phaseInc) >>> 0;
    buf[i] = toI16(f(out * gain));
  }
}

function calcPwmBlock(osc, buf, size, gain, pwm) {
  const row = SAW_BASE + osc.tableOffset * 1024, pm = osc.pm;
  for (let i = 0; i < size; i++) {
    const phase = osc.phase, p = pm ? (phase + pm[i]) >>> 0 : phase;
    const phase2 = pwmShift(p, pwm);
    const a = lerp(WAVE_MEM, row + (p >>> 22), p & 0x3fffff, 22);
    const b = lerp(WAVE_MEM, row + (phase2 >>> 22), phase2 & 0x3fffff, 22);
    const out = qsub16(a, b);
    osc.phase = (phase + osc.phaseInc) >>> 0;
    osc.output = out;
    buf[i] = toI16(f(out * gain));
  }
}

// sample-and-hold noise: a new random value each time the phase wraps
function calcNoiseBlock(osc, buf, size, gain, rng) {
  for (let i = 0; i < size; i++) {
    const last = osc.phase;
    osc.phase = (osc.phase + osc.phaseInc) >>> 0;
    if (last > osc.phase) osc.output = (rng.next() << 16) >> 16;
    buf[i] = toI16(f(osc.output * gain));
  }
}

// waveforms above PWM are user samples, which this port doesn't load; like the firmware
// without samples, they leave the buffer as it was
function calcNextOscSampleBlock(osc, buf, size, gain, pwm, rng) {
  switch (osc.waveform) {
    case SINE: calcSineBlock(osc, buf, size, gain); break;
    case SAW: calcWavetableOscBlock(osc, SAW_BASE, buf, size, gain); break;
    case TRI: calcWavetableOscBlock(osc, TRI_BASE, buf, size, gain); break;
    case REC: calcWavetableOscBlock(osc, REC_BASE, buf, size, gain); break;
    case NOISE: calcNoiseBlock(osc, buf, size, gain, rng); break;
    case PWM: calcPwmBlock(osc, buf, size, gain, pwm); break;
    default: break;
  }
}

function calcNextOscSampleFmBlock(osc, mod, buf, size, gain, pwm, rng) {
  switch (osc.waveform) {
    case SINE: calcFmSineBlock(osc, mod, buf, size, gain); break;
    case SAW: calcFmBlock(osc, SAW_BASE, mod, buf, size, gain); break;
    case TRI: calcFmBlock(osc, TRI_BASE, mod, buf, size, gain); break;
    case REC: calcFmBlock(osc, REC_BASE, mod, buf, size, gain); break;
    case NOISE: calcNoiseBlock(osc, buf, size, gain, rng); break;
    case PWM: calcPwmFmBlock(osc, mod, buf, size, gain, pwm); break;
    default: break;
  }
}

function osc_setFreq(osc) {
  const cur = f(f(osc.freq * osc.pitchMod) * osc.modNodeValue);
  switch (osc.waveform) {
    case SINE:
    case NOISE:
      osc.phaseInc = freq2PhaseIncr(cur);
      break;
    case SAW: case TRI: case REC: case PWM: {
      osc.phaseInc = freq2PhaseIncr1024(cur);
      const idx = freqToTableIndex(cur);
      osc.tableOffset = idx > 10 ? 10 : idx;
      break;
    }
    default:
      osc.phaseInc = freq2PhaseIncr32767(cur);
      break;
  }
}

/** midiParser_calcDetune: fine tune value 0..127 -> +/- one semitone factor */
function calcDetune(value) {
  const frac = f(f(value / 127) - 0.5);
  return f(1 + f(frac * SEMITONE_UP_MINUS_1));
}

function osc_recalcFreq(osc) {
  const cent = calcDetune(osc.midiFreq & 0xff);
  let note = (osc.midiFreq >> 8) + (osc.baseNote - SEQ_DEFAULT_NOTE);
  if (note > 127) note = 127;
  if (note < 0) note = 0;
  osc.freq = f(MIDI_NOTE_FREQ[note] * cent);
}

function osc_setBaseNote(osc, baseNote) {
  osc.baseNote = baseNote & 0xff;
  osc_recalcFreq(osc);
}

const setCoarse = (osc, v) => { osc.midiFreq = (osc.midiFreq & 0x00ff) | ((v << 8) & 0xffff); osc_recalcFreq(osc); };
const setFine = (osc, v) => { osc.midiFreq = (osc.midiFreq & 0xff00) | v; osc_recalcFreq(osc); };

// ---------------------------------------------------------------------------------------
// Envelopes: Decay.c (pitch EG, float), SlopeEg2.c (amp EG, double), snapEg.c
// ---------------------------------------------------------------------------------------
const decaySlope = (val, slope) => f(f(f(1 + slope) * val) / f(1 + f(slope * Math.abs(val))));
const TIME_K = f(f(2 * f(0.99)) / f(1 - f(0.99)));

function decayEg_calcTime(data2) {
  const val = f(data2 / 127);
  const ret = f(f(1 - f(f(f(1 + TIME_K) * val) / f(1 + f(TIME_K * Math.abs(val))))) * 2);
  return ret > 1 ? 1 : ret;
}
function decayEg_setSlope(eg, data2) {
  const amount = f(f(f(data2 / 127) - 0.5) * 2);
  eg.slope = f(f(2 * amount) / f(1 - amount));
}
function decayEg_calc(eg) {
  let val = eg.value;
  if (val > 0) val = f(val - eg.decay);
  else val = 0;
  eg.value = val;
  return decaySlope(val, eg.slope);
}

const EG_STOPPED = 0, EG_A = 1, EG_D = 2, EG_REPEAT = 3;
const TIME_K_ATTACK = 2 * 0.99 / (1.0 - 0.99);
const TIME_K_DECAY = 2 * 0.999 / (1.0 - 0.999);
const slopeValue = (val, slope) => (1.0 + slope) * val / (1.0 + slope * Math.abs(val));

function makeSlopeEg() {
  return { attack: 0, decay: 0, slope: 0, invSlope: 0, repeat: 0, repeatCnt: 0, value: 0, state: 0 };
}
function slopeEg2_calcTime(data2, amount) {
  const val = data2 / 127.0;
  const ret = f((1.0 - ((1.0 + amount) * val / (1.0 + amount * Math.abs(val)))) * 2);
  return ret > 1 ? 1 : ret;
}
function slopeEg2_setSlope(eg, data2) {
  const amount = f(f(f(data2 / 127) - 0.5) * f(1.999));
  const inv = -amount;
  eg.slope = 2 * amount / (1 - amount);
  eg.invSlope = 2 * inv / (1 - inv);
}
function slopeEg2_init(eg) {
  eg.attack = 0.01; eg.decay = 0.01; eg.value = 0; eg.state = EG_STOPPED; eg.repeat = 0;
  slopeEg2_setSlope(eg, 0); // the C passes 0.5f to a uint8_t parameter
}
function slopeEg2_trigger(eg) {
  if (!eg.repeat) eg.state = EG_A;
  else { eg.state = EG_REPEAT; eg.value = 1.0; }
  eg.repeatCnt = eg.repeat;
}
function slopeEg2_calc(eg) {
  let val = eg.value;
  switch (eg.state) {
    case EG_STOPPED:
      return 0.0;
    case EG_REPEAT:
      // the attack time is used as the decay time of the repeated part
      if (val > 0) val -= eg.attack;
      else {
        eg.repeatCnt = (eg.repeatCnt - 1) & 0xff;
        if (eg.repeatCnt > 0) val = 1.0;
        else { eg.state = EG_D; val = 1.0; }
      }
      eg.value = val;
      return slopeValue(val, eg.slope);
    case EG_A:
      val += eg.attack;
      if (val >= 1.0) { val = 1.0; eg.state = EG_D; }
      eg.value = val;
      return slopeValue(val, eg.invSlope);
    case EG_D:
      if (val > 0) {
        val -= eg.decay;
        eg.value = val;
        return slopeValue(val, eg.slope);
      }
      eg.value = 0;
      return 0;
  }
  return 0;
}

function snapEg_calc(eg, time) {
  let ret = 0;
  if (eg.value > 0) {
    ret = f(f(eg.value * eg.value) * 24);
    eg.value = f(eg.value - f(f(0.2) * time));
  }
  return ret;
}

// ---------------------------------------------------------------------------------------
// transientGenerator.c: 12 one-shot click/attack samples, plus "snap" (0) and "offset" (1)
// ---------------------------------------------------------------------------------------
export const NUM_TRANSIENTS = 12;
const TRANSIENT_LEN = 2205;
const TRANSIENT_END = 2311061504; // 2204 << 20

function makeTransient() { return { phase: 0, pitch: 1, waveform: 0, volume: 1 }; }
function transient_setWaveform(t, w) { t.waveform = w < NUM_TRANSIENTS + 2 ? w : 0; }
function transient_calcBlock(t, buf, size) {
  if (t.waveform <= 1 || t.phase >= TRANSIENT_END) { buf.fill(0, 0, size); return; }
  const base = (t.waveform - 2) * TRANSIENT_LEN;
  const inc = f(t.pitch * 1048576);
  for (let i = 0; i < size; i++) {
    if (t.phase < TRANSIENT_END) {
      const idx = t.phase >>> 20;
      buf[i] = toI16(f(f(t.volume * (TRANSIENT_DATA[base + idx] << 8)) * (idx < TRANSIENT_LEN ? 1 : 0)));
      t.phase = toU32(f(f(t.phase) + inc)); // phase += float: the add happens in float
    } else {
      buf[i] = 0;
    }
  }
}

// ---------------------------------------------------------------------------------------
// distortion.c, 1PoleLp.c, valueShaper.h
// ---------------------------------------------------------------------------------------
const distShape = (shape) => { shape = f(shape - 0.0078125); return f(f(2 * shape) / f(1 - shape)); };
function distortSample(s, shape) {
  let x = f(s / F_32767);
  x = f(f(f(1 + shape) * x) / f(1 + f(shape * Math.abs(x))));
  return toI16(f(x * 32767));
}

function makeOnePole() { return { r: f(0.01), b: 0 }; } // initOnePole()
function calcOnePole(flt, input) {
  flt.b = fmaf(flt.r, input - flt.b, flt.b);
  return flt.b;
}

function valueShaperF2F(val, shape) {
  const k = f(f(2 * shape) / f(f(1.0001) - shape));
  return f(f(f(1 + k) * val) / f(1 + f(k * Math.abs(val))));
}
const FILTER_SHAPER = f(-0.9);

// ---------------------------------------------------------------------------------------
// ResonantFilter.c: zero-delay-feedback state variable filter with soft clipping
// ---------------------------------------------------------------------------------------
export const FILTER_LP = 1, FILTER_HP = 2, FILTER_BP = 3, FILTER_UNITY_BP = 4, FILTER_NOTCH = 5,
  FILTER_PEAK = 6, FILTER_NAIVE_2_POLE = 7, FILTER_OFF = 8;
export const FILTER_TYPE_NAMES = ['LP', 'HP', 'BP', 'Unity BP', 'Notch', 'Peak', 'LP2', 'Off'];

function makeFilter() { return { f: 0, g: 0, q: 0, s1: 0, s2: 0, a: 0, b: 0, drive: 0 }; }

function fastTanh(v) {
  if (v < f(-1.95)) return -1;
  if (v > f(1.95)) return 1;
  return f(f(f(4.15) * v) / f(f(4.29) + f(v * v)));
}
function fastTan(x) {
  x = f(x);
  const x2 = f(x * x);
  const A = f(f(-15 * x) + f(x * x2));
  const B = f(3 * f(-5 + f(2 * x2)));
  return f(A / B);
}
function tanhXdX(x) {
  const a = f(x * x);
  return f(f(f(f(a + 105) * a) + 945) / f(f(f(f(15 * a) + 420) * a) + 945));
}
const softClipTwo = (x) => f(x * tanhXdX(f(0.5 * x)));

function SVF_init(flt) {
  flt.s1 = 0; flt.s2 = 0; flt.a = flt.b = 0;
  flt.f = f(0.20); flt.q = f(0.9); flt.drive = f(0.315);
  SVF_directSetFilterValue(flt, f(0.25));
}
function SVF_reset(flt) { flt.s1 = 0; flt.s2 = 0; flt.a = flt.b = 0; }
function SVF_setReso(flt, fb) { flt.q = f(1 - fb); if (flt.q < f(0.1)) flt.q = f(0.02); }
function SVF_setDrive(flt, d) { flt.drive = f(f(0.4) + f(f(d * d) * 6)); }
function SVF_directSetFilterValue(flt, val) {
  flt.f = f(val * f(0.5 * f(0.9)));
  flt.g = fastTan(Math.PI * flt.f);
}
function SVF_recalcFreq(flt) { flt.g = fastTan(Math.PI * flt.f); }

function SVF_calcBlockZDF(flt, type, buf, size) {
  const g = flt.g;
  const R = flt.f >= f(0.4499) ? 1 : flt.q; // high cutoff + resonance would go unstable
  const gg = f(g * g);
  if (type === FILTER_OFF) return;
  if (type === FILTER_NAIVE_2_POLE) {
    const f2 = f(flt.f * f(2.21));
    for (let i = 0; i < size; i++) {
      const x = softClipTwo(f(f(buf[i] / F_32767) * flt.drive));
      const q = f(f(1 - flt.q) * 1.4 + f(1 - flt.q) / (1.0 - f2));
      flt.a = f(flt.a + f(f2 * f(f(x - flt.a) + f(q * f(flt.a - flt.b)))));
      if (flt.a > 1) flt.a = 1; else if (flt.a < -1) flt.a = -1;
      flt.b = f(flt.b + f(f2 * f(flt.a - flt.b)));
      if (flt.b > 1) flt.b = 1; else if (flt.b < -1) flt.b = -1;
      buf[i] = ssat16(toI32(f(flt.b * 32767)));
    }
    return;
  }
  if (flt.s1 !== flt.s1) flt.s1 = 0; // removeMaliciousSample()
  if (flt.s2 !== flt.s2) flt.s2 = 0;
  for (let i = 0; i < size; i++) {
    const x = softClipTwo(f(f(buf[i] / F_32767) * flt.drive));
    // t0 = t1 = 1 (nonlinear integrators are compiled out)
    const g0 = f(1 / f(1 + f(f(g * 2) * R)));
    const s1 = flt.s1, s2 = flt.s2;
    const f1 = f(gg * g0);
    const y1 = f(f(f(f(f1 * x) + s2) + f(f(g * g0) * s1)) / f(f1 + 1));
    const xx = f(x - y1);
    const y0 = f(f(softClipTwo(s1) + f(g * xx)) * g0);
    flt.s1 = f(softClipTwo(s1) + f(f(2 * g) * f(xx - f(f(2 * R) * y0))));
    flt.s2 = f(s2 + f(f(2 * g) * y0));
    let out;
    switch (type) {
      case FILTER_LP: out = f(fastTanh(y1) * 32767); break;
      case FILTER_HP: { const ugb = f(f(2 * R) * y0); out = f(f(f(x - ugb) - y1) * 32767); break; }
      case FILTER_BP: out = f(y0 * 32767); break;
      case FILTER_UNITY_BP: out = f(f(f(2 * R) * y0) * 32767); break;
      case FILTER_NOTCH: out = f(f(x - f(f(2 * R) * y0)) * 32767); break;
      case FILTER_PEAK: { const ugb = f(f(2 * R) * y0); const h = f(f(x - ugb) - y1); out = f(f(y1 - h) * 32767); break; }
      default: return; // unknown type: stop processing (leaves the rest of the block as is)
    }
    buf[i] = ssat16(toI32(out));
  }
}

// ---------------------------------------------------------------------------------------
// lfo.c
// ---------------------------------------------------------------------------------------
export const LFO_WAVE_NAMES = ['Sine', 'Tri', 'Saw up', 'Saw down', 'Rec', 'Noise', 'Exp up', 'Exp down'];
const NUM_LFO_WAVEFORMS = 8;
const LFO_SR = f(REAL_FS / f(BLOCK));
const LFO_MAX_F = 200;

function makeLfo() {
  return { phase: 0, phaseInc: 1, waveform: 0, retrigger: 0, phaseOffset: 0, rnd: 0, sync: 0,
    freq: 1, modNodeValue: 1, modTarget: makeModNode() };
}
function lfo_calc(lfo, rng) {
  const old = lfo.phase;
  lfo.phase = (lfo.phase + toU32(f(lfo.phaseInc * lfo.modNodeValue))) >>> 0;
  const overflow = old > lfo.phase;
  const ph = lfo.phase;
  switch (lfo.waveform) {
    case 0: return f(f(f(SINE_TABLE[ph >>> 20] / F_32767) + 1) / 2);
    case 1: return f(1 - Math.abs(f(f(f(f(ph) / F_2POW32) * 2) - 1)));
    case 2: return f(f(ph) / F_2POW32);
    case 4: return ph > 0x7fffffff ? 1 : 0;
    case 5:
      if (overflow) { lfo.rnd = f(rng.next()); lfo.rnd = f(lfo.rnd / F_2POW32); }
      return lfo.rnd;
    case 3: return f(f(0xffffffff - ph) / F_2POW32);
    case 6: { const x = f(f(ph) / F_2POW32); return f(f(x * x) * x); }
    case 7: { const x = f(f(0xffffffff - ph) / F_2POW32); return f(f(x * x) * x); }
    default: return 0;
  }
}
const SYNC_SCALERS = [0, 0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 32];
export const LFO_SYNC_NAMES = ['Off', '4/1', '2/1', '1/1', '1/2', '1/3', '1/4', '1/6', '1/8', '1/12', '1/16', '1/32'];
function lfo_calcPhaseInc(freq, sync, bpm) {
  if (sync === 0 || sync > 11) return toU32(f(f(freq / LFO_SR) * F_2POW32));
  const b = f(bpm);
  const tempo = b > 0.0 ? f(f(b / 60) / 4) : 0;
  const syncFreq = f(tempo * SYNC_SCALERS[sync]);
  return toU32(f(f(syncFreq / LFO_SR) * F_2POW32));
}

// ---------------------------------------------------------------------------------------
// modulationNode.c: velocity and LFO modulation re-send a target parameter through the
// parameter handler with a modulated 0..1 value
// ---------------------------------------------------------------------------------------
function makeModNode() { return { destination: 0, amount: 0, lastVal: 0 }; }

// parameters that have a pointer in parameterArray (ParameterArray.c); others are ignored
// as modulation destinations
export const MODULATABLE = new Set([
  'AMOUNT_LFO1', 'AMOUNT_LFO2', 'AMOUNT_LFO3', 'AMOUNT_LFO4', 'AMOUNT_LFO5', 'AMOUNT_LFO6', 'AUDIO_OUT1',
  'AUDIO_OUT2', 'AUDIO_OUT3', 'AUDIO_OUT4', 'AUDIO_OUT5', 'AUDIO_OUT6', 'COARSE1', 'COARSE2', 'COARSE3',
  'COARSE4', 'COARSE5', 'COARSE6', 'CYMBAL_DISTORTION', 'DRIVE1', 'DRIVE2', 'DRIVE3', 'FILTER_DRIVE_1',
  'FILTER_DRIVE_2', 'FILTER_DRIVE_3', 'FILTER_DRIVE_4', 'FILTER_DRIVE_5', 'FILTER_DRIVE_6', 'FILTER_FREQ_1',
  'FILTER_FREQ_2', 'FILTER_FREQ_3', 'FILTER_FREQ_4', 'FILTER_FREQ_5', 'FILTER_FREQ_6', 'FILTER_TYPE_1',
  'FILTER_TYPE_2', 'FILTER_TYPE_3', 'FILTER_TYPE_4', 'FILTER_TYPE_5', 'FILTER_TYPE_6', 'FINE1', 'FINE2',
  'FINE3', 'FINE4', 'FINE5', 'FINE6', 'FMAMNT1', 'FMAMNT2', 'FMAMNT3', 'FM_FREQ1', 'FM_FREQ2', 'FM_FREQ3',
  'FREQ_LFO1', 'FREQ_LFO2', 'FREQ_LFO3', 'FREQ_LFO4', 'FREQ_LFO5', 'FREQ_LFO6', 'FX_DELAY_TYPE',
  'FX_DIST_TYPE', 'FX_DRY_WET', 'FX_P1', 'FX_P2', 'FX_P3', 'FX_P4', 'FX_RATIO', 'FX_ROUTING', 'FX_TYPE',
  'FX_WAVE', 'HAT_DISTORTION', 'MIDI_NOTE1', 'MIDI_NOTE2', 'MIDI_NOTE3', 'MIDI_NOTE4', 'MIDI_NOTE5',
  'MIDI_NOTE6', 'MIDI_NOTE7', 'MIX1', 'MIX_MOD_1', 'MIX_MOD_2', 'MIX_MOD_3', 'MODAMNT1', 'MODAMNT2',
  'MODAMNT3', 'MODAMNT4', 'MOD_EG1', 'MOD_EG2', 'MOD_EG3', 'MOD_EG4', 'MOD_OSC_F1', 'MOD_OSC_F1_CYM',
  'MOD_OSC_F2', 'MOD_OSC_F2_CYM', 'MOD_OSC_GAIN1', 'MOD_OSC_GAIN1_CYM', 'MOD_OSC_GAIN2', 'MOD_OSC_GAIN2_CYM',
  'MOD_WAVE_DRUM1', 'MOD_WAVE_DRUM2', 'MOD_WAVE_DRUM3', 'NOISE_FREQ1', 'OFFSET_LFO1', 'OFFSET_LFO2',
  'OFFSET_LFO3', 'OFFSET_LFO4', 'OFFSET_LFO5', 'OFFSET_LFO6', 'OSC_WAVE_DRUM1', 'OSC_WAVE_DRUM2',
  'OSC_WAVE_DRUM3', 'OSC_WAVE_SNARE', 'PAN1', 'PAN2', 'PAN3', 'PAN4', 'PAN5', 'PAN6', 'PITCH_SLOPE1',
  'PITCH_SLOPE2', 'PITCH_SLOPE3', 'PITCH_SLOPE4', 'PWM_1', 'PWM_2', 'PWM_3', 'PWM_4', 'PWM_5', 'PWM_6',
  'REPEAT4', 'REPEAT5', 'RESO_1', 'RESO_2', 'RESO_3', 'RESO_4', 'RESO_5', 'RESO_6', 'RETRIGGER_LFO1',
  'RETRIGGER_LFO2', 'RETRIGGER_LFO3', 'RETRIGGER_LFO4', 'RETRIGGER_LFO5', 'RETRIGGER_LFO6',
  'SNARE_DISTORTION', 'SYNC_LFO1', 'SYNC_LFO2', 'SYNC_LFO3', 'SYNC_LFO4', 'SYNC_LFO5', 'SYNC_LFO6',
  'TRANS1_FREQ', 'TRANS1_VOL', 'TRANS1_WAVE', 'TRANS2_FREQ', 'TRANS2_VOL', 'TRANS2_WAVE', 'TRANS3_FREQ',
  'TRANS3_VOL', 'TRANS3_WAVE', 'TRANS4_FREQ', 'TRANS4_VOL', 'TRANS4_WAVE', 'TRANS5_FREQ', 'TRANS5_VOL',
  'TRANS5_WAVE', 'TRANS6_FREQ', 'TRANS6_VOL', 'TRANS6_WAVE', 'VELOA1', 'VELOA2', 'VELOA3', 'VELOA4',
  'VELOA5', 'VELOA6', 'VELOD1', 'VELOD2', 'VELOD3', 'VELOD4', 'VELOD5', 'VELOD6_CLOSED', 'VELOD6_OPEN',
  'VELO_MOD_AMT_1', 'VELO_MOD_AMT_2', 'VELO_MOD_AMT_3', 'VELO_MOD_AMT_4', 'VELO_MOD_AMT_5', 'VELO_MOD_AMT_6',
  'VEL_DEST_1', 'VEL_DEST_2', 'VEL_DEST_3', 'VEL_DEST_4', 'VEL_DEST_5', 'VEL_DEST_6', 'VOICE_DECIMATION1',
  'VOICE_DECIMATION2', 'VOICE_DECIMATION3', 'VOICE_DECIMATION4', 'VOICE_DECIMATION5', 'VOICE_DECIMATION6',
  'VOICE_DECIMATION_ALL', 'VOL1', 'VOL2', 'VOL3', 'VOL4', 'VOL5', 'VOL6', 'VOLUME_MOD_ON_OFF1',
  'VOLUME_MOD_ON_OFF2', 'VOLUME_MOD_ON_OFF3', 'VOLUME_MOD_ON_OFF4', 'VOLUME_MOD_ON_OFF5',
  'VOLUME_MOD_ON_OFF6', 'VOL_SLOPE1', 'VOL_SLOPE2', 'VOL_SLOPE3', 'VOL_SLOPE4', 'VOL_SLOPE5', 'VOL_SLOPE6',
  'WAVE1_CYM', 'WAVE1_HH', 'WAVE2_CYM', 'WAVE2_HH', 'WAVE3_CYM', 'WAVE3_HH', 'WAVE_LFO1', 'WAVE_LFO2',
  'WAVE_LFO3', 'WAVE_LFO4', 'WAVE_LFO5', 'WAVE_LFO6',
].map((n) => PAR[n]));

// ---------------------------------------------------------------------------------------
// Voices: DrumVoice.c, Snare.c, CymbalVoice.c, HiHat.c
// ---------------------------------------------------------------------------------------
function makeDrumVoice(i) {
  const v = {
    osc: makeOsc(), modOsc: makeOsc(), fmModAmount: f(0.5), vol: f(0.8), velo: 0, pan: 0,
    triggeredPanL: 0, triggeredPanR: 0, oscPitchEg: { decay: f(0.01), slope: 0, value: 0 },
    egPitchModAmount: f(0.5), transGen: makeTransient(), lfo: makeLfo(), oscVolEg: makeSlopeEg(),
    distortion: { shape: 0, driveFilter: makeOnePole() }, filter: makeFilter(), filterType: 1,
    ampFilterInput: 0, lastGain: 0, mixOscs: 1, snapEg: { value: 0 }, volumeMod: 1,
    combinedVolume: 0, faderFilter: makeOnePole(), mixerVolFilter: makeOnePole(), pwm: 0,
  };
  v.faderFilter.r = 0.01;
  v.mixerVolFilter.r = 0.01;
  v.distortion.driveFilter.r = 0.01;
  SVF_init(v.filter);
  Object.assign(v.modOsc, { freq: 440, waveform: 1, fmMod: 0, midiFreq: 70 << 8 | 64, pitchMod: 1, modNodeValue: 1 });
  Object.assign(v.osc, { freq: 440, modNodeValue: 1, waveform: TRI + i, fmMod: 0, midiFreq: 70 << 8 | 64 });
  slopeEg2_init(v.oscVolEg);
  v.distortion.shape = distShape(0);
  return v;
}

function makeSnare() {
  const v = {
    osc: makeOsc(), noiseOsc: makeOsc(), filterType: 0, vol: f(0.8), pan: 0, triggeredPanL: 0,
    triggeredPanR: 0, mix: 0, velo: 0, filter: makeFilter(), oscPitchEg: { decay: f(0.01), slope: 0, value: 0 },
    egPitchModAmount: f(0.5), lfo: makeLfo(), transGen: makeTransient(), oscVolEg: makeSlopeEg(),
    egValueOscVol: 0, distortionShape: 0, snapEg: { value: 0 }, volumeMod: 1, combinedVolume: 0,
    faderFilter: makeOnePole(), pwm: 0,
  };
  v.faderFilter.r = 0.1;
  Object.assign(v.noiseOsc, { freq: 440, waveform: 1, fmMod: 0, midiFreq: 70 << 8 | 64, pitchMod: 1, modNodeValue: 1 });
  Object.assign(v.osc, { freq: 440, waveform: 1, fmMod: 0, midiFreq: 70 << 8 | 64, modNodeValue: 1 });
  v.distortionShape = distShape(0);
  slopeEg2_init(v.oscVolEg);
  SVF_init(v.filter);
  return v;
}

// cymbal and hihat share one structure: an FM oscillator driven by two mod oscillators
function makeMetal() {
  const v = {
    osc: makeOsc(), modOsc: makeOsc(), modOsc2: makeOsc(), fmModAmount1: f(0.5), fmModAmount2: f(0.5),
    vol: f(0.8), pan: 0, triggeredPanL: 0, triggeredPanR: 0, velo: 0, filter: makeFilter(), filterType: 0,
    lfo: makeLfo(), transGen: makeTransient(), distortionShape: 0, oscVolEg: makeSlopeEg(), egValueOscVol: 0,
    volumeMod: 1, snapEg: { value: 0 }, combinedVolume: 0, faderFilter: makeOnePole(), pwm: 0,
    decayClosed: 0, decayOpen: 0, isOpen: 0,
  };
  v.faderFilter.r = 0.1;
  v.distortionShape = distShape(0);
  Object.assign(v.modOsc, { freq: 440, waveform: SINE, fmMod: 0, midiFreq: 70 << 8 | 64, pitchMod: 1, modNodeValue: 1 });
  Object.assign(v.modOsc2, { freq: 440, waveform: NOISE, fmMod: 0, midiFreq: 70 << 8 | 64, pitchMod: 1, modNodeValue: 1 });
  Object.assign(v.osc, { freq: 440, waveform: 1, fmMod: 1, midiFreq: 70 << 8 | 64, pitchMod: 1, modNodeValue: 1 });
  slopeEg2_init(v.oscVolEg);
  SVF_init(v.filter);
  return v;
}

function updatePan(v) {
  v.triggeredPanL = f(Math.sqrt(f((127 - v.pan) / 127)));
  v.triggeredPanR = f(Math.sqrt(f(v.pan / 127)));
}

// oscillator start phase on trigger; "offset" transient mode (1) starts it later in the cycle
function resetPhase(osc, offset, sineStart) {
  if (osc.waveform === SINE) osc.phase = toU32(sineStart(offset));
  else if (osc.waveform > SINE && osc.waveform <= REC) osc.phase = toU32(f((0xff << 22) * offset));
  else osc.phase = 0;
}
const drumSineStart = (offset) => f(1024 + f(((0x3ff << 20) - 1024) * offset));
const otherSineStart = (offset) => f((0x3ff << 20) * offset);

// ---------------------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------------------
export class LxrEngine {
  constructor({ seed } = {}) {
    this.rng = new Rng(seed);
    this.bpm = 120;
    this.faderVolume = [1, 1, 1, 1, 1, 1];
    this.activeParameters = new Uint8Array(PAR.NUM_PARAMS);
    this.activeNrpnNumber = 0;
    // mixer_init()
    this.decimationRate = new Float32Array(7).fill(1);
    this.decimationCnt = new Float32Array(6);
    this.voiceSamples = new Int16Array(6);
    this.audioRouting = new Uint8Array(6);
    this.velocityModulators = Array.from({ length: 6 }, makeModNode);
    // initDrumVoice(), Snare_init(), HiHat_init(), Cymbal_init()
    this.drums = [0, 1, 2].map(makeDrumVoice);
    this.snare = makeSnare();
    this.hat = makeMetal();
    this.cymbal = makeMetal();
    this.lfos = [this.drums[0].lfo, this.drums[1].lfo, this.drums[2].lfo, this.snare.lfo, this.cymbal.lfo, this.hat.lfo];
    this.out = Array.from({ length: 6 }, () => new Int16Array(BLOCK));
    this._modBuf = new Int16Array(BLOCK);
    this._buf2 = new Int16Array(BLOCK);
    this._buf3 = new Int16Array(BLOCK);
    this.xmod = null; // crossfeed matrix, see setCrossMod(); null = the firmware's signal path
  }

  /**
   * Crossfeed (not in the firmware): feeds each voice's output into other voices.
   * amounts[src * 6 + dst] is -1..1; targets[dst] is 'fm' (audio-rate phase modulation of the
   * voice's main oscillator), 'filter' (the source's level moves the cutoff, up to 4 octaves
   * either way) or 'ring' (ring modulation of the voice's output). Sources are read one
   * block (64 samples) late, so a voice can also modulate itself. Pass null to switch it off.
   */
  setCrossMod(amounts, targets) {
    if (!amounts || !amounts.some((a) => a !== 0)) {
      this.xmod = null;
      for (const o of this._xOscs()) o.pm = null;
      return;
    }
    if (!this.xmod) {
      this.xmod = { amt: new Float32Array(36), target: [], prev: Array.from({ length: 6 }, () => new Int16Array(BLOCK)),
        env: new Float32Array(6), pm: Array.from({ length: 6 }, () => new Uint32Array(BLOCK)) };
    }
    this.xmod.amt.set(amounts);
    this.xmod.target = targets.slice();
  }
  _xOscs() { return [this.drums[0].osc, this.drums[1].osc, this.drums[2].osc, this.snare.osc, this.cymbal.osc, this.hat.osc]; }
  _xmodBefore() {
    const x = this.xmod, oscs = this._xOscs();
    const filters = [this.drums[0].filter, this.drums[1].filter, this.drums[2].filter, this.snare.filter, this.cymbal.filter, this.hat.filter];
    // envelope follower on last block's outputs: instant attack, ~30 ms release
    for (let n = 0; n < 6; n++) {
      let pk = 0; for (const v of x.prev[n]) { const a = v < 0 ? -v : v; if (a > pk) pk = a; }
      x.env[n] = Math.max(pk / 32768, x.env[n] * 0.955);
    }
    for (let d = 0; d < 6; d++) {
      const t = x.target[d];
      let any = false; for (let sIdx = 0; sIdx < 6; sIdx++) if (x.amt[sIdx * 6 + d]) any = true;
      oscs[d].pm = null;
      if (!any) continue;
      if (t === 'fm') {
        // up to 1.5 cycles of phase shift per full-scale source
        const pm = x.pm[d];
        for (let i = 0; i < BLOCK; i++) {
          let c = 0;
          for (let sIdx = 0; sIdx < 6; sIdx++) { const a = x.amt[sIdx * 6 + d]; if (a) c += x.prev[sIdx][i] / 32768 * a * 1.5; }
          pm[i] = ((c - Math.floor(c)) * 4294967296) >>> 0;
        }
        oscs[d].pm = pm;
      } else if (t === 'filter') {
        let oct = 0; for (let sIdx = 0; sIdx < 6; sIdx++) oct += x.amt[sIdx * 6 + d] * x.env[sIdx] * 4;
        const fl = filters[d], fc = Math.min(0.449, Math.max(0.0003, fl.f * Math.pow(2, oct)));
        fl.g = fastTan(Math.PI * fc);
      }
    }
  }
  _xmodAfter() {
    const x = this.xmod, o = this.out;
    for (let d = 0; d < 6; d++) {
      if (x.target[d] !== 'ring') continue;
      let sum = 0; for (let sIdx = 0; sIdx < 6; sIdx++) sum += Math.abs(x.amt[sIdx * 6 + d]);
      if (!sum) continue;
      const dry = Math.max(0, 1 - sum), buf = o[d];
      for (let i = 0; i < BLOCK; i++) {
        let m = 0; for (let sIdx = 0; sIdx < 6; sIdx++) { const a = x.amt[sIdx * 6 + d]; if (a) m += x.prev[sIdx][i] / 32768 * a * 2; }
        buf[i] = ssat16(Math.round(buf[i] * (dry + m)));
      }
    }
    for (let n = 0; n < 6; n++) x.prev[n].set(o[n]);
  }

  /** load the firmware's init kit, sending the parameters in preset-load order */
  loadInitKit() {
    const kit = new Uint8Array(PAR.END_OF_SOUND_PARAMETERS);
    for (let i = 8; i < PAR.END_OF_SOUND_PARAMETERS; i++) kit[i - 8] = INIT_KIT[i];
    this.loadKit(kit);
  }

  /** load a kit given as parameter values indexed by parameter number */
  loadKit(values) {
    for (let i = 0; i < values.length && i < PAR.END_OF_SOUND_PARAMETERS; i++) this.activeParameters[i] = values[i];
    // preset_sendDrumsetParameters(): the velocity and LFO targets go first
    for (let i = 0; i < 6; i++) {
      this.setVelocityDestination(i, this._targetPar(this.activeParameters[PAR.VEL_DEST_1 + i]));
      this.setLfoDestination(i, this._targetPar(this.activeParameters[PAR.TARGET_LFO1 + i]));
    }
    for (let i = 0; i < PAR.END_OF_SOUND_PARAMETERS; i++) {
      const p = PARAMETER_ORDER[i];
      this.setParam(p, this.activeParameters[p]);
    }
  }

  /** a parameter edit (front panel knob or MIDI CC): parameter number and value 0..127 */
  setParam(par, value) {
    this.activeParameters[par] = value;
    if (par === 0) return; // PAR_NONE
    // target menus: the value is an index into MOD_TARGETS, the menu sends the target separately
    if (par >= PAR.VEL_DEST_1 && par <= PAR.VEL_DEST_6) this.setVelocityDestination(par - PAR.VEL_DEST_1, this._targetPar(value));
    if (par >= PAR.TARGET_LFO1 && par <= PAR.TARGET_LFO6) this.setLfoDestination(par - PAR.TARGET_LFO1, this._targetPar(value));
    this._dispatch(par, value, false, 0);
  }

  // paramArray_setParameter / modNode_updateValue: parameter n < 128 is CC n+1, above it CC2 n-128
  _dispatch(par, data2, isFloatModulator, v) {
    if (par < 128) this.ccHandler(false, (par + 1) & 0x7f, data2, isFloatModulator, v);
    else this.ccHandler(true, (par - 128) & 0x7f, data2, isFloatModulator, v);
  }

  _targetPar(index) { return (MOD_TARGETS[index] || MOD_TARGETS[0])[1]; }

  /** modNode_setDestination() for a voice's velocity modulation (voice 0..5, parameter number) */
  setVelocityDestination(voice, par) { this._resetTargets(); this.velocityModulators[voice].destination = par; }
  /** modNode_setDestination() for an LFO (0..5, in voice order) */
  setLfoDestination(lfo, par) { this._resetTargets(); this.lfos[lfo].modTarget.destination = par; }

  /** voiceControl_noteOn: voice 0..2 drums, 3 snare, 4 cymbal, 5 closed hat, 6 open hat */
  trigger(voice, velocity = 127, note = SEQ_DEFAULT_NOTE) {
    if (voice < 3) this._drumTrigger(voice, velocity, note);
    else if (voice < 4) this._snareTrigger(velocity, note);
    else if (voice < 5) this._cymbalTrigger(velocity, note);
    else this._hatTrigger(velocity, voice - 5, note);
  }

  // ----- modulation -----
  _modUpdate(vm, val) {
    vm.lastVal = val;
    if (!MODULATABLE.has(vm.destination)) return;
    const original = f(this.activeParameters[vm.destination] / 127);
    let nv = f(original + f(vm.amount * f(f(val * 2) - 1)));
    nv = nv < 0 ? 0 : nv > 1 ? 1 : nv;
    this._dispatch(vm.destination, 0, true, nv);
  }
  _setOriginal(par) {
    if (!MODULATABLE.has(par)) return;
    this._dispatch(par, this.activeParameters[par], false, 0);
  }
  _resetTargets() {
    for (const vm of this.velocityModulators) this._setOriginal(vm.destination);
    for (const lfo of this.lfos) this._setOriginal(lfo.modTarget.destination);
  }
  _lfoRetrigger(voice) {
    for (const lfo of this.lfos) if (lfo.retrigger === voice + 1) lfo.phase = lfo.phaseOffset;
  }
  _lfoSetFreq(lfo, x) {
    x = f(f(0.0078125) + f(x * f(1 - f(0.0078125))));
    x = f(f(x * x) * x);
    lfo.freq = f(x * LFO_MAX_F);
    lfo.phaseInc = lfo_calcPhaseInc(lfo.freq, lfo.sync, this.bpm);
  }

  // ----- triggers -----
  _drumTrigger(n, vel, note) {
    const v = this.drums[n];
    this._lfoRetrigger(n);
    this._modUpdate(this.velocityModulators[n], f(vel / 127));
    let offset = 1;
    if (v.transGen.waveform === 1) offset = f(offset - v.transGen.volume);
    resetPhase(v.osc, offset, drumSineStart);
    resetPhase(v.modOsc, 1, drumSineStart);
    osc_setBaseNote(v.osc, note);
    osc_setBaseNote(v.modOsc, note);
    v.oscPitchEg.value = 1;
    slopeEg2_trigger(v.oscVolEg);
    v.velo = f(vel / 127);
    v.transGen.phase = 0;
    v.snapEg.value = 1;
    SVF_reset(v.filter);
    updatePan(v);
  }
  _snareTrigger(vel, note) {
    const v = this.snare;
    this._lfoRetrigger(3);
    this._modUpdate(this.velocityModulators[3], f(vel / 127));
    let offset = 1;
    if (v.transGen.waveform === 1) offset = f(offset - v.transGen.volume);
    resetPhase(v.osc, offset, otherSineStart);
    v.oscPitchEg.value = 1;
    slopeEg2_trigger(v.oscVolEg);
    v.velo = f(vel / 127);
    osc_setBaseNote(v.osc, note);
    v.transGen.phase = 0;
    v.snapEg.value = 1;
    updatePan(v);
  }
  _metalTrigger(v, lfoVoice, vel, note) {
    this._lfoRetrigger(lfoVoice);
    this._modUpdate(this.velocityModulators[lfoVoice], f(vel / 127));
    let offset = 1;
    if (v.transGen.waveform === 1) offset = f(offset - v.transGen.volume);
    resetPhase(v.osc, offset, otherSineStart);
    v.modOsc.phase = 0;
    v.modOsc2.phase = 0;
    osc_setBaseNote(v.osc, note);
    osc_setBaseNote(v.modOsc, note);
    osc_setBaseNote(v.modOsc2, note);
  }
  _cymbalTrigger(vel, note) {
    const v = this.cymbal;
    this._metalTrigger(v, 4, vel, note);
    slopeEg2_trigger(v.oscVolEg);
    v.velo = f(vel / 127);
    v.transGen.phase = 0;
    v.snapEg.value = 1;
    updatePan(v);
  }
  _hatTrigger(vel, isOpen, note) {
    const v = this.hat;
    this._metalTrigger(v, 5, vel, note);
    v.isOpen = isOpen;
    v.oscVolEg.decay = isOpen ? v.decayOpen : v.decayClosed;
    slopeEg2_trigger(v.oscVolEg);
    v.velo = f(vel / 127);
    v.transGen.phase = 0;
    v.snapEg.value = 1;
    updatePan(v);
  }

  // ----- per-block control rate (calc*Async) -----
  _drumAsync(v) {
    const egPitch = decayEg_calc(v.oscPitchEg);
    v.osc.pitchMod = f(1 + f(egPitch * v.egPitchModAmount));
    if (v.transGen.waveform === 0) {
      const snap = snapEg_calc(v.snapEg, v.transGen.pitch);
      v.osc.pitchMod = f(v.osc.pitchMod + f(snap * v.transGen.volume));
    }
    v.osc.fmMod = f(v.fmModAmount * egPitch);
    const eg = v.oscVolEg;
    if (eg.attack === 1 && (eg.state === EG_A || eg.state === EG_REPEAT)) {
      // attack 0: jump straight to the new gain instead of ramping
      v.ampFilterInput = slopeEg2_calc(eg);
      v.lastGain = v.ampFilterInput;
    } else {
      v.lastGain = v.ampFilterInput;
      v.ampFilterInput = slopeEg2_calc(eg);
    }
    osc_setFreq(v.osc);
    osc_setFreq(v.modOsc);
  }
  _snareAsync(v) {
    const egPitch = decayEg_calc(v.oscPitchEg);
    v.osc.pitchMod = f(1 + f(egPitch * v.egPitchModAmount));
    v.egValueOscVol = f(slopeEg2_calc(v.oscVolEg));
    if (v.transGen.waveform === 0) {
      const snap = snapEg_calc(v.snapEg, v.transGen.pitch);
      v.osc.pitchMod = f(v.osc.pitchMod + f(snap * v.transGen.volume));
    }
    osc_setFreq(v.osc);
    osc_setFreq(v.noiseOsc);
  }
  _metalAsync(v) {
    v.egValueOscVol = f(slopeEg2_calc(v.oscVolEg));
    if (v.transGen.waveform === 0) {
      const snap = snapEg_calc(v.snapEg, v.transGen.pitch);
      v.osc.pitchMod = f(1 + f(snap * v.transGen.volume));
    }
    osc_setFreq(v.osc);
    osc_setFreq(v.modOsc);
    osc_setFreq(v.modOsc2);
  }

  // ----- audio rate (calc*SyncBlock) -----
  _drumSync(n, buf) {
    const v = this.drums[n], mod = this._modBuf, size = BLOCK;
    calcNextOscSampleBlock(v.modOsc, mod, size, v.fmModAmount, v.pwm, this.rng);
    if (v.mixOscs) {
      calcNextOscSampleBlock(v.osc, buf, size, f(1 - v.fmModAmount), v.pwm, this.rng);
      for (let i = 0; i < size; i++) buf[i] = qadd16(buf[i], mod[i]);
    } else {
      calcNextOscSampleFmBlock(v.osc, mod, buf, size, 1, v.pwm, this.rng);
    }
    transient_calcBlock(v.transGen, mod, size);
    for (let i = 0; i < size; i++) buf[i] = qadd16(buf[i], mod[i]);
    SVF_calcBlockZDF(v.filter, v.filterType, buf, size);
    // amp EG, interpolated over the block (bufferTool_addGainInterpolated)
    const gain = f(v.ampFilterInput), last = f(v.lastGain), d = f(gain - last);
    for (let i = 0; i < size; i++) buf[i] = toI16(buf[i] * (last + f(i / f(size - 1)) * d));
    if (v.volumeMod) for (let i = 0; i < size; i++) buf[i] = toI16(f(buf[i] * v.velo));
    // drive, with the drive amount smoothed per sample (calcDistBlockFiltered)
    for (let i = 0; i < size; i++) buf[i] = distortSample(buf[i], calcOnePole(v.distortion.driveFilter, v.distortion.shape));
    for (let i = 0; i < size; i++) {
      const mixVol = calcOnePole(v.mixerVolFilter, v.vol);
      v.combinedVolume = f(mixVol * calcOnePole(v.faderFilter, this.faderVolume[n]));
      buf[i] = toI16(f(buf[i] * v.combinedVolume));
    }
  }
  _snareSync(buf) {
    const v = this.snare, osc = this._buf2, trans = this._buf3, size = BLOCK;
    calcNoiseBlock(v.noiseOsc, buf, size, f(0.9), this.rng);
    SVF_calcBlockZDF(v.filter, v.filterType, buf, size);
    calcNextOscSampleBlock(v.osc, osc, size, f(1 - v.mix), v.pwm, this.rng);
    transient_calcBlock(v.transGen, trans, size);
    v.combinedVolume = v.volumeMod ? f(f(v.vol * v.velo) * v.egValueOscVol) : f(v.vol * v.egValueOscVol);
    for (let j = 0; j < size; j++) {
      let tmp = fmaf(buf[j], v.mix, osc[j]);
      tmp = f(tmp + trans[j]);
      buf[j] = toI16(f(f(v.combinedVolume * tmp) * calcOnePole(v.faderFilter, this.faderVolume[3])));
    }
    for (let j = 0; j < size; j++) buf[j] = distortSample(buf[j], v.distortionShape);
  }
  _metalSync(v, fmGain, faderIdx, buf) {
    const mod = this._buf2, mod2 = this._buf3, size = BLOCK;
    calcNextOscSampleBlock(v.modOsc, mod, size, v.fmModAmount1, v.pwm, this.rng);
    calcNextOscSampleBlock(v.modOsc2, mod2, size, v.fmModAmount2, v.pwm, this.rng);
    for (let i = 0; i < size; i++) mod[i] = qadd16(mod[i], mod2[i]);
    calcNextOscSampleFmBlock(v.osc, mod, buf, size, fmGain, v.pwm, this.rng);
    SVF_calcBlockZDF(v.filter, v.filterType, buf, size);
    transient_calcBlock(v.transGen, mod, size);
    v.combinedVolume = v.volumeMod ? f(f(v.vol * v.velo) * v.egValueOscVol) : f(v.vol * v.egValueOscVol);
    for (let i = 0; i < size; i++) buf[i] = qadd16(buf[i], mod[i]);
    for (let j = 0; j < size; j++) {
      buf[j] = toI16(f(buf[j] * f(v.combinedVolume * calcOnePole(v.faderFilter, this.faderVolume[faderIdx]))));
    }
    for (let j = 0; j < size; j++) buf[j] = distortSample(buf[j], v.distortionShape);
  }
  _decimate(n, buf) {
    const inc = f(this.decimationRate[n] * this.decimationRate[6]);
    for (let i = 0; i < BLOCK; i++) {
      this.decimationCnt[n] = f(this.decimationCnt[n] + inc);
      if (this.decimationCnt[n] >= 1) {
        this.decimationCnt[n] = f(this.decimationCnt[n] - 1);
        this.voiceSamples[n] = buf[i];
      }
      buf[i] = this.voiceSamples[n];
    }
  }

  /**
   * mixer_calcNextSampleBlock(), up to the per-voice outputs: renders the next 64 samples
   * of each voice into this.out[0..5] (int16, mono, before panning and the FX bus)
   */
  renderBlock() {
    this._resetTargets();
    for (const vm of this.velocityModulators) this._modUpdate(vm, vm.lastVal);
    for (const lfo of this.lfos) this._modUpdate(lfo.modTarget, lfo_calc(lfo, this.rng));
    SVF_recalcFreq(this.drums[0].filter);
    SVF_recalcFreq(this.drums[1].filter);
    SVF_recalcFreq(this.drums[2].filter);
    SVF_recalcFreq(this.snare.filter);
    SVF_recalcFreq(this.cymbal.filter);
    SVF_recalcFreq(this.hat.filter);
    if (this.xmod) this._xmodBefore();
    for (const d of this.drums) this._drumAsync(d);
    this._snareAsync(this.snare);
    this._metalAsync(this.cymbal);
    this._metalAsync(this.hat);
    const o = this.out;
    for (let n = 0; n < 3; n++) { this._drumSync(n, o[n]); this._decimate(n, o[n]); }
    this._snareSync(o[3]); this._decimate(3, o[3]);
    this._metalSync(this.cymbal, 1, 4, o[4]); this._decimate(4, o[4]);
    this._metalSync(this.hat, f(0.5), 5, o[5]); this._decimate(5, o[5]);
    if (this.xmod) this._xmodAfter();
    return o;
  }

  /** stereo mix of this.out using each voice's pan from its last trigger, as floats -1..1 */
  mixStereo(left, right, offset = 0) {
    const pans = [this.drums[0], this.drums[1], this.drums[2], this.snare, this.cymbal, this.hat];
    for (let i = 0; i < BLOCK; i++) {
      let l = 0, r = 0;
      for (let n = 0; n < 6; n++) {
        const s = this.out[n][i];
        l += s * pans[n].triggeredPanL;
        r += s * pans[n].triggeredPanR;
      }
      left[offset + i] = l / 32768;
      right[offset + i] = r / 32768;
    }
  }

  // ---------------------------------------------------------------------------------------
  // midiParser_ccHandler(): parameter changes, from edits (isFloatModulator false, data2 =
  // 0..127) and from modulation (isFloatModulator true, v = 0..1)
  // ---------------------------------------------------------------------------------------
  ccHandler(isCC2, num, data2, isFloatModulator, v) {
    let itg, flt;
    if (isFloatModulator) { itg = toU8(f(v * 127)); flt = f(v); }
    else { itg = data2 & 0xff; flt = f(itg / 127); }
    const [d0, d1, d2] = this.drums;
    const drums = this.drums, sn = this.snare, cy = this.cymbal, hh = this.hat;
    const wave = (count) => {
      if (!isFloatModulator) return itg;
      const w = toU8(f(count * flt));
      return w >= count ? count - 1 : w;
    };
    const pitchModAmount = (x) => { const val = f(x / 127); return f(f(val * val) * 32); };
    const filterValue = () => valueShaperF2F(flt, FILTER_SHAPER);
    const transPitch = () => f(1 + f(f(itg / f(33.9)) - f(0.75)));

    if (!isCC2) {
      switch (num) {
        case CC.NRPN_DATA_ENTRY_COARSE:
          // midiParser_nrpnHandler: forwards the value to CC2 number activeNrpnNumber
          this.ccHandler(true, this.activeNrpnNumber & 0xff, itg, false, 0);
          return;
        case CC.NRPN_FINE: this.activeNrpnNumber = (this.activeNrpnNumber & ~0x7f) | (itg & 0x7f); break;
        case CC.NRPN_COARSE: this.activeNrpnNumber = ((this.activeNrpnNumber & 0x7f) | (itg << 7)) & 0xffff; break;
        case CC.VOL_SLOPE1: slopeEg2_setSlope(d0.oscVolEg, itg); break;
        case CC.PITCH_SLOPE1: decayEg_setSlope(d0.oscPitchEg, itg); break;
        case CC.VOL_SLOPE2: slopeEg2_setSlope(d1.oscVolEg, itg); break;
        case CC.PITCH_SLOPE2: decayEg_setSlope(d1.oscPitchEg, itg); break;
        case CC.VOL_SLOPE3: slopeEg2_setSlope(d2.oscVolEg, itg); break;
        case CC.PITCH_SLOPE3: decayEg_setSlope(d2.oscPitchEg, itg); break;
        case CC.PITCH_SLOPE4: decayEg_setSlope(sn.oscPitchEg, itg); break;
        case CC.VOL_SLOPE6: slopeEg2_setSlope(hh.oscVolEg, itg); break;
        case CC.FILTER_FREQ_DRUM1: case CC.FILTER_FREQ_DRUM2: case CC.FILTER_FREQ_DRUM3:
          SVF_directSetFilterValue(drums[num - CC.FILTER_FREQ_DRUM1].filter, filterValue()); break;
        case CC.RESO_DRUM1: case CC.RESO_DRUM2: case CC.RESO_DRUM3:
          SVF_setReso(drums[num - CC.RESO_DRUM1].filter, flt); break;
        case CC.F_OSC1_COARSE: setCoarse(d0.osc, itg); break;
        case CC.F_OSC2_COARSE: setCoarse(d1.osc, itg); break;
        case CC.F_OSC3_COARSE: setCoarse(d2.osc, itg); break;
        case CC.F_OSC4_COARSE: setCoarse(sn.osc, itg); break;
        case CC.F_OSC5_COARSE: setCoarse(cy.osc, itg); break;
        case CC.F_OSC1_FINE: setFine(d0.osc, itg); break;
        case CC.F_OSC2_FINE: setFine(d1.osc, itg); break;
        case CC.F_OSC3_FINE: setFine(d2.osc, itg); break;
        case CC.F_OSC4_FINE: setFine(sn.osc, itg); break;
        case CC.F_OSC5_FINE: setFine(cy.osc, itg); break;
        case CC.F_OSC6_FINE: setFine(hh.osc, itg); break;
        case CC.OSC_WAVE_DRUM1: d0.osc.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.MOD_WAVE_DRUM1: d0.modOsc.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.OSC_WAVE_DRUM2: d1.osc.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.MOD_WAVE_DRUM2: d1.modOsc.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.OSC_WAVE_DRUM3: d2.osc.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.MOD_WAVE_DRUM3: d2.modOsc.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.OSC_WAVE_SNARE: sn.osc.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.OSC1_DIST: d0.distortion.shape = distShape(flt); break;
        case CC.OSC2_DIST: d1.distortion.shape = distShape(flt); break;
        case CC.OSC3_DIST: d2.distortion.shape = distShape(flt); break;
        case CC.VELOA1: d0.oscVolEg.attack = slopeEg2_calcTime(itg, TIME_K_ATTACK); break;
        case CC.VELOD1: d0.oscVolEg.decay = slopeEg2_calcTime(itg, TIME_K_DECAY); break;
        case CC.PITCHD1: d0.oscPitchEg.decay = decayEg_calcTime(itg); break;
        case CC.MODAMNT1: d0.egPitchModAmount = pitchModAmount(itg); break;
        case CC.FMAMNT1: d0.fmModAmount = flt; break;
        case CC.FMDTN1: setCoarse(d0.modOsc, itg); break;
        case CC.VOL1: d0.vol = flt; break;
        case CC.PAN1: d0.pan = itg; break;
        case CC.VELOA2: d1.oscVolEg.attack = slopeEg2_calcTime(itg, TIME_K_ATTACK); break;
        case CC.VELOD2: d1.oscVolEg.decay = slopeEg2_calcTime(itg, TIME_K_DECAY); break;
        case CC.PITCHD2: d1.oscPitchEg.decay = decayEg_calcTime(itg); break;
        case CC.MODAMNT2: d1.egPitchModAmount = pitchModAmount(itg); break;
        case CC.FMAMNT2: d1.fmModAmount = flt; break;
        case CC.FMDTN2: setCoarse(d1.modOsc, itg); break;
        case CC.VOL2: d1.vol = flt; break;
        case CC.PAN2: d1.pan = itg; break;
        case CC.VELOA3: d2.oscVolEg.attack = slopeEg2_calcTime(itg, TIME_K_ATTACK); break;
        case CC.VELOD3: d2.oscVolEg.decay = slopeEg2_calcTime(itg, TIME_K_DECAY); break;
        case CC.PITCHD3: d2.oscPitchEg.decay = decayEg_calcTime(itg); break;
        case CC.MODAMNT3: d2.egPitchModAmount = pitchModAmount(itg); break;
        case CC.FMAMNT3: d2.fmModAmount = flt; break;
        case CC.FMDTN3: setCoarse(d2.modOsc, itg); break;
        case CC.VOL3: d2.vol = flt; break;
        case CC.PAN3: d2.pan = itg; break;
        case CC.VOL4: sn.vol = flt; break;
        case CC.PAN4: sn.pan = itg; break;
        case CC.SNARE_NOISE_F: sn.noiseOsc.freq = f(flt * 22000); break;
        case CC.VELOA4: sn.oscVolEg.attack = slopeEg2_calcTime(itg, TIME_K_ATTACK); break;
        case CC.VELOD4: sn.oscVolEg.decay = slopeEg2_calcTime(itg, TIME_K_DECAY); break;
        case CC.PITCHD4: sn.oscPitchEg.decay = decayEg_calcTime(itg); break;
        case CC.MODAMNT4: sn.egPitchModAmount = pitchModAmount(itg); break;
        case CC.SNARE_FILTER_F: SVF_directSetFilterValue(sn.filter, filterValue()); break;
        case CC.SNARE_RESO: SVF_setReso(sn.filter, flt); break;
        case CC.SNARE_MIX: sn.mix = flt; break;
        case CC.VOL5: cy.vol = flt; break;
        case CC.PAN5: cy.pan = itg; break;
        case CC.VELOA5: cy.oscVolEg.attack = slopeEg2_calcTime(itg, TIME_K_ATTACK); break;
        case CC.VELOD5: cy.oscVolEg.decay = slopeEg2_calcTime(itg, TIME_K_DECAY); break;
        case CC.CYM_WAVE1: cy.osc.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.CYM_WAVE2: cy.modOsc.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.CYM_WAVE3: cy.modOsc2.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.CYM_MOD_OSC_F1: setCoarse(cy.modOsc, itg); break;
        case CC.CYM_MOD_OSC_F2: setCoarse(cy.modOsc2, itg); break;
        case CC.CYM_MOD_OSC_GAIN1: cy.fmModAmount1 = flt; break;
        case CC.CYM_MOD_OSC_GAIN2: cy.fmModAmount2 = flt; break;
        case CC.CYM_FIL_FREQ: SVF_directSetFilterValue(cy.filter, filterValue()); break;
        case CC.CYM_RESO: SVF_setReso(cy.filter, flt); break;
        case CC.CYM_REPEAT: cy.oscVolEg.repeat = itg; break;
        case CC.CYM_SLOPE: slopeEg2_setSlope(cy.oscVolEg, itg); break;
        case CC.WAVE1_HH: hh.osc.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.WAVE2_HH: hh.modOsc.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.WAVE3_HH: hh.modOsc2.waveform = wave(NUM_OSC_WAVEFORMS); break;
        case CC.VELOD6: hh.decayClosed = f(slopeEg2_calcTime(itg, TIME_K_DECAY)); break;
        case CC.VELOD6_OPEN: hh.decayOpen = f(slopeEg2_calcTime(itg, TIME_K_DECAY)); break;
        case CC.HAT_FILTER_F: SVF_directSetFilterValue(hh.filter, filterValue()); break;
        case CC.HAT_RESO: SVF_setReso(hh.filter, flt); break;
        case CC.VOL6: hh.vol = flt; break;
        case CC.PAN6: hh.pan = itg; break;
        case CC.F_OSC6_COARSE: setCoarse(hh.osc, itg); break;
        case CC.MOD_OSC_F1: setCoarse(hh.modOsc, itg); break;
        case CC.MOD_OSC_F2: setCoarse(hh.modOsc2, itg); break;
        case CC.MOD_OSC_GAIN1: hh.fmModAmount1 = flt; break;
        case CC.MOD_OSC_GAIN2: hh.fmModAmount2 = flt; break;
        case CC.VELOA6: hh.oscVolEg.attack = slopeEg2_calcTime(itg, TIME_K_ATTACK); break;
        case CC.REPEAT1: sn.oscVolEg.repeat = itg; break;
        case CC.EG_SNARE1_SLOPE: slopeEg2_setSlope(sn.oscVolEg, itg); break;
        case CC.SNARE_DISTORTION: sn.distortionShape = distShape(flt); break;
        case CC.CYMBAL_DISTORTION: cy.distortionShape = distShape(flt); break;
        case CC.HAT_DISTORTION: hh.distortionShape = distShape(flt); break;
        case CC.FREQ_LFO1: case CC.FREQ_LFO2: case CC.FREQ_LFO3: case CC.FREQ_LFO4: case CC.FREQ_LFO5: case CC.FREQ_LFO6:
          this._lfoSetFreq(this.lfos[num - CC.FREQ_LFO1], flt); break;
        case CC.AMOUNT_LFO1: case CC.AMOUNT_LFO2: case CC.AMOUNT_LFO3: case CC.AMOUNT_LFO4: case CC.AMOUNT_LFO5: case CC.AMOUNT_LFO6:
          this.lfos[num - CC.AMOUNT_LFO1].modTarget.amount = flt; break;
        case CC.VOICE_DECIMATION1: case CC.VOICE_DECIMATION2: case CC.VOICE_DECIMATION3: case CC.VOICE_DECIMATION4:
        case CC.VOICE_DECIMATION5: case CC.VOICE_DECIMATION6: case CC.VOICE_DECIMATION_ALL:
          this.decimationRate[num - CC.VOICE_DECIMATION1] = valueShaperF2F(flt, f(-0.7)); break;
        default: break;
      }
      return;
    }

    switch (num) {
      case CC2.TRANS1_WAVE: case CC2.TRANS2_WAVE: case CC2.TRANS3_WAVE:
        transient_setWaveform(drums[num - CC2.TRANS1_WAVE].transGen, wave(NUM_TRANSIENTS)); break;
      case CC2.TRANS4_WAVE: transient_setWaveform(sn.transGen, wave(NUM_TRANSIENTS)); break;
      case CC2.TRANS5_WAVE: transient_setWaveform(cy.transGen, wave(NUM_TRANSIENTS)); break;
      case CC2.TRANS6_WAVE: transient_setWaveform(hh.transGen, wave(NUM_TRANSIENTS)); break;
      case CC2.TRANS1_VOL: case CC2.TRANS2_VOL: case CC2.TRANS3_VOL:
        drums[num - CC2.TRANS1_VOL].transGen.volume = flt; break;
      case CC2.TRANS4_VOL: sn.transGen.volume = flt; break;
      case CC2.TRANS5_VOL: cy.transGen.volume = flt; break;
      case CC2.TRANS6_VOL: hh.transGen.volume = flt; break;
      case CC2.TRANS1_FREQ: case CC2.TRANS2_FREQ: case CC2.TRANS3_FREQ:
        drums[num - CC2.TRANS1_FREQ].transGen.pitch = transPitch(); break;
      case CC2.TRANS4_FREQ: sn.transGen.pitch = transPitch(); break;
      case CC2.TRANS5_FREQ: cy.transGen.pitch = transPitch(); break;
      case CC2.TRANS6_FREQ: hh.transGen.pitch = transPitch(); break;
      case CC2.FILTER_TYPE_1: case CC2.FILTER_TYPE_2: case CC2.FILTER_TYPE_3:
      case CC2.FILTER_TYPE_4: case CC2.FILTER_TYPE_5: case CC2.FILTER_TYPE_6: {
        let type;
        if (isFloatModulator) {
          type = toU8(f(f(FILTER_NAIVE_2_POLE * flt) + 1));
          type = type >= FILTER_OFF ? FILTER_OFF - 1 : type;
        } else {
          type = (itg + 1) & 0xff; // +1: type 0 would be silence
        }
        [d0, d1, d2, sn, cy, hh][num - CC2.FILTER_TYPE_1].filterType = type;
        break;
      }
      case CC2.FILTER_DRIVE_1: case CC2.FILTER_DRIVE_2: case CC2.FILTER_DRIVE_3:
      case CC2.FILTER_DRIVE_4: case CC2.FILTER_DRIVE_5: case CC2.FILTER_DRIVE_6:
        SVF_setDrive([d0, d1, d2, sn, cy, hh][num - CC2.FILTER_DRIVE_1].filter, flt); break;
      case CC2.MIX_MOD_1: case CC2.MIX_MOD_2: case CC2.MIX_MOD_3:
        drums[num - CC2.MIX_MOD_1].mixOscs = itg !== 0 ? 1 : 0; break;
      case CC2.VOLUME_MOD_ON_OFF1: case CC2.VOLUME_MOD_ON_OFF2: case CC2.VOLUME_MOD_ON_OFF3:
      case CC2.VOLUME_MOD_ON_OFF4: case CC2.VOLUME_MOD_ON_OFF5: case CC2.VOLUME_MOD_ON_OFF6:
        [d0, d1, d2, sn, cy, hh][num - CC2.VOLUME_MOD_ON_OFF1].volumeMod = itg !== 0 ? 1 : 0; break;
      case CC2.VELO_MOD_AMT_1: case CC2.VELO_MOD_AMT_2: case CC2.VELO_MOD_AMT_3:
      case CC2.VELO_MOD_AMT_4: case CC2.VELO_MOD_AMT_5: case CC2.VELO_MOD_AMT_6:
        this.velocityModulators[num - CC2.VELO_MOD_AMT_1].amount = flt; break;
      case CC2.WAVE_LFO1: case CC2.WAVE_LFO2: case CC2.WAVE_LFO3:
      case CC2.WAVE_LFO4: case CC2.WAVE_LFO5: case CC2.WAVE_LFO6:
        this.lfos[num - CC2.WAVE_LFO1].waveform = wave(NUM_LFO_WAVEFORMS); break;
      case CC2.RETRIGGER_LFO1: case CC2.RETRIGGER_LFO2: case CC2.RETRIGGER_LFO3:
      case CC2.RETRIGGER_LFO4: case CC2.RETRIGGER_LFO5: case CC2.RETRIGGER_LFO6:
        this.lfos[num - CC2.RETRIGGER_LFO1].retrigger = isFloatModulator ? toU8(f(7 * flt)) : itg; break;
      case CC2.SYNC_LFO1: case CC2.SYNC_LFO2: case CC2.SYNC_LFO3:
      case CC2.SYNC_LFO4: case CC2.SYNC_LFO5: case CC2.SYNC_LFO6: {
        const lfo = this.lfos[num - CC2.SYNC_LFO1];
        lfo.sync = itg;
        lfo.phaseInc = lfo_calcPhaseInc(lfo.freq, lfo.sync, this.bpm);
        break;
      }
      case CC2.OFFSET_LFO1: case CC2.OFFSET_LFO2: case CC2.OFFSET_LFO3:
      case CC2.OFFSET_LFO4: case CC2.OFFSET_LFO5: case CC2.OFFSET_LFO6:
        this.lfos[num - CC2.OFFSET_LFO1].phaseOffset = toU32(f(flt * F_2POW32)); break;
      case CC2.AUDIO_OUT1: case CC2.AUDIO_OUT2: case CC2.AUDIO_OUT3:
      case CC2.AUDIO_OUT4: case CC2.AUDIO_OUT5: case CC2.AUDIO_OUT6:
        this.audioRouting[num - CC2.AUDIO_OUT1] = itg; break;
      case CC2.PWM_1: case CC2.PWM_2: case CC2.PWM_3:
        drums[num - CC2.PWM_1].pwm = flt; break;
      case CC2.PWM_4: sn.pwm = flt; break;
      case CC2.PWM_5: cy.pwm = flt; break;
      case CC2.PWM_6: hh.pwm = flt; break;
      // FX bus, mutes, LFO/velocity target selection: not part of the voice engine
      default: break;
    }
  }
}
