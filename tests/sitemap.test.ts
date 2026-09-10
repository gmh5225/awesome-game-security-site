import { describe, expect, test } from 'bun:test';
import { getCatalog } from '../src/lib/catalog';
import { LOCALES } from '../src/lib/types';
import { renderSitemap, renderSitemapIndex, sitemapEntries, sitemapFiles } from '../src/lib/sitemap';

describe('Complete paginated sitemaps', () => {
  test('the existing sitemap URL becomes an index of bounded locale files', () => {
    const files = sitemapFiles();
    expect(files.length).toBeGreaterThanOrEqual(LOCALES.length);
    const index = renderSitemapIndex();
    for (const file of files) {
      expect(index).toContain(`/sitemaps/${file}</loc>`);
      expect((renderSitemap(file)!.match(/<url>/g) || []).length).toBeLessThanOrEqual(20_000);
    }
    expect(renderSitemap('xx-1.xml')).toBeUndefined();
    expect(renderSitemap('en-999999.xml')).toBeUndefined();
  });
  test('resources and wiki are both discoverable without saved/search URLs', () => {
    const urls = sitemapEntries('zh-CN').map(entry => entry.url);
    const unique = new Set(urls);
    expect(unique.size).toBe(urls.length);
    expect(urls.some(url => url.endsWith('/zh-CN/wiki'))).toBe(true);
    for (const doc of getCatalog().wiki?.documents || []) expect(unique.has(`${new URL(urls[0]).origin}/zh-CN/wiki/${doc.id}`)).toBe(true);
    expect(urls.some(url => url.includes('/saved') || url.includes('?'))).toBe(false);
  });
});
