export interface AiStatus {
  configured: boolean;
  /** Image generation (OpenAI) is set up; text AI (Claude) can work without it. */
  imageConfigured: boolean;
}

export interface AiPostSource {
  url: string;
  title: string | null;
}

export interface AiPostVariations {
  /** Each variation is a thread: the first item is the post, the rest are comments. */
  variations: string[][];
  source: AiPostSource | null;
}

export interface AiThread {
  posts: string[];
}
