export const TRACKS = [
  { id: "paper", file: "Paper_Cranes_and_Coffee.mp3" },
  { id: "slow", file: "Slow_Afternoon_Light.mp3" },
  { id: "save", file: "The_Quiet_Save_Point.mp3" },
  { id: "lanterns", file: "Lanterns_in_the_Rain.mp3" },
  { id: "library", file: "Seven_AM_Library.mp3" },
  { id: "window", file: "Pages_by_the_Window.mp3" },
  { id: "aisles", file: "Midnight_Aisles.mp3" },
  { id: "treehouse", file: "Midnight_in_the_Treehouse.mp3" },
  { id: "hideaway", file: "The_Lamp_Lit_Hideaway.mp3" },
] as const;

/** The song a visit most often opens on, and how often; any other song shares the rest equally. The owner's pick on 2026-11-08. Next continues down the list from the opener. */
export const START_TRACK = "lanterns";
export const START_TRACK_CHANCE = 0.3;
