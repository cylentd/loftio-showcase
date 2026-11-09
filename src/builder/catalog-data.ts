// Preset catalog for the resident builder. PROVISIONAL: seeded from the v4 package's example inputs, which are test
// cases, not an approved catalog. IDs are stable and stored in kept residents; labels are what the form shows; `prompt` is
// the phrase the runtime prompt receives. Rename a label freely, never reuse an ID for a different choice.

export const CATALOG_STATUS = "provisional";
export const SURPRISE = "surprise";

export type CatalogOption = { id: string; label: string; prompt: string };
export type PaletteOption = CatalogOption & { colors: readonly string[] };

const option = (id: string, label: string, prompt: string): CatalogOption => ({ id, label, prompt });
const palette = (id: string, label: string, colors: readonly string[]): PaletteOption =>
  ({ id, label, prompt: colors.join(", "), colors });

export const CATALOG = {
  creatures: [
    option("moth", "Moth", "moth"),
    option("snail", "Snail", "snail"),
    option("teapot", "Teapot", "teapot"),
    option("frog", "Frog", "frog"),
    option("crystal", "Crystal creature", "crystal creature"),
    option("mushroom", "Mushroom", "mushroom"),
    option("gecko", "Gecko", "gecko"),
    option("beetle", "Beetle", "beetle"),
    option("cloud", "Cloud", "cloud"),
    option('cat', 'Cat', 'cat'),
    option('puppy', 'Puppy', 'puppy'),
    option('bunny', 'Bunny', 'bunny'),
    option('fox', 'Fox', 'fox'),
    option('bear', 'Bear', 'bear'),
    option('duck', 'Duck', 'duck'),
    option('penguin', 'Penguin', 'penguin'),
    option('axolotl', 'Axolotl', 'axolotl'),
    option('tiny-dragon', 'Dragon', 'tiny friendly dragon'),
    option('sprout', 'Sprout', 'small plant sprout'),
    option('little-ghost', 'Ghost', 'small friendly ghost'),
  ],
  personalities: [
    option("bookworm", "Bookish", "enthusiastic bookworm"),
    option("curious", "Curious", "fearlessly curious"),
    option("serious", "Grumpy", "comically serious"),
    option("bashful", "Shy", "bashful sweetheart"),
    option("mischievous", "Cheeky", "quietly mischievous"),
    option("sleepy", "Sleepy", "sleepy dreamer"),
    option("helper", "Cheerful helper", "cheerful helper"),
    option("troublemaker", "Tiny troublemaker", "tiny troublemaker"),
    option("gentle", "Gentle giant", "gentle giant"),
    option('playful', 'Playful', 'playful'),
    option('affectionate', 'Affectionate', 'affectionate'),
    option('calm', 'Calm', 'calm'),
  ],
  signatureDetails: [
    option("reading-glasses", "Reading glasses", "oversized reading glasses"),
    option("beret", "Hat", "tilted beret"),
    option("bow-tie", "Tiny bow tie", "tiny bow tie"),
    option("fang", "Little fang", "little fang"),
    option("tuft", "Curled tuft", "curled tuft"),
    option("mittens", "Oversized mittens", "oversized mittens"),
    option("antennae", "Unusual antennae", "unusual antennae"),
    option("scarf", "Scarf", "cozy knitted scarf"),
    option('none', 'None', 'no accessories or added signature details'),
    option('round-glasses', 'Glasses', 'round glasses'),
    option('tiny-bow', 'Bow', 'tiny bow'),
    option('sweater', 'Oversized sweater', 'oversized knitted sweater'),
    option('flower-tuft', 'Flowers', 'a small flower tuft'),
  ],
  palettes: [
    palette("blackberry", "Berry", ["blackberry purple", "warm cream", "honey gold"]),
    palette("apricot", "Peach", ["apricot", "moss green", "honey gold"]),
    palette("dusty-blue", "Sky", ["dusty blue", "cream", "copper"]),
    palette("cocoa", "Cocoa", ["warm ivory", "cocoa", "muted coral"]),
    palette("frost", "Frosty", ["lavender", "icy teal", "cream"]),
    palette("meadow", "Meadow", ["sage green", "butter yellow", "terracotta"]),
  ],
} as const satisfies Record<string, readonly CatalogOption[]>;
