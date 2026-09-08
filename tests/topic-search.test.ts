import { describe, expect, test } from 'bun:test';
import { topics } from '../src/data/topics';
import { searchTopics } from '../src/lib/topic-search';
import { LOCALES } from '../src/lib/types';

describe('localized topic discovery', () => {
  for (const locale of LOCALES) {
    test(`${locale} finds each of the three exact translated titles`, () => {
      for (const topic of topics) {
        const results = searchTopics(topic.title[locale], locale);
        expect(results.map(result => result.slug)).toEqual([topic.slug]);
        expect(results[0]).toBe(topic);
      }
    });

    test(`${locale} also supports English titles without duplicate results`, () => {
      for (const topic of topics) {
        expect(searchTopics(topic.title.en, locale).map(result => result.slug)).toEqual([topic.slug]);
      }
    });
  }

  test('matches description and audience words together, requiring every term', () => {
    expect(searchTopics('UI checks', 'en').map(topic => topic.slug)).toEqual(['testing-observability']);
    expect(searchTopics('network engineers', 'en').map(topic => topic.slug)).toEqual(['multiplayer-foundations']);
    expect(searchTopics('CPU engineers', 'en').map(topic => topic.slug)).toEqual(['testing-observability']);
    expect(searchTopics('CPU replication', 'en')).toEqual([]);
    expect(searchTopics('engine nonexistentword', 'en')).toEqual([]);
  });

  test('matches CJK fragments and mixed-language terms', () => {
    expect(searchTopics('测试', 'zh-CN').map(topic => topic.slug)).toEqual(['testing-observability']);
    expect(searchTopics('效能觀測', 'zh-TW').map(topic => topic.slug)).toEqual(['testing-observability']);
    expect(searchTopics('性能計測', 'ja').map(topic => topic.slug)).toEqual(['testing-observability']);
    expect(searchTopics('성능', 'ko').map(topic => topic.slug)).toEqual(['testing-observability']);
    expect(searchTopics('CPU 测试', 'zh-CN').map(topic => topic.slug)).toEqual(['testing-observability']);
    expect(searchTopics('测试 replication', 'zh-CN')).toEqual([]);
  });

  test('requires complete Latin words rather than arbitrary substrings', () => {
    expect(searchTopics('multiplayer', 'en').map(topic => topic.slug)).toEqual(['multiplayer-foundations']);
    expect(searchTopics('player', 'en')).toEqual([]);
    expect(searchTopics('network', 'en').map(topic => topic.slug)).toEqual(['multiplayer-foundations']);
    expect(searchTopics('net', 'en')).toEqual([]);
    expect(searchTopics('measure', 'en').map(topic => topic.slug)).toEqual(['testing-observability']);
    expect(searchTopics('meas', 'en')).toEqual([]);
    expect(searchTopics('unity', 'en')).toEqual([]);
  });

  test('normalizes case, Latin accents, Unicode width, and redundant terms', () => {
    expect(searchTopics('  CPU   cpu  ', 'en').map(topic => topic.slug)).toEqual(['testing-observability']);
    expect(searchTopics('ＣＰＵ', 'en').map(topic => topic.slug)).toEqual(['testing-observability']);
    expect(searchTopics('ingenieurs reseau', 'fr').map(topic => topic.slug)).toEqual(['multiplayer-foundations']);
    expect(searchTopics('ТЕСТИРОВАНИЕ', 'ru').map(topic => topic.slug)).toEqual(['testing-observability']);
  });

  test('empty searches return every topic in editorial order without exposing the source array', () => {
    for (const query of ['', '   ', '?!']) {
      const result = searchTopics(query, 'en');
      expect(result).toEqual(topics);
      expect(result).not.toBe(topics);
    }
  });

  test('never mutates source topics and does not duplicate bilingual matches', () => {
    const before = JSON.stringify(topics);
    const first = searchTopics('engine', 'en');
    first.reverse();
    const second = searchTopics('engine', 'en');
    expect(new Set(second.map(topic => topic.slug)).size).toBe(second.length);
    const bilingual = searchTopics('engine 引擎', 'zh-CN');
    expect(bilingual.map(topic => topic.slug)).toEqual(['engine-foundations']);
    expect(new Set(bilingual.map(topic => topic.slug)).size).toBe(bilingual.length);
    expect(JSON.stringify(topics)).toBe(before);
  });
});
