// The default blocklist parseNamePack applies to a themed name (#442 P2). Pure: no storage, no network, never throws.
import { BLOCKED_RUNS, BLOCKED_WORDS, FOLD_SWAPS } from './loadout-blocklist-data.ts';

const BLOCKED_WORD_SET: ReadonlySet<string> = new Set(BLOCKED_WORDS);
const COMBINING_MARKS = /\p{M}/gu;
const NOT_A_LETTER = /[^a-z]+/g;
const SWAPPED = /[0134577@$]/g;

/** Lowercase, accents removed, number-for-letter swaps undone: "Hítler" and "n1gger" read as the words they imitate. */
export const fold = (name: string): string =>
  name.normalize('NFKD').replace(COMBINING_MARKS, '').toLowerCase().replace(SWAPPED, (char) => FOLD_SWAPS[char] ?? char);

const NOT_A_WORD_CHAR = /[^a-z'’-]+/;
const JOINERS = /['’-]/g;
const SPACES = /\s+/u;
/** Scripts with letters that look like Latin ones. A word drawing on two of these is a disguise, not a language. */
const LOOKALIKE_SCRIPTS: readonly RegExp[] = [
  /\p{Script=Latin}/u, /\p{Script=Cyrillic}/u, /\p{Script=Greek}/u, /\p{Script=Armenian}/u, /\p{Script=Cherokee}/u,
];

/** True when one space-separated word mixes letters from more than one script: "nаzi" with a Cyrillic а. A whole-word non-Latin name passes. */
const mixesScripts = (name: string): boolean =>
  name.split(SPACES).some((word) => LOOKALIKE_SCRIPTS.filter((script) => script.test(word)).length > 1);

/** True when the name mixes scripts in a word, holds a blocked word, or holds a blocked run once its separators are removed. */
export const isNameBlocked = (name: string): boolean => {
  if (mixesScripts(name)) return true;
  const folded = fold(name);
  if (folded.split(NOT_A_LETTER).some((word) => BLOCKED_WORD_SET.has(word))) return true;
  // "Fu-ck" and "Fu'ck" read as one word once the hyphen or apostrophe is gone.
  if (folded.split(NOT_A_WORD_CHAR).some((word) => BLOCKED_WORD_SET.has(word.replace(JOINERS, '')))) return true;
  const run = folded.replace(NOT_A_LETTER, '');
  return BLOCKED_RUNS.some((blocked) => run.includes(blocked));
};
