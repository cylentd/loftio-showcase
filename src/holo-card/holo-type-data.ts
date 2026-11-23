// The holo types the compare board shows (look test `?holocard&holocompare`, 2026-11-20). Each is one data entry
// here plus its CSS block in holo-types.css, keyed by `data-holo`; no code branches on the type. The technique
// (layered gradients and masks moved by the tilt's custom properties, blend modes) is written from its description; textures
// are generated at load by holo-textures.ts.

export type HoloType = {
  readonly id: string;
  /** The tab's word. */
  readonly label: string;
  /** What the animation does when it is on, for the toggle's accessible description. */
  readonly motion: string;
};

export const HOLO_TYPES = [
  { id: 'cosmos', label: 'Cosmos', motion: 'light bands sweep the stars' },
  { id: 'classic', label: 'Classic', motion: 'the rainbow runs through the bars' },
  { id: 'reverse', label: 'Reverse', motion: 'light crosses the frame' },
  { id: 'rainbow', label: 'Rainbow', motion: 'the glitter changes colour' },
  { id: 'radiant', label: 'Radiant', motion: 'light bands cross the diamonds' },
  { id: 'etched', label: 'Etched gold', motion: 'light sweeps the lines' },
] as const satisfies readonly HoloType[];

export type HoloId = (typeof HOLO_TYPES)[number]['id'];

/** The holo the normal (original) card wears (owner, 2026-11-21). */
export const NORMAL_HOLO: HoloId = 'classic';

/** The tab that gives each card a different holo. */
export const MIX_TAB = 'mix';
export const MIX_LABEL = 'Mix';
/** Mix's holo per card, in board order (normal, cozy alt, action alt): one glittery, one barred, one sheen. */
export const MIX: readonly HoloId[] = ['classic', 'rainbow', 'cosmos'];

export type HoloTab = HoloId | typeof MIX_TAB;
export const HOLO_TABS: readonly HoloTab[] = [...HOLO_TYPES.map(type => type.id), MIX_TAB];

export const tabLabel = (tab: HoloTab): string => HOLO_TYPES.find(type => type.id === tab)?.label ?? MIX_LABEL;
