import type { WikiKind } from './wiki-types';
import { LOCALES } from './types';
import { getWikiDictionary } from './wiki-i18n';

/** The only document fields used by client-side discovery and reading lists. */
export interface WikiListDocument {
  id: string;
  title: string;
  kind: WikiKind;
  topics: string[];
  language: string;
  upstreamUpdatedAt?: string;
  firstSeenAt: string;
  contentChangedAt: string;
}

export interface WikiSearchOptions {
  q?: string;
  kind?: string;
  topic?: string;
  sort?: 'relevance' | 'name' | 'recent';
}

const fold = (value: string) => value.normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFKC').toLocaleLowerCase('en');
const words = (value: string) => fold(value).match(/[\p{L}\p{N}]+/gu) || [];
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const kindAliases: Record<WikiKind, string> = {
  overview: 'overview overviews 综述 綜述 概要 개요 übersicht übersichten synthèse synthèses panorama panoramas panoramica panoramiche обзор обзоры',
  concept: 'concept concepts 概念 개념 konzept konzepte concepto conceptos concetto concetti понятие понятия',
  entity: 'entity entities 实体 實體 项目 項目 エンティティ 엔티티 eintrag einträge entité entités entidad entidades entità сущность сущности',
};
for (const locale of LOCALES) {
  const labels = getWikiDictionary(locale);
  kindAliases.overview += ` ${labels.overviews}`;
  kindAliases.concept += ` ${labels.concepts}`;
  kindAliases.entity += ` ${labels.entities}`;
}
const topicAliases: Record<string, string> = {
  'game-engine': '游戏引擎 遊戲引擎 ゲームエンジン 게임엔진 spielengine moteur de jeu motor de juego motore di gioco игровой движок',
  'graphics-api': '图形接口 圖形介面 グラフィックス 그래픽스 grafikschnittstelle interface graphique interfaz gráfica interfaccia grafica графический интерфейс',
};
interface WikiSearchIndex { title: string; rawTitle: string; titleWords: Set<string>; metadata: string; metadataWords: Set<string> }
const indexes = new WeakMap<WikiListDocument, WikiSearchIndex>();
function indexDocument(document: WikiListDocument): WikiSearchIndex {
  const cached = indexes.get(document);
  if (cached) return cached;
  const title = fold(document.title.replace(/([a-z])([A-Z])/g, '$1 $2'));
  const rawTitle = fold(document.title);
  const metadata = fold([...document.topics, ...document.topics.map(topic => topicAliases[topic] || ''), document.kind, kindAliases[document.kind]].join(' '));
  const result = { title, rawTitle, titleWords: new Set([...words(title), ...words(rawTitle)]), metadata, metadataWords: new Set(words(metadata)) };
  indexes.set(document, result);
  return result;
}
const titleOrder = (a: WikiListDocument, b: WikiListDocument) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);

export function searchWikiDocuments(documents: readonly WikiListDocument[], options: WikiSearchOptions = {}): WikiListDocument[] {
  const phrase = fold((options.q || '').trim()).slice(0, 300);
  const terms = [...new Set(words(phrase))].slice(0, 24);
  const matches = (term: string, text: string, tokens: Set<string>) => CJK.test(term) ? text.includes(term) : tokens.has(term);
  const found = documents.filter(document => (!options.kind || document.kind === options.kind)
    && (!options.topic || document.topics.includes(options.topic))).map(document => {
    if (!terms.length) return { document, score: 1 };
    const { title, rawTitle, metadata, titleWords, metadataWords } = indexDocument(document);
    let score = 0;
    for (const term of terms) {
      if (matches(term, `${title} ${rawTitle}`, titleWords)) score += 100;
      else if (matches(term, metadata, metadataWords)) score += 25;
      else return { document, score: 0 };
    }
    if (rawTitle === phrase) score += 300;
    return { document, score };
  }).filter(result => result.score > 0);
  found.sort((a, b) => {
    if (options.sort === 'recent') {
      const recent = b.document.contentChangedAt.localeCompare(a.document.contentChangedAt);
      if (recent) return recent;
    } else if (options.sort !== 'name') {
      if (terms.length && a.score !== b.score) return b.score - a.score;
      if (!terms.length) {
        const priority = { overview: 0, concept: 1, entity: 2 };
        const kind = priority[a.document.kind] - priority[b.document.kind];
        if (kind) return kind;
      }
    }
    return titleOrder(a.document, b.document);
  });
  return found.map(result => result.document);
}

/** Clamp arbitrary URL page values without dropping or duplicating list entries. */
export function paginateWiki<T>(items: readonly T[], value: string | number | undefined, pageSize = 24) {
  const size = Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 24;
  const requested = Number(value || 1);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pageCount, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
  return { items: items.slice((page - 1) * size, page * size), page, pageCount, total: items.length };
}
