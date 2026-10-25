// ---- kits: .SND files are the 8-character kit name followed by one byte per parameter ----
// (preset_loadDrumsetSD / preset_readDrumsetData in presetManager.c)
function parseSnd(bytes) {
  if (bytes.length < 9) throw new Error('too short for a kit file');
  const name = String.fromCharCode(...bytes.slice(0, 8)).replace(/[^\x20-\x7e]/g, '').trim() || 'Empty';
  const kit = new Uint8Array(PAR.END_OF_SOUND_PARAMETERS); // missing bytes stay 0, as in the firmware
  kit.set(bytes.slice(8, 8 + PAR.END_OF_SOUND_PARAMETERS));
  for (let i = 0; i < 6; i++) {
    // the firmware's own clean-up of out-of-range mod targets and LFO voices
    if (kit[PAR.VEL_DEST_1 + i] >= MOD_TARGETS.length) kit[PAR.VEL_DEST_1 + i] = 0;
    if (kit[PAR.TARGET_LFO1 + i] >= MOD_TARGETS.length) kit[PAR.TARGET_LFO1 + i] = 0;
    if (kit[PAR.VOICE_LFO1 + i] < 1 || kit[PAR.VOICE_LFO1 + i] > 6) kit[PAR.VOICE_LFO1 + i] = 1;
  }
  const userSamples = [1, 2, 3, 4, 5, 6].filter((n) => kit[PAR['TRANS' + n + '_WAVE']] >= 14).length;
  return { name, kit, userSamples };
}
// a short note under the preset menu that clears itself
let noteT;
function kitNote(t) { $('kit-msg').textContent = t; clearTimeout(noteT); if (t) noteT = setTimeout(() => { $('kit-msg').textContent = ''; }, 5000); }
// the bundled kits aren't presets: they are hidden and only feed the generator (everything)
// (a transient that uses a user sample from the SD card would play silent, so it gets a built-in wave instead)
const sourceKits = BUNDLED_KITS.map((k) => parseSnd(Uint8Array.from(atob(k.data), (c) => c.charCodeAt(0))));
for (const { kit } of sourceKits) for (let n = 1; n <= 6; n++) if (kit[PAR['TRANS' + n + '_WAVE']] >= 14) kit[PAR['TRANS' + n + '_WAVE']] %= 14;
// ---- preset format ----
// A preset is { v, name, kit, xm, fx, fx3, dpos, song, fav }; xm, fx, fx3 and song may be missing (a sound from a
// kit file: the sends and FX then come from the kit's own FX settings). Only presets in the current format
// (v = PRESET_V) are read; older ones are skipped. A change to the format bumps PRESET_V and rewrites the
// built-in presets in presets/*.json to match (build.mjs refuses any in another format).
const PRESET_V = 4;
const PRESET_FIELDS = ['name', 'kit', 'xm', 'fx', 'fx3', 'dpos', 'song', 'fav'];
const isCurrent = (p) => !!(p && p.v === PRESET_V && p.kit);
// a preset as stored and exported, from a kit list entry
const presetData = (k) => ({ v: PRESET_V, ...Object.fromEntries(PRESET_FIELDS.map((f) => [f, k[f]])), kit: Array.from(k.kit), fav: !!k.fav });
// a kit list entry from a stored, built-in or imported preset
const fromStored = (p, extra) => ({ ...structuredClone(p), kit: Uint8Array.from(p.kit), fav: !!p.fav, userSamples: 0, ...extra });
// presets: the init kit, the built-in presets (favourites baked into the build), then the ones saved here
const kitList = [{ name: 'Init kit', kit: factoryInit, userSamples: 0, builtin: true },
  ...BUILTIN_PRESETS.map((p) => fromStored(p, { builtin: true }))];
