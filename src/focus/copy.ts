/** Focus cards: LOFTIO-COMPANION.md, "First 60 seconds" step 2 and "Focus cards".
 *  The cards belong to the person. No line here gives a card to a resident (David, 2026-11-08). */
export const FOCUS_COPY = {
  title: 'Focus cards', close: 'Close',
  intro: 'Pick up to 3 things you’d like a nudge toward. Each day brings one tiny suggestion from them.',
  later: 'You can change these anytime in Settings.',
  count: (picked: number, max: number) => [picked, 'of', max, 'picked'].join(' '),
  full: (max: number) => ['That’s', max + '.', 'Tap a picked card to swap it.'].join(' '),
  done: 'Done', skip: 'Skip for now',
  open: 'Focus cards', // the Settings › Room button that brings the picker back
  cards: {
    move: { label: 'Move', tiny: '5-minute stretch' },
    outside: { label: 'Get outside', tiny: 'Walk around the block' },
    tidy: { label: 'Tidy', tiny: 'Clear one surface' },
    organize: { label: 'Organize', tiny: 'Sort one drawer' },
    rest: { label: 'Rest', tiny: 'Phone down for 10 minutes' },
    people: { label: 'People', tiny: 'Message a friend or family member' },
    make: { label: 'Make & learn', tiny: '10 minutes of a hobby' },
    wishlist: { label: 'Wishlist', tiny: 'Add something you want to buy' },
  },
} as const;
