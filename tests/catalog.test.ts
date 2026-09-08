import { describe, expect, test } from 'bun:test';
import { buildCatalog, canEnrichResource, canonicalUrl, parseReadme, validateCatalog } from '../scripts/catalog-core';
import { isPublicAddress, validateLinkUrl } from '../scripts/check-links';
import { searchResources } from '../src/lib/search';
import { allowedMetadataEndpoint, applyMetadata, checkGithubMetadata, githubRepository, mapGithubMetadata, metadataRotation } from '../scripts/check-metadata';
import { getResourceByUrl } from '../src/lib/catalog';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const baseline = '2026-09-01T10:00:00.000Z';
const later = '2026-09-02T10:00:00.000Z';
const sha = 'a'.repeat(40);

describe('source parser', () => {
  test('canonicalizes GitHub repos and retains parent and subsection associations across duplicates', () => {
    const parsed = parseReadme(`## Game Engine\n> Source\n- https://github.com/GodotEngine/Godot.git/ [Engine]\n## Game Testing\n> Tools\n- [Godot](https://github.com/godotengine/godot?utm_source=test) [A longer description]`, baseline);
    expect(parsed.resources).toHaveLength(1);
    expect(parsed.resources[0].url).toBe('https://github.com/godotengine/godot');
    expect(parsed.resources[0].categories).toEqual(['Game Engine', 'Game Engine / Source', 'Game Testing', 'Game Testing / Tools']);
    expect(parsed.resources[0].description).toBe('A longer description');
    expect(parsed.sourceEntryCount).toBe(2);
  });
  test('handles markdown labels, balanced URL parentheses, subheadings, code fences and category reset', () => {
    const parsed = parseReadme('## Game Engine\n### Guide\n- [Math guide](https://example.com/Function_(math)) — Beginner documentation\n```\n- https://example.com/ignored\n```\n## Mathematics\n- <https://example.com/math> [Reference]', baseline);
    expect(parsed.resources).toHaveLength(2);
    const guide = parsed.resources.find(resource => resource.title === 'Math guide')!;
    expect(guide.url).toBe('https://example.com/Function_(math)');
    expect(guide.description).toBe('Beginner documentation');
    expect(parsed.resources.find(resource => resource.url.endsWith('/math'))?.categories).toEqual(['Mathematics']);
  });
  test('preserves square brackets in source subsection names while cleaning description wrappers', () => {
    const parsed = parseReadme('## Game Engine\n> Examples [UE5]\n- https://example.com/demo [Official examples]\n### Tutorials [2026]\n- https://example.com/tutorial [Beginner guide]', baseline);
    expect(parsed.resources.find(resource => resource.url.endsWith('/demo'))?.categories).toEqual(['Game Engine', 'Game Engine / Examples [UE5]']);
    expect(parsed.resources.find(resource => resource.url.endsWith('/tutorial'))?.categories).toEqual(['Game Engine', 'Game Engine / Tutorials [2026]']);
    expect(parsed.resources.find(resource => resource.url.endsWith('/demo'))?.description).toBe('Official examples');
  });
  test('preserves full passive source categories while limiting translated enrichment', () => {
    const parsed = parseReadme('## Cheat\n- https://example.com/unsafe\n## Some Tricks\n- https://example.com/tricks\n## Game Engine\n- https://example.com/injector [DLL injection tool]\n- https://example.com/Unity-Cheat-Sheet [Unity reference]\n> Hook\n- https://example.com/graphics-hook\n## Anti Cheat\n- https://example.com/security\n- https://dev.epicgames.com/docs/game-services/anti-cheat [Official developer documentation]', baseline);
    expect(parsed.resources).toHaveLength(7);
    expect(parsed.resources.filter(canEnrichResource).map(resource => resource.url)).toEqual(['https://example.com/Unity-Cheat-Sheet']);
    expect(parsed.resources.find(resource => resource.url.endsWith('/unsafe'))?.categories).toEqual(['Cheat']);
    expect(parseReadme('## Anti Cheat\n- https://learn.microsoft.com/windows/security [Official Windows security documentation]', baseline).resources.filter(canEnrichResource)).toHaveLength(1);
  });
  test('rejects non-web URLs and credentials while preserving useful nontracking queries', () => {
    expect(canonicalUrl('javascript:alert(1)')).toBeUndefined();
    expect(canonicalUrl('https://user:password@example.com')).toBeUndefined();
    expect(canonicalUrl('https://example.com/docs/?id=2&utm_source=x#intro')).toBe('https://example.com/docs?id=2');
    expect(canonicalUrl('https://github.com/Owner/Repo/blob/main/FILE.md')).toBe('https://github.com/owner/repo/blob/main/FILE.md');
  });
  test('preserves useful source anchors without changing resource identities or duplicating pages', () => {
    const parsed = parseReadme('## Game Network\n- https://example.com/docs\n- https://example.com/docs#send-receive [Networking reference]', baseline);
    expect(parsed.resources).toHaveLength(1);
    expect(parsed.resources[0].url).toBe('https://example.com/docs');
    expect(parsed.resources[0].sourceUrl).toBe('https://example.com/docs#send-receive');
    const old = buildCatalog(parseReadme('## Game Network\n- https://example.com/docs [Networking reference]', baseline), undefined, sha, baseline);
    const enriched = buildCatalog(parsed, old, sha, later);
    expect(enriched.changes).toHaveLength(0);
    expect(enriched.resources[0].id).toBe(old.resources[0].id);
    const next = buildCatalog(parseReadme('## Game Network\n- https://example.com/docs#new-section [Networking reference]', later), enriched, 'b'.repeat(40), later);
    expect(next.changes.map(change => change.type)).toEqual(['updated']);
    expect(getResourceByUrl('https://github.com/GodotEngine/Godot#readme')?.url).toBe('https://github.com/godotengine/godot');
  });
});

