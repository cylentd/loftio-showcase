/** Owner-approved first game visit allowance, 2026-11-17; never applied to an existing ledger. */
export const WELCOME_TICKETS = 3;
/** Appended to the mode's registry key, e.g. `loftio-residents-mock-v1-introduced`; game/scripts/ui_gate.py reads it from here. */
export const WELCOME_SEEN_SUFFIX = '-introduced';
/** The value saved under that key before the card opens; its presence alone suppresses the card. */
export const WELCOME_SEEN = 'seen';
