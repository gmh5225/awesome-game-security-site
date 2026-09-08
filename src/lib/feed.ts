import { getCatalog } from './catalog';
import { getTopic } from '@/data/topics';
import { topicResources } from './content';
import { getDictionary } from './i18n';
import { SITE_URL } from './seo';
import type { Locale } from './types';
export const escapeXml=(value:string)=>value.replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]!));
export function renderFeed(locale:Locale,slug?:string) {
  const d=getDictionary(locale);const catalog=getCatalog();const topic=slug?getTopic(slug):undefined;
  const ids=topic?new Set(topicResources(topic.slug,locale).map(resource=>resource.id)):undefined;
  const changes=catalog.changes.filter(change=>!ids||ids.has(change.resourceId)).slice(0,100);
  const labels={added:d.added,updated:d.updated,removed:d.removed};
  const feedUrl=`${SITE_URL}/${locale}/feed.xml${topic?`?topic=${encodeURIComponent(topic.slug)}`:''}`;
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeXml(topic?topic.title[locale]:`${d.siteName} · ${d.updates}`)}</title><link>${escapeXml(`${SITE_URL}/${locale}/${topic?`topics/${topic.slug}`:'updates'}`)}</link><description>${escapeXml(d.freshnessHelp)}</description><language>${locale}</language><lastBuildDate>${new Date(catalog.syncedAt).toUTCString()}</lastBuildDate><atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>${changes.map(change=>`<item><title>${escapeXml(`${labels[change.type]}: ${change.title}`)}</title><link>${escapeXml(change.type==='removed'?change.url:`${SITE_URL}/${locale}/resources/${change.resourceId}`)}</link><guid isPermaLink="false">${escapeXml(`${change.resourceId}:${change.date}:${change.type}`)}</guid><pubDate>${new Date(change.date).toUTCString()}</pubDate><description>${escapeXml(`${labels[change.type]} — ${change.title}`)}</description></item>`).join('')}</channel></rss>`;
}
