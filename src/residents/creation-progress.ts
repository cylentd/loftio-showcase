import { worldButton } from '../world-ui';
import type { GenerationStage } from '../builder/controller';
import { blindBox } from './blind-box';
import { RESIDENT_COPY as COPY } from './copy';
import './creation-progress.css';
import './creation-arrival.css';

export function creationProgress(exit: () => void) {
  const root = document.createElement('section'); root.className = 'creation-progress'; root.hidden = true;
  const art = document.createElement('div'); art.className = 'creation-package'; art.setAttribute('aria-hidden', 'true'); art.append(blindBox());
  const heading = document.createElement('h3'); heading.textContent = COPY.creationTitle; heading.tabIndex = -1;
  const body = document.createElement('p'); body.textContent = COPY.creationBody;
  const stage = document.createElement('p'); stage.className = 'creation-stage'; stage.setAttribute('role', 'status');
  const back = worldButton(COPY.creationReturn, exit); back.classList.add('world-primary');
  const message = document.createElement('div'); message.className = 'creation-message'; message.append(heading, body, stage);
  const content = document.createElement('div'); content.className = 'creation-progress-body'; content.append(art, message);
  root.append(content, back);
  return { root, update(value: GenerationStage, visible: boolean, arrived = false) {
    const entering = root.hidden && visible;
    root.hidden = !visible;
    root.dataset.state = arrived ? 'arrived' : 'creating';
    heading.textContent = arrived ? COPY.creationArrived : COPY.creationTitle;
    body.textContent = arrived ? COPY.creationArrivedBody : COPY.creationBody;
    back.textContent = arrived ? COPY.creationFind : COPY.creationReturn;
    stage.hidden = arrived;
    stage.textContent = arrived ? '' : value === 'preparing' ? COPY.creationPreparing : COPY.creationStatus;
    if (entering && root.closest('dialog')?.open) heading.focus({ preventScroll: true });
  } };
}

export function creationIndicator(open: () => void) {
  const root = worldButton('', open); root.classList.add('resident-build-status'); root.hidden = true;
  const text = document.createElement('span'); text.setAttribute('role', 'status'); root.append(text);
  document.body.append(root);
  return { update(status: string, stage: GenerationStage) {
    root.hidden = status !== 'generating' && status !== 'failed';
    root.dataset.state = status;
    text.textContent = status === 'failed' ? COPY.creationAttention
      : stage === 'preparing' ? COPY.creationPreparingStatus : COPY.creationStatus;
  } };
}
