import { describe, expect, test } from 'bun:test';
import { canonicalUrl, resourceId } from '../scripts/catalog-core';
import { topics, getTopic } from '../src/data/topics';
import { getCatalog } from '../src/lib/catalog';
import { getDictionary, isLocale, localeNames } from '../src/lib/i18n';
import { LOCALES, type Locale, type Localized } from '../src/lib/types';

const supportedLocales: Locale[] = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'de', 'fr', 'es', 'it', 'ru'];

function expectPopulatedTranslations(value: Localized) {
  expect(Object.keys(value).sort()).toEqual([...supportedLocales].sort());
  for (const locale of LOCALES) {
    expect(typeof value[locale]).toBe('string');
    expect(value[locale].trim().length).toBeGreaterThan(0);
    expect(value[locale]).not.toMatch(/^(?:TODO|TBD|undefined|null)$/i);
  }
}

describe('complete interface dictionaries', () => {
  test('supports the ten published locale routes and rejects unsupported ones', () => {
    expect([...LOCALES]).toEqual(supportedLocales);
    expect(Object.keys(localeNames).sort()).toEqual([...supportedLocales].sort());
    for (const locale of LOCALES) {
      expect(isLocale(locale)).toBe(true);
      expect(localeNames[locale].trim().length).toBeGreaterThan(0);
    }
    for (const invalid of ['', 'zh', 'zh-cn', 'pt', '../en']) expect(isLocale(invalid)).toBe(false);
  });

  for (const locale of LOCALES) {
    test(`${locale} has the full dictionary and usable navigation text`, () => {
      const dictionary = getDictionary(locale);
      const english = getDictionary('en');
      expect(Object.keys(dictionary).sort()).toEqual(Object.keys(english).sort());
      for (const value of Object.values(dictionary)) {
        expect(typeof value).toBe('string');
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value).not.toMatch(/^(?:TODO|TBD|undefined|null)$/i);
      }
      // These ordinary interface phrases should not silently fall back to English.
      if (locale !== 'en') {
        for (const key of ['searchLabel', 'noResults', 'resetFilters', 'savedLocal', 'followTopic'] as const) {
          expect(dictionary[key]).not.toBe(english[key]);
        }
      }
    });
  }
});

describe('authored topic integrity against the real snapshot', () => {
  const catalog = getCatalog();
  const byCanonicalUrl = new Map(catalog.resources.map(resource => [canonicalUrl(resource.url), resource]));

  test('contains the three published topics, with at least ten resources each', () => {
    expect(topics).toHaveLength(3);
    expect(topics.map(topic => topic.slug).sort()).toEqual([
      'engine-foundations', 'multiplayer-foundations', 'testing-observability',
    ]);
    expect(new Set(topics.map(topic => topic.slug)).size).toBe(topics.length);
    for (const topic of topics) expect(topic.entries.length).toBeGreaterThanOrEqual(10);
  });

  for (const topic of topics) {
    test(`${topic.slug} has complete notes and no missing or duplicate catalog entries`, () => {
      expectPopulatedTranslations(topic.title);
      expectPopulatedTranslations(topic.description);
      expectPopulatedTranslations(topic.audience);
      const seenIds = new Set<string>();
      for (const entry of topic.entries) {
        const canonical = canonicalUrl(entry.url);
        expect(canonical).toBeDefined();
        const resource = byCanonicalUrl.get(canonical);
        // Use the committed snapshot, not a fixture that mirrors the editorial list.
        expect(resource).toBeDefined();
        if (!canonical || !resource) throw new Error(`Missing topic resource in catalog: ${entry.url}`);
        expect(resource.id).toBe(resourceId(canonical));
        expect(seenIds.has(resource.id)).toBe(false);
        seenIds.add(resource.id);
        expectPopulatedTranslations(entry.summary);
        expectPopulatedTranslations(entry.reason);
        expectPopulatedTranslations(entry.limitation);
        expect(['tool', 'guide', 'reference', 'library', 'collection']).toContain(entry.kind);
        expect(['beginner', 'intermediate', 'advanced', 'all']).toContain(entry.level);
      }
      expect(seenIds.size).toBe(topic.entries.length);
      expect(getTopic(topic.slug)).toBe(topic);
    });
  }

  test('documentation anchors and GitHub repository casing resolve to catalog identities', () => {
    const anchored = topics.flatMap(topic => topic.entries).find(entry => new URL(entry.url).hash);
    expect(anchored).toBeDefined();
    const canonical = canonicalUrl(anchored!.url);
    expect(canonical).not.toContain('#');
    expect(byCanonicalUrl.has(canonical)).toBe(true);
    const mixedCaseGitHub = topics.flatMap(topic => topic.entries).find(entry => entry.url === 'https://github.com/ValveSoftware/GameNetworkingSockets');
    expect(mixedCaseGitHub).toBeDefined();
    expect(byCanonicalUrl.has(canonicalUrl(mixedCaseGitHub!.url))).toBe(true);
    expect(getTopic('missing-topic')).toBeUndefined();
  });
});
