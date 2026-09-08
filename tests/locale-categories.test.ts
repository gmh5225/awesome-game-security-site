import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { getDictionary, isLocale, localeNames, localizedCategory, localizedTag } from '../src/lib/i18n';
import { LOCALES } from '../src/lib/types';

const topLevelCategories = [
  'Game Engine', 'Mathematics', 'Renderer', '3D Graphics', 'AI', 'Image Codec', 'Wavefront Obj',
  'Task Scheduler', 'Game Network', 'PhysX SDK', 'Game Develop', 'Game Assets', 'Game Hot Patch',
  'Game Testing', 'Game Tools', 'Game Manager', 'Game CI', 'DirectX', 'OpenGL', 'Vulkan', 'Cheat',
  'Anti Cheat', 'Some Tricks', 'Windows Security Features', 'WSL', 'WSA', 'Windows Emulator',
  'Linux Emulator', 'Android Emulator', 'IOS Emulator', 'Game Boy', 'GameCube/Wii', 'Nintendo 3DS',
  'Nintendo Switch', 'Xbox', 'PlayStation',
];
const properNames = new Set([
  'PhysX SDK', 'DirectX', 'OpenGL', 'Vulkan', 'WSL', 'WSA', 'Game Boy', 'GameCube/Wii',
  'Nintendo 3DS', 'Nintendo Switch', 'Xbox', 'PlayStation',
]);
const snapshot = JSON.parse(readFileSync(new URL('../src/data/catalog.json', import.meta.url), 'utf8')) as {
  resources: Array<{ categories: string[] }>;
};
const sourceCategories = [...new Set(snapshot.resources.flatMap(resource => resource.categories))];

