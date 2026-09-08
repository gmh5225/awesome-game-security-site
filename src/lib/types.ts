export const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'de', 'fr', 'es', 'it', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export type Localized = Record<Locale, string>;
export type ResourceKind = 'tool' | 'guide' | 'reference' | 'library' | 'collection';
export type ResourceLevel = 'beginner' | 'intermediate' | 'advanced' | 'all';
export interface Resource {
  id: string;
  title: string;
  url: string;
  sourceUrl?: string;
  description: string;
  summaries?: Partial<Record<Locale, string>>;
  categories: string[];
  tags: string[];
  kind: ResourceKind;
  platforms: string[];
  engines: string[];
  level: ResourceLevel;
  firstSeenAt: string;
  contentChangedAt: string;
  upstreamUpdatedAt?: string;
  metadataCheckedAt?: string;
  metadataVerifiedAt?: string;
  metadataStatus?: 'ok' | 'unavailable' | 'restricted' | 'unknown';
  lastCheckedAt?: string;
  linkStatus: 'unknown' | 'ok' | 'unavailable' | 'restricted';
  maintenance: 'unknown' | 'active' | 'archived';
}
export interface CatalogChange {
  resourceId: string;
  title: string;
  url: string;
  type: 'added' | 'updated' | 'removed';
  date: string;
}
export interface Catalog {
  version: number;
  sourceCommit: string;
  syncedAt: string;
  baselineAt: string;
  resources: Resource[];
  changes: CatalogChange[];
  sourceEntryCount: number;
}
export interface EditorialEntry {
  url: string;
  summary: Localized;
  reason: Localized;
  limitation: Localized;
  level: ResourceLevel;
  kind: ResourceKind;
}
export interface Topic {
  slug: string;
  title: Localized;
  description: Localized;
  audience: Localized;
  entries: EditorialEntry[];
}
