import { describe, expect, it } from 'vitest';
import { commentNeedsReply } from './inbox-sla';

describe('commentNeedsReply', () => {
  it('skips emoji-only and very short reactions', () => {
    for (const text of ['🔥', '❤️❤️', 'nice', 'All the best 🧡'.slice(0, 4), '👍🏽', '!!!', 'wow 😍']) {
      expect(commentNeedsReply(text)).toBe(false);
    }
  });

  it('keeps questions and real messages', () => {
    for (const text of ['price?', 'Is this available in size M', 'What is the price of this', 'Please call me back today']) {
      expect(commentNeedsReply(text)).toBe(true);
    }
  });
});
