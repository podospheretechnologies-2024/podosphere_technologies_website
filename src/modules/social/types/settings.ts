import type { PostMedia } from './post';

export interface SignatureItem {
  id: string;
  content: string;
  /** Added to new posts automatically; at most one signature has it. */
  autoAdd: boolean;
  createdAt: string;
}

export interface TagItem {
  id: string;
  name: string;
  color: string;
}

export interface TemplateContent {
  integrationIds: string[];
  tagIds: string[];
  values: { content: string; media: PostMedia[] }[];
}

export interface TemplateItem {
  id: string;
  name: string;
  content: TemplateContent;
  createdAt: string;
}

export interface SaveSignatureInput {
  content: string;
  autoAdd: boolean;
}

export interface SaveTagInput {
  name: string;
  color: string;
}

export interface CreateTemplateInput {
  name: string;
  integrationIds: string[];
  tagIds: string[];
  values: { content: string; mediaIds: string[] }[];
}
