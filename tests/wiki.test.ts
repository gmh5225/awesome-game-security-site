import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildWikiSnapshot, gitBlobSha, parseWikiDocument, validateWikiIndex, validateWikiSnapshot, wikiId, type WikiFile } from '../scripts/wiki-core';
import { DEFAULT_WIKI_LIMITS, fetchWikiTree, loadWikiBlobs, selectWikiFiles } from '../scripts/wiki-sync';
import { parseReadme } from '../scripts/catalog-core';

const commit = 'a'.repeat(40);
const baseline = '2026-09-01T00:00:00.000Z';
const later = '2026-09-02T00:00:00.000Z';
const body = (kind: string, content = '', sources = '[]') => `---\ntitle: Sample\nkind: ${kind}\ntopics: [game-engine]\nsources: ${sources}\nupdated: 2026-08-31\nconfidence: medium\n---\n# Sample\n\n${content}\n`;
const file = (filename: string, text = ''): WikiFile => ({ path: filename, sha: gitBlobSha(Buffer.from(text)), size: Buffer.byteLength(text), mode: '100644' });
const resources = parseReadme('## Game Engine\n- https://github.com/godotengine/godot [Official engine]', baseline).resources;
const index = file('wiki/index.md', '# Index');

describe('passive wiki parsing and provenance', () => {
  test('keeps neutral frontmatter and exact source lines without storing body or summaries', () => {
    const markdown = body('entity', '[[demo]]\n\n- Repo: https://github.com/godotengine/godot\n\n(source: wiki/sources/descriptions/godotengine__godot.md)\n\n```\n[[not-a-citation]]\n```', '\n  - wiki/sources/descriptions/godotengine__godot.md');
    const parsed = parseWikiDocument('wiki/entities/godot.md', markdown);
    expect(parsed.language).toBe('unknown');
    expect(parsed.upstreamUpdatedAt).toBe('2026-08-31T00:00:00.000Z');
    expect(parsed.links.filter(link => link.rawTarget.startsWith('wiki/sources/'))).toHaveLength(1);
    expect(parsed.links[0].line).toBe(6);
    for (const reference of parsed.links) expect(markdown.split('\n')[reference.line - 1]).toContain(reference.rawTarget);
    expect(parsed.links.some(link => link.rawTarget === 'not-a-citation')).toBe(false);
    const snapshot = buildWikiSnapshot([parsed], [file(parsed.path, markdown)], index, resources, commit, baseline);
    expect('body' in snapshot.documents[0]).toBe(false);
    expect('summary' in snapshot.documents[0]).toBe(false);
    const repo = snapshot.references.find(ref => ref.type === 'resource')!;
    expect(repo.resourceIds).toEqual([resources[0].id]);
    const projection = snapshot.references.find(ref => ref.type === 'source')!;
    expect(projection.status).toBe('unresolved');
    expect(projection.resolvedUrl).toBeUndefined();
  });

  test('resolves only exact URLs and tracked targets, preserving ambiguity and missing anchors', () => {
    const a = parseWikiDocument('wiki/entities/sample.md', body('entity', '[[demo]] [[concepts/demo#details]] [[concepts/demo#missing]] [self](#sample)\nhttps://github.com/GodotEngine/Godot#readme\nhttps://github.com/godotengine/godot-fork'));
    const b = parseWikiDocument('wiki/entities/demo.md', body('entity'));
    const c = parseWikiDocument('wiki/concepts/demo.md', body('concept', '## Details\n## Details'));
    const files = [a, b, c].map(doc => file(doc.path));
    const snapshot = buildWikiSnapshot([a, b, c], files, index, resources, commit, baseline);
    expect(snapshot.references.find(ref => ref.rawTarget === 'demo')?.status).toBe('ambiguous');
    expect(snapshot.references.find(ref => ref.rawTarget === 'demo')?.candidateDocumentIds).toHaveLength(2);
    expect(c.anchors).toEqual(['sample', 'details', 'details-1']);
    expect(snapshot.references.find(ref => ref.rawTarget === 'concepts/demo#details')?.status).toBe('resolved');
    const missing = snapshot.references.find(ref => ref.rawTarget === 'concepts/demo#missing')!;
    expect(missing.status).toBe('unresolved');
    expect(missing.reason).toBe('missing-anchor');
    expect(missing.targetDocumentId).toBe(wikiId(c.path));
    expect(missing.resolvedUrl).not.toContain('#');
    expect(snapshot.references.find(ref => ref.rawTarget === '#sample')?.targetDocumentId).toBe(wikiId(a.path));
    expect(snapshot.references.find(ref => ref.rawTarget.includes('GodotEngine'))?.resourceIds).toEqual([resources[0].id]);
    expect(snapshot.references.find(ref => ref.rawTarget.endsWith('godot-fork'))?.type).toBe('external');
    validateWikiSnapshot(snapshot, resources, commit, { files, parsed: [a, b, c] });
  });

  test('maps source projections from verified real paths without guessing owner/repository splits', () => {
    const parsed = parseWikiDocument('wiki/entities/sample.md', body('entity', '', '\n  - wiki/sources/README-categories.md\n  - wiki/sources/skills/game-engine.md\n  - wiki/sources/descriptions/godotengine__godot.md\n  - wiki/sources/descriptions/a__b__c.md'));
    const files = [file(parsed.path), file('README.md'), file('.claude/skills/game-engine/SKILL.md'), file('description/godotengine/godot/description_en.txt'), file('description/a__b/c/description_en.txt'), file('description/a/b__c/description_en.txt')];
    const snapshot = buildWikiSnapshot([parsed], files, index, resources, commit, baseline);
    expect(snapshot.references.filter(ref => ref.reason === 'projection-source')).toHaveLength(3);
    const mapped = snapshot.references.find(ref => ref.rawTarget.includes('godotengine'))!;
    expect(mapped.mappedSourcePath).toBe('description/godotengine/godot/description_en.txt');
    expect(mapped.resourceIds).toEqual([]);
    expect(snapshot.references.find(ref => ref.rawTarget.endsWith('a__b__c.md'))?.status).toBe('ambiguous');
    validateWikiSnapshot(snapshot, resources, commit, { files, parsed: [parsed] });
    const forged = structuredClone(snapshot);
    forged.references[0].line = 999;
    expect(() => validateWikiSnapshot(forged, resources, commit, { files, parsed: [parsed] })).toThrow('line evidence');
    forged.references[0] = { ...snapshot.references[0], resolvedUrl: `https://github.com/gmh5225/awesome-game-security/blob/${commit}/nonexistent.md` };
    expect(() => validateWikiSnapshot(forged, resources, commit, { files, parsed: [parsed] })).toThrow('verified file');
  });

  test('does not claim an unverified projection section exists in its original source', () => {
    const parsed = parseWikiDocument('wiki/entities/sample.md', body('entity', '[source](../sources/README-categories.md#game-engine)'));
    const files = [file(parsed.path), file('README.md')];
    const snapshot = buildWikiSnapshot([parsed], files, index, resources, commit, baseline);
    expect(snapshot.references[0].status).toBe('unresolved');
    expect(snapshot.references[0].reason).toBe('unverified-anchor');
    expect(snapshot.references[0].mappedSourcePath).toBe('README.md');
    expect(snapshot.references[0].resolvedUrl).not.toContain('#');
    validateWikiSnapshot(snapshot, resources, commit, { files, parsed: [parsed] });
  });

  test('rejects malformed metadata and checks index correspondence independently of incidental wikilinks', () => {
    expect(() => parseWikiDocument('wiki/entities/a.md', body('concept'))).toThrow('kind');
    expect(() => parseWikiDocument('wiki/entities/a.md', body('entity').replace('2026-08-31', '2026-02-30'))).toThrow('date');
    expect(() => parseWikiDocument('wiki/entities/a.md', body('entity').replace('title: Sample', 'title: A\ntitle: B'))).toThrow('frontmatter');
    validateWikiIndex('- [Sample](entities/a.md) [[incidental]]', ['wiki/entities/a.md']);
    expect(() => validateWikiIndex('- [Missing](entities/b.md)', ['wiki/entities/a.md'])).toThrow('disagree');
    expect(() => validateWikiIndex('- [A](entities/a.md)\n- [A](entities/a.md)', ['wiki/entities/a.md'])).toThrow('disagree');
  });

  test('accepts only an unquoted title colon repair and preserves original source line numbers', () => {
    const markdown = body('entity', '[[demo]]', '\n  - wiki/sources/README-categories.md').replace('title: Sample', 'title: Command and Conquer: Red Alert');
    const parsed = parseWikiDocument('wiki/entities/a.md', markdown);
    expect(parsed.title).toBe('Command and Conquer: Red Alert');
    expect(parsed.links[0].line).toBe(6);
    for (const reference of parsed.links) expect(markdown.split('\n')[reference.line - 1]).toContain(reference.rawTarget);
    expect(() => parseWikiDocument('wiki/entities/a.md', markdown.replace('kind: entity', 'kind: entity: broken'))).toThrow('frontmatter');
    expect(() => parseWikiDocument('wiki/entities/a.md', markdown.replace('title: Command and Conquer: Red Alert', 'title: A: B # ambiguous comment'))).toThrow('frontmatter');
  });

  test('initial baseline is quiet and later changes preserve observed dates and removed-source evidence', () => {
    const a = parseWikiDocument('wiki/entities/a.md', body('entity'));
    const b = parseWikiDocument('wiki/entities/b.md', body('entity'));
    const old = buildWikiSnapshot([a, b], [file(a.path, 'old-a'), file(b.path, 'old-b')], index, resources, commit, baseline);
    expect(old.changes).toEqual([]);
    const repeated = buildWikiSnapshot([a, b], [file(a.path, 'old-a'), file(b.path, 'old-b')], index, resources, 'b'.repeat(40), later, old);
    expect(repeated.changes).toEqual([]);
    expect(repeated.documents[0].contentChangedAt).toBe(baseline);
    const c = parseWikiDocument('wiki/entities/c.md', body('entity'));
    const changed = buildWikiSnapshot([a, c], [file(a.path, 'new-a'), file(c.path, 'new-c')], index, resources, 'b'.repeat(40), later, old);
    expect(changed.changes.map(change => change.type).sort()).toEqual(['added', 'removed', 'updated']);
    expect(changed.documents.find(doc => doc.path === a.path)?.firstSeenAt).toBe(baseline);
    expect(changed.changes.find(change => change.type === 'removed')?.sourceUrl).toContain(`/blob/${commit}/`);
    expect(changed.changes.find(change => change.type === 'removed')?.topics).toEqual(['game-engine']);
    expect(resources[0].contentChangedAt).toBe(baseline);
  });
});

