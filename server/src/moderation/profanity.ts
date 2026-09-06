/**
 * Production-Grade Server-Side Profanity Moderation Engine
 * 
 * Implements a multi-stage defense-in-depth normalization pipeline:
 *  1. Unicode Normalization (NFKD) to decompose accents and mathematical glyphs.
 *  2. Stripping invisible/zero-width formatting characters.
 *  3. Character substitution / Leetspeak translation (@ -> a, $ -> s, etc.).
 *  4. Delimiter and inter-character spacing collapse (f.u.c.k, f u c k -> fuck).
 *  5. Repeated character compression (fuuuuck -> fuck).
 *  6. Contextual token matching & boundary-aware substring evaluation.
 */

// Curated prohibited core stems & high-severity words
const PROHIBITED_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'whore',
  'slut',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'motherfucker',
  'dumbass',
  'bullshit',
  'dipshit',
  'jackass',
  'twat',
  'wanker',
  'blowjob'
];

// Leetspeak and symbol substitutions mapping
const LEET_MAP: Record<string, string> = {
  '@': 'a',
  '4': 'a',
  '/\\': 'a',
  '^': 'a',
  '8': 'b',
  '6': 'b',
  '(': 'c',
  '<': 'c',
  '{': 'c',
  '[': 'c',
  '3': 'e',
  '€': 'e',
  '9': 'g',
  '#': 'h',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '0': 'o',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
  'v': 'u',
  '\\/': 'u',
  '%': 'x',
  '2': 'z'
};

// Zero-width and hidden unicode characters to strip
const INVISIBLE_REGEX = /[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]/g;

export interface ModerationResult {
  isClean: boolean;
  flaggedWords: string[];
  reason?: string;
  normalizedSample?: string;
}

/**
 * Normalizes input text through successive anti-evasion stages
 */
export function normalizeText(rawText: string): {
  normalizedTokens: string[];
  collapsedText: string;
  phoneticText: string;
} {
  // 1. Unicode decomposition (decompose bold, italics, accents: e.g., 𝐟𝐮𝐜𝐤 -> fuck)
  let text = rawText.normalize('NFKD');

  // 2. Strip invisible formatting characters (zero-width spaces, soft hyphens)
  text = text.replace(INVISIBLE_REGEX, '');

  // 3. Lowercase
  text = text.toLowerCase();

  // 4. Translate known multi-char leet (e.g. "ph" -> "f", "/\" -> "a", "\/" -> "u")
  text = text.replace(/ph/g, 'f');
  text = text.replace(/\/\\/g, 'a');
  text = text.replace(/\\\//g, 'u');

  // 5. Single-character leetspeak substitution
  let translated = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    translated += LEET_MAP[char] || char;
  }

  // 6. Tokenize words with punctuation stripped
  const tokenList = translated
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);

  // 7. Deduplicate 3+ consecutive repeated characters (e.g. "fuuuuuck" -> "fuck", "shiiiit" -> "shit", while preserving legitimate double letters like "asshole")
  const compressRepeats = (str: string) => str.replace(/(.)\1{2,}/g, '$1');
  
  const normalizedTokens = tokenList.map(compressRepeats);

  // 8. Delimiter collapse: collapses words spaced out with spaces, dots, dashes, underscores
  // e.g. "f u c k" -> "fuck", "f.u.c.k" -> "fuck", "f-u-c-k" -> "fuck"
  const collapsedText = compressRepeats(
    translated.replace(/[\s\.\-_,\*\+~`'"|/\\^!#@%]+/g, '')
  );

  return {
    normalizedTokens,
    collapsedText,
    phoneticText: translated
  };
}

/**
 * Evaluates whether text contains prohibited profanity or evade attempts
 */
export function checkProfanity(rawText: string): ModerationResult {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return { isClean: true, flaggedWords: [] };
  }

  const { normalizedTokens, collapsedText } = normalizeText(rawText);
  const flagged = new Set<string>();

  // Check 1: Direct token match on compressed words
  for (const token of normalizedTokens) {
    for (const badWord of PROHIBITED_WORDS) {
      if (token === badWord) {
        flagged.add(badWord);
      }
    }
  }

  // Check 2: Substring matches on individual tokens for compound curse words (e.g. "motherfucker", "asshole")
  for (const token of normalizedTokens) {
    for (const badWord of PROHIBITED_WORDS) {
      if (badWord.length >= 4 && token.includes(badWord)) {
        // Safe check for common innocent substrings (Scunthorpe problem prevention)
        const safeWhitelists: Record<string, string[]> = {
          dick: ['dickens', 'benedict'],
          ass: ['classic', 'glass', 'grass', 'mass', 'pass', 'bass', 'compass', 'asset', 'assist', 'assign', 'associate', 'assume'],
          tit: ['title', 'entity', 'quantity', 'attitude', 'appetite', 'constitute', 'substitute'],
          cock: ['cocktail', 'peacock', 'cockpit', 'shuttlecock'],
          twat: []
        };

        const whitelist = safeWhitelists[badWord];
        const isWhitelisted = whitelist && whitelist.some(safe => token.includes(safe));
        if (!isWhitelisted) {
          flagged.add(badWord);
        }
      }
    }
  }

  // Check 3: Delimiter-collapsed text check (for "f u c k", "s h i t", "b.i.t.c.h")
  for (const badWord of PROHIBITED_WORDS) {
    if (collapsedText.includes(badWord)) {
      flagged.add(badWord);
    }
  }

  if (flagged.size > 0) {
    const words = Array.from(flagged);
    return {
      isClean: false,
      flaggedWords: words,
      reason: `Message blocked: prohibited language detected (${words.join(', ')}).`,
      normalizedSample: collapsedText
    };
  }

  return {
    isClean: true,
    flaggedWords: []
  };
}
