import { describe, expect, test } from 'bun:test';
import { renderWikiFeed } from '../src/lib/wiki-feed';
import type { WikiSnapshot } from '../src/lib/wiki-types';
import { LOCALES } from '../src/lib/types';

const snapshot: WikiSnapshot = {version:1,sourceCommit:'a'.repeat(40),syncedAt:'2026-09-11T00:00:00Z',baselineAt:'2026-09-11T00:00:00Z',indexPath:'wiki/index.md',indexBlobSha:'b'.repeat(40),sourceFileCount:0,documents:[],references:[],changes:[]};

describe('Wiki update feeds', () => {
  for (const locale of LOCALES) test(`${locale} baseline contains no invented publications`, () => {
    const xml = renderWikiFeed(locale, undefined, snapshot);
    expect(xml).not.toContain('<item>');
    expect(xml).toContain(`<language>${locale}</language>`);
    expect(xml).toContain('/feed.xml?scope=wiki');
  });
  test('topic filtering preserves removed entries and points at their recorded source', () => {
    const changes: WikiSnapshot['changes'] = [
      {documentId:'x',title:'A & <B>',path:'wiki/entities/a.md',sourceUrl:'https://example.com/old?a=1&b=2',topics:['game-engine'],type:'removed',date:'2026-09-12T00:00:00Z'},
      {documentId:'y',title:'Other',path:'wiki/entities/b.md',sourceUrl:'https://example.com/b',topics:['graphics'],type:'added',date:'2026-09-12T00:00:00Z'},
    ];
    const xml = renderWikiFeed('en', 'game-engine', {...snapshot,changes});
    expect((xml.match(/<item>/g)||[]).length).toBe(1);
    expect(xml).toContain('A &amp; &lt;B&gt;');
    expect(xml).toContain('https://example.com/old?a=1&amp;b=2');
    expect(xml).toContain('scope=wiki&amp;topic=game-engine');
    expect(xml).not.toContain('/wiki/x</link>');
  });
  test('older added events also use pinned sources once their document is gone', () => {
    const xml = renderWikiFeed('en', undefined, {...snapshot, changes:[{documentId:'gone',title:'Old entry',path:'wiki/entities/old.md',sourceUrl:'https://example.com/pinned-old',topics:[],type:'added',date:'2026-09-11T00:00:00Z'}]});
    expect(xml).toContain('<link>https://example.com/pinned-old</link>');
    expect(xml).not.toContain('/wiki/gone');
  });
});
