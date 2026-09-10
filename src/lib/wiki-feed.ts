import { getCatalog } from './catalog';
import { escapeXml } from './feed';
import { getWikiDictionary } from './wiki-i18n';
import { SITE_URL } from './seo';
import type { Locale } from './types';
import type { WikiSnapshot } from './wiki-types';

export function hasWikiTopic(topic: string): boolean {
  const wiki = getCatalog().wiki;
  return !!wiki && (wiki.documents.some(doc => doc.topics.includes(topic)) || wiki.changes.some(change => change.topics.includes(topic)));
}

export function renderWikiFeed(locale: Locale, topic?: string, wiki: WikiSnapshot | undefined = getCatalog().wiki) {
  const w = getWikiDictionary(locale);
  const params = new URLSearchParams({scope:'wiki'});
  if (topic) params.set('topic', topic);
  const changes = (wiki?.changes || []).filter(change => !topic || change.topics.includes(topic)).slice(0, 100);
  const labels = {added:w.added, updated:w.updated, removed:w.removed};
  const currentIds = new Set(wiki?.documents.map(doc => doc.id) || []);
  const items = changes.map(change => {
    const url = change.type === 'removed' || !currentIds.has(change.documentId) ? change.sourceUrl : `${SITE_URL}/${locale}/wiki/${change.documentId}`;
    return `<item><title>${escapeXml(`${labels[change.type]}: ${change.title}`)}</title><link>${escapeXml(url)}</link><guid isPermaLink="false">${escapeXml(`wiki:${change.documentId}:${change.date}:${change.type}`)}</guid><pubDate>${new Date(change.date).toUTCString()}</pubDate><description>${escapeXml(`${labels[change.type]} — ${change.title}`)}</description></item>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeXml(`${w.wikiUpdates}${topic ? ` · ${topic}` : ''}`)}</title><link>${escapeXml(`${SITE_URL}/${locale}/updates?${params}`)}</link><description>${escapeXml(w.wikiChangesHelp)}</description><language>${locale}</language>${wiki ? `<lastBuildDate>${new Date(wiki.syncedAt).toUTCString()}</lastBuildDate>` : ''}<atom:link href="${escapeXml(`${SITE_URL}/${locale}/feed.xml?${params}`)}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
}
