/*
 * TD-3 / TD-3-MO pattern SysEx codec.
 *
 * Message layout (opcode 0x78, 123 bytes total):
 *   F0 00 20 32 00 01 0A 78 <group 0-3> <slot 0-15> <112-byte block> F7
 *
 * 112-byte block (every byte is a nibble, so the payload is 7-bit safe):
 *   0x00   2  unknown (00 00)
 *   0x02  32  pitches, 16 x nibble pair, storage value = MIDI note - 12
 *   0x22  32  accent flags, 16 x (00 0x)
 *   0x42  32  slide flags, 16 x (00 0x)
 *   0x62   2  triplet (00 0x)
 *   0x64   2  step count (hi nibble, lo nibble), 16 = 01 00
 *   0x66   2  unknown (00 00)
 *   0x68   4  hold mask, bit 0 = tied step (inverted), nibble order 7654 3210 FEDC BA98
 *   0x6C   4  rest mask, bit 1 = rest, same nibble order
 *
 * Sources: timox/td333 (round trip verified on hardware), echolevel/Acid-Injector,
 * 303patterns.com. No official spec exists.
 *
 * Pitch model: the factory dump suggests the TD-3 stores pitches/accents/slides
 * PACKED (one entry per played note, in order, like a real TB-303's pitch vs time
 * mode), with rests and ties positioned by the masks. td333 treats them as
 * indexed by step. Both are supported here; "packed" is the default and is one
 * of the things to confirm on hardware.
 */
