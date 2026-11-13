import { AUDIO_PREFS } from "./audio-constants.ts";

export type Channel = "music" | "rain";
/** `null` means the person never chose, so the channel keeps its default. `on` is their intent, not whether playback worked. */
export interface ChannelChoice { level: number | null; on: boolean | null }
export type AudioChoices = Record<Channel, ChannelChoice>;

const CHANNELS: readonly Channel[] = ["music", "rain"];
const blank = (): AudioChoices => ({ music: { level: null, on: null }, rain: { level: null, on: null } });

function level(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

/** Saved choices; anything missing, corrupt, of another version or unreadable gives the defaults. */
export function loadAudioChoices(): AudioChoices {
  const choices = blank();
  try {
    const record = JSON.parse(localStorage.getItem(AUDIO_PREFS.key) ?? "null");
    if (record?.version !== AUDIO_PREFS.version) return choices;
    for (const channel of CHANNELS) {
      const saved = record[channel];
      choices[channel] = { level: level(saved?.level), on: typeof saved?.on === "boolean" ? saved.on : null };
    }
  } catch { return blank(); }
  return choices;
}

/** Remember one channel's choice, keeping the other channel's. A storage failure is ignored: the choice then lasts the visit. */
export function rememberChoice(channel: Channel, change: Partial<ChannelChoice>): void {
  try {
    const choices = loadAudioChoices();
    choices[channel] = { ...choices[channel], ...change };
    localStorage.setItem(AUDIO_PREFS.key, JSON.stringify({ version: AUDIO_PREFS.version, ...choices }));
  } catch { /* storage denied */ }
}
