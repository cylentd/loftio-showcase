/** Gestures iOS Safari accepts as permission to start or restart audio. `pointerdown` and `touchstart` do not count there. */
export const AUDIO_UNLOCK_EVENTS = ["touchend", "pointerup", "click", "keydown"] as const;

/** Browser storage key and record version for the room's saved sound choices. */
export const AUDIO_PREFS = { key: "loftio.room-audio", version: 1 } as const;
