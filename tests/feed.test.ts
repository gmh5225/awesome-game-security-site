import {describe,test,expect} from 'bun:test';
import {renderFeed,escapeXml} from '../src/lib/feed';
import {LOCALES} from '../src/lib/types';
import {getCatalog} from '../src/lib/catalog';
import {topics} from '../src/data/topics';
describe('Public update feeds',()=>{
  test('escape text without creating markup',()=>expect(escapeXml('<tag a="x">&\'')).toBe('&lt;tag a=&quot;x&quot;&gt;&amp;&apos;'));
  for(const locale of LOCALES)test(`localized feed ${locale} describes real changes only`,()=>{const xml=renderFeed(locale);expect(xml).toContain(`<language>${locale}</language>`);expect(xml).toContain('application/rss+xml');expect((xml.match(/<item>/g)||[]).length).toBe(Math.min(getCatalog().changes.length,100));});
  test('topic feed uses correct self URL',()=>{const topic=topics[0];expect(renderFeed('en',topic.slug)).toContain(`?topic=${topic.slug}`);expect(renderFeed('en',topic.slug)).toContain(escapeXml(topic.title.en));});
});
