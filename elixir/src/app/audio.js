// ---- audio ----
let ctx = null, node = null, fallback = null;
const pending = [];
// while barSync is set (loading a preset), messages are held by the player until the next bar
let barSync = false;
function send(m) { if (barSync) m = { type: 'atBar', m }; if (node) node.port.postMessage(m); else if (fallback) fallback.msg(m); else pending.push(m); }
async function startAudio() {
  if (ctx) { if (ctx.state === 'suspended') await ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const kitMsg = { type: 'kit', values: effValues() };
  try {
    const src = document.getElementById('engine').textContent + document.getElementById('player').textContent + `
      registerProcessor('lxr', class extends AudioWorkletProcessor {
        constructor() { super({ numberOfInputs: 0 }); this.p = new Player(sampleRate); this.port.onmessage = (e) => this.p.msg(e.data); }
        process(_, outputs) { const o = outputs[0]; this.p.process(o[0], o[1] || o[0]);
          if (this.p.events.length) { for (const ev of this.p.events) this.port.postMessage(ev); this.p.events.length = 0; } return true; }
      });`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    await ctx.audioWorklet.addModule(url);
    node = new AudioWorkletNode(ctx, 'lxr', { numberOfInputs: 0, outputChannelCount: [2] });
    node.port.onmessage = (e) => onEvent(e.data);
    node.connect(ctx.destination);
  } catch (err) {
    // no AudioWorklet: run the same player on the main thread
    fallback = new Player(ctx.sampleRate);
    const sp = ctx.createScriptProcessor(1024, 0, 2);
    sp.onaudioprocess = (e) => {
      fallback.process(e.outputBuffer.getChannelData(0), e.outputBuffer.getChannelData(1));
      for (const ev of fallback.events) onEvent(ev);
      fallback.events.length = 0;
    };
    sp.connect(ctx.destination);
  }
  send(kitMsg);
  sendSeq();
  while (pending.length) send(pending.shift());
}

