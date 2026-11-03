const LOOKAHEAD = 0.12;
const HIDDEN_LOOKAHEAD = 1.2;
const TICK_MS = 25;
const _ = null;

const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const SHAPES = {
  maj9: [4, 7, 11, 14],
  m9: [3, 7, 10, 14],
  13: [4, 9, 10, 14],
  9: [4, 7, 10, 14],
  '7#9': [4, 10, 15, 19],
  '7alt': [4, 10, 15, 20],
};

const BASS_GROOVES = {
  pocket: [[0, 'R', 3, 'n'], [3, 'R', 1, 'g'], [4, 'O', 1, 'p'], [6, 'R', 1, 'n'], [7, '5', 1, 'n'], [10, 'R', 2, 'n'], [12, 'O', 1, 'p'], [13, '7', 1, 'g'], [14, 'A', 2, 'n']],
  strut: [[0, 'R', 2, 'n'], [2, 'R', 1, 'g'], [3, 'O', 1, 'p'], [5, '5', 1, 'n'], [6, '7', 2, 'n'], [8, 'R', 2, 'n'], [11, 'R', 1, 'g'], [12, 'O', 1, 'p'], [13, '5', 1, 'n'], [14, 'A', 2, 'n']],
  split: [[0, 'R', 2, 'n'], [3, 'O', 1, 'p'], [4, '5', 1, 'g'], [6, 'R', 1, 'n'], [7, 'A', 1, 'n'], [8, 'R', 2, 'n'], [11, 'O', 1, 'p'], [12, 'R', 1, 'g'], [14, 'A', 2, 'n']],
  glide: [[0, 'R', 4, 'n'], [6, '5', 2, 'n'], [8, 'R', 3, 'n'], [11, '7', 1, 'g'], [12, 'O', 2, 'p'], [14, 'A', 2, 'n']],
};

const COMP = {
  push: [[0, 5], [6, 2], [10, 3], [14, 2, 1]],
  lift: [[2, 3], [6, 3], [11, 3]],
  stab: [[0, 3], [3, 3], [8, 5], [14, 2, 1]],
  halves: [[0, 4], [6, 2], [8, 4], [14, 2, 1]],
  skip: [[2, 3], [6, 1], [8, 4], [11, 3]],
  float: [[0, 7], [8, 5], [14, 2, 1]],
  pad: [[0, 7], [8, 6]],
  bed: [[0, 12, 0, 0.55]],
};

const MELODY_A = [
  [[2, 2, 76], [4, 2, 79], [6, 3, 81], [10, 2, 79], [12, 4, 76]],
  [[0, 3, 74], [4, 2, 76], [8, 2, 73], [10, 2, 71], [12, 4, 78]],
  [[2, 1, 77], [3, 1, 76], [4, 2, 74], [6, 2, 69], [8, 4, 72], [14, 4, 74]],
  [[2, 2, 76], [4, 2, 77], [8, 2, 76], [10, 2, 74], [12, 4, 71]],
  [[2, 2, 76], [4, 2, 79], [6, 3, 83], [10, 2, 81], [12, 4, 79]],
  [[0, 3, 76], [4, 2, 79], [8, 2, 78], [10, 2, 76], [12, 4, 72]],
  [[2, 1, 81], [3, 1, 79], [4, 2, 77], [6, 2, 76], [8, 2, 74], [10, 2, 77], [12, 2, 76], [14, 2, 74]],
  [[0, 6, 76], [10, 2, 75], [12, 2, 73], [14, 2, 75]],
];

const ANSWERS_A = [_, _, _, [[12, 1, 74], [13, 1, 76], [14, 2, 77]], _, [[12, 1, 78], [13, 1, 76], [14, 2, 74]], _, _];

const MELODY_A2 = [
  [[2, 2, 76], [4, 2, 79], [6, 3, 81], [10, 1, 84], [11, 1, 83], [12, 4, 81]],
  [[0, 2, 79], [2, 2, 78], [4, 2, 76], [8, 2, 76], [10, 2, 73], [12, 4, 71]],
  [[2, 1, 77], [3, 1, 76], [4, 2, 74], [6, 2, 69], [8, 2, 72], [10, 2, 74], [12, 2, 77], [14, 4, 81]],
  [[2, 2, 79], [4, 2, 77], [6, 2, 76], [8, 3, 77], [12, 4, 83]],
  [[0, 2, 71], [2, 2, 74], [4, 2, 76], [6, 2, 79], [8, 2, 78], [10, 2, 76], [12, 4, 73]],
  [[0, 2, 74], [2, 2, 77], [4, 2, 81], [6, 2, 84], [8, 2, 83], [10, 2, 81], [12, 4, 76]],
  [[0, 4, 79], [4, 2, 78], [6, 2, 76], [8, 4, 79], [12, 2, 77], [14, 2, 74]],
  [[0, 4, 77], [4, 2, 76], [6, 2, 74], [8, 2, 70], [10, 2, 71], [12, 2, 74], [14, 2, 77]],
];

