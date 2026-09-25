// Tiny synthesized sound effects (no audio files needed).
// iOS only allows audio after a user gesture, so initAudio() is called from touch handlers.

let ctx = null;
let master = null;
let windGain = null;
let enabled = true;

export function initAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.55 : 0;
    master.connect(ctx.destination);
    startWind();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function setSoundEnabled(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.02);
}

function tone(freq, dur, { type = 'sine', vol = 0.25, slide = null, delay = 0 } = {}) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBuffer(seconds) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function noise(dur, { vol = 0.3, freq = 800, q = 1, type = 'lowpass', delay = 0 } = {}) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

function startWind() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(2);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 500;
  f.Q.value = 0.7;
  windGain = ctx.createGain();
  windGain.gain.value = 0;
  src.connect(f).connect(windGain).connect(master);
  src.start();
}

// 0..1 wind loudness, driven by fall speed.
export function setWind(amount) {
  if (!windGain) return;
  windGain.gain.setTargetAtTime(Math.min(1, amount) * 0.22, ctx.currentTime, 0.1);
}

export const sfx = {
  click() { tone(660, 0.06, { type: 'triangle', vol: 0.15 }); },
  jump() { tone(220, 0.22, { type: 'square', vol: 0.08, slide: 520 }); noise(0.2, { vol: 0.12, freq: 1200 }); },
  flip(n) {
    const base = 440 * Math.pow(2, Math.min(n, 12) / 12 * 2);
    tone(base, 0.12, { type: 'triangle', vol: 0.18 });
    tone(base * 1.5, 0.12, { type: 'sine', vol: 0.1, delay: 0.05 });
  },
  coin() { tone(988, 0.07, { type: 'square', vol: 0.07 }); tone(1319, 0.18, { type: 'square', vol: 0.07, delay: 0.06 }); },
  land() { tone(140, 0.18, { type: 'sine', vol: 0.35, slide: 60 }); noise(0.18, { vol: 0.25, freq: 400 }); },
  perfect() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.16, delay: i * 0.07 })); },
  crash() { noise(0.45, { vol: 0.5, freq: 300 }); tone(180, 0.4, { type: 'sawtooth', vol: 0.12, slide: 50 }); },
  buy() { tone(784, 0.08, { type: 'square', vol: 0.08 }); tone(1175, 0.08, { type: 'square', vol: 0.08, delay: 0.08 }); tone(1568, 0.25, { type: 'square', vol: 0.08, delay: 0.16 }); },
  nope() { tone(200, 0.15, { type: 'square', vol: 0.08 }); tone(150, 0.2, { type: 'square', vol: 0.08, delay: 0.12 }); },
  win() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'square', vol: 0.07, delay: i * 0.1 })); },
};
