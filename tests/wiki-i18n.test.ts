import { describe, expect, test } from 'bun:test';
import { LOCALES } from '../src/lib/types';
import { getWikiDictionary } from '../src/lib/wiki-i18n';

describe('Wiki interface dictionaries', () => {
  test('all ten locales provide the same complete nonempty contract', () => {
    const keys = Object.keys(getWikiDictionary('en')).sort();
    expect(LOCALES).toHaveLength(10);
    for (const locale of LOCALES) {
      const dictionary = getWikiDictionary(locale);
      expect(Object.keys(dictionary).sort()).toEqual(keys);
      for (const value of Object.values(dictionary)) expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  test('source provenance and local-state notices are translated in every non-English locale', () => {
    const keys = ['noTranslation', 'indexOnly', 'confidenceNote', 'upstreamDateNote', 'indexBaseline', 'localNote', 'storageUnavailable', 'searchScopeNote', 'wikiChangesHelp', 'removedSaved'] as const;
    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      for (const key of keys) expect(getWikiDictionary(locale)[key]).not.toBe(getWikiDictionary('en')[key]);
    }
    expect(getWikiDictionary('en').upstreamUpdated).toBe('Update date declared by source');
    expect(getWikiDictionary('zh-CN').sourceEvidence).toBe('引用依据');
  });

  test('terminology aliases resolve within the selected locale', () => {
    for (const locale of LOCALES) {
      const d = getWikiDictionary(locale);
      expect(d.firstIndexed).toBe(d.firstObserved);
      expect(d.sourceOnlyNote).toBe(d.indexOnly);
      expect(d.saveFailed).toBe(d.storageUnavailable);
      expect(d.sourceAmbiguous).toBe(d.ambiguous);
      expect(d.backToWiki).toBe(d.backToKnowledge);
    }
  });
});
