import { focusCards, lobbyPlay } from '../src/features';
import { startRoom } from '../src/room';

// The public showcase. It gets a feature only when it is listed here, and the export copies only what this file
// reaches. A new game feature stays out of the showcase until someone adds it to this list on purpose.
startRoom([focusCards, lobbyPlay]);
