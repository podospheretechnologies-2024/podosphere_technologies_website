/**
 * PS-14: only comments that ask for something get a reply SLA. Emoji-only or very short reactions
 * ("🔥", "nice", "❤️❤️") still land in the inbox but do not start an SLA clock. DMs always do.
 */
export function commentNeedsReply(text: string): boolean {
  const words = text
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0f\p{P}\p{S}]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return false;
  if (text.includes('?')) return true;
  return words.length >= 3 || words.join(' ').length >= 12;
}
