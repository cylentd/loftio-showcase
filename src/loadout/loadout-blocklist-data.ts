// Data for the default name blocklist (#442 P2). Lists only; the matching rules are in loadout-blocklist-model.ts.
// Source: a starter list written for this build (conductor, 2026-11-19) from common slur and profanity lists plus the
// best-known children's-media brands. It is not exhaustive and never claims to be: extend it by editing these arrays.
// Every entry is lowercase letters only; matching folds case, accents and number-for-letter swaps before it compares.

/** Whole words: a name is blocked when any of its words, after folding, equals one of these. A word that merely contains one passes (Scunthorpe, Classic, Cocktail). */
export const BLOCKED_WORDS: readonly string[] = [
  // Hate and violence
  'nazi', 'nazis', 'hitler', 'kkk', 'swastika', 'nigger', 'nigga', 'faggot', 'fag', 'kike', 'spic', 'chink', 'tranny', 'retard', 'rape', 'rapist',
  // Profanity and sexual terms
  'fuck', 'fucker', 'fucking', 'shit', 'bitch', 'cunt', 'whore', 'slut', 'cock', 'pussy', 'dildo', 'porn',
  // Brand characters whose names are ordinary words or short enough to clash with them
  'mario', 'luigi', 'zelda', 'sonic', 'elmo', 'shrek', 'barbie', 'batman', 'superman', 'naruto', 'goku',
];

/** Strings checked against the whole name with spaces, hyphens and apostrophes removed, so "Pika chu" and "Hello-Kitty" are caught. Long and distinctive only. */
export const BLOCKED_RUNS: readonly string[] = [
  'nigger', 'nigga', 'faggot', 'hitler',
  'pikachu', 'pokemon', 'mickeymouse', 'hellokitty', 'nintendo', 'disney', 'spongebob', 'minecraft', 'fortnite', 'roblox',
];

/** Number and symbol swaps folded to letters before matching, so "n1gger" and "Mari0" are the words they imitate. */
export const FOLD_SWAPS: Readonly<Record<string, string>> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's',
};