describe('bounded wiki transport', () => {
  test('fails before downloading oversized, symlinked or incomplete sets', () => {
    const files = [index, file('wiki/entities/a.md', 'plain')];
    expect(selectWikiFiles(files)).toHaveLength(2);
    expect(() => selectWikiFiles([index, { ...files[1], size: DEFAULT_WIKI_LIMITS.documentBytes + 1 }])).toThrow('bounds');
    expect(() => selectWikiFiles([index, { ...files[1], mode: '120000' }])).toThrow('regular');
    expect(() => selectWikiFiles(files, { ...DEFAULT_WIKI_LIMITS, totalBytes: 1 })).toThrow('total');
    expect(() => selectWikiFiles([files[1]])).toThrow('count');
  });

  test('recovers a truncated recursive tree with bounded nonrecursive traversal', async () => {
    const wikiSha = 'b'.repeat(40), subSha = 'c'.repeat(40);
    const visited: string[] = [];
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input); visited.push(url);
      expect(new URL(url).hostname).toBe('api.github.com');
      expect(init?.redirect).toBe('error');
      const item = (path: string, sha: string, type: string, size?: number) => ({ path, sha, type, mode: type === 'tree' ? '040000' : '100644', size });
      if (url.endsWith(commit)) return Response.json({ tree: [item('wiki', wikiSha, 'tree')] });
      if (url.endsWith(`${wikiSha}?recursive=1`)) return Response.json({ truncated: true, tree: [] });
      if (url.endsWith(wikiSha)) return Response.json({ tree: [item('index.md', index.sha, 'blob', index.size), item('entities', subSha, 'tree')] });
      return Response.json({ tree: [item('a.md', 'd'.repeat(40), 'blob', 10)] });
    }) as typeof fetch;
    const files = await fetchWikiTree(commit, fetcher);
    expect(files.map(entry => entry.path)).toEqual(['wiki/entities/a.md', 'wiki/index.md']);
    expect(visited).toHaveLength(4);
    const broken = (async () => Response.json({ truncated: true, tree: [] })) as unknown as typeof fetch;
    await expect(fetchWikiTree(commit, broken)).rejects.toThrow('incomplete');
  });

  test('reuses only hash-verified cache bytes without network or source checkout', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ags-wiki-cache-test-'));
    try {
      const text = body('entity');
      const source = file('wiki/entities/a.md', text);
      await writeFile(path.join(directory, `${source.sha}.md`), text);
      const texts = await loadWikiBlobs([source], commit, directory);
      expect(texts.get(source.path)).toBe(text);
      expect(await readFile(path.join(directory, `${source.sha}.md`), 'utf8')).toBe(text);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
