// ---- recorder: the finished mix, taken at the engine's own rate, written out as a WAV ----
// A loop starts on the first step of a bar (starting playback if it is stopped) and stops after its bars,
// so the take is exactly that many bars and the echo carried over from before the loop keeps it seamless.
const recDlg = $('rec'), LENS = [0, 1, 2, 4, 8, 16], RATES = [44100, 48000], BITS = [16, 24];
const recSet = { len: 3, rate: 0, bits: 0, norm: false, count: false };
try { Object.assign(recSet, JSON.parse(localStorage.getItem('elexir-rec') || '{}')); } catch (e) { /* defaults */ }
const saveRecSet = () => { try { localStorage.setItem('elexir-rec', JSON.stringify(recSet)); } catch (e) { /* not kept */ } };
let recState = 'off', recChunks = [], recT0 = 0, recTimer = 0, recBars = 0, recLoop = false, takeNo = 0;
const RECMAX = 10 * 60; // seconds; a free take stops itself after ten minutes
radios($('rec-len'), 'rec-len', LENS.map((b) => (b ? `${b} bar${b > 1 ? 's' : ''}` : 'free')), () => recSet.len, (i) => { recSet.len = i; saveRecSet(); recHint(); });
radios($('rec-rate'), 'rec-rate', ['44.1k', '48k'], () => recSet.rate, (i) => { recSet.rate = i; saveRecSet(); });
radios($('rec-bits'), 'rec-bits', ['16-bit', '24-bit'], () => recSet.bits, (i) => { recSet.bits = i; saveRecSet(); });
$('rec-norm').checked = recSet.norm;
$('rec-norm').addEventListener('change', () => { recSet.norm = $('rec-norm').checked; saveRecSet(); });
$('rec-count').checked = recSet.count;
$('rec-count').addEventListener('change', () => { recSet.count = $('rec-count').checked; saveRecSet(); recHint(); });
function recHint() {
  const b = LENS[recSet.len];
  $('rec-hint').textContent = b
    ? `Records exactly ${b} bar${b > 1 ? 's' : ''} from the start of the next bar (from bar 1 if stopped), ready to loop. Changes you make while it records are in the take.`
    : recSet.count ? 'Records everything from the bar after the count until you press stop, up to ten minutes.'
    : 'Records everything from now until you press stop, up to ten minutes.';
  if (recSet.count) $('rec-hint').textContent += ' Count-in: one bar of beeps first (from bar 1 if stopped), with the music turned down; neither is in the take.';
}
recHint();
function recUi() {
  const b = $('rec-open'), go = $('rec-go');
  b.classList.toggle('on', recState === 'on'); b.classList.toggle('wait', recState === 'wait' || recState === 'count');
  go.classList.toggle('on', recState !== 'off'); go.querySelector('span').textContent = recState === 'off' ? 'record' : 'stop';
  recDlg.querySelectorAll('.rec-opts input').forEach((i) => { i.disabled = recState !== 'off'; });
}
function recStatus() {
  const st = $('rec-status');
  if (recState === 'wait') st.textContent = 'waiting for the next bar…';
  else if (recState === 'count') st.textContent = 'counting in…';
  else if (recState === 'on' && recLoop) st.textContent = `● bar ${Math.min(recBars + 1, LENS[recSet.len])} of ${LENS[recSet.len]}`;
  else if (recState === 'on') {
    const t = (performance.now() - recT0) / 1000;
    st.textContent = `● ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    if (t > RECMAX) send({ type: 'recStop' });
  }
}
async function recStart() {
  await startAudio();
  recChunks = []; recBars = 0; recLoop = LENS[recSet.len] > 0;
  const count = recSet.count, m = { type: 'rec', bars: LENS[recSet.len], count };
  recState = count ? (playing ? 'wait' : 'count') : recLoop ? 'wait' : 'on'; recT0 = performance.now();
  if (node) node.port.postMessage(m); else if (fallback) fallback.msg(m);
  // a loop needs the transport; it starts at bar 1 (after a count-in, the player starts it itself)
  if (recLoop && !count && !playing) $('play').click();
  clearInterval(recTimer); recTimer = setInterval(recStatus, 250);
  recUi(); recStatus();
}
function recEvent(ev) {
  if (ev.type === 'recData') { recChunks.push(ev); return; }
  if (ev.state === 'count') recState = 'count';
  if (ev.state === 'play') { playing = true; $('play').setAttribute('aria-pressed', true); $('play').textContent = 'STOP'; }
  if (ev.state === 'on') { recState = 'on'; recT0 = performance.now(); }
  if (ev.state === 'bar') recBars = ev.done;
  if (ev.state === 'done') { clearInterval(recTimer); recState = 'off'; finishTake(ev); }
  recUi(); recStatus();
}
$('rec-go').addEventListener('click', () => {
  if (recState === 'off') { recStart(); recDlg.close(); } // the button by play shows the take's progress
  else { const m = { type: 'recStop' }; if (node) node.port.postMessage(m); else if (fallback) fallback.msg(m); }
});
$('rec-open').addEventListener('click', () => { recUi(); recDlg.showModal(); });
$('rec-close').addEventListener('click', () => recDlg.close());
recDlg.addEventListener('click', (e) => { if (e.target === recDlg) recDlg.close(); });

async function finishTake(ev) {
  const n = recChunks.reduce((a, c) => a + c.L.length, 0);
  if (!n) { $('rec-status').textContent = 'nothing recorded'; return; }
  $('rec-status').textContent = 'writing…';
  const rate = RATES[recSet.rate], bits = BITS[recSet.bits], loop = recLoop && ev.bars >= LENS[recSet.len];
  // resample to the file's rate; a loop is padded with its own ends so the join stays clean
  const pad = loop ? 256 : 0, src = new AudioBuffer({ numberOfChannels: 2, length: n + 2 * pad, sampleRate: LXR.REAL_FS });
  for (const [ch, key] of [[0, 'L'], [1, 'R']]) {
    const d = src.getChannelData(ch);
    let o = pad; for (const c of recChunks) { d.set(c[key], o); o += c[key].length; }
    if (loop) { d.copyWithin(0, n, n + pad); d.copyWithin(n + pad, pad, 2 * pad); }
  }
  recChunks = [];
  // a loop is cut to the exact length of its bars at the tempo (the engine works in 64-sample blocks)
  const frames = loop ? Math.round(LENS[recSet.len] * 240 / ev.bpm * rate) : Math.round(n * rate / LXR.REAL_FS), padOut = Math.round(pad * rate / LXR.REAL_FS);
  const off = new OfflineAudioContext(2, frames + 2 * padOut, rate);
  const bs = off.createBufferSource(); bs.buffer = src; bs.connect(off.destination); bs.start();
  const out = await off.startRendering();
  const L = out.getChannelData(0).subarray(padOut, padOut + frames), R = out.getChannelData(1).subarray(padOut, padOut + frames);
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gain = recSet.norm && peak > 1e-6 ? Math.pow(10, -0.3 / 20) / peak : 1;
  const blob = wavBlob(L, R, rate, bits, gain);
  const bpm = ev.bpm, preset = ($('kit').selectedOptions[0] || {}).textContent || 'take';
  const len = loop ? `${LENS[recSet.len]} bar${LENS[recSet.len] > 1 ? "s" : ""}` : `${(frames / rate).toFixed(1)} s`;
  const name = `elixir ${preset.replace(/[^\w' -]/g, '').trim()} ${bpm}bpm ${loop ? LENS[recSet.len] + 'bar' : 'take'} ${++takeNo}.wav`;
  addTake({ name, blob, len, peak: peak * gain, rate, bits });
  $('rec-status').textContent = `took ${len}`;
}
function wavBlob(L, R, rate, bits, gain) {
  const n = L.length, bps = bits / 8, buf = new ArrayBuffer(44 + n * 2 * bps), v = new DataView(buf);
  const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2 * bps, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2 * bps, true);
  v.setUint16(32, 2 * bps, true); v.setUint16(34, bits, true); str(36, 'data'); v.setUint32(40, n * 2 * bps, true);
  const full = bits === 16 ? 32767 : 8388607;
  let o = 44;
  for (let i = 0; i < n; i++) for (const x of [L[i], R[i]]) {
    // 16-bit gets triangular dither; both are clipped at full scale
    const d = bits === 16 ? Math.random() - Math.random() : 0;
    const s = Math.max(-full - 1, Math.min(full, Math.round(x * gain * full + d)));
    if (bits === 16) v.setInt16(o, s, true); else { v.setUint8(o, s & 255); v.setUint8(o + 1, (s >> 8) & 255); v.setUint8(o + 2, (s >> 16) & 255); }
    o += bps;
  }
  return new Blob([buf], { type: 'audio/wav' });
}
function addTake(t) {
  const list = $('rec-takes'), li = document.createElement('li'), url = URL.createObjectURL(t.blob);
  const db = t.peak > 0 ? (20 * Math.log10(t.peak)).toFixed(1) : '−∞';
  li.innerHTML = `<span><span class="pm-name"></span><br><span class="pm-sub">${t.len} · ${t.rate / 1000} kHz ${t.bits}-bit · peak ${db} dB${t.peak >= 1 ? ' (clipped)' : ''}</span></span>
    <a class="btn" download>save .wav</a><button class="btn ghost pm-del" type="button">delete</button><audio controls preload="none"></audio>`;
  li.querySelector('.pm-name').textContent = t.name;
  li.querySelector('a').href = url; li.querySelector('a').download = t.name; li.querySelector('audio').src = url;
  li.querySelector('.pm-del').addEventListener('click', () => { URL.revokeObjectURL(url); li.remove(); });
  list.prepend(li);
}
