// ---- scope: render one hit of the selected voice offline with the same engine ----
const scope = $('scope'), sctx = scope.getContext('2d');
let scopeTimer = 0;
function scheduleScope() { clearTimeout(scopeTimer); scopeTimer = setTimeout(drawScope, 70); }
function drawScope() {
  const t = TRACKS[track];
  const e = new LXR.LxrEngine();
  e.loadKit(values);
  for (let i = 0; i < 40; i++) e.renderBlock(); // let the volume smoothing settle
  e.trigger(track, 127, 60);
  const n = Math.round(LXR.REAL_FS * 0.5 / 64), data = new Float32Array(n * 64);
  for (let b = 0; b < n; b++) { const o = e.renderBlock(); for (let i = 0; i < 64; i++) data[b * 64 + i] = o[t.voice][i] / 32768; }
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--lcd-ink').trim(), dim = css.getPropertyValue('--lcd-dim').trim();
  const W = scope.width, H = scope.height, mid = H / 2;
  sctx.clearRect(0, 0, W, H);
  sctx.strokeStyle = dim; sctx.lineWidth = 1; sctx.globalAlpha = .5;
  sctx.beginPath(); sctx.moveTo(0, mid); sctx.lineTo(W, mid);
  for (let ms = 100; ms < 500; ms += 100) { const x = ms / 500 * W; sctx.moveTo(x, mid - 6); sctx.lineTo(x, mid + 6); }
  sctx.stroke(); sctx.globalAlpha = 1;
  sctx.fillStyle = ink;
  const per = data.length / W;
  let peak = 0;
  for (let x = 0; x < W; x++) {
    let lo = 1, hi = -1;
    for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per); i++) { const v = data[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    peak = Math.max(peak, Math.abs(lo), Math.abs(hi));
    sctx.fillRect(x, mid - hi * mid * .92, 1, Math.max(1, (hi - lo) * mid * .92));
  }
  sctx.fillStyle = dim; sctx.font = '20px ' + css.getPropertyValue('--mono');
  sctx.fillText('500 ms', W - 86, H - 10);
  if (!document.activeElement || !document.activeElement.closest('.knob')) {
    detail(`peak <em>${peak > 0 ? (20 * Math.log10(peak)).toFixed(1) + ' dBFS' : 'silent'}</em>`);
  }
}

// ---- triggering ----
const pad = $('pad');
function flash(el) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('hit'), 90); }
async function hit(t) {
  await startAudio();
  send({ type: 'trig', voice: t, vel: perf.vel });
  flash(voicesEl.children[t]);
  if (t === track) flash(pad);
}
pad.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(track); });
pad.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); hit(track); } });
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.code === 'Space') { e.preventDefault(); hit(track); }
  else if (/^[1-7]$/.test(e.key)) hit(Number(e.key) - 1);
  else if (e.key === 'r') { randomise(); setDirty(true); }
  else if (e.key === 'R') { randomise([0, 1, 2, 3, 4, 5]); setDirty(true); }
});

