import type { Resource, ResourceKind, ResourceLevel } from './types';

export interface SearchOptions {
  q?: string;
  category?: string;
  kind?: ResourceKind | string;
  platform?: string;
  engine?: string;
  level?: ResourceLevel | string;
  sort?: 'relevance' | 'name' | 'recent';
  savedIds?: string[];
}

const fold = (value: string) => value.normalize('NFD').replace(/(\p{Script=Latin})\p{M}+/gu, '$1').normalize('NFKC').toLocaleLowerCase('en');
const words = (value: string) => fold(value).match(/[\p{L}\p{N}]+/gu) || [];
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const categoryAliases: Record<string, string> = {
  'Game Engine': '游戏引擎 遊戲引擎 ゲームエンジン 게임엔진 spielengine moteur moteurdejeu motor motorjuego motore движок',
  'Game Testing': '游戏测试 遊戲測試 ゲームテスト 게임테스트 测试 測試 test tests pruebas testowanie тестирование',
  'Game Network': '游戏网络 遊戲網路 网络 網路 ネットワーク 네트워크 netzwerk réseau red rete сеть multiplayer 多人',
  'Game Develop': '游戏开发 遊戲開發 ゲーム開発 게임개발 entwicklung développement desarrollo sviluppo разработка',
  'Game Assets': '游戏素材 遊戲素材 素材 アセット 에셋 ressources recursos risorse ассеты',
  'Mathematics': '数学 數學 数学 수학 mathematik mathématiques matemáticas matematica математика',
  'Renderer': '渲染 レンダリング 렌더러 rendu renderizado rendering рендеринг',
  'Game CI': '持续集成 持續整合 継続的インテグレーション 지속적통합 continuous integration',
  'Windows Security Features': '安全 セキュリティ 보안 sicherheit sécurité seguridad sicurezza безопасность',
};

function matches(term: string, text: string, tokens: Set<string>): boolean {
  // CJK writing does not require spaces. Latin terms always use complete tokens.
  return CJK.test(term) ? text.includes(term) : tokens.has(term);
}

interface SearchDocument { title: string; titleRaw: string; fields: [string, Set<string>, number][] }
const index = new WeakMap<Resource, SearchDocument>();

function indexResource(resource: Resource): SearchDocument {
  const existing = index.get(resource);
  if (existing) return existing;
  const title = fold(resource.title.replace(/([a-z])([A-Z])/g, '$1 $2'));
  const titleRaw = fold(resource.title);
  const tags = fold([...resource.tags, ...resource.categories, ...resource.engines, ...resource.platforms, resource.kind, resource.level, ...resource.categories.map(category => categoryAliases[category] || '')].join(' '));
  const description = fold([resource.description, ...Object.values(resource.summaries || {})].join(' '));
  const url = fold(resource.url);
  const fields: [string, Set<string>, number][] = [
    [`${title} ${titleRaw}`, new Set([...words(title), ...words(titleRaw)]), 100],
    [tags, new Set(words(tags)), 45], [description, new Set(words(description)), 12], [url, new Set(words(url)), 4],
  ];
  const document = { title, titleRaw, fields };
  index.set(resource, document);
  return document;
}

function scoreResource(resource: Resource, terms: string[], phrase: string): number {
  const { title, titleRaw, fields } = indexResource(resource);
  let score = 0;
  for (const term of terms) {
    let best = 0;
    for (const [text, tokens, weight] of fields) if (matches(term, text, tokens)) best = Math.max(best, weight);
    if (!best) return 0;
    score += best;
  }
  if (titleRaw === phrase) score += 300;
  else if (terms.length > 1 && title.includes(phrase)) score += 80;
  return score;
}

export function searchResources(resources: Resource[], options: SearchOptions = {}): Resource[] {
  const phrase = fold((options.q || '').trim()).slice(0, 300);
  const terms = [...new Set(words(phrase))].slice(0, 24);
  const savedIds = options.savedIds === undefined ? undefined : new Set(options.savedIds);
  const matchesFilter = (value: string | undefined, available: string[]) => !value || available.includes(value);
  const filtered = resources.filter(resource =>
    matchesFilter(options.category, resource.categories) && matchesFilter(options.kind, [resource.kind]) &&
    matchesFilter(options.platform, resource.platforms) && matchesFilter(options.engine, resource.engines) &&
    matchesFilter(options.level, [resource.level]) && (savedIds === undefined || savedIds.has(resource.id)),
  ).map(resource => ({ resource, score: terms.length ? scoreResource(resource, terms, phrase) : 1 })).filter(item => item.score > 0);
  filtered.sort((a, b) => {
    if (options.sort === 'recent') {
      const recent = b.resource.contentChangedAt.localeCompare(a.resource.contentChangedAt);
      if (recent) return recent;
    } else if (options.sort !== 'name' && terms.length && a.score !== b.score) return b.score - a.score;
    return a.resource.title.localeCompare(b.resource.title, 'en', { sensitivity: 'base', numeric: true }) || a.resource.id.localeCompare(b.resource.id);
  });
  return filtered.map(item => item.resource);
}