describe('multilingual source taxonomy', () => {
  test('covers all 36 source top-level categories in every interface language', () => {
    expect(topLevelCategories).toHaveLength(36);
    for (const category of topLevelCategories) {
      expect(sourceCategories).toContain(category);
      for (const locale of LOCALES) {
        const translated = localizedCategory(category, locale);
        expect(translated.trim().length).toBeGreaterThan(0);
        // Official technology and console names can retain their original spelling.
        if (locale !== 'en' && !properNames.has(category)) expect(translated).not.toBe(category);
      }
    }
  });

  test('translates the slash-qualified paths actually stored in the catalog', () => {
    expect(sourceCategories).toContain('Game Engine / Guide');
    expect(localizedCategory('Game Engine / Guide', 'zh-CN')).toBe('游戏引擎 › 学习指南');
    expect(localizedCategory('Game Engine / Guide', 'de')).toBe('Spiele-Engines › Anleitungen');
    expect(localizedCategory('Game Engine / Guide', 'ja')).toBe('ゲームエンジン › 学習ガイド');
    for (const locale of LOCALES) {
      expect(localizedCategory('Game Engine / Guide', locale)).toBe(
        `${localizedCategory('Game Engine', locale)} › ${localizedCategory('Guide', locale)}`,
      );
    }
  });

  test('composes research categories and subsection prefixes while preserving product names', () => {
    expect(sourceCategories).toContain('Cheat / Game Engine Explorer:Unity');
    expect(localizedCategory('Cheat / Game Engine Explorer:Unity', 'zh-CN')).toBe('作弊研究 › 引擎分析: Unity');
    expect(localizedCategory('Cheat / Game Engine Explorer:Unity', 'ja')).toBe('チート研究 › エンジン調査: Unity');
    expect(localizedCategory('Anti Cheat / Detection:Memory Integrity', 'zh-CN')).toBe('反作弊 › 检测: 内存完整性');
    expect(localizedCategory('Cheat / IDA Plugins', 'zh-CN')).toBe('作弊研究 › IDA · 插件');
    for (const locale of LOCALES) {
      expect(localizedCategory('Cheat / Game Engine Explorer:Unity', locale)).toEndWith(': Unity');
      expect(localizedCategory('Cheat / Game Engine Explorer:Source', locale)).toEndWith(': Source');
      expect(localizedCategory('Cheat / Game:Apex Legends', locale)).toEndWith(': Apex Legends');
      expect(localizedCategory('Game:Example / Remastered', locale)).toEndWith(': Example / Remastered');
      expect(localizedCategory('Cheat / Game:Example / Remastered', locale)).toEndWith(': Example / Remastered');
      expect(localizedCategory('QEMU/KVM/PVE/VBOX', locale)).toBe('QEMU/KVM/PVE/VBOX');
      expect(localizedCategory('DirectX', locale)).toBe('DirectX');
      expect(localizedCategory('Unity', locale)).toBe('Unity');
    }
  });

  test('retains compatible breadcrumb separators and handles source whitespace', () => {
    for (const separator of [' / ', ' > ', ' › ']) {
      expect(localizedCategory(`  Game Engine${separator}Guide  `, 'zh-TW')).toBe('遊戲引擎 › 學習指南');
    }
    expect(localizedCategory('GameCube/Wii', 'en')).toBe('GameCube/Wii');
    expect(localizedCategory('Unknown product', 'ja')).toBe('Unknown product');
  });

  test('every current source category and dictionary entry is nonempty in all 10 locales', () => {
    const expectedKeys = Object.keys(getDictionary('en')).sort();
    expect(LOCALES).toHaveLength(10);
    for (const locale of LOCALES) {
      expect(isLocale(locale)).toBe(true);
      expect(localeNames[locale].trim().length).toBeGreaterThan(0);
      const dictionary = getDictionary(locale);
      expect(Object.keys(dictionary).sort()).toEqual(expectedKeys);
      for (const value of Object.values(dictionary)) expect(value.trim().length).toBeGreaterThan(0);
      for (const category of sourceCategories) expect(localizedCategory(category, locale).trim().length).toBeGreaterThan(0);
      for (const key of [
        'metadataPending', 'metadataVerified', 'metadataStale', 'metadataAttempted', 'linkStatus',
        'translationFallback', 'sourceGenerated', 'indexUpdated', 'usageNote', 'classificationNote',
        'errorTitle', 'errorMessage', 'retry', 'notFoundTitle', 'notFoundMessage',
      ] as const) {
        if (locale !== 'en') expect(dictionary[key]).not.toBe(getDictionary('en')[key]);
      }
    }
    expect(isLocale('unsupported')).toBe(false);
  });

  test('localizes resource kind and experience labels without translating technology names', () => {
    expect(localizedTag('tool', 'zh-CN')).toBe('工具');
    expect(localizedTag('advanced', 'de')).toBe('Expertenwissen');
    expect(localizedTag('Unity', 'fr')).toBe('Unity');
  });

  test('translates generic snapshot subsections instead of falling back to source labels', () => {
    const sourceProductsAndAcronyms = new Set([
      'API', 'Android', 'Android ROM', 'DMA', 'ESP', 'Frida', 'HWID', 'IoT', 'JWT', 'Linux',
      'Magisk', 'OpenCV', 'QEMU/KVM/PVE/VBOX', 'RPM', 'SIM', 'W2S', 'Wine', 'Xposed',
    ]);
    const productPrefixes = /^(?:Game|Game Engine Explorer|Game Engine Plugins|Game Engine Protection|Explore AntiCheat System|Injection):/i;
    for (const category of sourceCategories) {
      for (const subsection of category.split(' / ').slice(1)) {
        if (productPrefixes.test(subsection) || sourceProductsAndAcronyms.has(subsection)) continue;
        expect(localizedCategory(subsection, 'zh-CN')).not.toBe(subsection);
      }
    }
    expect(localizedCategory('Anti Cheat / Anti Disassembly', 'zh-CN')).toBe('反作弊 › 反汇编防护');
    expect(localizedCategory('Anti Cheat / Backup Drivers', 'de')).toBe('Cheat-Abwehr › Treibersicherung');
    expect(localizedCategory('Cheat / Android File Explorer', 'fr')).toBe('Recherche sur la triche › Exploration des fichiers Android');
    expect(localizedCategory('Signature Scanning', 'ja')).toBe('シグネチャスキャン');
    expect(localizedCategory('Binary signature scanning', 'zh-CN')).toBe('特征扫描');
    expect(localizedCategory('Anti Cheat / Detection:Wall Hack', 'zh-CN')).toBe('反作弊 › 检测: 透视作弊');
    expect(localizedCategory('Encryption', 'es')).toBe('Cifrado');
  });

  test('metadata wording describes the actual evidence without claiming active maintenance or known suitability', () => {
    const english = getDictionary('en');
    expect(english.active).toBe('Not archived');
    expect(english.upstreamUpdated).toBe('Last repository push');
    expect(english.allLevelsLabel).toBe('Not specified');
    expect(english.metadataStale).toContain('last successfully verified evidence');
    const chinese = getDictionary('zh-CN');
    expect(chinese.active).toBe('未归档');
    expect(chinese.upstreamUpdated).toBe('仓库最近推送');
    expect(chinese.allLevelsLabel).toBe('未标注');
    expect(localizedTag('all', 'zh-CN')).toBe('未标注');
  });
});
