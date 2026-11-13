/** Stacking sounds: a recorded clip (public/audio/sfx, see its README) played back at pitch steps. Every number is a taste choice made by ear unless noted. */
export const SFX = {
  // Which clip plays for a landing and for a topple. Swap either to another file in public/audio/sfx to change the voice.
  landFile: "audio/sfx/squish-pop.mp3", // owner's pick 2026-11-08: Pixabay "squish pop" by pixelcrusher, edited into a muffled bloop (see the sfx README)
  toppleFile: "audio/sfx/squish-pop.mp3", // same voice; the cascade's falling pitch and toppleGain keep six together gentle
  semitonesPerOctave: 12, // equal temperament
  // C major pentatonic, one step per pile level. Any order of these notes sounds consonant, so any pile sounds pleasant.
  scaleSemitones: [0, 2, 4, 7, 9, 12],
  detuneCents: 15, // each play drifts up to this far either way so repeats are not robotic; 100 cents is one semitone
  peak: 0.5, // voice loudness before master; the clip peaks near -1.5 dBFS, the room music plays at 0.35 and the rain at 0.196 of full scale
  master: 0.5, // all stacking sounds together: peak x master = 0.25, the owner's pick over the music bed on 2026-11-08 (0.64 was distracting)
  quietFactor: 0.3, // self-made piles: noticeably softer than a player's pile
  toppleGapS: 0.07, // stagger between voices of a cascade
  toppleGain: 0.8, // a cascade voice is a little softer than a landing, so six together stay gentle
} as const;
