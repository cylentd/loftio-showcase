// Words in the storybook binder look test (`?mode=mock&binder`). Card words come from holo-card-copy.ts.
import type { SheetAction } from './constants';

export const BINDER_COPY = {
  title: 'Our loft friends',
  empty: 'A new friend goes here',
  prev: 'Previous page',
  next: 'Next page',
  /** The page counter under the binder: one page on a phone, a spread on a desktop. */
  page: (first: number, last: number, count: number) => first === last ? `Page ${first} of ${count}` : `Pages ${first} and ${last} of ${count}`,
  endpaper: 'More pages open as new friends arrive',
  /** The corner mark is a button that opens the options sheet; its name says where the resident is. */
  mark: (name: string, inLoft: boolean) => `${name} is ${inLoft ? 'in the loft' : 'away'}. Options`,
  status: (inLoft: boolean) => inLoft ? 'In the loft' : 'Away for now',
  close: 'Close',
  /** An action failed and nothing changed; shown in the sheet when the error has no words of its own. */
  failed: 'That did not work. Nothing changed.',
  actions: {
    home: 'Send home',
    invite: 'Invite in',
    invitation: 'Send invitation',
    abilities: 'Abilities',
    reroll: 'Reroll',
  } satisfies Record<SheetAction, string>,
  /** The big card's art switch. */
  art: 'Card art',
  normal: 'Normal',
  alt: 'Alt',
  /** An original's two alt paintings (holo-card-scenes.ts, variants b and a). */
  cozy: 'Cozy',
  action: 'Action',
};
