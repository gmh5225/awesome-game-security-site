import { getCatalog } from './catalog';
import { topics } from '@/data/topics';
import type { Locale, Resource } from './types';
import { getEditorial, resourceKey } from './editorial';
export { getEditorial, resourceDescription } from './editorial';
export function getDisplayResources(locale: Locale): Resource[] {
  return getCatalog().resources.map(resource => {
    const editorial = getEditorial(resource.url);
    return { ...resource, kind: editorial?.kind || resource.kind, level: editorial?.level || resource.level,
      summaries: { [locale]: editorial?.summary[locale] || resource.summaries?.[locale], en: editorial?.summary.en || resource.summaries?.en },
    };
  });
}
export function topicResources(slug: string, locale: Locale) {
  const topic = topics.find(item => item.slug === slug);
  const resources = getDisplayResources(locale);
  return topic?.entries.flatMap(entry => {
    const resource = resources.find(item => resourceKey(item.url) === resourceKey(entry.url));
    return resource ? [resource] : [];
  }) || [];
}
