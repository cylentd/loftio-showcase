// Every word the storybook page shows (#565). Card side names come from the binder copy (Normal, Cozy, Action).

export const STORYBOOK_COPY = {
  /** The shelf button's label and accessible name, and the page's accessible name. */
  title: 'Collection',
  /** The cover's one line, set in live text over the cover art: the same word, so players know what the book is. */
  coverTitle: 'Collection',
  open: 'Open the book',
  close: 'Close the storybook',
  prev: 'Previous page',
  next: 'Next page',
  /** The counter under the book: one page on a phone, a spread on a desktop. */
  pages: (first: number, last: number, total: number) => first === last ? `Page ${first} of ${total}` : `Pages ${first} and ${last} of ${total}`,
  /** A card button's name: the resident and which of its cards. */
  card: (name: string, side: string) => `${name}, ${side} card`,
} as const;
