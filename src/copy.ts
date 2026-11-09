// Every word the spike shows, keyed. Voices follow product doc §7.1.

export const LINES: Record<string, string> = {
  sprout: "Oh! You're back. I watered the fern twice, just in case.",
  hoodie: "Found the corner piece. Not telling where.",
  puff: "I left you a letter. Take your time with it.",
  chomper: "Last cookie's mine. Race you for it?",
  slime: "Rain's louder tonight. Good for reading.",
  burger: "Counter's clean. That counts as a win.",
};

export const NAMES: Record<string, string> = {
  sprout: "Sprout",
  hoodie: "Hoodie",
  puff: "Puff",
  chomper: "Chomper",
  slime: "Slime",
  burger: "Burger",
};

export const CUE_LABEL = "Letter from Puff: a decision is waiting";

export const PANEL = {
  title: "Choose the reading-list layout",
  summary: "Puff needs one answer before the reading list can change.",
  cards: [
    {
      name: "Card grid",
      benefit: "Covers show, so a book is easy to spot.",
      tradeoff: "But only about eight books fit before you scroll.",
    },
    {
      name: "Compact list",
      benefit: "Twenty titles fit on one screen.",
      tradeoff: "But with no covers, you scan by title alone.",
    },
  ],
  back: "Back to choices",
  later: "Decide later",
};

export const METER_LABEL = "Frame rate";
export const ROOM_AUDIO = { enable: "Enable room sound", mute: "Mute room sound", blocked: "Your browser needs a tap to start music and rain." };
export const SCENE_LABEL = "The loft on a rainy night. Six residents are home.";
export const ABOUT = {
  title: "About Loftio",
  description: "A treehouse loft where six little residents keep you company.",
  maker: "Made by Cylent Labs.",
  music: "Music by Cylent Labs.",
  rain: "Rain: ",
  recording: "Soft rain.WAV by barkenov",
  source: "https://freesound.org/people/barkenov/sounds/640655/",
  license: " (CC0).",
  sounds: "Stacking sound: ",
  soundsPack: "Squish pop by pixelcrusher",
  soundsSource: "https://pixabay.com/sound-effects/squish-pop-256410/",
  soundsLicense: " (Pixabay).",
};
export const LOOK = {
  controls: "Settings",
  drag: "Center view",
  swipe: "Center view",
  keyboard: "Look around with arrow keys. Home to centre.",
  help: "Drag to look around. Click here or press Home to centre. On a phone, swipe to explore.",
  still: "Still",
  stillHelp: "Pause the room, rain and camera",
  reduced: "Still follows your reduced-motion setting",
};
export const MUSIC = {
  tracks: {
    paper: "Paper Cranes and Coffee",
    slow: "Slow Afternoon Light",
    save: "The Quiet Save Point",
    lanterns: "Lanterns in the Rain",
    tea: "Tea and Tiny Books",
    aisles: "Midnight Aisles",
    treehouse: "Treehouse After Dark",
    hideaway: "The Lamp-Lit Hideaway",
  },
  track: "Track",
  next: "Next track",
  chooseSong: "Choose a song",
  songList: "Songs",
  nowPlaying: "Now playing",
  position: "Song position",
  positionText: (at: string, length: string) => `${at} of ${length}`,
  label: "Music",
  active: "Music on",
  play: "Play music",
  pause: "Pause music",
  volume: "Volume",
  paused: "Paused",
  playing: "Playing · playlist",
  error: "Playback couldn't start. Try Play music.",
};

export const LIGHTING_COPY = {
  title: "Room light",
  modes: { cycle: "Auto", lamplit: "Lamplit", dusk: "Dusk", moonlit: "Moonlit" },
  help: "Auto drifts through a four-minute evening. Still pauses the cycle and lamp flickers.",
};

export const SCENE_SETTINGS = {
  atmosphere: "Atmosphere",
  effects: { particles: "Particles", leaves: "Leaves", lights: "Lamp glow" },
  help: "0% turns an effect off. Rain stays unchanged.",
  reset: "Reset atmosphere",
  showCue: "Show Puff's letter",
  readCue: "Read Puff's letter",
};

