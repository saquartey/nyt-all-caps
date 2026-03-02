/**
 * Determines if a headline is "ALL CAPS."
 *
 * Rules:
 * 1. Strip out non-letters (numbers, punctuation, spaces are neutral).
 * 2. Need at least 10 letters — filters out short abbreviations like "FBI" or "U.S."
 * 3. At least 90% of letters must be uppercase — allows for edge cases
 *    like possessives ("TRUMP's") where one letter is lowercase.
 */
export function isAllCaps(headline: string): boolean {
  // Get only the alphabetic characters
  const letters = headline.replace(/[^a-zA-Z]/g, "");

  // Too short = probably an abbreviation, not an editorial choice
  if (letters.length < 10) {
    return false;
  }

  // Count uppercase letters and calculate the ratio
  const uppercaseCount = letters.replace(/[^A-Z]/g, "").length;
  const ratio = uppercaseCount / letters.length;

  return ratio >= 0.9;
}
