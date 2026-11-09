export const RESIDENT_COPY = {
  title: 'Residents', close: 'Close', tabs: ['In the loft', 'Saved', 'Create'],
  welcome: 'Welcome home', later: 'Save for later', remove: 'Remove from loft',
  ready: 'Someone’s arrived.', reveal: 'Open travelling basket', skip: 'Skip arrival',
  greeting: 'A little place to call home.', empty: 'Your saved residents will be here.',
  originals: 'The original six are always at home.',
  capacity: 'The loft has room for 12 created residents alongside the original six. Remove one from the loft to make space; its image stays saved.',
  create: 'Bring to life',
  // Shown while a resident is being made. Online the image arrives through this page, so leaving it loses the image.
  creating: {
    mock: 'Bringing your design to life. You can close this drawer.',
    local: 'Bringing your design to life. You can close this drawer or leave the page; it keeps going.',
    online: 'Bringing your design to life. You can close this drawer, but keep this page open until it arrives.',
  },
  preparing: 'Your image is saved. Getting it ready for the loft…',
  reconnect: 'Reconnect', retryPreparation: 'Retry preparation',
  loadFailure: 'Could not load residents. Your saved data has been preserved.',
  actionFailure: 'Could not finish that change. Your saved resident is still available.',
  // The Create form's notice, per builder mode.
  notice: {
    mock: 'Preview mode: the result is sample art and won’t match your design.',
    local: 'Uses Codex allowance. Closing this drawer keeps it running.',
    online: 'Each resident is a brand-new image, drawn just for you. It takes about a minute.',
  },
  original: 'Download original PNG',
  ticketNote: (left: number) => ['Uses 1 build ticket ·', left, 'left'].join(' '),
  outOfTickets: 'Out of build tickets',
  outOfTicketsBody: 'Each new resident is a brand-new image, so it uses a build ticket. More tickets aren’t available in this preview yet.',
  grantTicket: 'Add a test ticket',
  // Asked before a ticket is spent: there is no cancel once a resident starts (David, 2026-11-07).
  confirmBuild: (left: number) => (left === 1 ? 'This uses your last build ticket.' : ['This uses 1 of your', left, 'build tickets.'].join(' '))
    + ' Once it starts, it can’t be stopped.',
  confirmYes: 'Use 1 ticket', confirmNo: 'Not yet',
};
/** The Create panel's picture-card steps, in step order, then the summary card. Card labels come from the catalog.
 *  Tone (David, 2026-11-07): a designer-toy collectible for all ages, plain and never babyish. */
export const WIZARD_COPY = {
  steps: ['Choose a creature', 'Pick a mood', 'Add a signature detail', 'Choose a palette'],
  parts: ['Creature', 'Mood', 'Detail', 'Palette'], // the summary's caption under each pick, in step order
  summary: 'Your design',
  surprise: 'Surprise me', surprisePick: 'Surprise', anyPalette: 'Any palette', back: 'Back',
  progress: (step: number, total: number) => ['Step', step, 'of', total].join(' '),
  change: (part: string, pick: string) => [part + ':', pick + '.', 'Change'].join(' '),
};
