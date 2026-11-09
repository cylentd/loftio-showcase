/** The disc's song list. CSS pixels; the script places the list, so these live here rather than in tokens.css. */
export const TRACK_LIST = {
  /** Between the disc and the list: --space-2, the tray's own gap between a tile and its label. */
  gapPx: 8,
  /** Kept clear at every screen edge: --space-3, the tray's own distance from the corner (--tray-corner). */
  marginPx: 12,
} as const;
