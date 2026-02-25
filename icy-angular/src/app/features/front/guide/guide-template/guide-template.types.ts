export type GuideBadgeTone = 'live' | 'writing' | 'soon' | 'alert';

export interface GuideStatusBadge {
  label: string;
  tone: GuideBadgeTone;
}

export interface GuideGlossaryItem {
  term: string;
  definition: string;
}

export interface GuideCallout {
  title: string;
  text: string;
  tone: GuideBadgeTone;
}

export interface GuideParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface GuideListBlock {
  type: 'list';
  items: string[];
}

export interface GuideCalloutBlock {
  type: 'callout';
  callout: GuideCallout;
}

export interface GuideImageBlock {
  type: 'image';
  imageUrl: string;
  alt?: string;
}

export type GuideContentBlock =
  | GuideParagraphBlock
  | GuideListBlock
  | GuideCalloutBlock
  | GuideImageBlock;

export interface GuideSubsection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  callouts?: GuideCallout[];
  blocks?: GuideContentBlock[];
}

export interface GuideSection {
  id: string;
  title: string;
  summary?: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: GuideSubsection[];
  callout?: GuideCallout;
  callouts?: GuideCallout[];
  blocks?: GuideContentBlock[];
  imageUrl?: string;
}

export interface GuideDocument {
  slug: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  readTime: string;
  difficulty: string;
  status: GuideStatusBadge;
  tags: string[];
  glossary?: GuideGlossaryItem[];
  sections: GuideSection[];
}
