// Steppin UI: transport, multisliders, sample loading, and the audio engine bridge.
(function () {
  const $ = (id) => document.getElementById(id);
  const DSP_SRC = document.getElementById('dsp-src').textContent;

  const VOICES = ['samp', 'anny', 'untl', 'bsStp', 'tonMt', 'lazr', 'gabbr', 'bsClk', 'bsClk', 'gbStp', 'bsClk', 'bsDrm', 'snDrm', 'snClk', '?', '?'];
  const state = {
    vols: [100, 85, 95, 92, 90, 95, 92, 100, 98, 105, 100, 108, 118, 96, 0, 0],
    gab: [120, 0, 250, 60, 0, 180, 400, 0, 90, 300, 0, 140, 220, 0, 480, 40],
    ann: [500, 0, 300, 0, 150, 500, 0, 400, 0, 0, 250, 500, 0, 100],
    bass: [60, 60, 0, 90, 45, 0, 120, 60, 30, 0, 75, 150, 60, 0, 45, 240],
    freq: [180, 320, 560, 900, 1500, 2400, 3600, 4800],
    q: [8, 8, 10, 10, 12, 12, 14, 14],
    gain: [1, 0.9, 0.8, 0.8, 0.7, 0.7, 0.6, 0.6],
    F: 1.25, fix: false, master: 0.6
  };

  let ctx = null, send = () => {}, running = false, sampleData = null, sampleName = 'built-in hit';

  // ---------- multislider ----------
  function token(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  class MultiSlider {
    constructor(canvas, opts) {
      this.c = canvas; this.o = opts; this.values = opts.values; this.head = -1; this.down = false;
      const ro = new ResizeObserver(() => this.resize()); ro.observe(canvas);
      canvas.addEventListener('pointerdown', (e) => { this.down = true; canvas.setPointerCapture(e.pointerId); this.set(e); });
      canvas.addEventListener('pointermove', (e) => { if (this.down) this.set(e); });
      const up = () => { this.down = false; };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('keydown', (e) => this.key(e));
      this.focus = 0;
      this.resize();
    }
    resize() {
      const r = this.c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      this.w = r.width; this.h = r.height;
      this.c.width = Math.max(1, Math.round(r.width * dpr)); this.c.height = Math.max(1, Math.round(r.height * dpr));
      this.ctx = this.c.getContext('2d'); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.draw();
    }
    set(e) {
      const r = this.c.getBoundingClientRect(), n = this.values.length;
      const i = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n)));
      if (this.o.disabled && this.o.disabled(i)) return;
      const u = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      let v = this.o.min + u * (this.o.max - this.o.min);
      if (this.o.int) v = Math.round(v);
      this.values[i] = v; this.focus = i; this.draw(); this.o.onChange(this.values);
    }
    key(e) {
      const n = this.values.length, step = (this.o.max - this.o.min) / 20;
      if (e.key === 'ArrowRight') this.focus = Math.min(n - 1, this.focus + 1);
      else if (e.key === 'ArrowLeft') this.focus = Math.max(0, this.focus - 1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const d = e.key === 'ArrowUp' ? step : -step;
        let v = Math.max(this.o.min, Math.min(this.o.max, this.values[this.focus] + d));
        if (this.o.int) v = Math.round(v);
        this.values[this.focus] = v; this.o.onChange(this.values);
      } else return;
      e.preventDefault(); this.draw();
    }
    setHead(i) { if (i !== this.head) { this.head = i; this.draw(); } }
    draw() {
      const x = this.ctx; if (!x) return;
      const n = this.values.length, w = this.w, h = this.h, bw = w / n;
      const fill = token('--bar'), head = token('--accent'), grid = token('--grid'), ink = token('--bar-ink'), dim = token('--muted');
      x.clearRect(0, 0, w, h);
      for (let i = 0; i < n; i++) {
        const u = (this.values[i] - this.o.min) / (this.o.max - this.o.min);
        const off = this.o.disabled && this.o.disabled(i);
        x.fillStyle = i === this.head ? head : off ? grid : fill;
        x.fillRect(i * bw + 1, h - u * h, bw - 2, u * h);
        x.fillStyle = grid; x.fillRect(Math.round((i + 1) * bw) - 0.5, 0, 1, h);
        if (this.o.labels) {
          x.save(); x.translate(i * bw + bw / 2 + 4, h - 6); x.rotate(-Math.PI / 2);
          x.font = '600 10px "Martian Mono", ui-monospace, monospace';
          x.fillStyle = u * h > 50 && !off ? ink : dim; x.fillText(this.o.labels[i], 0, 0);
          x.restore();
        }
      }
      if (document.activeElement === this.c) {
        x.strokeStyle = head; x.lineWidth = 2; x.strokeRect(this.focus * bw + 1, 1, bw - 2, h - 2);
      }
    }
  }

  const sliders = {};
  function mk(id, key, opts) {
    const c = $(id);
    c.addEventListener('focus', () => sliders[key].draw()); c.addEventListener('blur', () => sliders[key].draw());
    sliders[key] = new MultiSlider(c, Object.assign({ values: state[key] }, opts));
  }
  mk('ms-vols', 'vols', { min: 0, max: 127, int: true, labels: VOICES, disabled: (i) => i >= 14, onChange: (v) => send({ t: 'vols', v }) });
  mk('ms-gab', 'gab', { min: 0, max: 500, int: true, onChange: (v) => send({ t: 'steps', w: 'gab', v }) });
  mk('ms-ann', 'ann', { min: 0, max: 500, int: true, onChange: (v) => send({ t: 'steps', w: 'ann', v }) });
  mk('ms-bass', 'bass', { min: 0, max: 500, int: true, onChange: (v) => send({ t: 'steps', w: 'bass', v }) });
  const filt = () => send({ t: 'filt', f: state.freq, q: state.q, g: state.gain });
  mk('ms-freq', 'freq', { min: 20, max: 5000, onChange: filt });
  mk('ms-q', 'q', { min: 0, max: 100, onChange: filt });
  mk('ms-gain', 'gain', { min: 0, max: 1, onChange: filt });

  const redrawAll = () => Object.values(sliders).forEach((s) => s.draw());
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redrawAll);
    new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (e) {}
  if (document.fonts) document.fonts.ready.then(redrawAll);

  // ---------- randomise everything / alter (nudge) ----------
  const RANGES = {
    gab: { min: 0, max: 500, int: true }, ann: { min: 0, max: 500, int: true }, bass: { min: 0, max: 250, int: true },
    vols: { min: 0, max: 127, int: true }, freq: { min: 20, max: 5000 }, q: { min: 0, max: 100 }, gain: { min: 0, max: 1 }
  };
  const rr = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // roughly -1..1, centred
  function pushAll() {
    Object.keys(RANGES).forEach((k) => sliders[k].draw());
    ['gab', 'ann', 'bass'].forEach((w) => send({ t: 'steps', w, v: state[w] }));
    send({ t: 'vols', v: state.vols }); filt();
  }
  function randomiseAll() {
    ['gab', 'ann', 'bass'].forEach((k) => {
      const a = state[k], mx = RANGES[k].max;
      for (let i = 0; i < a.length; i++) a[i] = Math.random() < 0.3 ? 0 : Math.round(rr(10, mx));
    });
    for (let i = 0; i < 14; i++) state.vols[i] = Math.random() < 0.12 ? 0 : Math.round(rr(78, 120));
    for (let i = 0; i < 8; i++) {
      state.freq[i] = Math.exp(rr(Math.log(60), Math.log(5000)));
      state.q[i] = rr(2, 40); state.gain[i] = rr(0.3, 1);
    }
    setF(1000 / Math.round(rr(560, 1100)));
    pushAll(); flashBtn('rand');
  }
  function alterAll() {
    ['gab', 'ann', 'bass'].forEach((k) => {
      const a = state[k], mx = RANGES[k].max;
      for (let i = 0; i < a.length; i++) {
        if (Math.random() < 0.08) a[i] = a[i] > 0 ? 0 : Math.round(rr(10, mx)); // occasionally flip a step on or off
        else if (a[i] > 0) a[i] = Math.round(Math.max(1, Math.min(mx, a[i] + gauss() * mx * 0.08)));
      }
    });
    for (let i = 0; i < 14; i++) if (state.vols[i] > 0) state.vols[i] = Math.round(Math.max(1, Math.min(127, state.vols[i] + gauss() * 6)));
    for (let i = 0; i < 8; i++) {
      state.freq[i] = Math.max(20, Math.min(5000, state.freq[i] * Math.pow(2, gauss() * 0.25)));
      state.q[i] = Math.max(0.5, Math.min(100, state.q[i] * Math.pow(2, gauss() * 0.3)));
      state.gain[i] = Math.max(0, Math.min(1, state.gain[i] + gauss() * 0.08));
    }
    setF(state.F * Math.pow(2, gauss() * 0.04));
    pushAll(); flashBtn('alter');
  }
  function flashBtn(id) { const el = $(id); el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); }
  $('rand').addEventListener('click', randomiseAll);
  $('alter').addEventListener('click', alterAll);
  document.querySelectorAll('[data-clear]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.clear; state[k].fill(0); sliders[k].draw(); send({ t: 'steps', w: k, v: state[k] });
  }));

  // ---------- tempo ----------
  const msecIn = $('msec'), ratioIn = $('ratio');
  function setF(F, from) {
    if (!(F > 0) || !isFinite(F)) return;
    state.F = F;
    if (from !== 'ratio') ratioIn.value = F.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    if (from !== 'msec') msecIn.value = Math.round(1000 / F);
    send({ t: 'F', v: F });
  }
  msecIn.addEventListener('input', () => { const ms = parseFloat(msecIn.value); if (ms > 0) setF(1000 / ms, 'msec'); });
  ratioIn.addEventListener('input', () => setF(parseFloat(ratioIn.value), 'ratio'));
  $('fix').addEventListener('change', (e) => { state.fix = e.target.checked; send({ t: 'fix', v: state.fix }); });
  $('master').addEventListener('input', (e) => { state.master = parseFloat(e.target.value); send({ t: 'master', v: state.master }); });

  // ---------- engine ----------
  function sendAll() {
    send({ t: 'F', v: state.F }); send({ t: 'fix', v: state.fix }); send({ t: 'master', v: state.master });
    send({ t: 'vols', v: state.vols });
    ['gab', 'ann', 'bass'].forEach((w) => send({ t: 'steps', w, v: state[w] }));
    filt();
    if (sampleData) send({ t: 'sample', v: sampleData });
  }
  function onMsg(m) {
    if (m.t !== 'ui') return;
    sliders.gab.setHead(m.gi); sliders.ann.setHead(m.ai); sliders.bass.setHead(m.bi);
    $('ro-beat').textContent = m.msD ? Math.round(m.msD) : '–';
    $('ro-sub').textContent = m.msA ? Math.round(m.msA) : '–';
    $('ro-loop').textContent = m.ls + ' + ' + (m.ll ? m.ll.toFixed(1) : '0');
    $('ro-count').textContent = m.c136 + ' · ' + m.c433 + ' · ' + m.c63;
  }
  async function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    let node = null;
    try {
      const proc = DSP_SRC + `
        class SteppinProcessor extends AudioWorkletProcessor {
          constructor() { super(); this.d = new PatchDSP(sampleRate); this.d.post = (m) => this.port.postMessage(m); this.port.onmessage = (e) => this.d.handle(e.data); }
          process(i, o) { const out = o[0]; this.d.process(out[0], out[1] || out[0], out[0].length); return true; }
        }
        registerProcessor('steppin', SteppinProcessor);`;
      const url = URL.createObjectURL(new Blob([proc], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      node = new AudioWorkletNode(ctx, 'steppin', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      node.port.onmessage = (e) => onMsg(e.data);
      send = (m) => node.port.postMessage(m);
      $('engine').textContent = 'AudioWorklet';
    } catch (err) {
      const PatchDSP = new Function(DSP_SRC + '; return PatchDSP;')();
      const d = new PatchDSP(ctx.sampleRate);
      d.post = (m) => onMsg(m);
      node = ctx.createScriptProcessor(1024, 1, 2);
      node.onaudioprocess = (e) => { const b = e.outputBuffer; d.process(b.getChannelData(0), b.getChannelData(1), b.length); };
      send = (m) => d.handle(m);
      $('engine').textContent = 'ScriptProcessor (fallback)';
    }
    node.connect(ctx.destination);
    if (!sampleData) sampleData = builtInHit(ctx.sampleRate);
    sendAll();
  }

  function builtInHit(sr) {
    const n = Math.round(sr * 0.5), a = new Float32Array(n);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      a[i] = (Math.sin(2 * Math.PI * 180 * t + 3 * Math.sin(2 * Math.PI * 523 * t)) * 0.6
        + rnd() * Math.exp(-t * 40) * 0.5 + Math.sin(2 * Math.PI * 1210 * t) * Math.exp(-t * 20) * 0.25) * Math.exp(-t * 9);
    }
    return a;
  }

  // spacebar: [key] → [select 32] → 800 ms, ratio 1.25, [s o] phase resets
  function sync() {
    msecIn.value = 800; setF(1.25, 'msec');
    send({ t: 'reset' });
    flash();
  }
  function flash() { flashBtn('sync'); }

  async function start() {
    await ensureCtx();
    await ctx.resume();
    if (!running) { running = true; sync(); }
    setRun(true);
  }
  async function stop() { if (ctx) await ctx.suspend(); running = false; setRun(false); }
  function setRun(on) {
    const b = $('start'); b.textContent = on ? 'Stop' : 'Start';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    document.body.classList.toggle('on', on);
  }
  $('start').addEventListener('click', () => (running ? stop() : start()));
  $('sync').addEventListener('click', async () => { if (!running) await start(); else sync(); });
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'select' || tag === 'textarea';
    if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key === 'r' || e.key === 'R') { randomiseAll(); return; }
      if (e.key === 'a' || e.key === 'A') { alterAll(); return; }
    }
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (typing || tag === 'button') return;
    e.preventDefault();
    if (!running) start(); else sync();
  });

  // ---------- sample ----------
  $('file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try {
      await ensureCtx();
      const ab = await f.arrayBuffer();
      const audio = await ctx.decodeAudioData(ab);
      const n = audio.length, mono = new Float32Array(n);
      for (let c = 0; c < audio.numberOfChannels; c++) { const d = audio.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / audio.numberOfChannels; }
      sampleData = mono; sampleName = f.name;
      send({ t: 'sample', v: mono });
      $('sample-name').textContent = f.name + ' · ' + Math.round(n / ctx.sampleRate * 1000) + ' ms';
    } catch (err) {
      $('sample-name').textContent = 'Could not decode that file. Try a WAV, AIFF or MP3.';
    }
  });
  $('builtin').addEventListener('click', async () => {
    await ensureCtx();
    sampleData = builtInHit(ctx.sampleRate); sampleName = 'built-in hit';
    send({ t: 'sample', v: sampleData });
    $('sample-name').textContent = 'built-in hit · 500 ms';
  });
})();
