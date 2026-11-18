import { installFocusCards } from './focus/view';
import { installLobbyPlay } from './lobby-play';
import type { RoomFeature } from './room';

// Features the entries pass to startRoom. Both the game (main.ts) and the showcase (../showcase/main.ts) list them
// today; a game-only feature is defined here and listed in main.ts alone.

// Step 2 of the first 60 seconds: after the title, before building a resident (LOFTIO-COMPANION.md).
export const focusCards: RoomFeature = ({ shell }) => {
  const cards = installFocusCards(document.getElementById("letter-settings"), shell);
  return { ready: () => cards.askOnce(), teardown: () => cards.dispose() };
};

// The game and the showcase open Focus from its control only: a first visit gets the welcome card instead (owner, 2026-11-17).
export const focusCardsOnRequest: RoomFeature = ({ shell }) => {
  const cards = installFocusCards(document.getElementById("letter-settings"), shell);
  return { teardown: () => cards.dispose() };
};

// Tossing residents across the floor and piling them up to six high.
export const lobbyPlay: RoomFeature = (room) => installLobbyPlay(room);