const MELODY_B = [
  [[0, 6, 84], [6, 2, 82], [8, 6, 79]],
  [[0, 4, 77], [4, 4, 74], [8, 4, 76], [12, 4, 81]],
  [],
  [],
  [[0, 6, 79], [6, 2, 77], [8, 6, 74]],
  [[0, 4, 72], [4, 4, 69], [8, 4, 71], [12, 4, 76]],
  [[0, 2, 76], [2, 2, 79], [4, 4, 83], [8, 4, 85], [12, 2, 83], [14, 2, 81]],
  [[0, 4, 81], [4, 2, 77], [6, 2, 74], [8, 4, 84], [12, 2, 85], [14, 2, 76]],
];

const RIFFS_B = [
  _,
  _,
  [[2, 1, 81], [3, 1, 79], [4, 2, 76], [6, 2, 72], [8, 1, 74], [9, 1, 76], [10, 2, 79], [12, 4, 81]],
  [[0, 2, 80], [2, 1, 79], [3, 1, 77], [4, 2, 75], [6, 2, 72], [8, 2, 74], [10, 2, 79], [12, 2, 77], [14, 2, 80]],
  _,
  _,
  _,
  _,
];

const MELODY_OUTRO = [
  [[2, 2, 78], [4, 2, 81], [6, 6, 85], [12, 4, 83]],
  [[0, 6, 81], [8, 4, 81], [12, 4, 77]],
  [],
  [[8, 2, 76], [10, 2, 79], [12, 4, 81]],
];

const RIFFS_OUTRO = [_, _, [[0, 1, 82], [1, 1, 81], [2, 2, 79], [4, 2, 77], [6, 2, 74], [8, 1, 77], [9, 1, 79], [10, 2, 82], [12, 4, 81]], _];

const VELVET_SECTIONS = [
  {
    name: 'intro',
    bars: [['Fmaj9'], ['Em9', 'A13'], ['Dm9', 'G13'], ['Cmaj9', 'Gb13']],
    melody: [],
    drums: ['none', 'none', 'hats', 'full'],
    bass: [false, false, true, true],
    groove: 'glide',
    kick: [0, 7, 10],
    crash: false,
  },
  {
    name: 'A',
    bars: [['Fmaj9'], ['Em9', 'A13'], ['Dm9'], ['Dm9', 'G13'], ['Cmaj9'], ['Am9', 'D9'], ['Dm9', 'G13'], ['Cmaj9', 'Gb13']],
    melody: MELODY_A,
    answers: ANSWERS_A,
    groove: 'pocket',
    kick: [0, 7, 10],
  },
  {
    name: 'A2',
    bars: [['Fmaj9'], ['Em9', 'A13'], ['Dm9'], ['Dm9', 'G13'], ['Em9', 'A13'], ['Dm9', 'G13'], ['Em9', 'Ebmaj9'], ['Dm9', 'G7#9']],
    melody: MELODY_A2,
    groove: 'strut',
    kick: [0, 3, 10],
  },
  {
    name: 'B',
    bars: [['Abmaj9'], ['Gm9', 'C13'], ['Fmaj9'], ['Fm9', 'Bb13'], ['Ebmaj9'], ['Dm9', 'G13'], ['Em9', 'A13'], ['Bbmaj9', 'A7#9']],
    melody: MELODY_B,
    riffs: RIFFS_B,
    groove: 'glide',
    kick: [0, 10],
    comp: 'float',
  },
  {
    name: 'A3',
    bars: [['Gmaj9'], ['F#m9', 'B13'], ['Em9'], ['Em9', 'A13'], ['Dmaj9'], ['Bm9', 'E9'], ['Em9', 'A13'], ['Dmaj9', 'A7alt']],
    melody: MELODY_A,
    answers: ANSWERS_A,
    shift: 2,
    double: true,
    groove: 'strut',
    kick: [0, 7, 10, 13],
  },
  {
    name: 'outro',
    bars: [['Dmaj9'], ['Bm9', 'Bbmaj9'], ['Gm9'], ['Gm9', 'C13']],
    melody: MELODY_OUTRO,
    riffs: RIFFS_OUTRO,
    groove: 'glide',
    kick: [0, 10],
    comp: 'float',
  },
];

