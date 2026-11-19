import { startPlan, beginLabel, GATE } from './intro-gate-model.mjs';

/** Runs once the world is ready, before the cover lifts. Resolves when the cover may go: at once if sound
 *  started on its own (or none is wanted), else after the visitor presses the begin button. */
export async function openGate({ status, begin, gate }) {
  const started = gate.introWanted && gate.soundOn() ? await gate.tryStart() : false;
  if (startPlan({ hasIntro: gate.introWanted, soundOn: gate.soundOn(), started }) === 'go') return;
  begin.textContent = beginLabel(matchMedia('(pointer: coarse)').matches);
  status.textContent = GATE.ready;
  begin.hidden = false;
  begin.focus();
  await new Promise((resolve) => begin.addEventListener('click', resolve, { once: true }));
  gate.unlock();
}