(function (root) {
  'use strict';

  const HEADER = [0xF0, 0x00, 0x20, 0x32, 0x00, 0x01, 0x0A];
  const OP = { ACK: 0x01, REQUEST: 0x77, PATTERN: 0x78, CLOCK: 0x1B };
  const BLOCK = 112;
  const STEPS = 16;
  const MIDI_MIN = 24; // C1
  const MIDI_MAX = 60; // C4
  const PLACEHOLDER = 0x18; // firmware's idle pitch (C2)

  const MASK_LAYOUT = [
    [7, 6, 5, 4],
    [3, 2, 1, 0],
    [15, 14, 13, 12],
    [11, 10, 9, 8],
  ];

  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteName = (midi) => NAMES[midi % 12] + (Math.floor(midi / 12) - 1);

  // A step's "time" is one of 'note' | 'tie' | 'rest', as on the TD-3's time mode.
  function emptyPattern() {
    return {
      length: 16,
      triplet: false,
      steps: Array.from({ length: STEPS }, () => ({ time: 'rest', note: 36, accent: false, slide: false })),
    };
  }

  function clampNote(n) {
    return Math.max(MIDI_MIN, Math.min(MIDI_MAX, n | 0));
  }

  function encodeMask(bits) {
    return MASK_LAYOUT.map((steps) =>
      steps.reduce((nib, step, i) => (bits[step] ? nib | (0x08 >> i) : nib), 0));
  }

  function decodeMask(bytes) {
    const bits = new Array(STEPS).fill(false);
    MASK_LAYOUT.forEach((steps, b) => {
      steps.forEach((step, i) => { bits[step] = !!(bytes[b] & (0x08 >> i)); });
    });
    return bits;
  }

  function pairs(values) {
    const out = [];
    for (const v of values) out.push((v >> 4) & 0x0F, v & 0x0F);
    return out;
  }

  function unpairs(bytes) {
    const out = [];
    for (let i = 0; i < bytes.length; i += 2) out.push(((bytes[i] & 0x0F) << 4) | (bytes[i + 1] & 0x0F));
    return out;
  }

  /** Pattern -> 112-byte block. model: 'packed' | 'indexed' */
  function encodeBlock(p, model = 'packed') {
    const length = p.triplet ? Math.min(p.length, 15) : p.length; // same clamp as SynthTribe
    const pitches = [], accents = [], slides = [];
    const rest = [], hold = [];

    for (let i = 0; i < STEPS; i++) {
      const s = p.steps[i];
      let time = s.time;
      if (time === 'tie' && i === 0) time = 'note'; // first step can't be tied
      rest.push(time === 'rest');
      hold.push(time !== 'tie');
      if (model === 'indexed') {
        pitches.push(clampNote(s.note) - 12);
        accents.push(s.accent ? 1 : 0);
        slides.push(s.slide ? 1 : 0);
      } else if (time === 'note') {
        pitches.push(clampNote(s.note) - 12);
        accents.push(s.accent ? 1 : 0);
        slides.push(s.slide ? 1 : 0);
      }
    }
    while (pitches.length < STEPS) { pitches.push(PLACEHOLDER); accents.push(0); slides.push(0); }

    const block = [
      0x00, 0x00,
      ...pairs(pitches),
      ...pairs(accents),
      ...pairs(slides),
      0x00, p.triplet ? 0x01 : 0x00,
      (length >> 4) & 0x0F, length & 0x0F,
      0x00, 0x00,
      ...encodeMask(hold),
      ...encodeMask(rest),
    ];
    if (block.length !== BLOCK) throw new Error('block size ' + block.length);
    return block;
  }

  function decodeBlock(block, model = 'packed') {
    const pitches = unpairs(block.slice(0x02, 0x22));
    const accents = unpairs(block.slice(0x22, 0x42));
    const slides = unpairs(block.slice(0x42, 0x62));
    const triplet = !!(block[0x63] & 1);
    let length = ((block[0x64] << 4) | block[0x65]) & 0xFF;
    if (length === 0 || length > 16) length = 16;
    const hold = decodeMask(block.slice(0x68, 0x6C));
    const rest = decodeMask(block.slice(0x6C, 0x70));

    const p = emptyPattern();
    p.length = length;
    p.triplet = triplet;
    let k = 0;
    for (let i = 0; i < STEPS; i++) {
      const time = rest[i] ? 'rest' : (!hold[i] ? 'tie' : 'note');
      const idx = model === 'indexed' ? i : (time === 'note' ? k++ : -1);
      const s = p.steps[i];
      s.time = time;
      if (idx >= 0 && idx < STEPS) {
        s.note = clampNote((pitches[idx] & 0x7F) + 12);
        s.accent = !!(accents[idx] & 1);
        s.slide = !!(slides[idx] & 1);
      } else if (i > 0) {
        s.note = p.steps[i - 1].note; // ties/rests show the previous pitch
      }
    }
    return p;
  }

  function patternMessage(group, slot, p, model) {
    return Uint8Array.from([...HEADER, OP.PATTERN, group & 3, slot & 15, ...encodeBlock(p, model), 0xF7]);
  }

  function requestMessage(group, slot) {
    return Uint8Array.from([...HEADER, OP.REQUEST, group & 3, slot & 15, 0xF7]);
  }

  /** source: 0 internal, 1 MIDI DIN, 2 MIDI USB, 3 trigger */
  function clockMessage(source) {
    return Uint8Array.from([...HEADER, OP.CLOCK, source & 3, 0xF7]);
  }

  /** Returns {opcode, group, slot, block?} for a TD-3 SysEx, or null. */
  function parse(data) {
    const d = Array.from(data);
    if (d.length < 9 || d[d.length - 1] !== 0xF7) return null;
    for (let i = 0; i < HEADER.length; i++) if (d[i] !== HEADER[i]) return null;
    const opcode = d[7];
    const out = { opcode, group: d[8], slot: d[9] };
    if (opcode === OP.PATTERN && d.length === 7 + 1 + 2 + BLOCK + 1) out.block = d.slice(10, 10 + BLOCK);
    return out;
  }

  const slotName = (slot) => ((slot & 7) + 1) + (slot < 8 ? 'A' : 'B');
  const groupName = (g) => ['I', 'II', 'III', 'IV'][g & 3];
  const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

  const TD3 = {
    HEADER, OP, BLOCK, STEPS, MIDI_MIN, MIDI_MAX,
    emptyPattern, encodeBlock, decodeBlock, patternMessage, requestMessage, clockMessage,
    parse, noteName, slotName, groupName, hex,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TD3;
  else root.TD3 = TD3;
})(this);
