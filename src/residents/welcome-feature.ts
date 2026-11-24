import type { ResidentHooks, ResidentOptions } from './view';
import { firstVisit } from './first-visit';
import { welcomeCard } from './welcome';
import { ROOM_MODAL_CLASS } from '../world-ui';
import { WELCOME_SEEN_SUFFIX, WELCOME_TICKETS } from './welcome-constants';
import { WELCOME_COPY } from './welcome-copy';

type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
type Card = { open(): void; dispose(): void };
/** The part of `RoomContext` this feature reads, typed here so a view never imports the boot file (GAME-LAYERS.md). */
type WelcomeRoom = { residents?: ResidentHooks };
/** The page this feature reads; the game passes the real one, a test passes its own. */
export type WelcomePage = {
  storage: Storage;
  /** True on a direct return from a minigame (`data-loft-return`), which enters the room without ceremony. */
  returning: () => boolean;
  dialogOpen: () => boolean;
  card: (trigger: HTMLElement, build: () => void) => Card;
};

/** A fresh game profile starts with the welcome allowance and the final Create button names its cost. */
export const WELCOME_OPTIONS: ResidentOptions = { initialTickets: WELCOME_TICKETS, confirmLabel: WELCOME_COPY.confirm };

/**
 * Room feature, in the game and the showcase: once the intro has ended and the saved room has loaded, a fresh profile sees the welcome
 * card once. Never in arrival preview, on a minigame return, over an open dialog, or after teardown.
 */
export function welcomeFeature(page: WelcomePage, options: ResidentOptions = WELCOME_OPTIONS) {
  const install = ({ residents }: WelcomeRoom) => {
    if (!residents) return;
    const first = residents.fresh ? firstVisit(page.storage, residents.storageKey + WELCOME_SEEN_SUFFIX) : () => false;
    let card: Card | null = null;
    let disposed = false;
    return {
      ready: () => {
        if (residents.preview || page.returning()) return;
        void residents.restored.then(loaded => {
          if (!loaded || disposed || page.dialogOpen() || !first()) return;
          card = page.card(residents.trigger, residents.openCreate);
          card.open();
        });
      },
      teardown: () => { disposed = true; card?.dispose(); },
    };
  };
  return Object.assign(install, { residents: options });
}

/** True while any modal is up: an open `<dialog>` or a full-screen page marked as a room modal (the storybook). */
export const modalOpen = (root: Pick<ParentNode, 'querySelector'>): boolean =>
  root.querySelector('dialog[open]') !== null || root.querySelector(`.${ROOM_MODAL_CLASS}`) !== null;

const browserPage: WelcomePage = {
  storage: { getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) },
  returning: () => document.documentElement.hasAttribute('data-loft-return'),
  dialogOpen: () => modalOpen(document),
  card: welcomeCard,
};

export const welcome = welcomeFeature(browserPage);
export const showcaseWelcome = (launches?: ResidentOptions['launches'], selectGame?: ResidentOptions['selectGame']) => welcomeFeature({ ...browserPage,
  card: (trigger, build) => welcomeCard(trigger, build, true),
}, { ...WELCOME_OPTIONS, firstResident: true, launches, selectGame });
