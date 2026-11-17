// Sound made in code with Web Audio: no sample files. Each effect is a few oscillators and filtered noise
// through one shared generated reverb. Music cycles through the soundtrack underneath.

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // semitones above the root, for wisp chimes
const ROOT_HZ = 523.25; // C5
const MUSIC_TRACKS = ['./music.mp3', './path-through-the-glowing-grove.mp3'];
const BATTLE_TRACK = './battle.mp3'; // plays while a monster is engaged with you
const MUSIC_LEVEL = 0.42, BATTLE_LEVEL = 0.5; // volumes
const FADE_IN = 0.9, FADE_OUT = 2.6; // seconds: battle music arrives quickly and leaves slowly

export function createAudio({ muted = false }) {
  let ctx, master, wet, noiseBuf, wind, windGain, windFilter, music, musicGain, on = !muted, chime = 0, lastChime = 0, lastTick = 0;
  let musicIndex = 0, waterGain = null, battle = null, battleGain = null, inBattle = false, battleStop = 0;

  function boot() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = on ? 0.9 : 0;
    master.connect(ctx.destination);

    // reverb: an impulse made of decaying noise
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    wet = ctx.createGain();
    wet.gain.value = 0.28;
    wet.connect(verb).connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const n = noiseBuf.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;

    // wind: looped noise through a band-pass; speed opens it up
    wind = ctx.createBufferSource();
    wind.buffer = noiseBuf; wind.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 300; windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0.015;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();

    music = new Audio(MUSIC_TRACKS[musicIndex]);
    music.loop = false;
    music.addEventListener('ended', () => {
      musicIndex = (musicIndex + 1) % MUSIC_TRACKS.length;
      music.src = MUSIC_TRACKS[musicIndex];
      music.load();
      if (on) music.play().catch(() => {});
    });
    musicGain = ctx.createGain();
    musicGain.gain.value = MUSIC_LEVEL;
    ctx.createMediaElementSource(music).connect(musicGain).connect(master);
    if (on) music.play().catch(() => {});

    // Battle music is a second player on its own volume. The valley music never stops underneath it:
    // it is only turned down, so it comes back mid-phrase when the fight ends.
    battle = new Audio(BATTLE_TRACK);
    battle.loop = true; battle.preload = 'auto';
    battleGain = ctx.createGain();
    battleGain.gain.value = 0;
    ctx.createMediaElementSource(battle).connect(battleGain).connect(master);
    if (inBattle) { inBattle = false; encounter(true); }
  }

  /** Cross-fade to the battle track when a fight starts, and back to the valley music when it is over. */
  function encounter(active) {
    if (active === inBattle) return;
    inBattle = active;
    if (!ctx) return; // remembered, and applied when sound first starts
    const t = ctx.currentTime;
    clearTimeout(battleStop);
    for (const g of [battleGain.gain, musicGain.gain]) g.cancelScheduledValues(t);
    if (active) {
      if (battle.paused) { battle.currentTime = 0; if (on) battle.play().catch(() => {}); }
      battleGain.gain.setTargetAtTime(BATTLE_LEVEL, t, FADE_IN / 3);
      musicGain.gain.setTargetAtTime(0, t, FADE_IN / 3);
    } else {
      battleGain.gain.setTargetAtTime(0, t, FADE_OUT / 3);
      musicGain.gain.setTargetAtTime(MUSIC_LEVEL, t, FADE_OUT / 3);
      // once it is silent, stop it, so the next fight starts the track from the top
      battleStop = setTimeout(() => { if (!inBattle) battle.pause(); }, FADE_OUT * 1500);
    }
  }

  const out = (node, send = 0.5) => { node.connect(master); const s = ctx.createGain(); s.gain.value = send; node.connect(s).connect(wet); };

  /** One enveloped oscillator gliding from f0 to f1. */
  function tone({ type = 'sine', f0, f1 = f0, dur, gain = 0.2, attack = 0.005, at = 0, send = 0.5, wobble = 0, wobbleHz = 0 }) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    if (wobble) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = wobbleHz; lg.gain.setValueAtTime(wobble, t); lg.gain.exponentialRampToValueAtTime(0.01, t + dur);
      l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); out(g, send);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /** A burst of filtered noise whose filter sweeps from f0 to f1. */
  function hiss({ f0, f1 = f0, dur, gain = 0.2, q = 1, type = 'bandpass', attack = 0.01, at = 0, send = 0.4 }) {
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g); out(g, send);
    s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }

  const bell = (hz, gain, at = 0, dur = 0.9) => {
    tone({ f0: hz, dur, gain, at, send: 0.9 });
    tone({ f0: hz * 2.76, dur: dur * 0.45, gain: gain * 0.35, at, send: 0.9 });
    tone({ f0: hz * 5.4, dur: dur * 0.2, gain: gain * 0.15, at, send: 0.9 });
  };
  const ready = (fn) => (...a) => { if (ctx && on) fn(...a); };

  return {
    boot,
    material: ready((event) => {
      if(!event.gain)return;
      const recipe={f0:event.f0,f1:event.f1,dur:event.duration,gain:Math.min(event.gain,.12),send:event.send,type:event.type};
      if(event.sound==='rustle')hiss(recipe);else tone(recipe);
    }),
    get on() { return on; },
    toggle() {
      boot();
      on = !on;
      master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05);
      if (on) { music.play().catch(() => {}); if (inBattle) battle.play().catch(() => {}); } else { music.pause(); battle.pause(); }
      return on;
    },
    encounter,
    get inBattle() { return inBattle; },
    /** For scripted checks: what the two music players are doing right now. */
    debug() { return ctx ? { inBattle, battleVolume: +battleGain.gain.value.toFixed(2), valleyVolume: +musicGain.gain.value.toFixed(2), battlePaused: battle.paused } : null; },
    /** speed 0..1 and whether we are diving: the wind follows. */
    wind: ready((speed, dive) => {
      const t = ctx.currentTime;
      windGain.gain.setTargetAtTime(0.015 + speed * 0.2 + (dive ? 0.06 : 0), t, 0.15);
      windFilter.frequency.setTargetAtTime(280 + speed * 1500 + (dive ? 500 : 0), t, 0.15);
    }),
    fling: ready((power) => {
      hiss({ f0: 500, f1: 2600, dur: 0.32, gain: 0.16 + power * 0.12, q: 1.2 });
      tone({ f0: 190, f1: 420 + power * 240, dur: 0.3, gain: 0.2, wobble: 30, wobbleHz: 22, type: 'triangle' });
    }),
    jump: ready(() => { tone({ f0: 300, f1: 620, dur: 0.14, gain: 0.14, type: 'triangle' }); }),
    thump: ready((hard) => {
      tone({ f0: 150, f1: 52, dur: 0.22, gain: 0.25 + hard * 0.3, send: 0.2 });
      hiss({ f0: 900, f1: 300, dur: 0.12, gain: 0.07 + hard * 0.1, type: 'lowpass' });
      tone({ f0: 330, f1: 500, dur: 0.16, gain: 0.07, at: 0.02, wobble: 40, wobbleHz: 30, type: 'triangle' });
    }),
    cloud: ready((skyfall) => {
      hiss({ f0: 2400, f1: 260, dur: 0.7, gain: 0.3, type: 'lowpass', attack: 0.02, send: 0.8 });
      tone({ f0: 130, f1: 520, dur: 0.5, gain: 0.26, wobble: 24, wobbleHz: 12 });
      if (skyfall) [0, 4, 7, 12, 16].forEach((semi, i) => bell(ROOT_HZ * 2 ** (semi / 12), 0.13, 0.08 + i * 0.07, 1.4));
    }),
    pad: ready(() => {
      tone({ f0: 180, f1: 760, dur: 0.42, gain: 0.24, wobble: 90, wobbleHz: 17, type: 'triangle' });
      tone({ f0: 360, f1: 1520, dur: 0.3, gain: 0.07, at: 0.02 });
    }),
    rock: ready(() => {
      tone({ f0: 880, f1: 700, dur: 0.09, gain: 0.2, type: 'triangle', send: 0.7 });
      bell(1318, 0.07, 0.01, 0.5);
    }),
    /** Wisps climb a pentatonic scale while you keep collecting, and fall back after a pause. */
    wisp: ready(() => {
      const now = ctx.currentTime;
      chime = now - lastChime < 2.5 ? Math.min(chime + 1, PENTATONIC.length - 1) : 0;
      lastChime = now;
      bell(ROOT_HZ * 2 ** (PENTATONIC[chime] / 12), 0.16);
    }),
    /** Landing a hit on the monster: a thud with a crack, and a rising note for each combo step. */
    hit: ready((power, combo = 1) => {
      // four layers: a sub drop for weight, a hard knock, a crack of noise, and a bright note that climbs with the combo
      tone({ f0: 150, f1: 34, dur: 0.42, gain: 0.5 + power * 0.3, send: 0.25 });
      tone({ f0: 420, f1: 110, dur: 0.09, gain: 0.3 + power * 0.2, type: 'square', send: 0.15 });
      hiss({ f0: 5200, f1: 700, dur: 0.11, gain: 0.3 + power * 0.2, type: 'highpass', attack: 0.002, send: 0.3 });
      hiss({ f0: 900, f1: 180, dur: 0.3, gain: 0.16 + power * 0.14, type: 'lowpass', send: 0.5 });
      const step = Number.isFinite(combo) ? Math.max(0, Math.min(Math.floor(combo) - 1, PENTATONIC.length - 1)) : 0;
      const note = 392 * 2 ** (PENTATONIC[step] / 12);
      bell(note, 0.14, 0.02, 0.7); bell(note * 1.5, 0.07, 0.05, 0.5);
    }),
    /** Striking a weak spot: a bright ringing crack over the normal hit. */
    weak: ready(() => {
      hiss({ f0: 7000, f1: 2200, dur: 0.16, gain: 0.26, type: 'highpass', attack: 0.002, send: 0.5 });
      [12, 19, 24].forEach((semi, i) => bell(ROOT_HZ * 2 ** (semi / 12), 0.15, i * 0.035, 1.1));
      tone({ f0: 900, f1: 2400, dur: 0.22, gain: 0.12, type: 'triangle' });
    }),
    /** A dive that lands: a deep boom, flying grit, and a low ring that hangs in the air. */
    slam: ready((power = 1) => {
      tone({ f0: 120, f1: 26, dur: 0.75, gain: 0.6 * power, send: 0.5 });
      tone({ f0: 62, f1: 40, dur: 0.9, gain: 0.3 * power, type: 'triangle', send: 0.7 });
      hiss({ f0: 2600, f1: 160, dur: 0.55, gain: 0.34 * power, type: 'lowpass', attack: 0.003, send: 0.6 });
      hiss({ f0: 6000, f1: 2500, dur: 0.22, gain: 0.12 * power, type: 'highpass', at: 0.03, send: 0.4 });
    }),
    /** Bursting a lantern pod: a soft pop and a note that steps up the scale with each one in a row. */
    pod: ready((count = 1) => {
      hiss({ f0: 2600, f1: 500, dur: 0.14, gain: 0.2, type: 'bandpass', q: 0.7, attack: 0.002, send: 0.4 });
      tone({ f0: 260, f1: 720, dur: 0.16, gain: 0.2, type: 'triangle' });
      bell(ROOT_HZ * 2 ** (PENTATONIC[(count - 1) % PENTATONIC.length] / 12), 0.15, 0.02, 0.9);
    }),
    /** Bumping off Chomper: a rubbery boing and a bright two-note chime. */
    bump: ready(() => {
      tone({ f0: 210, f1: 640, dur: 0.3, gain: 0.3, wobble: 70, wobbleHz: 19, type: 'triangle' });
      bell(ROOT_HZ * 1.5, 0.14, 0.02, 0.6); bell(ROOT_HZ * 2, 0.12, 0.09, 0.8);
    }),
    /** Dropping into water: a slap, a deep "ploomp", then falling droplets. */
    splash: ready((power = 0.5) => {
      hiss({ f0: 3800, f1: 600, dur: 0.16, gain: 0.26 + power * 0.3, type: 'bandpass', q: 0.5, attack: 0.002, send: 0.5 });
      tone({ f0: 240, f1: 62, dur: 0.34, gain: 0.3 + power * 0.25, send: 0.4 });
      hiss({ f0: 1400, f1: 320, dur: 0.75, gain: 0.12 + power * 0.14, type: 'lowpass', at: 0.05, send: 0.7 });
      for (let i = 0; i < 6; i++) tone({ f0: 700 + Math.random() * 900, f1: 1500 + Math.random() * 1400, dur: 0.07, gain: 0.07, at: 0.18 + i * 0.07 + Math.random() * 0.05, send: 0.6 });
    }),
    /** Wading: a small slosh and one rising droplet "bloop". */
    slosh: ready(() => {
      hiss({ f0: 700, f1: 1500, dur: 0.24, gain: 0.07, type: 'bandpass', q: 1.4, send: 0.5 });
      tone({ f0: 380 + Math.random() * 200, f1: 900 + Math.random() * 500, dur: 0.08, gain: 0.06, at: 0.06, send: 0.5 });
    }),
    /** How close open water is, 0..1: a soft lapping bed that fades in near the lake and creek. */
    water: ready((near) => {
      if (!waterGain) {
        const src = ctx.createBufferSource(), band = ctx.createBiquadFilter(), lap = ctx.createOscillator(), depth = ctx.createGain();
        src.buffer = noiseBuf; src.loop = true;
        band.type = 'bandpass'; band.frequency.value = 950; band.Q.value = 0.9;
        waterGain = ctx.createGain(); waterGain.gain.value = 0;
        // a slow wobble on the filter makes the hiss lap like small waves
        lap.frequency.value = 0.35; depth.gain.value = 420;
        lap.connect(depth).connect(band.frequency);
        src.connect(band).connect(waterGain); out(waterGain, 0.4);
        src.start(); lap.start();
      }
      waterGain.gain.setTargetAtTime(near * 0.085, ctx.currentTime, 0.4);
    }),
    growl: ready(() => { tone({ f0: 95, f1: 60, dur: 0.85, gain: 0.26, type: 'sawtooth', wobble: 14, wobbleHz: 28, send: 0.4 }); }),
    stomp: ready(() => {
      tone({ f0: 110, f1: 30, dur: 0.6, gain: 0.5, send: 0.5 });
      hiss({ f0: 1400, f1: 120, dur: 0.6, gain: 0.3, type: 'lowpass', send: 0.6 });
    }),
    /** The special move: a quick outward pop. */
    pop: ready((hits = 0) => {
      // a shockwave: a sub boom, air rushing outward, a rising shimmer, and a bright chord on top
      tone({ f0: 140, f1: 30, dur: 0.7, gain: 0.55, send: 0.5 });
      tone({ f0: 70, f1: 44, dur: 0.8, gain: 0.25, type: 'triangle', send: 0.6 });
      hiss({ f0: 300, f1: 5200, dur: 0.5, gain: 0.3, q: 0.8, attack: 0.004, send: 0.6 });
      hiss({ f0: 6000, f1: 1200, dur: 0.9, gain: 0.1, type: 'highpass', at: 0.08, send: 0.9 });
      tone({ f0: 300, f1: 1500, dur: 0.4, gain: 0.14, type: 'triangle', wobble: 60, wobbleHz: 24 });
      [0, 7, 12, 19].forEach((semi, i) => bell(ROOT_HZ * 2 ** (semi / 12), 0.11, 0.03 + i * 0.045, 1.2));
      // each monster it catches answers with a knock
      for (let i = 0; i < Math.min(hits, 3); i++) tone({ f0: 380, f1: 90, dur: 0.12, gain: 0.3, type: 'square', at: 0.12 + i * 0.07, send: 0.2 });
    }),
    /** Winding up a jump: quick rising ticks, called every frame while charging. */
    charge: ready((amount) => {
      if (ctx.currentTime - lastTick < 0.09) return;
      lastTick = ctx.currentTime;
      tone({ f0: 240 + amount * 620, f1: 280 + amount * 700, dur: 0.08, gain: 0.06 + amount * 0.05, type: 'triangle', send: 0.2 });
    }),
    /** A chained bounce: a springy note that climbs with the chain. */
    bounce: ready((chain) => {
      const hz = 262 * 2 ** (PENTATONIC[Math.min(chain, PENTATONIC.length - 1)] / 12);
      tone({ f0: hz * 0.6, f1: hz * 1.5, dur: 0.3, gain: 0.22, wobble: 40, wobbleHz: 18, type: 'triangle' });
      bell(hz * 2, 0.08, 0.03, 0.5);
    }),
    /** A kicked puffball: a soft round "boop", lower for bigger balls. */
    boop: ready((size = 1) => {
      tone({ f0: 320 / size, f1: 150 / size, dur: 0.18, gain: 0.2, send: 0.3 });
      hiss({ f0: 700, f1: 300, dur: 0.08, gain: 0.05, type: 'lowpass' });
    }),
    /** A chime flower: one note of the scale per flower. */
    bell: ready((note = 0) => { bell(ROOT_HZ * 2 ** (PENTATONIC[note % PENTATONIC.length] / 12), 0.15, 0, 1.3); }),
    rustle: ready(() => { hiss({ f0: 2600, f1: 5200, dur: 0.35, gain: 0.09, q: 0.7, send: 0.2 }); hiss({ f0: 1800, f1: 900, dur: 0.2, gain: 0.05, at: 0.05 }); }),
    hoop: ready(() => {
      hiss({ f0: 800, f1: 4200, dur: 0.3, gain: 0.14, q: 2 });
      [0, 7, 12].forEach((semi, i) => bell(ROOT_HZ * 2 ** (semi / 12), 0.12, i * 0.05, 0.8));
    }),
    poof: ready(() => { hiss({ f0: 1800, f1: 500, dur: 0.25, gain: 0.1, type: 'lowpass' }); tone({ f0: 700, f1: 1100, dur: 0.12, gain: 0.06 }); }),
  };
}
