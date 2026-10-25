// Runs the engine and the step sequencer, and resamples 44 140 Hz to the output rate.
// Used inside the AudioWorklet (or a ScriptProcessor fallback).
// bar conditions: 0 every bar; n = only the last bar of every n; -n = every bar except that one;
// 100 + n = only the first bar of every n (the bar after a fill)
function barOk(b, bar) {
  if (!b) return true;
  if (b > 100) return bar % (b - 100) === 0;
  if (b > 0) return bar % b === b - 1;
  return bar % -b !== -b - 1;
}
// the tempo-synced delay: 1/128 of a bar at 0, a whole bar at 1, evenly in octaves between
const delaySamples = (pos, bpm) => 240 / bpm * Math.pow(2, -7 * (1 - pos)) * LXR.REAL_FS;
const RING_MAKEUP = 3;
class Player {
  constructor(outRate) {
    this.e = new LXR.LxrEngine();
    this.e.loadInitKit();
    this.ratio = LXR.REAL_FS / outRate;
    this.A = [new Float32Array(64), new Float32Array(64)];
    this.B = [new Float32Array(64), new Float32Array(64)];
    this.idx = 0; this.frac = 0;
    this.pattern = { on: [], acc: [], bar: [] };
    this.playing = false; this.bpm = 120; this.vel = 100; this.accGain = 0.5;
    this.step = 0; this.bar = 0; this.toNext = 0; this.atBar = [];
    // groove: per track and step, how far its hits sit off the grid in 16ths (+ late, - early)
    this.groove = { off: Array.from({ length: 7 }, () => new Array(16).fill(0)) };
    this.queue = []; this.sched = []; this.fresh = false; this.rec = null;
    // count-in: a beep then three boops over the bar before a take, with the mix turned down under them
    this.cntStep = 0; this.cntGain = 1; this.clk = null;
    // accent: unaccented sequencer hits are turned down by the accent amount, after the engine
    this.gain = new Float32Array(6).fill(1); this.gainTo = new Float32Array(6).fill(1);
    this.fxGain = new Float32Array(6); this.fxAmt = new Float32Array(6).fill(1);
    // mixer mute: the sequencer skips a muted voice's steps; pads, MIDI and anything still ringing play on
    this.muted = new Uint8Array(6);
    // master: drum 1 ducks the other voices (before the FX bus), then a compressor
    // on the whole mix, the same design as the LXR-02's FX compressor
    this.master = { comp: true, thresh: -12, ratio: 3, attack: 5, release: 120, makeup: 0, duck: 0.4, duckRelease: 150, duckFx: false, duckOn: true };
    // delay: tempo-synced time, 0 = 1/128 .. 1 = one bar, and run as a send effect (all wet,
    // the voices keep their dry path); not in the firmware
    this.delayPos = 1 + Math.log2(3 / 16) / 7;
    // two more of the firmware's FX, each as its own send bus: distortion and ring mod (the
    // engine's own FX bus is the echo); all three are wet only, the voices keep their dry path
    this.dist = new LXR.FxBus(); this.dist.fxType = LXR.FX_DISTORTION; this.dist.forceWet = true;
    this.ring = new LXR.FxBus(); this.ring.fxType = LXR.FX_RING; this.ring.forceWet = true;
    this.fxRng = new LXR.Rng(0x2545f491);
    this.sendD = new Float32Array(6); this.sendR = new Float32Array(6); this.echoWidth = 1;
    this.busIn = new Float32Array(128); this.busOut = new Int16Array(128);
    this.duckEnv = 0; this.duckAt = 1; this.compEnv = 0; this.gr = 0; this.duckMin = 1;
    // level meters: each voice's peak after its fader, accent, mute and duck
    this.lvl = new Float32Array(6); this.lvlN = 0; this.lvlOn = false;
    this.events = [];
    this._render(this.A); this._render(this.B);
  }
  msg(m) {
    if (m.type === 'param') this.e.setParam(m.par, m.value);
    else if (m.type === 'kit') this.e.loadKit(m.values);
    else if (m.type === 'trig') { this.e.trigger(m.voice, m.vel, 60); this.gainTo[Math.min(m.voice, 5)] = 1; }
    else if (m.type === 'mute') m.muted.forEach((v, n) => { this.muted[n] = v ? 1 : 0; });
    else if (m.type === 'xmod') this.e.setCrossMod(m.amt, m.target);
    else if (m.type === 'delay') this.delayPos = m.pos;
    else if (m.type === 'atBar') { if (this.playing) this.atBar.push(m.m); else this.msg(m.m); }
    else if (m.type === 'mix') {
      if (m.master) Object.assign(this.master, m.master);
      if (m.dist) {
        this.dist.distortion.type = m.dist.type;
        m.dist.p.forEach((v, i) => this.dist.setParameter(i, v / 127));
        this.ring.ringmod.osc.waveform = m.ring.wave;
        this.ring.setParameter(0, m.ring.freq / 127);
        this.sendD.set(m.sendD); this.sendR.set(m.sendR); this.echoWidth = m.echo.pct / 100;
      } this.fxAmt.set(m.fx); }
    else if (m.type === 'rec') {
      // recorder: free starts now; a loop waits for the first step of a bar and stops after its bars
      // with a count-in, the take starts on the bar after a counted one (from stop the count keeps its own time)
      this.rec = { loop: m.bars > 0, bars: m.bars, on: !(m.bars > 0) && !m.count, count: m.count ? (this.playing ? 'wait' : 'run') : null,
        done: 0, L: new Float32Array(16384), R: new Float32Array(16384), n: 0 };
      if (this.rec.count === 'run') { this.cntStep = 0; this.toNext = 0; }
      this.events.push({ type: 'rec', state: this.rec.on ? 'on' : this.rec.count === 'run' ? 'count' : 'wait' });
    } else if (m.type === 'recStop') { if (this.rec) this.recEnd(); }
    else if (m.type === 'seq') {
      // a live pattern change (the perform sliders, the grid) wins over one still waiting for the bar
      this.atBar = this.atBar.filter((q) => q.type !== 'seq');
      this.pattern = m.pattern; this.patternOn = m.patternOn !== false; this.bpm = m.bpm;
      if (m.groove) this.groove = m.groove; this.vel = m.vel; this.e.bpm = m.bpm;
      this.accGain = Math.pow(10, -m.accentDb / 20);
      if (m.playing && !this.playing) { this.step = 0; this.bar = 0; this.toNext = 0; this.queue = []; this.fresh = true; }
      const was = this.playing; this.playing = m.playing;
      // stopping ends a loop or a count-in (a count from stop is not playing yet, so it carries on)
      if (!this.playing) { this.flushBar(); if (this.rec && (this.rec.loop || this.rec.count) && (was || this.rec.count !== 'run')) this.recEnd(); }
    }
  }
  recFlush() {
    const r = this.rec;
    if (r.n) this.events.push({ type: 'recData', L: r.L.slice(0, r.n), R: r.R.slice(0, r.n) });
    r.n = 0;
  }
  recEnd() { this.recFlush(); this.events.push({ type: 'rec', state: 'done', bars: this.rec.done, bpm: this.bpm }); this.rec = null; }
  // a preset loaded while playing: its messages wait for the first step of the next bar.
  // A queued pattern never starts or stops the transport.
  flushBar() {
    const q = this.atBar; this.atBar = [];
    for (const m of q) this.msg(m.type === 'seq' ? { ...m, playing: this.playing } : m);
  }
  // the hits of step s, each due `at` samples from now: the grid time of the step moved by the groove
  schedule(s, bar, at0) {
    const P = this.pattern.pages ? this.pattern.pages[bar % this.pattern.pages.length] : this.pattern; // pages: one bar each, in turn
    const hits = [], { on, acc, bar: cond } = P, G = this.groove, len = LXR.REAL_FS * 60 / this.bpm / 4;
    for (let t = 0; t < 7 && this.patternOn; t++) {
      if (!on[t][s] || !barOk(cond[t][s], bar) || this.muted[Math.min(t, 5)]) continue;
      const off = G.off[t][s];
      this.queue.push({ at: Math.max(0, at0 + off * len), t, acc: !!acc[t][s] });
      hits.push(t);
    }
    this.sched[s] = hits;
  }
  clickAt(hi) { this.clk = { n: 0, ph: 0, w: 2 * Math.PI * (hi ? 1760 : 880) / LXR.REAL_FS }; }
  _render(dst) {
    const rc = this.rec;
    if (!this.playing && rc && rc.count === 'run') {
      // a count-in from stop keeps its own time, then starts the transport at bar 1 for the take
      const len = LXR.REAL_FS * 60 / this.bpm / 4;
      while (this.toNext <= 0 && !this.playing) {
        if (this.cntStep === 16) {
          rc.count = 'end'; this.playing = true; this.step = 0; this.bar = 0; this.queue = []; this.fresh = true;
          this.events.push({ type: 'rec', state: 'play' });
        } else { if (this.cntStep % 4 === 0) this.clickAt(this.cntStep === 0); this.cntStep++; this.toNext += len; }
      }
      if (!this.playing) this.toNext -= 64;
    }
    if (this.playing) {
      if (this.toNext <= 0) {
        if (this.step === 0 && this.atBar.length) this.flushBar();
        if (this.step === 0 && this.rec) {
          // a count-in takes the bar before; then a loop (or a counted free take) starts on this one
          const r = this.rec;
          if (r.count === 'wait') { r.count = 'run'; this.events.push({ type: 'rec', state: 'count' }); }
          else if (!r.on) { r.on = true; r.count = null; this.events.push({ type: 'rec', state: 'on' }); }
          else if (!r.loop) r.done++;
          else if (++r.done >= r.bars) this.recEnd();
          if (this.rec && r.loop && r.on) this.events.push({ type: 'rec', state: 'bar', done: r.done });
        }
        if (this.rec && this.rec.count === 'run' && this.step % 4 === 0) this.clickAt(this.step === 0);
        const len = LXR.REAL_FS * 60 / this.bpm / 4;
        // on starting, this step's own hits; after that each tick books the next step's, a step ahead,
        // so a track pushed early can still come in before its grid time
        if (this.fresh) { this.fresh = false; this.schedule(this.step, this.bar, this.toNext); }
        const next = (this.step + 1) % 16;
        this.schedule(next, next === 0 ? this.bar + 1 : this.bar, this.toNext + len);
        this.events.push({ type: 'step', step: this.step, bar: this.bar, hits: this.sched[this.step] || [], gr: this.gr, duck: this.duckMin });
        this.sched[this.step] = [];
        this.gr = 0; this.duckMin = 1;
        this.step = next;
        if (this.step === 0) this.bar++;
        this.toNext += len;
      }
      this.toNext -= 64;
    } else if (this.queue.length) this.queue = [];
    // hits due in this block
    if (this.queue.length) {
      const keep = [];
      for (const q of this.queue) {
        // a voice muted after its step was booked is skipped too
        if (q.at < 64) { if (!this.muted[Math.min(q.t, 5)]) { this.e.trigger(q.t, q.acc ? 127 : this.vel, 60); this.gainTo[Math.min(q.t, 5)] = q.acc ? 1 : this.accGain; } }
        else { q.at -= 64; keep.push(q); }
      }
      this.queue = keep;
    }
    const out = this.e.renderBlock(), e = this.e;
    const pans = [e.drums[0], e.drums[1], e.drums[2], e.snare, e.cymbal, e.hat];
    const [L, R] = dst;
    L.fill(0); R.fill(0);
    // sidechain: follow drum 1's level (instant attack, set release) and turn the rest down
    const M = this.master, k = out[0];
    const isDelay = e.fx.fxType === LXR.FX_DELAY;
    e.fx.forceWet = isDelay;
    e.fx.setDelaySync(isDelay ? delaySamples(this.delayPos, this.bpm) : null);
    let pk = 0;
    for (let i = 0; i < 64; i++) pk = Math.max(pk, Math.abs(k[i]));
    pk = pk / 32768 * this.gainTo[0];
    this.duckEnv = Math.max(pk, this.duckEnv * Math.exp(-64000 / (M.duckRelease * LXR.REAL_FS)));
    const duck0 = this.duckAt, duck1 = 1 - (M.duckOn ? M.duck : 0) * Math.min(1, this.duckEnv / 0.3);
    this.duckAt = duck1; this.duckMin = Math.min(this.duckMin, duck1);
    for (let n = 0; n < 6; n++) {
      // accent gain, ramped over the block, and the duck on every voice but drum 1
      const d0 = n ? duck0 : 1, d1 = n ? duck1 : 1;
      const g0 = this.gain[n] * d0, g1 = this.gainTo[n] * d1, dg = (g1 - g0) / 64;
      // every voice reaches the outputs; one routed to the echo bus also feeds it at its send
      const fa = e.audioRouting[n] === LXR.MIXER_ROUTING_FX_BUS ? this.fxAmt[n] : 0;
      const pl = pans[n].triggeredPanL / 32768, pr = pans[n].triggeredPanR / 32768;
      const o = out[n];
      let lv = 0;
      for (let i = 0; i < 64; i++) { const v = o[i] * (g0 + dg * i); L[i] += v * pl; R[i] += v * pr; const a = v < 0 ? -v : v; if (a > lv) lv = a; }
      lv *= Math.max(pl, pr); if (lv > this.lvl[n]) this.lvl[n] = lv;
      this.fxGain[n] = g1 * fa;
      this.gain[n] = this.gainTo[n];
    }
    if (++this.lvlN >= 16) {
      this.lvlN = 0;
      const on = this.lvl.some((v) => v > 1e-4);
      if (on || this.lvlOn) this.events.push({ type: 'lvl', l: Array.from(this.lvl) });
      this.lvlOn = on; this.lvl.fill(0);
    }
    // the firmware's FX bus (distortion, ring mod, compressor or delay), sample-exact
    const fx = e.renderFx(this.fxGain, this.echoWidth);
    // with duck fx on, the three FX returns are ducked too (all of them, drum 1's sends included), ramped over the block
    const fd0 = M.duckFx ? duck0 : 1, fdd = M.duckFx ? (duck1 - duck0) / 64 : 0;
    // distortion and ring mod buses: each voice panned in at its send, saturated to int16.
    // The firmware's ring mod carrier is quiet (about a third of a plain multiply), so its bus gets makeup gain.
    for (const [bus, sends, mk] of [[this.dist, this.sendD, 1], [this.ring, this.sendR, RING_MAKEUP]]) {
      const bi = this.busIn; bi.fill(0);
      let any = false;
      for (let n = 0; n < 6; n++) {
        const g = sends[n] * this.gainTo[n] * (n ? duck1 : 1);
        if (!g) continue;
        any = true;
        const o = out[n], pl = pans[n].triggeredPanL * g, pr = pans[n].triggeredPanR * g;
        for (let i = 0; i < 64; i++) { bi[2 * i] += o[i] * pl; bi[2 * i + 1] += o[i] * pr; }
      }
      for (let i = 0; i < 128; i++) bus.input[i] = Math.max(-32768, Math.min(32767, Math.round(bi[i])));
      const bo = this.busOut; bo.fill(0);
      bus.process(bo, 64, this.fxRng);
      if (any || bo.some((v) => v)) for (let i = 0; i < 64; i++) { const g = mk / 32768 * (fd0 + fdd * i); L[i] += bo[2 * i] * g; R[i] += bo[2 * i + 1] * g; }
    }
    for (let i = 0; i < 64; i++) { const g = (fd0 + fdd * i) / 32768; L[i] += fx[2 * i] * g; R[i] += fx[2 * i + 1] * g; }
    if (M.comp) {
      // peak detector in dB, attack/release smoothing, gain = over * (1/ratio - 1) + makeup
      const ca = Math.exp(-1000 / (M.attack * LXR.REAL_FS)), cr = Math.exp(-1000 / (M.release * LXR.REAL_FS));
      const slope = 1 / M.ratio - 1, mk = Math.pow(10, M.makeup / 20);
      let env = this.compEnv, gr = this.gr;
      for (let i = 0; i < 64; i++) {
        const peak = Math.max(Math.abs(L[i]), Math.abs(R[i])) + 1e-9;
        const over = Math.max(0, 20 * Math.log10(peak) - M.thresh);
        env = over + (over > env ? ca : cr) * (env - over);
        const g = Math.pow(10, env * slope / 20) * mk;
        L[i] *= g; R[i] *= g;
        gr = Math.max(gr, -env * slope);
      }
      this.compEnv = env; this.gr = gr;
    }
    // the recorder takes the finished mix at the engine's own rate
    const r = this.rec;
    if (r && r.on) { r.L.set(L, r.n); r.R.set(R, r.n); r.n += 64; if (r.n === r.L.length) this.recFlush(); }
    // the count-in is after the recorder, so neither its beeps nor the turned-down mix are in the take
    const to = r && r.count === 'run' ? 0.25 : 1;
    if (to !== 1 || this.cntGain !== 1 || this.clk) {
      let g = this.cntGain;
      for (let i = 0; i < 64; i++) {
        g += (to - g) * 0.003; if (Math.abs(to - g) < 1e-4) g = to;
        let c = 0, k = this.clk;
        if (k) {
          c = 0.35 * Math.sin(k.ph) * Math.min(1, k.n / 48) * Math.exp(-k.n / (0.04 * LXR.REAL_FS));
          k.ph += k.w; if (++k.n > 0.15 * LXR.REAL_FS) this.clk = k = null;
        }
        L[i] = L[i] * g + c; R[i] = R[i] * g + c;
      }
      this.cntGain = g;
    }
  }
  process(L, R) {
    for (let n = 0; n < L.length; n++) {
      while (this.idx >= 64) {
        const t = this.A; this.A = this.B; this.B = t;
        this._render(this.B);
        this.idx -= 64;
      }
      const i = this.idx, fr = this.frac;
      const l0 = this.A[0][i], r0 = this.A[1][i];
      const l1 = i < 63 ? this.A[0][i + 1] : this.B[0][0];
      const r1 = i < 63 ? this.A[1][i + 1] : this.B[1][0];
      L[n] = l0 + (l1 - l0) * fr;
      R[n] = r0 + (r1 - r0) * fr;
      this.frac += this.ratio;
      const k = Math.floor(this.frac);
      this.idx += k; this.frac -= k;
    }
  }
}
