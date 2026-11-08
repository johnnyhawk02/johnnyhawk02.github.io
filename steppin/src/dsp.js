// Steppin DSP engine: a sample-by-sample port of the decoded Max/MSP patch.
// Every phasor~/cycle~ in the patch is one state variable here, named after its Max object id.
// Runs inside an AudioWorkletProcessor, or on the main thread as a ScriptProcessor fallback.

const TWO_PI = 6.283185307179586;
function wrap(x) { return x - Math.floor(x); }
function clip(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
// log~ with a base: 0 for non-positive input or a degenerate base (keeps the graph NaN-free)
function lg(x, b) {
  if (x <= 0 || b <= 0) return 0;
  const lb = Math.log(b);
  if (Math.abs(lb) < 1e-9) return 0;
  return Math.log(x) / lb;
}
// index~ reading a 0..1 phasor scaled by N then offset by -0.5, truncated
function stepIndex(p, n) { const i = (p * n - 0.5) | 0; return i < 0 ? 0 : i >= n ? n - 1 : i; }
// gain~ slider law: 0 is off, 127 is unity, 0.6 dB per step
function gainAmp(v) { return v <= 0 ? 0 : Math.pow(2, (v - 127) / 10); }

class Curve { // curve~ / line~ segment generator
  constructor(sr, c) { this.sr = sr; this.v = 0; this.from = 0; this.to = 0; this.n = 0; this.len = 1; this.setCurve(c); }
  setCurve(c) { this.a = c * 8; this.den = Math.abs(this.a) < 1e-6 ? 0 : Math.exp(this.a) - 1; }
  start(from, to, ms) { this.from = from; this.to = to; this.n = 0; this.len = Math.max(1, ms * this.sr / 1000); this.v = from; }
  tick() {
    if (this.n < this.len) {
      const u = this.n / this.len;
      const s = this.den === 0 ? u : (Math.exp(this.a * u) - 1) / this.den;
      this.v = this.from + (this.to - this.from) * s;
      this.n++;
    } else this.v = this.to;
    return this.v;
  }
}

class PatchDSP {
  constructor(sr) {
    this.sr = sr; this.isr = 1 / sr; this.post = function () {};
    this.F = 1.25; this.fix = false; this.master = 0.35;
    const vars = ['p266','p329','p251','p460','p436','p62','p257','p259','p110','p112','p236','p56','p431','p398','p380','p319','p296','p281','p133','p101','p229','p214','p207','p174',
      'c114','c254','c107','c444','c414','c364','c422','c121','c397','c303','c379','c318','c295','c123','c228','c83','c173','c334','c250'];
    for (const k of vars) this[k] = 0;
    // step buffers (buffer~ newstep / steppin / thesteps), stored 0..1 like peek~ value/500
    this.gab = new Float32Array(16); this.ann = new Float32Array(14); this.bass = new Float32Array(16);
    this.gt = new Float32Array(14); this.g = new Float32Array(14);
    // counters
    this.c322 = 41; this.uf = false; this.o136 = 0; this.c136 = 0; this.o433 = 1; this.c433 = 1; this.o63 = 1; this.c63 = 1;
    // sah~
    this.shR = 0; this.shL = 0; this.ctlR = 0; this.ctlL = 0;
    // previous phasor outputs for delta~ <~ 0 edge~ trigger detection
    this.pa = 0; this.pb = 0; this.pc = 0; this.pd = 0; this.pe = 0;
    // envelopes
    this.l300 = 0; this.l300d = 0; this.l100 = 0; this.l100d = 0;
    this.cv75 = new Curve(sr, -0.9); this.cv143 = new Curve(sr, -0.9);
    // gate~ objects and their delay closes
    this.g158 = 0; this.g183 = 0; this.t158 = 0; this.t183 = 0;
    // fffb~ 8
    this.bands = [];
    for (let i = 0; i < 8; i++) this.bands.push({ b0: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0, gain: 0.5 });
    // comb~ (10 ms max delay; the patch's delay signal always exceeds it)
    this.cD = Math.max(1, Math.round(0.010 * sr)); this.cx = new Float32Array(this.cD); this.cy = new Float32Array(this.cD); this.ci = 0;
    this.ca = 1; this.cb = 0.8; this.cc = 0.7;
    // spool / grooveduck sample looper
    this.buf = null; this.pos = 0; this.lsMs = 0; this.llMs = 8; this.duckMs = 1;
    // output DC blockers
    this.dxL = 0; this.dyL = 0; this.dxR = 0; this.dyR = 0;
    this.n = 0; this.pollN = 0; this.uiN = 0; this.lastD = 0; this.msD = 0; this.lastA = 0; this.msA = 0;
    this.gabV = 0; this.gi = 0; this.ai = 0; this.bi = 0;
    this.rates();
  }

  // the "master tempo hack": every clock rate derived from the ratio F (1.25 Hz = 800 ms)
  rates() {
    const F = this.F;
    this.rF = F; this.r12 = F * 12; this.r20 = F / 20; this.r50 = F / 50;
    this.r8 = F / 0.125; this.r4 = this.r8 / 2; this.rn8 = -this.r8;
    // [/ 10.] receives F in both inlets; Max fires the right inlet first, so it outputs F/F = 1
    this.R = this.fix ? F / 10 : 1; this.rnR = -this.R;
  }

  setFilters(f, q, g) {
    for (let i = 0; i < 8; i++) {
      const b = this.bands[i];
      const fr = clip(f[i], 20, this.sr * 0.45), Q = Math.max(0.5, q[i]);
      const w0 = TWO_PI * fr / this.sr, al = Math.sin(w0) / (2 * Q), a0 = 1 + al;
      b.b0 = al / a0; b.b2 = -al / a0; b.a1 = -2 * Math.cos(w0) / a0; b.a2 = (1 - al) / a0; b.gain = g[i];
    }
  }

  handle(m) {
    switch (m.t) {
      case 'F': this.F = m.v; this.rates(); break;
      case 'fix': this.fix = !!m.v; this.rates(); break;
      case 'vols': for (let i = 0; i < 14; i++) this.gt[i] = gainAmp(m.v[i]); break;
      case 'steps': { const a = this[m.w]; for (let i = 0; i < a.length; i++) a[i] = (m.v[i] || 0) / 500; break; }
      case 'filt': this.setFilters(m.f, m.q, m.g); break;
      case 'sample': this.buf = m.v; this.pos = 0; break;
      case 'master': this.master = m.v; break;
      case 'reset': this.reset(); break;
    }
  }

  // spacebar: [s o] → every [r o], plus the key's own messages
  reset() {
    this.p266 = 0; this.c322 = 0; this.uf = false; this.lsMs = 0;
    this.p329 = 0.5; this.p207 = 0.5; this.p236 = 0; this.p251 = 0; this.p281 = 0; this.p296 = 0;
    this.p319 = 0.75; this.p380 = 0; this.c83 = 0; this.p214 = 0; this.p229 = 0; this.p174 = 0.5; this.c173 = 0;
    this.c318 = this.c379 = this.c397 = this.c422 = this.c414 = 0;
    this.ca = 1; this.cb = 0.8; this.cc = 0.7;
    this.c123 = 0.5; this.c303 = 0.5; this.p436 = 0; this.p56 = 0.8; this.p133 = 0; this.c121 = 0.2; this.p101 = 0;
    this.c136 = 0; this.o136 = 0;
    this.p398 = 0.5; this.p431 = 0; this.c364 = 0; this.c114 = 0; this.p460 = 0; this.p62 = 0; this.p259 = 0; this.p257 = 0;
    this.c433 = 1; this.o433 = 1; this.c63 = 1; this.o63 = 1;
    this.pos = 0;
  }

  // trigger handlers (button → ...)
  trigA() { // phasor~ 5 wrap: loop-start counter, ring-mod and tonMt envelopes
    let v = this.c322 - 1, uf = false;
    if (v < 1) { v = 40; uf = true; }
    if (!uf && this.uf) { this.p110 = 0.01; this.p112 = 0.01; this.p259 = 0; this.p257 = 0; } // [select 0] after underflow
    this.uf = uf; this.c322 = v; this.lsMs = v;
    this.l300 = 1; this.l300d = 1 / (0.3 * this.sr);
    this.l100 = 1; this.l100d = 1 / (0.1 * this.sr);
    this.msA = (this.n - this.lastA) * 1000 / this.sr; this.lastA = this.n;
  }
  trigBar() { // slow phasor~ wrap: gabber multiplier and bass-step log base
    let v = this.c136 - 1; if (v < 1) v = 10; this.c136 = v; this.o136 = v;
    let w = this.c433 + 1; if (w > 64) w = 1; this.c433 = w; this.o433 = w;
  }
  trigC() { let v = this.c63 + 1; if (v > 3) v = 1; this.c63 = v; this.o63 = v; }
  trigD() { this.cv75.start(0.8, 0, 5000); this.msD = (this.n - this.lastD) * 1000 / this.sr; this.lastD = this.n; }
  trigE() {
    this.g158 = 1; this.t158 = Math.round(0.020 * this.sr);
    this.g183 = 1; this.t183 = Math.round(0.080 * this.sr);
    this.cv143.start(3000, 200, 50);
  }

  process(L, R, len) {
    const isr = this.isr, sr = this.sr, g = this.g, gt = this.gt;
    for (let i = 0; i < len; i++) {
      for (let k = 0; k < 14; k++) g[k] += (gt[k] - g[k]) * 0.0015;

      // ---- step readers (index~) ----
      const p266 = this.p266; this.p266 = wrap(p266 + 0.625 * isr);
      const gi = stepIndex(p266, 16), gabV = this.gab[gi] * 500;
      const p101 = this.p101; this.p101 = wrap(p101 + 0.714286 * isr);
      const ai = stepIndex(p101, 14), annS = this.ann[ai];
      const p436 = this.p436; this.p436 = wrap(p436 + this.R * isr);
      const p460 = this.p460; this.p460 = wrap(p460 + 32 * lg(p436, this.o433 / 16) * isr);
      const bi = stepIndex(p460, 16), bassV = this.bass[bi] * 500;
      this.gabV = gabV; this.gi = gi; this.ai = ai; this.bi = bi;

      // ---- shared clocks ----
      const p431 = this.p431; this.p431 = wrap(p431 + this.r4 * isr);
      const p62 = this.p62; this.p62 = wrap(p62 + 0.5 * isr);
      const p229 = this.p229; this.p229 = wrap(p229 + this.rF * isr);
      const p207 = this.p207; this.p207 = wrap(p207 + this.rF * isr);

      // ---- triggers ----
      if (p431 < this.pa) this.trigA(); this.pa = p431;
      if (p436 < this.pb) this.trigBar(); this.pb = p436;
      if (p62 < this.pc) this.trigC(); this.pc = p62;
      if (p229 < this.pd) this.trigD(); this.pd = p229;
      if (p207 < this.pe) this.trigE(); this.pe = p207;
      if (this.t158 > 0 && --this.t158 === 0) this.g158 = 0;
      if (this.t183 > 0 && --this.t183 === 0) this.g183 = 0;

      // number~ polled every 100 ms → [!/ 1000.] → loop length
      if (++this.pollN >= sr * 0.1) { this.pollN = 0; this.llMs = gabV > 0 ? 1000 / gabV : 0; }

      // ---- 0 samp: spool looper, ring-modulated ----
      let gro = 0;
      const buf = this.buf;
      if (buf && buf.length > 2) {
        const blen = buf.length - 1;
        const s = Math.min(blen - 1, this.lsMs * sr / 1000);
        const e = Math.min(blen, Math.max(s + 1, (this.lsMs + this.llMs) * sr / 1000));
        if (this.pos >= e || this.pos < s) this.pos = s;
        const ip = this.pos | 0, fr = this.pos - ip;
        const v = buf[ip] * (1 - fr) + buf[ip + 1] * fr;
        const d = this.duckMs * sr / 1000, dist = Math.min(this.pos - s, e - this.pos);
        gro = v * (d > 0 ? Math.min(1, dist / d) : 1);
        this.pos += 1;
      }
      const s334 = Math.cos(TWO_PI * this.c334); this.c334 = wrap(this.c334 + 412 * isr);
      const p329 = this.p329; this.p329 = wrap(p329 + 0.03125 * isr);
      this.l300 = Math.max(0, this.l300 - this.l300d);
      const vSamp = gro * s334 * this.l300 * (p329 + 0.5);

      // ---- 1 anny: sah~ random-pitch blips, L and R ----
      const p257 = this.p257; this.p257 = wrap(p257 + 25 * isr);
      const p259 = this.p259; this.p259 = wrap(p259 + this.r12 * isr);
      if (this.ctlR <= 0.01 && p259 > 0.01) this.shR = p257; this.ctlR = p259;
      const aR = Math.cos(TWO_PI * this.c254) * 0.2; this.c254 = wrap(this.c254 + this.shR * 1000 * isr);
      const p110 = this.p110; this.p110 = wrap(p110 + 25 * isr);
      const p112 = this.p112; this.p112 = wrap(p112 + this.r12 * isr);
      if (this.ctlL <= 0.01 && p112 > 0.01) this.shL = p110; this.ctlL = p112;
      const aL = Math.cos(TWO_PI * this.c107) * 0.2; this.c107 = wrap(this.c107 + this.shL * 1000 * isr);
      const s114 = Math.cos(TWO_PI * this.c114); this.c114 = wrap(this.c114 + this.r20 * isr);

      // ---- 2 untl: audio-rate log sweep clocked by the bass steps ----
      const p251 = this.p251; this.p251 = wrap(p251 + (bassV / this.o63) * isr);
      const f250 = clip(Math.abs(32 * lg(p251, 48)) * 32 - 1200, 0, 20000);
      const s250 = Math.cos(TWO_PI * this.c250); this.c250 = wrap(this.c250 + f250 * isr);
      const p236 = this.p236; this.p236 = wrap(p236 - 2.5 * isr);
      const p56 = this.p56; this.p56 = wrap(p56 + this.r50 * isr);
      const vUntl = s250 * clip(1 - p251, 0, 1) * clip(p236 + 0.3, -1, 1) * p56 * p436;

      // ---- 3 bsStp: bass sine at step/4 Hz ----
      const vBs = Math.cos(TWO_PI * this.c444); this.c444 = wrap(this.c444 + bassV / 4 * isr);

      // ---- 4 tonMt: 206 Hz ping, left channel only ----
      const s414 = Math.cos(TWO_PI * this.c414); this.c414 = wrap(this.c414 + 206 * isr);
      const s364 = Math.cos(TWO_PI * this.c364); this.c364 = wrap(this.c364 + this.R * isr);
      this.l100 = Math.max(0, this.l100 - this.l100d);
      const vTon = s414 * this.l100 * s364;

      // ---- 5 lazr ----
      const f422 = clip(Math.abs(32 * lg(p431, 4)) * 32 - 1200, 0, 10000);
      const s422 = Math.cos(TWO_PI * this.c422); this.c422 = wrap(this.c422 + f422 * isr);
      const s121 = Math.cos(TWO_PI * this.c121); this.c121 = wrap(this.c121 + 0.015625 * isr);
      const vLaz = s422 * clip(1 - p431, 0, 1) * s121;

      // ---- 6 gabbr: same sweep, DC-pushed into the clipper ----
      const p398 = this.p398; this.p398 = wrap(p398 + this.r4 * isr);
      const f397 = clip(Math.abs(32 * lg(p398, 4)) * 32 - 1200, 0, 10000);
      const s397 = Math.cos(TWO_PI * this.c397); this.c397 = wrap(this.c397 + f397 * isr);
      const s303 = Math.cos(TWO_PI * this.c303); this.c303 = wrap(this.c303 + 0.03125 * isr);
      const vGabbr = clip(s397 * clip(1 - p398, 0, 1) * s303 + 0.9, -1, 1);

      // ---- 7, 8 bsClk ----
      const p380 = this.p380; this.p380 = wrap(p380 + this.R * isr);
      const f379 = clip(Math.abs(32 * lg(p380, 32)) * 32 - 1200, 0, 10000);
      const s379 = Math.cos(TWO_PI * this.c379); this.c379 = wrap(this.c379 + f379 * isr);
      const vClkA = s379 * clip(1 - p380, 0, 1);
      const p319 = this.p319; this.p319 = wrap(p319 + this.R * isr);
      const f318 = clip(Math.abs(32 * lg(p319, 48)) * 32 - 1200, 0, 10000);
      const s318 = Math.cos(TWO_PI * this.c318); this.c318 = wrap(this.c318 + f318 * isr);
      const vClkB = s318 * clip(1 - p319, 0, 1);

      // ---- 9 gbStp: gabber, rate from gabber steps, chopped by annoying steps ----
      const p296 = this.p296; this.p296 = wrap(p296 + gabV * 2 * this.o136 / 32 * isr);
      const f295 = clip(Math.abs(96 * lg(p296, 48)) * 32 - 1200, 0, 10000);
      const s295 = Math.cos(TWO_PI * this.c295); this.c295 = wrap(this.c295 + f295 * isr);
      const p281 = this.p281; this.p281 = wrap(p281 + this.r8 * isr);
      const p133 = this.p133; this.p133 = wrap(p133 + this.rnR * isr);
      const s123 = Math.cos(TWO_PI * this.c123); this.c123 = wrap(this.c123 + 0.007812 * isr);
      const vGbStp = s295 * clip(1 - p296, 0, 1) * clip(lg(p281, 2) + 0.1, -1, 1)
        * clip(p133 + 0.8 + Math.cos(TWO_PI * s123), -1, 1) * annS;

      // ---- 10 bsClk (gated by reverse saw) ----
      const lg229 = Math.abs(70 * lg(p229, 2048)) * 32 - 1200;
      const s228 = Math.cos(TWO_PI * this.c228); this.c228 = wrap(this.c228 + clip(lg229, 0, 10000) * isr);
      const p214 = this.p214; this.p214 = wrap(p214 + this.rn8 * isr);
      const vClkC = s228 * clip(1 - p229, 0, 1) * clip(p214 + 0.75, -1, 1);

      // ---- 11 bsDrm: same sweep, 5 s curve~ tail ----
      const s83 = Math.cos(TWO_PI * this.c83); this.c83 = wrap(this.c83 + clip(lg229, 50, 10000) * isr);
      const vDrm = s83 * this.cv75.tick();

      // ---- 12 snDrm: noise → fffb~ 8 → gate~ → comb~ ----
      const nz = (Math.random() * 2 - 1) * 0.3;
      let fb = 0;
      for (let k = 0; k < 8; k++) {
        const b = this.bands[k];
        const y = b.b0 * nz + b.b2 * b.x2 - b.a1 * b.y1 - b.a2 * b.y2;
        b.x2 = b.x1; b.x1 = nz; b.y2 = b.y1; b.y1 = y;
        fb += y * b.gain;
      }
      const env183 = this.g183 ? -(lg(p207, 8192) + 0.1) : 0;
      const sx = fb * env183;
      const xd = this.cx[this.ci], yd = this.cy[this.ci];
      const cy = this.ca * sx + this.cb * xd + this.cc * yd;
      this.cx[this.ci] = sx; this.cy[this.ci] = cy; this.ci = (this.ci + 1) % this.cD;
      const vSn = sx + cy;

      // ---- 13 snClk: 3000→200 Hz chirp, 20 ms gate, +0.9 offset ----
      const p174 = this.p174; this.p174 = wrap(p174 + 1.25 * isr);
      const s173 = Math.cos(TWO_PI * this.c173); this.c173 = wrap(this.c173 + this.cv143.tick() * isr);
      const vClk = (this.g158 ? s173 * clip(1 - p174, 0, 1) : 0) + 0.9;

      // ---- mix (each dac~) ----
      const both = vSamp * g[0] + vUntl * g[2] + vBs * g[3] + vLaz * g[5] + vGabbr * g[6] + vClkA * g[7]
        + vClkB * g[8] + vGbStp * g[9] + vClkC * g[10] + vDrm * g[11] + vSn * g[12] + vClk * g[13];
      let l = both + aL * g[1] * s114 + vTon * g[4];
      let r = both + aR * g[1] * s114;
      // DC blockers (not in the patch: gabbr and snClk add large DC offsets)
      const yl = l - this.dxL + 0.9995 * this.dyL; this.dxL = l; this.dyL = yl;
      const yr = r - this.dxR + 0.9995 * this.dyR; this.dxR = r; this.dyR = yr;
      L[i] = clip(yl * this.master, -1, 1);
      R[i] = clip(yr * this.master, -1, 1);
      this.n++;
    }
    this.uiN += len;
    if (this.uiN >= sr / 30) {
      this.uiN = 0;
      this.post({ t: 'ui', gi: this.gi, ai: this.ai, bi: this.bi, msD: this.msD, msA: this.msA,
        ls: this.lsMs, ll: this.llMs, c136: this.o136, c433: this.o433, c63: this.o63 });
    }
  }
}
