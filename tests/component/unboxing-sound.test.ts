import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRevealSound } from '../../src/residents/unboxing-sound.ts';

function audioFixture(rejected = false) {
  const starts: number[] = [], stops: number[] = [], levels: number[] = [];
  let created = 0, closed = 0;
  const sources: { onended?: () => void }[] = [], outputs: { connected: boolean }[] = [];
  const param = (log = levels) => ({ value: 0, setValueAtTime(value: number) { log.push(value); },
    linearRampToValueAtTime(value: number) { log.push(value); }, exponentialRampToValueAtTime(value: number) { log.push(value); } });
  const source = () => {
    const made = { connect() {}, disconnect() {}, start(time: number) { starts.push(time); },
      stop(time: number) { stops.push(time); }, frequency: param([]), type: 'sine', buffer: null };
    sources.push(made as { onended?: () => void }); // the code under test assigns onended; the fake does not declare it
    return made;
  };
  const context = { currentTime: 10, sampleRate: 1000, state: 'suspended', destination: {},
    resume: () => rejected ? Promise.reject(new Error('blocked')) : Promise.resolve(),
    close: () => { closed += 1; return Promise.resolve(); },
    createGain: () => {
      const gain = { gain: param(), output: { connected: false },
        connect(to: unknown) { if (to === context.destination) { this.output.connected = true; outputs.push(this.output); } },
        disconnect() { this.output.connected = false; } };
      return gain;
    },
    createOscillator: source, createBufferSource: source,
    createBiquadFilter: () => ({ type: 'lowpass', frequency: param([]), Q: param([]), connect() {} }),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { starts, stops, levels, sources, outputs, get created() { return created; }, get closed() { return closed; },
    factory: () => { created += 1; return context as unknown as AudioContext; } };
}

test('a muted reveal creates no audio context or scheduled sound', () => {
  const audio = audioFixture();
  const sound = createRevealSound(() => false, audio.factory);
  sound.play('intro'); sound.play('opening'); sound.dispose();
  assert.equal(audio.created, 0);
  assert.deepEqual(audio.starts, []);
});

test('intro and opening schedule bounded music and foley on one context', () => {
  const audio = audioFixture();
  const sound = createRevealSound(() => true, audio.factory);
  sound.play('intro');
  const introCount = audio.starts.length;
  assert.ok(introCount > 0);
  sound.play('opening');
  assert.equal(audio.created, 1);
  assert.ok(audio.starts.length > introCount);
  assert.ok(audio.starts.every(time => time >= 10 && time <= 15));
  assert.ok(audio.levels.every(level => Number.isFinite(level) && level > 0 && level <= 1));
});

test('each reveal cue releases its output gain once its last note ends, so a shared context does not accumulate nodes', () => {
  const audio = audioFixture();
  const sound = createRevealSound(() => true, audio.factory);
  sound.play('intro'); sound.play('opening');
  assert.equal(audio.outputs.length, 2);
  const [intro, opening] = audio.outputs as { connected: boolean }[];
  audio.sources.slice(0, audio.sources.length).forEach(source => source.onended?.());
  assert.deepEqual([intro!.connected, opening!.connected], [false, false]);
});

test('an output gain stays connected while a note of its cue is still sounding', () => {
  const audio = audioFixture();
  const sound = createRevealSound(() => true, audio.factory);
  sound.play('opening');
  assert.ok(audio.sources.length > 1);
  audio.sources[0]!.onended?.();
  assert.equal(audio.outputs[0]!.connected, true);
});

test('muting stops scheduled notes and disposal closes once without resurrection', () => {
  const audio = audioFixture();
  let enabled = true;
  const sound = createRevealSound(() => enabled, audio.factory);
  sound.play('opening');
  const scheduledStops = audio.stops.length;
  enabled = false; sound.stop();
  assert.ok(audio.stops.length > scheduledStops);
  sound.dispose(); sound.dispose(); enabled = true; sound.play('intro');
  assert.equal(audio.closed, 1);
  assert.equal(audio.created, 1);
});

test('blocked audio is swallowed and does not retry or prevent the reveal', async () => {
  const audio = audioFixture(true);
  const sound = createRevealSound(() => true, audio.factory);
  sound.play('intro');
  await Promise.resolve(); await Promise.resolve();
  const starts = audio.starts.length;
  sound.play('opening');
  assert.equal(audio.starts.length, starts);
  assert.ok(audio.stops.length > starts);
  sound.dispose();
});