describe('bounded GitHub repository metadata', () => {
  test('maps archival evidence and actual repository pushes without inventing dates or activity', () => {
    expect(mapGithubMetadata({ archived: false, pushed_at: '2024-02-29T12:34:56Z', updated_at: later })).toEqual({ status: 'ok', maintenance: 'active', upstreamUpdatedAt: '2024-02-29T12:34:56.000Z' });
    expect(mapGithubMetadata({ archived: true, pushed_at: null })).toEqual({ status: 'ok', maintenance: 'archived', upstreamUpdatedAt: undefined });
    expect(mapGithubMetadata({ archived: false, pushed_at: '2025-02-30T12:00:00Z' }).upstreamUpdatedAt).toBeUndefined();
    expect(mapGithubMetadata({ archived: false, updated_at: later }).upstreamUpdatedAt).toBeUndefined();
    expect(mapGithubMetadata({ message: 'Not Found' })).toEqual({ status: 'unknown' });
  });
  test('preserves last successful evidence on failure and keeps source dates and change history intact', () => {
    const catalog = buildCatalog(parseReadme('## Game Engine\n- https://github.com/example/engine [Engine]', baseline), undefined, sha, baseline);
    const resource = catalog.resources[0];
    applyMetadata(resource, mapGithubMetadata({ archived: true, pushed_at: '2020-01-02T03:04:05Z' }), baseline);
    applyMetadata(resource, { status: 'restricted' }, later);
    expect(resource.metadataCheckedAt).toBe(later);
    expect(resource.metadataVerifiedAt).toBe(baseline);
    expect(resource.metadataStatus).toBe('restricted');
    expect(resource.maintenance).toBe('archived');
    expect(resource.upstreamUpdatedAt).toBe('2020-01-02T03:04:05.000Z');
    expect(resource.contentChangedAt).toBe(baseline);
    expect(catalog.syncedAt).toBe(baseline);
    expect(catalog.changes).toEqual([]);
    const synced = buildCatalog(parseReadme('## Game Engine\n- https://github.com/example/engine [Engine]', later), catalog, sha, later);
    expect(synced.resources[0].metadataVerifiedAt).toBe(baseline);
    expect(synced.resources[0].metadataStatus).toBe('restricted');
    expect(synced.changes).toEqual([]);
  });
  test('groups repository URLs into one check and rotates unobserved repositories first', () => {
    const resources = parseReadme('## Game Engine\n- https://github.com/a/one\n- https://github.com/a/one/wiki\n- https://github.com/b/two\n- https://example.com/docs', baseline).resources;
    for (const resource of resources.filter(resource => resource.url.includes('/a/'))) resource.metadataCheckedAt = later;
    expect(metadataRotation(resources, 1).map(group => group.repository)).toEqual(['b/two']);
    expect(metadataRotation(resources, 10).find(group => group.repository === 'a/one')?.resources).toHaveLength(2);
    expect(githubRepository('https://github.com/Owner/Repo.git/blob/main/README.md')).toBe('owner/repo');
    expect(githubRepository('https://github.com/topics/engines')).toBeUndefined();
    expect(githubRepository('https://github.com.attacker.invalid/owner/repo')).toBeUndefined();
  });
  test('never follows an API redirect to another host or sends a token there', async () => {
    const visited: string[] = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      visited.push(String(input));
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-token');
      expect(init?.redirect).toBe('manual');
      return new Response('', { status: 301, headers: { Location: 'https://untrusted.invalid/repos/example/engine' } });
    });
    expect(await checkGithubMetadata('example/engine', { token: 'test-token', fetcher })).toEqual({ status: 'unknown' });
    expect(visited).toEqual(['https://api.github.com/repos/example/engine']);
    expect(allowedMetadataEndpoint('https://api.github.com/repos/example/engine')).toBe(true);
    expect(allowedMetadataEndpoint('https://api.github.com/repositories/123')).toBe(true);
    expect(allowedMetadataEndpoint('https://api.github.com/user')).toBe(false);
    expect(allowedMetadataEndpoint('https://api.github.com/repos/example/engine?token=secret')).toBe(false);
  });
  test('distinguishes unavailable, restricted, malformed and network failures', async () => {
    for (const [status, expected] of [[404, 'unavailable'], [403, 'restricted'], [429, 'restricted'], [500, 'unknown']] as const) {
      const fetcher = async () => new Response('{}', { status });
      expect((await checkGithubMetadata('example/engine', { fetcher })).status).toBe(expected);
    }
    const malformed = async () => new Response('not json', { status: 200 });
    expect((await checkGithubMetadata('example/engine', { fetcher: malformed })).status).toBe('unknown');
    const offline = async () => { throw new Error('Offline'); };
    expect((await checkGithubMetadata('example/engine', { fetcher: offline })).status).toBe('unknown');
    const moved = (async (input: string | URL | Request) => String(input).endsWith('/example/engine')
      ? new Response('', { status: 301, headers: { Location: '/repositories/123' } })
      : Response.json({ archived: false, pushed_at: '2026-09-01T01:02:03Z' }));
    expect(await checkGithubMetadata('example/engine', { fetcher: moved })).toEqual({ status: 'ok', maintenance: 'active', upstreamUpdatedAt: '2026-09-01T01:02:03.000Z' });
  });
  test('bounds response size and redirect attempts and signals API restriction', async () => {
    const oversized = async () => new Response('x'.repeat(128 * 1024 + 1), { status: 200 });
    expect((await checkGithubMetadata('example/engine', { fetcher: oversized })).status).toBe('unknown');
    let requests = 0;
    const redirectLoop = async () => { requests++; return new Response('', { status: 301, headers: { Location: '/repositories/123' } }); };
    expect((await checkGithubMetadata('example/engine', { fetcher: redirectLoop })).status).toBe('unknown');
    expect(requests).toBe(3);
    const restricted = async () => new Response('{}', { status: 429 });
    expect(await checkGithubMetadata('example/engine', { fetcher: restricted })).toEqual({ status: 'restricted', stop: true });
  });
});

