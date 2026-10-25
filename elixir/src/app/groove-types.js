// ---- groove: a groove type (where each track's hits sit against the grid) and a depth (how much of it plays) ----
// Each type gives every track an offset for every step, in 16ths at full depth (+ late, - early); depth scales it
// from 0 (straight) to 100%. Tracks: d1 (kick), d2, d3, snare, cymbal, closed hat, open hat.
const offbeat = (a) => (t, s) => (s % 2 ? a : 0); // every second 16th late by a (MPC-style swing: 54% is .08, 66.7% is 1/3)
const DRUNK_HAT = [0, .26, -.05, .2, .03, .3, -.04, .18, 0, .24, -.06, .22, .02, .32, -.03, .16];
const GROOVE_TYPES = [
  { name: 'straight', off: () => 0 },
  { name: 'swing 54', off: offbeat(.08) },
  { name: 'swing 58', off: offbeat(.16) },
  { name: 'swing 62', off: offbeat(.24) },
  { name: 'triplet', off: offbeat(1 / 3) },
  { name: 'shuffle', off: offbeat(.44) }, // a hard shuffle, about 72%
  // the hats swing, kick and snare stay straight, the toms take half
  { name: 'hat swing', off: (t, s) => (s % 2 ? [0, .12, .12, 0, 0, .26, .26][t] : 0) },
  // the second and fourth 16th of every beat late, the third a touch late
  { name: 'gallop', off: (t, s) => [0, .18, .06, .12][s % 4] },
  // kick and closed hat ahead of the beat, snare and open hat behind it
  { name: 'push-pull', off: (t) => [-.06, 0, 0, .1, 0, -.06, .1][t] },
  // everything behind the kick: the snare dragged, the hats lazy and a little swung
  { name: 'laid back', off: (t, s) => [0, .04, .04, .12, 0, .06, .06][t] + (t >= 5 && s % 2 ? .1 : 0) },
  // everything ahead of the kick, the hats most
  { name: 'rushed', off: (t) => [0, -.04, -.04, -.05, 0, -.08, -.08][t] },
  // after Dilla: hats swung unevenly, the kick early on the beat and late off it, the snare late
  { name: 'drunk', off: (t, s) => (t === 0 ? (s % 4 ? .12 : -.03) : t === 3 ? (s % 8 === 4 ? .14 : .08)
    : t >= 5 ? DRUNK_HAT[s] : t === 4 ? 0 : .06 + (s % 2 ? .15 : 0)) },
];
const GROOVE0 = { type: 'straight', depth: 100 };
const groove = { ...GROOVE0 };
const grooveIdx = () => Math.max(0, GROOVE_TYPES.findIndex((g) => g.name === groove.type));
// what the player gets: every track's offset for every step, in 16ths
const grooveMsg = () => {
  const g = GROOVE_TYPES[grooveIdx()], d = groove.depth / 100;
  return { off: Array.from({ length: 7 }, (_, t) => Array.from({ length: 16 }, (_, s) => g.off(t, s) * d)) };
};
