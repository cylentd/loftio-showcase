import type { visitChrome } from './view-parts';
import { COPY } from './copy';
import type { Guest } from './invite-contract';
import type { VisitEvent } from './visit-model';

type Chrome = ReturnType<typeof visitChrome>;
type Removal = { remove(id: string): Promise<void>; changed(removed?: boolean): Promise<void> };
/** The viewer's state machine as the removal buttons see it: send an event, or note that the dialog was closed. */
export type Session = { send(event: VisitEvent): void; closed(): void };

/** The saved guest's single action, End visit, and its confirmation. Returns the first button so a caller can focus it. */
export function removalActions(ui: Chrome, removal: Removal, session: Session, guest: Guest): HTMLButtonElement {
  ui.actions.replaceChildren();
  return ui.button(COPY.remove, () => {
    ui.message.textContent = COPY.removeHelp; ui.status.textContent = COPY.confirmRemove; ui.actions.replaceChildren();
    ui.button(COPY.remove, () => {
      session.send('welcome'); ui.busy(true);
      void removal.remove(guest.id).then(async () => { session.closed(); ui.dialog.close(); await removal.changed(true); })
        .catch(error => { session.send('fail'); ui.status.textContent = error instanceof Error ? error.message : COPY.storage; })
        .finally(() => ui.busy(false));
    }, true);
    ui.button(COPY.cancel, () => { ui.message.textContent = COPY.guest; ui.status.textContent = ''; removalActions(ui, removal, session, guest).focus(); }).focus();
  }, true);
}