export const RESIDENT_CONTROLS = {
  title: "Residents",
  help: "Drag residents onto the floor, either loft, the pink lounge, the cream ottoman, or the puzzle table and its chairs. Keyboard: Space to pick up or place; arrows to move; Page Up / Down to change floors; Escape to cancel. Shift moves in smaller steps.",
  reset: "Everyone home",
  picked: "picked up. Arrow keys move; Space places; Escape cancels.",
  placed: "placed in the room.",
  cancelled: "returned to the previous spot.",
  seatTaken: "returned to the previous spot. That seat is already taken.",
  restored: "Everyone is back at their starting spot.",
  wander: "Wander",
  wanderHelp: "Off keeps everyone where you put them.",
};
export const LOFT_ARRIVAL = "Best view of the rain from up here.";
export const ARRIVALS: Record<string, string> = {
  sprout: "The teal sofa, the rain, the plants. My kind of corner.",
  hoodie: "My chair at the puzzle table. Now, where was that corner piece?",
  puff: "The window makes a good place to watch the rain.",
  chomper: "Warm lantern, good company. I'm staying a minute.",
  slime: "The upstairs sofa. Just one more chapter.",
  burger: "Books straightened. Lamp looking good.",
};
export const RAIN_SOUND = {
  label: "Rain sound", active: "Rain sound on", play: "Play rain", pause: "Pause rain",
  volume: "Rain volume", paused: "Paused", playing: "Playing",
  help: "Soft rain, mixed separately from music.",
  error: "Playback couldn't start. Try Play rain.",
};
export const SETTINGS_NAV = { title: "Room settings", close: "Close settings", residents: "Residents", letter: "Puff's letter", details: "Moving residents", resetHelp: "Restore particles, leaves and lamp glow", tabs: { room: "Room", effects: "Effects", sound: "Sound" } };
export const FAVORITES = { toggle: "Show all favorite spots", help: "Hold a resident to softly light their favorite corner.", labels: { sprout: "The upstairs teal sofa", hoodie: "The chair at the puzzle table", puff: "The rain window", chomper: "The warm lantern", slime: "The upstairs reading sofa", burger: "The books and lamp" } as Record<string, string> };
export const POSTCARD = { save: "Make postcard", working: "Making postcard", title: "Your postcard", close: "Close preview", alt: "Your arranged loft in a keepsake postcard frame", download: "Download PNG", downloaded: "Download started", copy: "Copy image", copying: "Copying image", copied: "Image copied", copyError: "Clipboard unavailable. Use Download PNG, or allow clipboard access and try again.", error: "Couldn't make this view. Try again.", help: "Keep just the scene, or add a little note.", showCaption: "Add a caption", signature: "Loftio", caption: "Loftio / A rainy evening", greetings: ["Wish you were here.", "Stay a little longer.", "Rain can wait.", "Your quiet corner.", "No hurry here.", "A small, soft pause."], captionChoice: "Caption", borderChoice: "Border", previousCaption: "Previous caption", nextCaption: "Next caption", previousBorder: "Previous border", nextBorder: "Next border", borders: { storybook: "Paper", quilt: "Film", airmail: "Borderless" }, stamp: "LOFTIO", postmark: "GROVE", post: "POST", file: "loftio-postcard.png" };
export const SCENE_ACTIONS = { label: "Scene actions" };
/** The dock's three tiles: the word under each tile, and its accessible name, which must contain that word. */
export const TRAY = {
  music: { label: "Music", name: "Music player", help: "Show or hide the music player" },
  postcard: { label: "Postcard", name: POSTCARD.save },
  settings: { label: "Settings", name: LOOK.controls },
};
export const INTRO = { name: "Loftio", pageTitle: "Loftio", loading: "Opening the loft…", error: "The loft couldn't load. Please try again.", retry: "Try again", hint: "Click to enter", hintTouch: "Tap to enter", cleanupMs: 1600 };
