import { seededRng } from '../loadout/loadout-model.ts';

export type AltKind = 'A' | 'B';

/** Share of residents drawn as kind A (action); the rest are kind B (quiet). Owner, 2026-11-20 (ledger #476): action
 *  art is not consistently good enough to give players, so it is off until re-approved. Was 0.5, an even split. */
const KIND_A_SHARE = 0;

/** A resident's alt art kind, seeded from its record id: the same id always gets the same kind. A is action, B is quiet. */
export const altKindFor = (id: string): AltKind => (seededRng(id)() < KIND_A_SHARE ? 'A' : 'B');
