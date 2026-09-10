import { getCatalog } from './catalog';
import { topics } from '@/data/topics';
import { LOCALES, type Locale } from './types';
import { SITE_URL } from './seo';

const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]!));
const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
const pageSize = 20_000;

export function sitemapEntries(locale: Locale) {
  const catalog = getCatalog();
  const paths = ['', '/wiki', '/topics', '/updates', '/about', ...topics.map(topic => `/topics/${topic.slug}`)];
  return [
    ...paths.map(path => ({url:`${SITE_URL}/${locale}${path}`, modified:catalog.syncedAt})),
    ...catalog.resources.map(resource => ({url:`${SITE_URL}/${locale}/resources/${resource.id}`, modified:resource.contentChangedAt})),
    ...(catalog.wiki?.documents || []).map(doc => ({url:`${SITE_URL}/${locale}/wiki/${doc.id}`, modified:doc.contentChangedAt})),
  ];
}

export function sitemapFiles() {
  const pages = Math.max(1, Math.ceil(sitemapEntries('en').length / pageSize));
  return LOCALES.flatMap(locale => Array.from({length:pages}, (_, page) => `${locale}-${page + 1}.xml`));
}

export function renderSitemapIndex() {
  return `${xmlHeader}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemapFiles().map(file => `<sitemap><loc>${escapeXml(`${SITE_URL}/sitemaps/${file}`)}</loc></sitemap>`).join('')}</sitemapindex>`;
}

export function renderSitemap(file: string): string | undefined {
  if (!sitemapFiles().includes(file)) return;
  const match = /^(.*)-(\d+)\.xml$/.exec(file)!;
  const entries = sitemapEntries(match[1] as Locale).slice((Number(match[2]) - 1) * pageSize, Number(match[2]) * pageSize);
  return `${xmlHeader}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(entry => `<url><loc>${escapeXml(entry.url)}</loc><lastmod>${escapeXml(entry.modified)}</lastmod></url>`).join('')}</urlset>`;
}
