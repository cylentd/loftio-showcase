import { focusCardsOnRequest, lobbyPlay } from '../src/features';
import { startRoom } from '../src/room';
import { playGlade } from '../src/glade/view';
import { welcome } from '../src/residents/welcome-feature';
import { hostedVisits } from '../src/visits/feature';

// The public showcase. It gets a feature only when it is listed here, and the export copies only what this file
// reaches. A new game feature stays out of the showcase until someone adds it to this list on purpose.
// welcome: the once-only first-visit card (owner, 2026-11-17). It replaces the automatic focus ask, so Focus opens
// on request only, as in the game (../src/main.ts), and it gives a fresh profile the welcome allowance of 3 tickets.
// hostedVisits: resident invitations, files and hosted links (owner, 2026-11-18). The showcase is the one build that
// deploys the endpoint (game/vercel.json), so it asks for links itself; the game (../src/main.ts) follows a build flag.
startRoom([focusCardsOnRequest, lobbyPlay, playGlade, welcome, hostedVisits]);
