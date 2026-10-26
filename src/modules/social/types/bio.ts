export interface BioLinkItem {
  id: string;
  label: string;
  url: string;
  clicks: number;
}

export interface BioPageItem {
  id: string;
  slug: string;
  title: string;
  headline: string | null;
  avatarUrl: string | null;
  theme: string;
  published: boolean;
  views: number;
  links: BioLinkItem[];
  createdAt: string;
}

export interface SaveBioLinkInput {
  /** Present when editing an existing link (preserves its click count). */
  id?: string;
  label: string;
  url: string;
}

export interface SaveBioPageInput {
  slug?: string;
  title: string;
  headline?: string | null;
  avatarUrl?: string | null;
  theme: string;
  published: boolean;
  links: SaveBioLinkInput[];
}

/** Shape rendered by the public /b/[slug] page. */
export interface PublicBioPage {
  title: string;
  headline: string | null;
  avatarUrl: string | null;
  theme: string;
  links: { id: string; label: string }[];
}