describe('observation history', () => {
  test('the actual sync command exits nonzero and preserves the last good file on truncated input', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'catalog-failure-test-'));
    try {
      const first = buildCatalog(parseReadme('## Game Engine\n- https://example.com/engine [Engine]', baseline), undefined, sha, baseline);
      mkdirSync(path.join(directory, 'src/data'), { recursive: true });
      const filename = path.join(directory, 'src/data/catalog.json');
      const before = JSON.stringify(first);
      writeFileSync(filename, before);
      writeFileSync(path.join(directory, 'truncated.md'), '## Game Engine\n');
      const result = spawnSync(process.execPath, [path.resolve('scripts/sync-catalog.ts'), '--readme', path.join(directory, 'truncated.md'), '--commit', sha, '--no-descriptions'], { cwd: directory, encoding: 'utf8', timeout: 10_000 });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('snapshot preserved');
      expect(readFileSync(filename, 'utf8')).toBe(before);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  test('initial import has no fabricated additions; repeats retain dates and metadata', () => {
    const first = buildCatalog(parseReadme('## Game Engine\n- https://example.com/engine [A game engine]', baseline), undefined, sha, baseline);
    expect(first.changes).toEqual([]);
    first.resources[0].lastCheckedAt = baseline;
    first.resources[0].linkStatus = 'ok';
    const repeat = buildCatalog(parseReadme('## Game Engine\n- https://example.com/engine [A game engine]', later), first, sha, later);
    expect(repeat.baselineAt).toBe(baseline);
    expect(repeat.resources[0].firstSeenAt).toBe(baseline);
    expect(repeat.resources[0].contentChangedAt).toBe(baseline);
    expect(repeat.resources[0].linkStatus).toBe('ok');
    expect(repeat.changes).toEqual([]);
    expect(() => validateCatalog(repeat)).not.toThrow();
  });
  test('records real additions, content changes and removals without reassigning first seen', () => {
    const first = buildCatalog(parseReadme('## Game Engine\n- https://example.com/one [Initial]\n- https://example.com/two [Second]', baseline), undefined, sha, baseline);
    const next = buildCatalog(parseReadme('## Game Engine\n- https://example.com/one [Changed]\n- https://example.com/three [New]', later), first, 'b'.repeat(40), later);
    expect(next.changes.map(change => change.type).sort()).toEqual(['added', 'removed', 'updated']);
    expect(next.resources.find(resource => resource.url.endsWith('/one'))?.firstSeenAt).toBe(baseline);
    expect(next.resources.find(resource => resource.url.endsWith('/one'))?.contentChangedAt).toBe(later);
    expect(next.resources.find(resource => resource.url.endsWith('/three'))?.firstSeenAt).toBe(later);
    expect(buildCatalog(parseReadme('## Game Engine\n- https://example.com/one [Changed]\n- https://example.com/three [New]', later), next, sha, later).changes).toHaveLength(3);
  });
});

