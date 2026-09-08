import { topics } from '@/data/topics';
import type { EditorialEntry, Locale, Resource } from './types';
export function resourceKey(url: string) { const parsed = new URL(url); parsed.hash = ''; return parsed.toString().replace(/\/$/, '').toLowerCase(); }
const editorialByUrl = new Map(topics.flatMap(topic => topic.entries).map(entry => [resourceKey(entry.url),entry]));
export function getEditorial(url: string): EditorialEntry | undefined { return editorialByUrl.get(resourceKey(url)); }
export function summaryInfo(resource: Resource, locale: Locale) {
  const editorial=getEditorial(resource.url);
  if(editorial) return {text:editorial.summary[locale],provenance:'editorial' as const,language:locale};
  if(resource.summaries?.[locale]) return {text:resource.summaries[locale],provenance:'upstream' as const,language:locale};
  if(resource.summaries?.en) return {text:resource.summaries.en,provenance:'upstream' as const,language:'en'};
  return {text:resource.description||resource.title,provenance:'original' as const,language:undefined};
}
export function resourceDescription(resource:Resource,locale:Locale){return summaryInfo(resource,locale).text;}
