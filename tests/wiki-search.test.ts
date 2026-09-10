import { describe, expect, test } from 'bun:test';
import { paginateWiki, searchWikiDocuments, type WikiListDocument } from '../src/lib/wiki-search';
import { getWikiDictionary } from '../src/lib/wiki-i18n';
import { LOCALES } from '../src/lib/types';

const document = (id: string, title: string, kind: WikiListDocument['kind'], topics: string[], date = '2026-09-01T00:00:00Z'): WikiListDocument => ({
  id, title, kind, topics, language: 'en', firstSeenAt: date, contentChangedAt: date,
});
const docs = [
  document('godot', 'Godot', 'entity', ['game-engine']),
  document('unity', 'Unity', 'entity', ['game-engine'], '2026-09-03T00:00:00Z'),
  document('community', 'Community Guidelines', 'concept', ['documentation']),
  document('engine', '游戏引擎 Game Engine', 'overview', ['game-engine']),
  document('rigor', 'Research Rigor', 'concept', ['research-methods']),
  document('french', 'Qualité', 'concept', ['documentation']),
];

describe('passive Wiki metadata search', () => {
  test('requires whole Latin words while matching CJK without spaces', () => {
    expect(searchWikiDocuments(docs, { q: 'unity' }).map(item => item.id)).toEqual(['unity']);
    expect(searchWikiDocuments(docs, { q: '引擎' }).map(item => item.id)).toEqual(['engine', 'godot', 'unity']);
    expect(searchWikiDocuments(docs, { q: 'qualite' }).map(item => item.id)).toEqual(['french']);
  });
  test('combines all terms and exact type/topic filters', () => {
    expect(searchWikiDocuments(docs, { q: 'godot engine' }).map(item => item.id)).toEqual(['godot']);
    expect(searchWikiDocuments(docs, { q: 'godot documentation' })).toHaveLength(0);
    expect(searchWikiDocuments(docs, { kind: 'entity', topic: 'game-engine' }).map(item => item.id)).toEqual(['godot', 'unity']);
    expect(searchWikiDocuments(docs, { kind: 'sources' })).toHaveLength(0);
    expect(searchWikiDocuments(docs, { q: '概念', topic: 'research-methods' }).map(item => item.id)).toEqual(['rigor']);
  });
  test('sorts recent by index change and never mutates input', () => {
    const original = JSON.stringify(docs);
    expect(searchWikiDocuments(docs, { sort: 'recent' })[0].id).toBe('unity');
    const all = searchWikiDocuments(docs, { q: '  ' });
    expect(all).toHaveLength(docs.length);
    expect(new Set(all.map(item => item.id)).size).toBe(docs.length);
    expect(JSON.stringify(docs)).toBe(original);
    expect(all).not.toBe(docs);
  });
  test('all visible localized type labels are searchable', () => {
    for (const locale of LOCALES) {
      const d = getWikiDictionary(locale);
      for (const [label, kind] of [[d.overviews, 'overview'], [d.concepts, 'concept'], [d.entities, 'entity']]) {
        const found = searchWikiDocuments(docs, { q: label });
        expect(found.length).toBeGreaterThan(0);
        expect(found.some(document => document.kind === kind)).toBe(true);
      }
    }
  });
});

describe('bounded Wiki pagination', () => {
  test('clamps invalid or out-of-range URL pages and retains every item', () => {
    for (const invalid of ['-1', '1.5', 'NaN', 'Infinity', '0']) expect(paginateWiki(docs, invalid, 2).page).toBe(1);
    expect(paginateWiki(docs, '999', 2).page).toBe(3);
    const pages = [1, 2, 3].flatMap(page => paginateWiki(docs, page, 2).items);
    expect(pages).toEqual(docs);
    expect(paginateWiki([], '99', 2)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
  });
});
