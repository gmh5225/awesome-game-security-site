import { topics } from '@/data/topics';
import type { Locale, Topic } from './types';

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const fold = (value: string) => value.normalize('NFD')
  .replace(/(\p{Script=Latin})\p{M}+/gu, '$1')
  .normalize('NFKC').toLocaleLowerCase('en');
const words = (value: string) => value.match(/[\p{L}\p{N}]+/gu) || [];

function matches(term: string, text: string, tokens: Set<string>): boolean {
  // Unspaced CJK phrases can occur within longer text. Other scripts require
  // complete words, so "unity" cannot match "community".
  return CJK.test(term) ? text.includes(term) : tokens.has(term);
}

/** Search topic introductions in the selected locale and English, without changing topic data. */
export function searchTopics(query: string, locale: Locale): Topic[] {
  const phrase = fold(query.trim());
  const terms = [...new Set(words(phrase))];
  if (!terms.length) return [...topics];

  return topics.map((topic, index) => {
    const titles = [...new Set([fold(topic.title[locale]), fold(topic.title.en)])];
    const text = [
      ...titles, topic.description[locale], topic.description.en,
      topic.audience[locale], topic.audience.en,
    ].map(fold).join(' ');
    const tokens = new Set(words(text));
    if (!terms.every(term => matches(term, text, tokens))) return { topic, index, score: 0 };
    const titleText = titles.join(' ');
    const titleTokens = new Set(words(titleText));
    const score = titles.includes(phrase) ? 1000 : 1 + terms.filter(term => matches(term, titleText, titleTokens)).length;
    return { topic, index, score };
  }).filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(result => result.topic);
}