const kitSel = $('kit');
// saved presets: the kit values, crossfeed, FX and mixer sends, plus the song (pattern, perform dials,
// tempo, velocity, accent, master, snare rush and its settings), kept in this browser
// storage keys keep the old elexir- prefix, so presets saved before the rename still load
// (the -v2 is from when presets and kits were split, not the preset format version)
const SAVE_KEY = 'elexir-presets-v2';
function storedPresets() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || []; } catch (e) { return []; } }
function storePresets() {
  const list = kitList.filter((k) => k.saved).map(presetData);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); } catch (e) {}
}
for (const p of storedPresets().filter(isCurrent)) kitList.push(fromStored(p, { saved: true }));
function fillKits() {
  kitSel.innerHTML = '';
  const groups = [['built in', (k) => k.builtin], ['mine', (k) => k.saved]];
  for (const [label, test] of groups) {
    const g = document.createElement('optgroup'); g.label = label;
    kitList.forEach((k, i) => { if (test(k)) g.appendChild(new Option(k.name, i)); });
    if (g.children.length) kitSel.appendChild(g);
  }
}
fillKits();
// alien names from small syllables: onset + vowel + coda, two or three of them, max 8 letters
// (an LXR kit name is 8 characters)
const ONSETS = ['k', 'z', 'x', 'v', 'q', 'th', 'zh', 'kr', 'gr', 'vr', 'xh', 'y', 'n', 'sk', 'l', ''];
const VOWELS = ['a', 'o', 'u', 'i', 'y', 'ae', 'oo', 'ix', 'ue', 'aa'];
const CODAS = ['', '', 'x', 'k', 'th', 'n', 'rr', 'q', 'z', 'l', 'sh'];
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
// a preset's name: two alien words
function presetName() {
  for (let tries = 0; tries < 200; tries++) {
    const name = alienName().replace(/'/g, '') + ' ' + alienName().replace(/'/g, '');
    if (name.length <= 16 && !kitList.some((k) => k.name === name)) return name;
  }
  return alienName();
}
function alienName() {
  for (let tries = 0; tries < 200; tries++) {
    const n = Math.random() < 0.6 ? 2 : 3;
    const parts = Array.from({ length: n }, (_, i) => pickOne(ONSETS) + pickOne(VOWELS) + (i === n - 1 || Math.random() < 0.4 ? pickOne(CODAS) : ''));
    let name = parts.join(Math.random() < 0.2 ? "'" : '');
    name = name[0].toUpperCase() + name.slice(1);
    if (name.length >= 4 && name.length <= 8 && !kitList.some((k) => k.name === name)) return name;
  }
  return 'Xo' + Math.floor(Math.random() * 1e6);
}
function useKit(k) {
  const kitFx = k.kit[PAR.FX_TYPE], hadDelay = kitFx === LXR.FX_DELAY;
  // the kit's own effect seeds that bus, and the voices it routed there get a 25% send on it (distortion: on)
  Object.assign(fx3, structuredClone(FX3_0), structuredClone(k.fx3 ? k.fx3.params : {}));
  if (!k.fx3 && kitFx === LXR.FX_DISTORTION) fx3.dist = { type: k.kit[PAR.FX_DIST_TYPE], p: [0, 1, 2, 3].map((i) => k.kit[PAR.FX_P1 + i]) };
  if (!k.fx3 && kitFx === LXR.FX_RING) fx3.ring = { wave: k.kit[PAR.FX_WAVE], freq: k.kit[PAR.FX_P1] };
  const routed = [0, 1, 2, 3, 4, 5].map((n) => k.kit[PAR.AUDIO_OUT1 + n] === LXR.MIXER_ROUTING_FX_BUS);
  const deflt = (t, on = 25) => routed.map((r) => (r && (kitFx === t || (t === LXR.FX_DELAY && kitFx !== LXR.FX_DISTORTION && kitFx !== LXR.FX_RING)) ? on : 0));
  initValues.set(k.kit); asDelay(initValues); values.set(initValues);
  if (k.xm) { xm.amt.splice(0, 36, ...k.xm.amt); xm.target.splice(0, 6, ...k.xm.target); xm.target.forEach((t, d) => { xSelects[d].value = t; }); xcells.forEach((d) => d()); sendX(); }
  mix.fx.splice(0, 6, ...(k.fx || deflt(LXR.FX_DELAY)));
  mix.dist.splice(0, 6, ...(k.fx3 ? k.fx3.dsend : deflt(LXR.FX_DISTORTION)));
  mix.ring.splice(0, 6, ...(k.fx3 ? k.fx3.ring : deflt(LXR.FX_RING)));
  // a kit's own delay time, unless it has none worth keeping (another effect, or a time
  // under 1/32 of a bar, a comb more than an echo): then a dotted eighth
  const own = hadDelay ? kitDelayPos() : 0;
  delayPos = k.dpos ?? (own >= posOf(1 / 32) ? own : posOf(3 / 16)); send({ type: 'delay', pos: delayPos });
  syncMixer(); sendMix();
  for (const h in homes) delete homes[h];
  undoValues = null; $('undo').disabled = true;
  send({ type: 'kit', values: effValues() });
  buildKnobs(); drawScope();
  kitNote(k.userSamples
    ? `${k.userSamples} transient${k.userSamples > 1 ? 's use' : ' uses'} a user sample from the SD card, which plays silent here.` : '');
}
kitSel.addEventListener('change', () => {
  loadPreset(kitList[Number(kitSel.value)]);
});
// bpm by the preset menu: ticked, a loaded preset brings its own tempo; unticked, the tempo stays as it is
const presetBpm = $('preset-bpm');
try { presetBpm.checked = localStorage.getItem('elexir-preset-bpm') !== '0'; } catch (e) { /* default: ticked */ }
presetBpm.addEventListener('change', () => { try { localStorage.setItem('elexir-preset-bpm', presetBpm.checked ? '1' : '0'); } catch (e) { /* not kept */ } });
function loadPreset(k) {
  kitSel.value = kitList.indexOf(k);
  barSync = true;
  try { useKit(k); if (k.song) useSong(k.song, !presetBpm.checked); } finally { barSync = false; }
  setDirty(false);
  if (playing) kitNote(`${k.name} from the next bar`);
}
// ‹ › step through the presets in menu order
function stepPreset(d) {
  const opts = [...kitSel.options], i = opts.findIndex((o) => o.value === kitSel.value);
  const o = opts[(i + d + opts.length) % opts.length];
  if (o && o.value !== kitSel.value) loadPreset(kitList[Number(o.value)]);
}
$('kit-prev').addEventListener('click', () => stepPreset(-1));
$('kit-next').addEventListener('click', () => stepPreset(1));
// a star by save once the sound or song has been changed by a randomise since the last save or load
let dirty = false;
function setDirty(d) {
  dirty = d; $('dirty').classList.toggle('on', d); // the star keeps its space so nothing shifts
  $('kit-save').setAttribute('aria-label', d ? 'Save (unsaved changes)' : 'Save');
}
function songSnapshot() {
  const copy = (a) => a.map((r) => r.slice());
  return { style: STYLES[styleIdx].name, user: STYLES[styleIdx].user && userPats.length ? structuredClone(userPats[userSlot()]) : undefined, energy: perf.energy, beat: perf.beat, fills: perf.fills,
    tempo: perf.tempo, rush: perf.rush, vel: perf.vel, accent: perf.accent, view, source, groove: structuredClone(groove), macro: { ...macro },
    pattern: { on: copy(pattern.on), acc: copy(pattern.acc), bar: copy(pattern.bar) }, stepPages: pages.slice(0, pageCount).map(copyPage),
    master: { ...master }, rushSet: { ...rushSet } };
}
function useSong(g, keepTempo) {
  setStyle(styleIndex(g.style));
  for (const k of ['energy', 'beat', 'fills', 'tempo', 'vel', 'accent']) if (!(keepTempo && k === 'tempo')) perf[k] = g[k];
  perf.tempo = clampTempo(perf.tempo); // presets from when the range was wider
  $('tempo').value = perf.tempo;
  if (STYLES[styleIdx].user && g.user) { const i = ensureUserPat(g.user); if (i >= 0) useUserSlot(i); }
  Object.assign(master, MASTER0, g.master); buildMaster(); // presets saved before the sidechain switch have it on
  sendMix();
  perf.rush = Math.max(0, Math.min(100, Number(g.rush) || 0)); send({ type: 'rush', v: perf.rush });
  useRushSet(g.rushSet);
  // the dial readouts come from generate; then the saved pattern, which may have been edited by hand
  generate();
  copyInto(pattern, g.pattern);
  const sp = g.stepPages;
  sp.forEach((P, i) => copyInto(pages[i], P)); pageCount = sp.length; editPage = 0; grid = pages[0];
  drawGrid();
  sendSeq();
  if (g.view === 'steps') setTab('steps');
  setSource(g.source);
  Object.assign(groove, structuredClone(g.groove)); drawGroove(); sendSeq();
  Object.assign(macro, g.macro); drawMacros(); sendMacros();
}
$('kit-save').addEventListener('click', () => {
  const k = { name: presetName(), kit: Uint8Array.from(values), xm: { amt: xm.amt.slice(), target: xm.target.slice() }, fx: mix.fx.slice(),
    fx3: fx3Snapshot(), dpos: delayPos, song: songSnapshot(), saved: true, userSamples: 0 };
  kitList.push(k); storePresets(); fillKits();
  kitSel.value = kitList.length - 1;
  initValues.set(values); buildKnobs(); // the saved sound is now the reference for changed knobs
  setDirty(false); drawManager();
  kitNote(`saved as ${k.name}`);
});
// everything: each voice comes from a random bundled kit, the FX and the rest from another, then every
// voice gets a 10% drum-safe randomise; the delay time, crossfeed and the pattern's beat, energy and fills
// are rolled too. Save keeps it.
function voiceOwned(v) {
  const s = new Set();
  for (const g of VOICE_PAGES[v].groups) for (const [, name] of g.params) s.add(PAR[name]);
  for (const n of ['AUDIO_OUT1', 'VOICE_LFO1', 'TARGET_LFO1', 'VOL1', 'PAN1']) if (PAR[n] !== undefined) s.add(PAR[n] + v);
  return [...s];
}
$('new-kit').addEventListener('click', async () => {
  await startAudio();
  const src = sourceKits;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const kit = Uint8Array.from(src.length ? pick(src).kit : values);
  if (src.length) for (let v = 0; v < 6; v++) { const k = pick(src); for (const par of voiceOwned(v)) kit[par] = k.kit[par]; }
  for (let v = 0; v < 6; v++) kit[PAR.VOL1 + v] = values[PAR.VOL1 + v]; // the mixer levels stay as they are
  useKit({ name: '', kit, xm: { amt: new Array(36).fill(0), target: xm.target.slice() }, userSamples: 0 });
  for (let v = 0; v < 6; v++) randomiseVoice(v, 0.1);
  // echo feedback stays lowish (20..55); about one roll in 15 slams it up to 75..110
  setValue(PAR.FX_P4, rnd() < 1 / 15 ? 75 + Math.floor(rnd() * 36) : 20 + Math.floor(rnd() * 36), true);
  delayPos = randomDelayPos(); send({ type: 'delay', pos: delayPos }); syncFx();
  initValues.set(values);
  for (const h in homes) delete homes[h];
  send({ type: 'kit', values: effValues() });
  buildKnobs(); drawScope();
  randomiseX();
  perf.beat = Math.floor(rnd() * 32); perf.energy = 45 + Math.floor(rnd() * 46); perf.fills = Math.floor(rnd() * 101);
  drawUserTools();
  if (view === 'steps') setTab('perform'); else generate();
  setDirty(true);
  kitNote('');
});
