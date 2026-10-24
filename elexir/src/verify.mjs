// Sample-for-sample check of lxr.js against the original LXR firmware C code.
//
// The reference is ref/harness.c linked with the firmware's Soundengine sources, compiled for
// the Cortex-M7 (arm-linux-gnueabihf-gcc -mcpu=cortex-m7 -mthumb -mfpu=fpv5-d16) and run under
// qemu-arm-static. Both sides get the same text script of parameter edits, triggers and
// renders, and every 64-sample block of all 6 voices is compared.
//
//   node verify.mjs <path to ref binary> [scenarios=40] [seed=1] [--quiet]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LxrEngine, PAR, BLOCK, MODULATABLE, setSawPastEndSample } from './lxr.js';

// in the reference binary the linker placed initKit right after sawTable, so the firmware's
// one-past-the-end read of the top saw row returns its first two bytes ("In" = 0x6e49)
setSawPastEndSample(0x6e49);

const quiet = process.argv.includes('--quiet');
const [refBin, nScen = '40', seedArg = '1'] = process.argv.slice(2).filter((a) => a !== '--quiet');
if (!refBin) { console.error('usage: node verify.mjs <ref binary> [scenarios] [seed]'); process.exit(2); }

let s = Number(seedArg) >>> 0 || 1;
const rand = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
const ri = (n) => Math.floor(rand() * n);

// parameters a scenario may edit (all sound parameters except FX bus, MIDI notes and routing)
const editable = Object.entries(PAR)
  .filter(([n, v]) => v > 0 && v < PAR.END_OF_SOUND_PARAMETERS && !/^(FX_|MIDI_NOTE|AUDIO_OUT|NRPN|BANK|MOD_WHEEL|VEL_DEST|VOICE_LFO|TARGET_LFO|NONE)/.test(n))
  .map(([, v]) => v);
const waveParams = new Set(['OSC_WAVE_DRUM1', 'OSC_WAVE_DRUM2', 'OSC_WAVE_DRUM3', 'OSC_WAVE_SNARE', 'WAVE1_CYM',
  'WAVE1_HH', 'MOD_WAVE_DRUM1', 'MOD_WAVE_DRUM2', 'MOD_WAVE_DRUM3', 'WAVE2_CYM', 'WAVE3_CYM', 'WAVE2_HH', 'WAVE3_HH'].map((n) => PAR[n]));
const valueFor = (p) => {
  if (waveParams.has(p)) return ri(6); // 0..5: user-sample slots aren't modelled
  if (p >= PAR.FILTER_TYPE_1 && p <= PAR.FILTER_TYPE_6) return ri(8);
  if (p >= PAR.TRANS1_WAVE && p <= PAR.TRANS6_WAVE) return ri(14);
  if (p >= PAR.WAVE_LFO1 && p <= PAR.WAVE_LFO6) return ri(8);
  if (p >= PAR.SYNC_LFO1 && p <= PAR.SYNC_LFO6) return ri(12);
  if (p >= PAR.RETRIGGER_LFO1 && p <= PAR.RETRIGGER_LFO6) return ri(8);
  if (p === PAR.REPEAT4 || p === PAR.REPEAT5) return ri(8);
  return ri(128);
};
// modulation targets: parameters the firmware's target menus offer (all have a parameter
// pointer; the firmware dereferences it without a null check when a target is edited)
const targets = editable.filter((p) => MODULATABLE.has(p));
const modTarget = () => targets[ri(targets.length)];
const editParam = () => editable[ri(editable.length)];

function scenario(k) {
  const cmds = [`seed ${1 + ri(1e9)}`, 'kit'];
  // the first few scenarios: init kit, every voice
  if (k < 7) { cmds.push(`t ${k} 127 60`, 'r 400'); return cmds; }
  const nEdits = k < 20 ? 3 + ri(10) : 20 + ri(60);
  for (let e = 0; e < nEdits; e++) { const p = editParam(); cmds.push(`p ${p} ${valueFor(p)}`); }
  if (k >= 20) {
    for (let v = 0; v < 6; v++) if (rand() < 0.5) cmds.push(`vd ${v} ${modTarget()}`);
    for (let l = 0; l < 6; l++) if (rand() < 0.5) cmds.push(`lt ${l} ${modTarget()}`);
  }
  for (let step = 0; step < 24; step++) {
    if (rand() < 0.6) cmds.push(`t ${ri(7)} ${1 + ri(127)} ${36 + ri(48)}`);
    if (rand() < 0.3) { const p = editParam(); cmds.push(`p ${p} ${valueFor(p)}`); }
    cmds.push(`r ${1 + ri(40)}`);
  }
  return cmds;
}

function runJs(cmds) {
  let eng = new LxrEngine();
  const blocks = [];
  for (const c of cmds) {
    const [op, ...a] = c.split(' ');
    const n = a.map(Number);
    if (op === 'seed') eng.rng.state = n[0] >>> 0;
    else if (op === 'kit') eng.loadInitKit();
    else if (op === 'p') eng.setParam(n[0], n[1]);
    else if (op === 'vd') eng.setVelocityDestination(n[0], n[1]);
    else if (op === 'lt') eng.setLfoDestination(n[0], n[1]);
    else if (op === 't') eng.trigger(n[0], n[1], n[2]);
    else if (op === 'r') for (let i = 0; i < n[0]; i++) { const o = eng.renderBlock(); const b = new Int16Array(6 * BLOCK); o.forEach((v, j) => b.set(v, j * BLOCK)); blocks.push(b); }
  }
  return blocks;
}

const dir = mkdtempSync(join(tmpdir(), 'lxrv-'));
let total = 0, bad = 0, nonzero = 0, maxDiff = 0, errSq = 0, sigSq = 0, small = 0;
const voiceNames = ['drum1', 'drum2', 'drum3', 'snare', 'cymbal', 'hihat'];
for (let k = 0; k < Number(nScen); k++) {
  const cmds = scenario(k);
  const outFile = join(dir, 'o.bin');
  execFileSync('qemu-arm-static', [refBin, outFile], { input: cmds.join('\n') + '\n' });
  const ref = new Int16Array(readFileSync(outFile).buffer.slice(0));
  const js = runJs(cmds);
  let mism = 0, first = null;
  for (let b = 0; b < js.length; b++) {
    for (let i = 0; i < 6 * BLOCK; i++) {
      const r = ref[b * 6 * BLOCK + i], j = js[b][i];
      total++;
      if (r !== 0) nonzero++;
      const d = Math.abs(r - j);
      if (d > maxDiff) maxDiff = d;
      if (d > 0 && d <= 3) small++;
      errSq += d * d; sigSq += r * r;
      if (r !== j) { mism++; if (!first) first = { block: b, voice: voiceNames[Math.floor(i / BLOCK)], i: i % BLOCK, ref: r, js: j }; }
    }
  }
  if (ref.length !== js.length * 6 * BLOCK) { mism++; first = first || { lengthRef: ref.length, lengthJs: js.length * 6 * BLOCK }; }
  bad += mism;
  if (mism) {
    if (!quiet) console.log(`scenario ${k}: ${mism} mismatches, first`, first);
    writeFileSync(join(dir, `fail${k}.txt`), cmds.join('\n'));
  }
}
console.log(`${total} samples compared (${nonzero} non-zero), ${bad} mismatches`);
if (bad) console.log(`${small} of the mismatches are off by 1-3 LSB`);
if (bad) console.log(`largest difference ${maxDiff} LSB, error ${(10 * Math.log10(errSq / sigSq)).toFixed(1)} dB relative to the signal`);
process.exit(bad ? 1 : 0);