describe('search relevance and filters', () => {
  const resources = parseReadme('## Game Engine\n> Source\n- [Unity](https://example.com/unity) [Game engine]\n- [Community notes](https://example.com/community) [Community resources]\n- [A renderer](https://example.com/render) [Unity graphics reference]\n## Game Testing\n- [Profiler](https://example.com/profiler) [Linux tool]', baseline).resources;
  resources.find(resource => resource.title === 'Unity')!.summaries = { 'zh-CN': '游戏引擎开发参考', ja: 'ゲームエンジンの開発資料', de: 'Überblick für Entwickler' };
  test('uses word boundaries and ranks title before description', () => {
    expect(searchResources(resources, { q: 'unity' }).map(resource => resource.title)).toEqual(['Unity', 'A renderer']);
    expect(searchResources(resources, { q: 'community' }).map(resource => resource.title)).toEqual(['Community notes']);
  });
  test('supports multilingual summaries, no-space CJK and normalized accents', () => {
    expect(searchResources(resources, { q: '开发参考' })[0]?.title).toBe('Unity');
    expect(searchResources(resources, { q: '開発資料' })[0]?.title).toBe('Unity');
    expect(searchResources(resources, { q: 'uberblick' })[0]?.title).toBe('Unity');
    expect(searchResources(resources, { q: '测试' }).map(resource => resource.title)).toEqual(['Profiler']);
    const japanese = parseReadme('## Game Engine\n- [パーティ](https://example.com/party)\n- [ハーティ](https://example.com/other)', baseline).resources;
    expect(searchResources(japanese, { q: 'パーティ' }).map(resource => resource.title)).toEqual(['パーティ']);
  });
  test('combines all terms and exact category filters, with empty saved IDs returning no rows', () => {
    expect(searchResources(resources, { q: 'unity graphics', category: 'Game Engine' }).map(resource => resource.title)).toEqual(['A renderer']);
    expect(searchResources(resources, { category: 'Engine' })).toHaveLength(0);
    expect(searchResources(resources, { category: 'Game Engine / Source' })).toHaveLength(3);
    expect(searchResources(resources, { category: 'Game Testing', platform: 'Linux' })).toHaveLength(1);
    expect(searchResources(resources, { savedIds: [] })).toHaveLength(0);
    expect(searchResources(resources, { q: 'absent' })).toHaveLength(0);
  });
  test('does not mutate input and sorts deterministically, including punctuation-only queries', () => {
    const input = [...resources].reverse();
    const ids = input.map(resource => resource.id);
    expect(searchResources(input, { q: '???', sort: 'name' }).map(resource => resource.title)).toEqual(['A renderer', 'Community notes', 'Profiler', 'Unity']);
    expect(input.map(resource => resource.id)).toEqual(ids);
  });
  test('uses the empty filter for all results and literal level all for unspecified experience', () => {
    const levels = parseReadme('## Game Engine\n- [Introduction](https://example.com/start) [Beginner tutorial]\n- [Reference](https://example.com/reference) [Engine documentation]', baseline).resources;
    expect(searchResources(levels, { level: '' })).toHaveLength(2);
    expect(searchResources(levels, { level: 'all' }).map(resource => resource.title)).toEqual(['Reference']);
    expect(searchResources(levels, { level: 'beginner' }).map(resource => resource.title)).toEqual(['Introduction']);
  });
});

describe('bounded link destination validation', () => {
  test('blocks loopback, private, mapped, link-local and reserved addresses', () => {
    for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1']) expect(isPublicAddress(address)).toBe(false);
    expect(isPublicAddress('1.1.1.1')).toBe(true);
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);
    expect(() => validateLinkUrl('http://127.1')).toThrow();
    expect(() => validateLinkUrl('http://localhost')).toThrow();
    expect(() => validateLinkUrl('https://example.com:8443')).toThrow();
    expect(() => validateLinkUrl('https://example.com/docs')).not.toThrow();
  });
});
