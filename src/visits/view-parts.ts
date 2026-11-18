import { worldDrawer, dismissOnBackdrop, worldButton } from '../world-ui';
import { COPY, LINK_COPY } from './copy';
import './tokens.css';
import './styles.css';

/** The ready link: a read-only field the owner can select by hand, and the privacy note under it. */
function linkBox() {
  const box = document.createElement('div'); box.className = 'visit-link'; box.hidden = true;
  const field = document.createElement('input'); field.readOnly = true; field.className = 'visit-link-field';
  field.setAttribute('aria-label', LINK_COPY.field); field.addEventListener('focus', () => field.select());
  const note = document.createElement('p'); note.className = 'visit-note';
  box.append(field, note);
  return { box, field, note };
}

/** The file route, shown under the link buttons as the quieter second choice. */
function fileGroup() {
  const group = document.createElement('div'); group.className = 'visit-files'; group.hidden = true;
  const label = document.createElement('p'); label.className = 'visit-files-label'; label.textContent = COPY.fileRoute;
  const row = document.createElement('div'); row.className = 'visit-files-row';
  group.append(label, row);
  return { group, row };
}

export function visitChrome() {
  const drawer = worldDrawer(COPY.title, COPY.close);
  drawer.dialog.classList.add('visit-viewer', 'world-modal'); dismissOnBackdrop(drawer.dialog);
  const body = document.createElement('div'); body.className = 'visit-body';
  const stage = document.createElement('div'); stage.className = 'visit-stage';
  const image = new Image(); image.alt = ''; image.draggable = false; stage.append(image);
  const name = document.createElement('h3'), message = document.createElement('p'), status = document.createElement('p');
  message.className = 'visit-message'; status.className = 'visit-status';
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const link = linkBox(), files = fileGroup();
  const footer = document.createElement('footer'); footer.className = 'visit-footer';
  const actions = document.createElement('div'); actions.className = 'visit-actions';
  footer.append(actions, files.group);
  body.append(stage, name, message, link.box, status); drawer.content.append(body, footer);
  let busy = false;
  drawer.dialog.addEventListener('keydown', event => {
    if (busy && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  drawer.dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  drawer.dialog.addEventListener('click', event => { if (busy && event.target === drawer.dialog) event.stopImmediatePropagation(); }, true);
  const close = drawer.dialog.querySelector<HTMLButtonElement>('.world-close')!;
  return { ...drawer, body, stage, image, name, message, status, actions, link,
    busy(value: boolean) {
      busy = value; drawer.dialog.setAttribute('aria-busy', String(value)); close.disabled = value;
      footer.querySelectorAll('button').forEach(button => { button.disabled = value; });
    },
    /** Clears every action and the link box, for a fresh open. */
    reset() { actions.replaceChildren(); files.row.replaceChildren(); files.group.hidden = true; link.box.hidden = true; link.field.value = ''; link.note.textContent = ''; },
    /** Shows a ready link with its privacy note. */
    showLink(value: string, note: string) { link.field.value = value; link.note.textContent = note; link.box.hidden = false; },
    button(label: string, action: () => void, primary = false) {
      const button = worldButton(label, action); if (primary) button.classList.add('world-primary'); actions.append(button); return button;
    },
    /** A file-route button: secondary by design, under the link buttons. */
    fileButton(label: string, action: () => void) {
      const button = worldButton(label, action); button.classList.add('visit-file-button'); files.row.append(button); files.group.hidden = false; return button;
    },
  };
}
