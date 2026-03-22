export type HelpArticle = {
  id: string;
  title: string;
  summary: string;
  category: HelpCategory;
  audience: HelpAudience[];
  keywords: string[];
  prerequisites?: string[];
  steps: HelpStep[];
  tips?: string[];
  relatedArticles?: string[];
  featureFlag?: string;
};

export type HelpStep = {
  title: string;
  description: string;
};

export type HelpCategory =
  | 'getting-started'
  | 'classes-scheduling'
  | 'members'
  | 'payments'
  | 'waivers'
  | 'collective-mode'
  | 'events-retreats'
  | 'settings'
  | 'messaging'
  | 'analytics'
  | 'member-guide';

export type HelpAudience = 'owner' | 'manager' | 'instructor' | 'member';

export type HelpCategoryInfo = {
  id: HelpCategory;
  title: string;
  description: string;
  icon: string;
  audiences: HelpAudience[];
  order: number;
};