function parseChord(name) {
  const match = /^([A-G])([b#]?)(.+)$/.exec(name);
  const accidental = match[2] === 'b' ? -1 : match[2] === '#' ? 1 : 0;
  return { name, pc: (PITCH[match[1]] + accidental + 12) % 12, type: match[3] };
}

function buildSong(sections) {
  const bars = [];
  sections.forEach((section) => {
    const shift = section.shift || 0;
    const moved = (list) => (list ? list.map(([step, len, midi]) => [step, len, midi + shift]) : null);
    section.bars.forEach((names, index) => {
      bars.push({
        section: section.name,
        index,
        last: index === section.bars.length - 1,
        chords: names.map(parseChord),
        melody: moved(section.melody[index]) || [],
        riff: moved(section.riffs && section.riffs[index]),
        answer: moved(section.answers && section.answers[index]),
        double: Boolean(section.double),
        drums: section.drums ? section.drums[index] : 'full',
        bass: section.bass ? section.bass[index] : true,
        groove: section.groove,
        kick: section.kick,
        comp: section.comp || null,
        crash: index === 0 && section.crash !== false,
      });
    });
  });
  return { bars, loopStart: sections[0].bars.length };
}

function songBar(song, n) {
  if (n < song.loopStart) return { bar: song.bars[n], cycle: 0 };
  const loopLength = song.bars.length - song.loopStart;
  const k = n - song.loopStart;
  return { bar: song.bars[song.loopStart + (k % loopLength)], cycle: Math.floor(k / loopLength) };
}

function voiceChord(chord, previous) {
  const shape = SHAPES[chord.type];
  let best = null;
  let bestCost = Infinity;
  for (let r = 0; r < shape.length; r++) {
    const rotated = shape.slice(r).concat(shape.slice(0, r).map((n) => n + 12));
    const raw = rotated.map((n) => chord.pc + n);
    const lift = Math.ceil((50 - raw[0]) / 12) * 12;
    const notes = raw.map((n) => n + lift);
    const top = notes[notes.length - 1];
    let cost = top > 74 ? (top - 74) * 3 : 0;
    notes.forEach((n, i) => {
      cost += Math.abs(n - previous[i]);
    });
    if (cost < bestCost) {
      bestCost = cost;
      best = notes;
    }
  }
  return best;
}

const TRACKS = [
  {
    id: 'velvet-hours',
    title: 'Velvet Hours',
    bpm: 120,
    swing: 0.18,
    rain: false,
    reverb: 0.24,
    echo: 0.28,
    duck: 0.85,
    kickGain: 0.9,
    song: buildSong(VELVET_SECTIONS),
  },
  {
    id: 'ocean-drive',
    title: 'Ocean Drive',
    bpm: 100,
    swing: 0,
    rain: false,
    fill: true,
    reverb: 0.22,
    echo: 0.38,
    duck: 0.35,
    kickGain: 0.95,
    chords: [
      { root: 45, tones: [57, 60, 64, 69] },
      { root: 41, tones: [57, 60, 65, 69] },
      { root: 48, tones: [55, 60, 64, 67] },
      { root: 43, tones: [55, 59, 62, 67] },
    ],
    kick: [0, 8],
    kickAlt: [0, 8, 11],
    snare: { steps: [4, 12], gain: 0.42, rim: false },
    hat: { steps: [0, 2, 4, 6, 8, 10, 12, 14], open: [14], gain: 0.1 },
    bass: { pattern: [0, _, 0, _, 0, _, 12, _, 0, _, 0, _, 0, _, 12, _], length: 1.6, cutoff: 480, q: 6, gain: 0.17, wave: 'sawtooth' },
    arp: { every: 1, pattern: [0, 1, 2, 3, 4, 3, 2, 1], octave: 12, gate: 0.8, gain: 0.15, wave: 'square', cutoff: 2600 },
    pad: { octave: 0, gain: 0.3, cutoff: 1500, attack: 0.9, release: 1.2, wave: 'sawtooth' },
  },
  {
    id: 'neon-rain',
    title: 'Neon Rain',
    bpm: 84,
    swing: 0,
    rain: true,
    fill: false,
    reverb: 0.32,
    echo: 0.5,
    duck: 0.6,
    kickGain: 0.85,
    chords: [
      { root: 38, tones: [57, 62, 65, 69] },
      { root: 46, tones: [58, 62, 65, 70] },
      { root: 43, tones: [55, 58, 62, 67] },
      { root: 45, tones: [57, 61, 64, 69] },
    ],
    kick: [0, 10],
    kickAlt: [0, 7, 10],
    snare: { steps: [8], gain: 0.36, rim: false },
    hat: { steps: [2, 6, 10, 14], open: [], gain: 0.06 },
    bass: { pattern: [0, _, _, _, _, _, 0, _, 12, _, _, _, 0, _, 7, _], length: 3.2, cutoff: 360, q: 4, gain: 0.145, wave: 'sawtooth' },
    arp: { every: 2, pattern: [0, 2, 1, 3, 2, 4, 3, 5], octave: 12, gate: 1.4, gain: 0.11, wave: 'triangle', cutoff: 2000 },
    pad: { octave: 0, gain: 0.32, cutoff: 1100, attack: 1.6, release: 2, wave: 'sawtooth' },
  },
  {
    id: 'vice-pursuit',
    title: 'Vice Pursuit',
    bpm: 118,
    swing: 0,
    rain: false,
    fill: true,
    reverb: 0.18,
    echo: 0.3,
    duck: 0.3,
    kickGain: 1,
    chords: [
      { root: 40, tones: [59, 64, 67, 71] },
      { root: 36, tones: [60, 64, 67, 72] },
      { root: 43, tones: [59, 62, 67, 71] },
      { root: 38, tones: [57, 62, 66, 69] },
    ],
    kick: [0, 4, 8, 12],
    kickAlt: null,
    snare: { steps: [4, 12], gain: 0.46, rim: false },
    hat: { steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], open: [6, 14], gain: 0.075 },
    bass: { pattern: [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 7, 12, 0], length: 0.85, cutoff: 650, q: 9, gain: 0.175, wave: 'sawtooth' },
    arp: { every: 1, pattern: [0, 2, 4, 2, 1, 3, 5, 3], octave: 12, gate: 0.7, gain: 0.18, wave: 'sawtooth', cutoff: 3200 },
    pad: { octave: -12, gain: 0.27, cutoff: 1700, attack: 0.4, release: 0.7, wave: 'sawtooth' },
  },
  {
    id: 'daemon-lounge',
    title: 'Daemon Lounge',
    bpm: 72,
    swing: 0.18,
    rain: false,
    fill: false,
    reverb: 0.36,
    echo: 0.45,
    duck: 0.8,
    kickGain: 0.8,
    chords: [
      { root: 41, tones: [53, 57, 60, 64] },
      { root: 40, tones: [55, 59, 62, 64] },
      { root: 38, tones: [53, 57, 60, 62] },
      { root: 36, tones: [55, 59, 60, 64] },
    ],
    kick: [0, 7, 10],
    kickAlt: [0, 10],
    snare: { steps: [4, 12], gain: 0.28, rim: true },
    hat: { steps: [0, 2, 4, 6, 8, 10, 12, 14], open: [], gain: 0.055 },
    bass: { pattern: [0, _, _, _, 7, _, _, _, 12, _, _, _, 7, _, 11, _], length: 3.4, cutoff: 520, q: 2, gain: 0.125, wave: 'triangle' },
    arp: { every: 2, pattern: [3, 2, 1, 2, 0, 1, 2, 4, 5, 4, 3, 2], octave: 12, gate: 1.6, gain: 0.1, wave: 'triangle', cutoff: 1800 },
    pad: { octave: 0, gain: 0.27, cutoff: 900, attack: 1.2, release: 1.6, wave: 'sawtooth' },
  },
];

function hz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function makeNoise(ctx) {
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makeImpulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return buffer;
}

export function createJukebox() {
  let ctx = null;
  let input = null;
  let master = null;
  let noise = null;
  let impulse = null;
  let session = null;
  let timer = null;
  let volume = 0.5;
  let current = null;
  let playing = false;
  const listeners = new Set();

  function emit() {
    const state = { playing, current };
    listeners.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        console.error(err);
      }
    });
  }

  function ensureContext() {
    if (ctx) return true;
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    input = ctx.createGain();
    input.gain.value = 0.8;
    master = ctx.createGain();
    master.gain.value = volume;
    input.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);
    noise = makeNoise(ctx);
    impulse = makeImpulse(ctx, 2.2, 3);
    return true;
  }

  function lfo(s, time, rate, depth, target) {
    const osc = ctx.createOscillator();
    osc.frequency.value = rate;
    const amount = ctx.createGain();
    amount.gain.value = depth;
    osc.connect(amount);
    amount.connect(target);
    osc.start(time);
    s.sources.push(osc);
  }

  function startSession(track) {
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.linearRampToValueAtTime(1, now + 0.6);
    bus.connect(input);
    const pump = ctx.createGain();
    pump.connect(bus);
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse;
    const wet = ctx.createGain();
    wet.gain.value = track.reverb;
    reverb.connect(wet);
    wet.connect(bus);
    const delay = ctx.createDelay(2);
    delay.delayTime.value = (60 / track.bpm) * 0.75;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 2400;
    const feedback = ctx.createGain();
    feedback.gain.value = track.echo;
    const echo = ctx.createGain();
    echo.gain.value = 0.3;
    delay.connect(damp);
    damp.connect(feedback);
    feedback.connect(delay);
    damp.connect(echo);
    echo.connect(pump);
    const s = { track, bus, pump, reverb, delay, ep: null, lead: null, sources: [], step: 0, next: now + 0.08 };
    if (track.rain) rain(s, now);
    if (track.song) {
      const ep = ctx.createGain();
      const tremolo = ctx.createGain();
      tremolo.gain.value = 0.92;
      ep.connect(tremolo);
      lfo(s, now, 4.6, 0.08, tremolo.gain);
      let epOut = tremolo;
      if (ctx.createStereoPanner) {
        const pan = ctx.createStereoPanner();
        tremolo.connect(pan);
        lfo(s, now, 2.3, 0.5, pan.pan);
        epOut = pan;
      }
      const epVerb = ctx.createGain();
      epVerb.gain.value = 0.45;
      epOut.connect(pump);
      epOut.connect(epVerb);
      epVerb.connect(reverb);
      const lead = ctx.createGain();
      const leadEcho = ctx.createGain();
      leadEcho.gain.value = 0.32;
      const leadVerb = ctx.createGain();
      leadVerb.gain.value = 0.35;
      lead.connect(pump);
      lead.connect(leadEcho);
      leadEcho.connect(delay);
      lead.connect(leadVerb);
      leadVerb.connect(reverb);
      Object.assign(s, { ep, lead, voicing: [57, 60, 64, 67], pushNext: false, lastLead: null });
    }
    return s;
  }

  function endSession(s, fade) {
    const now = ctx.currentTime;
    const gain = s.bus.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.linearRampToValueAtTime(0, now + fade);
    s.sources.forEach((source) => {
      try {
        source.stop(now + fade + 0.05);
      } catch (err) {
        console.error(err);
      }
    });
    setTimeout(() => {
      [s.bus, s.pump, s.reverb, s.delay, s.ep, s.lead].forEach((audioNode) => {
        if (audioNode) audioNode.disconnect();
      });
    }, (fade + 0.4) * 1000);
  }

  function kick(s, time, gain, click) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.13);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(gain, time + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);
    osc.connect(amp);
    amp.connect(s.bus);
    osc.start(time);
    osc.stop(time + 0.42);
    if (click) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 2500;
      const tick = ctx.createGain();
      tick.gain.setValueAtTime(0.0001, time);
      tick.gain.exponentialRampToValueAtTime(0.22, time + 0.001);
      tick.gain.exponentialRampToValueAtTime(0.0001, time + 0.012);
      src.connect(highpass);
      highpass.connect(tick);
      tick.connect(s.bus);
      src.start(time, Math.random() * 1.5);
      src.stop(time + 0.02);
    }
    const pump = s.pump.gain;
    pump.setValueAtTime(s.track.duck, time);
    pump.linearRampToValueAtTime(1, time + Math.min(0.3, (60 / s.track.bpm) * 0.5));
  }

  function snare(s, time, gain, rim) {
    const length = rim ? 0.06 : 0.2;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = rim ? 2400 : 1200;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(gain, time + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + length);
    src.connect(highpass);
    highpass.connect(amp);
    amp.connect(s.bus);
    amp.connect(s.reverb);
    src.start(time, Math.random() * 1.5);
    src.stop(time + length + 0.02);
    const tone = ctx.createOscillator();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(rim ? 420 : 200, time);
    tone.frequency.exponentialRampToValueAtTime(rim ? 300 : 140, time + 0.08);
    const toneAmp = ctx.createGain();
    toneAmp.gain.setValueAtTime(0.0001, time);
    toneAmp.gain.exponentialRampToValueAtTime(gain * 0.6, time + 0.003);
    toneAmp.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    tone.connect(toneAmp);
    toneAmp.connect(s.bus);
    tone.start(time);
    tone.stop(time + 0.12);
  }

  function hat(s, time, gain, open) {
    const length = open ? 0.28 : 0.045;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 7500;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 10000;
    band.Q.value = 0.8;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(gain, time + 0.002);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + length);
    src.connect(highpass);
    highpass.connect(band);
    band.connect(amp);
    amp.connect(s.bus);
    src.start(time, Math.random() * 1.5);
    src.stop(time + length + 0.02);
  }

  function crash(s, time) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 4500;
    const shimmer = ctx.createBiquadFilter();
    shimmer.type = 'peaking';
    shimmer.frequency.value = 8500;
    shimmer.gain.value = 6;
    shimmer.Q.value = 0.7;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.1, time + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 1.7);
    src.connect(highpass);
    highpass.connect(shimmer);
    shimmer.connect(amp);
    amp.connect(s.bus);
    amp.connect(s.reverb);
    src.start(time, Math.random() * 0.2);
    src.stop(time + 1.75);
  }

  function bass(s, time, midi, dur) {
    const opts = s.track.bass;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.Q.value = opts.q;
    lowpass.frequency.setValueAtTime(opts.cutoff * 3, time);
    lowpass.frequency.exponentialRampToValueAtTime(opts.cutoff, time + Math.min(dur, 0.16));
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(opts.gain, time + 0.008);
    amp.gain.setValueAtTime(opts.gain, time + Math.max(0.01, dur * 0.5));
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    lowpass.connect(amp);
    amp.connect(s.pump);
    [-6, 6].forEach((detune) => {
      const osc = ctx.createOscillator();
      osc.type = opts.wave;
      osc.frequency.value = hz(midi);
      osc.detune.value = detune;
      osc.connect(lowpass);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = hz(midi - 12);
    const subAmp = ctx.createGain();
    subAmp.gain.value = 0.6;
    sub.connect(subAmp);
    subAmp.connect(amp);
    sub.start(time);
    sub.stop(time + dur + 0.02);
  }

  function funkBass(s, time, midi, dur, kind) {
    const ghost = kind === 'g';
    const pop = kind === 'p';
    const length = ghost ? 0.06 : Math.max(0.08, dur * 0.9);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.Q.value = pop ? 9 : 5;
    lowpass.frequency.setValueAtTime(ghost ? 420 : pop ? 3200 : 1500, time);
    lowpass.frequency.exponentialRampToValueAtTime(ghost ? 260 : pop ? 1000 : 420, time + Math.min(length, 0.14));
    const amp = ctx.createGain();
    const peak = ghost ? 0.045 : pop ? 0.1 : 0.115;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(peak, time + 0.004);
    amp.gain.setTargetAtTime(peak * 0.55, time + 0.01, 0.12);
    amp.gain.setTargetAtTime(0.0001, time + length, 0.025);
    lowpass.connect(amp);
    amp.connect(s.pump);
    const stopAt = time + length + 0.18;
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = hz(midi);
    saw.connect(lowpass);
    const square = ctx.createOscillator();
    square.type = 'square';
    square.frequency.value = hz(midi);
    square.detune.value = 4;
    const squareAmp = ctx.createGain();
    squareAmp.gain.value = 0.5;
    square.connect(squareAmp);
    squareAmp.connect(lowpass);
    [saw, square].forEach((osc) => {
      osc.start(time);
      osc.stop(stopAt);
    });
    if (!ghost) {
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = hz(midi);
      const subAmp = ctx.createGain();
      subAmp.gain.value = pop ? 0.3 : 0.55;
      sub.connect(subAmp);
      subAmp.connect(amp);
      sub.start(time);
      sub.stop(stopAt);
    }
  }

  function rhodes(s, time, midi, dur, velocity) {
    const f = hz(midi);
    const end = time + dur;
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = f;
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = f;
    const bodyDepth = ctx.createGain();
    bodyDepth.gain.setValueAtTime(f * 0.9 * velocity, time);
    bodyDepth.gain.exponentialRampToValueAtTime(f * 0.08, time + 0.6);
    body.connect(bodyDepth);
    bodyDepth.connect(carrier.frequency);
    const tine = ctx.createOscillator();
    tine.type = 'sine';
    tine.frequency.value = f * 14;
    const tineDepth = ctx.createGain();
    tineDepth.gain.setValueAtTime(f * 0.7 * velocity, time);
    tineDepth.gain.exponentialRampToValueAtTime(0.5, time + 0.05);
    tine.connect(tineDepth);
    tineDepth.connect(carrier.frequency);
    const amp = ctx.createGain();
    const peak = 0.088 * velocity;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(peak, time + 0.005);
    amp.gain.setTargetAtTime(peak * 0.32, time + 0.01, 0.4);
    amp.gain.setTargetAtTime(0.0001, end, 0.07);
    carrier.connect(amp);
    amp.connect(s.ep);
    [carrier, body, tine].forEach((osc) => {
      osc.start(time);
      osc.stop(end + 0.45);
    });
  }

  function leadNote(s, time, midi, dur, voice, level, follow) {
    const f = hz(midi);
    const end = time + dur;
    const previous = follow ? s.lastLead : null;
    const glide = Boolean(previous) && previous.midi !== midi && time - previous.end < 0.04;
    const amp = ctx.createGain();
    const peak = (voice === 'synth' ? 0.08 : 0.078) * level;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(peak, time + (glide ? 0.025 : 0.014));
    amp.gain.setTargetAtTime(peak * 0.82, time + 0.03, 0.2);
    amp.gain.setTargetAtTime(0.0001, end, 0.05);
    amp.connect(s.lead);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 5.4;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, time);
    depth.gain.linearRampToValueAtTime(voice === 'synth' ? 15 : 22, time + Math.min(0.4, dur));
    vibrato.connect(depth);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    let tail = lowpass;
    if (voice === 'synth') {
      lowpass.Q.value = 1.2;
      lowpass.frequency.setValueAtTime(4200, time);
      lowpass.frequency.exponentialRampToValueAtTime(2400, time + 0.25);
    } else {
      lowpass.Q.value = 0.7;
      lowpass.frequency.value = 2200;
      const formants = voice === 'ah' ? [[750, 10], [1150, 8]] : [[480, 10], [860, 8]];
      formants.forEach(([frequency, boost]) => {
        const peakFilter = ctx.createBiquadFilter();
        peakFilter.type = 'peaking';
        peakFilter.frequency.value = frequency;
        peakFilter.gain.value = boost;
        peakFilter.Q.value = 3;
        tail.connect(peakFilter);
        tail = peakFilter;
      });
    }
    tail.connect(amp);
    const stopAt = end + 0.35;
    const layers = voice === 'synth' ? [['square', 0], ['sawtooth', 7]] : [['sawtooth', 0]];
    layers.forEach(([type, detune]) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(glide ? hz(previous.midi) : f, time);
      if (glide) osc.frequency.exponentialRampToValueAtTime(f, time + 0.06);
      depth.connect(osc.detune);
      osc.connect(lowpass);
      osc.start(time);
      osc.stop(stopAt);
    });
    vibrato.start(time);
    vibrato.stop(stopAt);
    if (follow) s.lastLead = { midi, end };
  }

  function rain(s, time) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800;
    band.Q.value = 0.4;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 600;
    const amp = ctx.createGain();
    amp.gain.value = 0.05;
    src.connect(band);
    band.connect(highpass);
    highpass.connect(amp);
    amp.connect(s.bus);
    src.start(time);
    s.sources.push(src);
    lfo(s, time, 0.11, 0.02, amp.gain);
  }

  function droplet(s, time) {
    const pitch = 1800 + Math.random() * 2600;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, time);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, time + 0.05);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(0.012, time + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    osc.connect(amp);
    amp.connect(s.bus);
    osc.start(time);
    osc.stop(time + 0.08);
  }

  function scheduleStep(s, step, time) {
    const tr = s.track;
    const i = step % 16;
    const bar = Math.floor(step / 16);
    const chord = tr.chords[bar % tr.chords.length];
    const sixteenth = 60 / tr.bpm / 4;
    const inFill = tr.fill && bar % 8 === 7 && i >= 12;
    const kicks = bar % 2 === 1 && tr.kickAlt ? tr.kickAlt : tr.kick;
    if (kicks.includes(i) && !inFill) kick(s, time, tr.kickGain, false);
    if (inFill) snare(s, time, tr.snare.gain * (0.4 + (i - 12) * 0.2), tr.snare.rim);
    else if (tr.snare.steps.includes(i)) snare(s, time, tr.snare.gain, tr.snare.rim);
    if (tr.hat.steps.includes(i)) hat(s, time, tr.hat.gain * (i % 4 === 2 ? 1 : 0.65), tr.hat.open.includes(i));
    const offset = tr.bass.pattern[i];
    if (offset !== null) bass(s, time, chord.root + offset, sixteenth * tr.bass.length);
    if (i % tr.arp.every === 0) {
      const perBar = 16 / tr.arp.every;
      const index = tr.arp.pattern[(i / tr.arp.every + bar * perBar) % tr.arp.pattern.length];
      const tones = chord.tones.concat(chord.tones.map((n) => n + 12));
      arp(s, time, tones[index % tones.length] + tr.arp.octave, sixteenth * tr.arp.every * tr.arp.gate);
    }
    if (i === 0) pad(s, time, chord.tones.map((n) => n + tr.pad.octave), sixteenth * 16);
    if (tr.rain && Math.random() < 0.16) droplet(s, time + Math.random() * sixteenth);
  }

  function bassRoot(pc) {
    return 31 + ((pc + 5) % 12);
  }

  function compFor(bar, barNumber) {
    if (bar.riff) return COMP.bed;
    if (bar.section === 'intro') return bar.index === 0 ? COMP.pad : bar.chords.length > 1 && bar.index > 1 ? COMP.halves : COMP.pad;
    if (bar.comp) return COMP[bar.comp];
    if (bar.chords.length > 1) return barNumber % 2 ? COMP.skip : COMP.halves;
    return [COMP.push, COMP.lift, COMP.stab][barNumber % 3];
  }

  function grooveFor(bar, barNumber) {
    if (bar.chords.length > 1 && bar.groove !== 'glide') return BASS_GROOVES.split;
    if (bar.groove === 'pocket' && barNumber % 2) return BASS_GROOVES.strut;
    return BASS_GROOVES[bar.groove];
  }

  function scheduleSong(s, step, time) {
    const song = s.track.song;
    const i = step % 16;
    const barNumber = Math.floor(step / 16);
    const { bar, cycle } = songBar(song, barNumber);
    const following = songBar(song, barNumber + 1).bar;
    const sixteenth = 60 / s.track.bpm / 4;
    const split = bar.chords.length > 1;
    const chord = split && i >= 8 ? bar.chords[1] : bar.chords[0];
    const upcoming = split && i < 8 ? bar.chords[1] : following.chords[0];
    const skipDownbeat = i === 0 && s.pushNext;
    if (i === 0) s.pushNext = false;

    if (bar.drums !== 'none') {
      const full = bar.drums === 'full';
      const fill = full && bar.last && i >= 12;
      if (full && bar.crash && i === 0) crash(s, time);
      if ((full ? bar.kick : [0, 10]).includes(i) && !(fill && i > 12)) kick(s, time, s.track.kickGain, true);
      if (full) {
        if (fill) snare(s, time, 0.12 + (i - 12) * 0.09, false);
        else if (i === 4 || i === 12) {
          snare(s, time, 0.4, false);
          snare(s, time, 0.1, true);
        } else if ((i === 7 || i === 9 || i === 15) && Math.random() < (cycle > 0 ? 0.9 : 0.7)) {
          snare(s, time, 0.05, false);
        }
      }
      if (!fill) {
        if (full && i === 14) hat(s, time, 0.1, true);
        else hat(s, time, i % 4 === 0 ? 0.12 : i % 2 === 0 ? 0.09 : 0.055, false);
      }
    }

    if (bar.bass) {
      const event = grooveFor(bar, barNumber).find((e) => e[0] === i);
      if (event) {
        const [, degree, length, kind] = event;
        const target = degree === 'A' ? upcoming : chord;
        let midi = bassRoot(target.pc);
        if (degree === 'O') midi += 12;
        else if (degree === '5') midi += 7;
        else if (degree === '7') midi += target.type === 'maj9' ? 11 : 10;
        else if (degree === 'A') midi += barNumber % 2 ? 1 : -1;
        funkBass(s, time, midi, sixteenth * length, kind);
      }
    }

    const hit = compFor(bar, barNumber).find((h) => h[0] === i);
    if (hit && !skipDownbeat) {
      const [, length, push, velocity = 1] = hit;
      s.voicing = voiceChord(push ? following.chords[0] : chord, s.voicing);
      s.voicing.forEach((midi, n) => rhodes(s, time + n * 0.004, midi, sixteenth * length, velocity * (n === 3 ? 0.85 : 1)));
      if (push) s.pushNext = true;
    }

    const voice = cycle % 2 === 0 ? 'synth' : barNumber % 4 < 2 ? 'ah' : 'oh';
    bar.melody.forEach(([start, length, midi]) => {
      if (start !== i) return;
      leadNote(s, time, midi, length * sixteenth * 0.95, voice, 1, true);
      if (bar.double) leadNote(s, time, midi - 12, length * sixteenth * 0.95, voice, 0.45, false);
    });
    if (bar.riff) {
      bar.riff.forEach(([start, length, midi]) => {
        if (start === i) rhodes(s, time, midi, length * sixteenth, 1.25);
      });
    }
    if (bar.answer && cycle % 2 === 1) {
      bar.answer.forEach(([start, length, midi]) => {
        if (start === i) rhodes(s, time, midi, length * sixteenth, 1.1);
      });
    }
  }

  function arp(s, time, midi, dur) {
    const opts = s.track.arp;
    const osc = ctx.createOscillator();
    osc.type = opts.wave;
    osc.frequency.value = hz(midi);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = opts.cutoff;
    lowpass.Q.value = 3;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(opts.gain, time + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(lowpass);
    lowpass.connect(amp);
    amp.connect(s.pump);
    amp.connect(s.delay);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  function pad(s, time, notes, dur) {
    const opts = s.track.pad;
    const end = time + dur + opts.release;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.Q.value = 0.8;
    lowpass.frequency.setValueAtTime(opts.cutoff * 0.6, time);
    lowpass.frequency.linearRampToValueAtTime(opts.cutoff, time + dur * 0.5);
    const mix = ctx.createGain();
    mix.gain.value = 1 / (notes.length * 2);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(opts.gain, time + Math.min(opts.attack, dur * 0.6));
    amp.gain.setValueAtTime(opts.gain, time + dur);
    amp.gain.linearRampToValueAtTime(0.0001, end);
    mix.connect(lowpass);
    lowpass.connect(amp);
    amp.connect(s.pump);
    amp.connect(s.reverb);
    notes.forEach((midi) => {
      [-8, 8].forEach((detune) => {
        const osc = ctx.createOscillator();
        osc.type = opts.wave;
        osc.frequency.value = hz(midi);
        osc.detune.value = detune;
        osc.connect(mix);
        osc.start(time);
        osc.stop(end + 0.05);
      });
    });
  }

  function tick() {
    if (!session) return;
    const hidden = typeof document !== 'undefined' && document.hidden;
    const horizon = ctx.currentTime + (hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD);
    if (session.next < ctx.currentTime - 0.2) session.next = ctx.currentTime + 0.05;
    const schedule = session.track.song ? scheduleSong : scheduleStep;
    while (session.next < horizon) {
      schedule(session, session.step, session.next);
      const sixteenth = 60 / session.track.bpm / 4;
      const swing = session.track.swing;
      session.next += session.step % 2 === 0 ? sixteenth * (1 + swing) : sixteenth * (1 - swing);
      session.step += 1;
    }
  }

  function play(id) {
    const track = TRACKS.find((t) => t.id === id) || TRACKS.find((t) => t.id === current) || TRACKS[0];
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (session && playing && session.track.id === track.id) return;
    if (session) endSession(session, 0.7);
    session = startSession(track);
    current = track.id;
    playing = true;
    if (!timer) timer = setInterval(tick, TICK_MS);
    tick();
    emit();
  }

  function stop() {
    if (session) endSession(session, 0.6);
    session = null;
    if (timer) clearInterval(timer);
    timer = null;
    if (!playing) return;
    playing = false;
    emit();
  }

  return {
    tracks: TRACKS.map(({ id, title, bpm }) => ({ id, title, bpm })),
    get playing() {
      return playing;
    },
    get current() {
      return current;
    },
    play,
    stop,
    toggle() {
      if (playing) stop();
      else play(current || TRACKS[0].id);
    },
    next() {
      const index = TRACKS.findIndex((t) => t.id === current);
      play(TRACKS[(index + 1) % TRACKS.length].id);
    },
    setVolume(value) {
      volume = Math.min(1, Math.max(0, Number(value) || 0));
      if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    },
    onChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
