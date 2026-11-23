import { ALT_RECOVERY_COPY } from './alt-recovery-copy';

export function altRecoveryControls(recover: (host: HTMLElement) => Promise<string>): HTMLElement {
  const controls = document.createElement('div');
  controls.className = 'binder-art-switch alt-recovery';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'binder-art-option';
  button.textContent = ALT_RECOVERY_COPY.generate;
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  status.tabIndex = -1;
  const challenge = document.createElement('div');
  controls.append(button, status, challenge);
  let retrySave = false;
  button.onclick = async () => {
    status.focus({ preventScroll: true });
    button.disabled = true;
    status.textContent = retrySave ? ALT_RECOVERY_COPY.saving : ALT_RECOVERY_COPY.drawing;
    const result = await recover(challenge).catch(() => 'network');
    retrySave = result === 'storage';
    status.textContent = result === 'ready' ? ALT_RECOVERY_COPY.ready : result === 'busy' ? ALT_RECOVERY_COPY.busy
      : result === 'cap' ? ALT_RECOVERY_COPY.limit : retrySave ? ALT_RECOVERY_COPY.notSaved : ALT_RECOVERY_COPY.failed;
    button.disabled = result === 'ready';
    if (result !== 'ready' && result !== 'busy') button.textContent = retrySave ? ALT_RECOVERY_COPY.retrySave : ALT_RECOVERY_COPY.retry;
    if (document.activeElement === document.body && controls.closest('dialog[open]')) {
      (button.disabled ? status : button).focus({ preventScroll: true });
    }
  };
  return controls;
}
