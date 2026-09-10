import { readFile, writeFile, rename, mkdir, mkdtemp, lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { LOCALES, type Catalog, type Resource } from '../src/lib/types';
import { buildCatalog, canEnrichResource, parseReadme, validateCatalog } from './catalog-core';
import { DEFAULT_WIKI_LIMITS, syncWiki } from './wiki-sync';
import { validateWikiSnapshot } from './wiki-core';

const REPOSITORY = 'gmh5225/awesome-game-security';
const output = path.resolve('src/data/catalog.json');
const args = process.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const exec = promisify(execFile);

async function fetchBytes(url: string, limit: number, accept?: string): Promise<Uint8Array> {
  const headers: Record<string, string> = { 'User-Agent': 'GameSecurityAtlas-CatalogSync/1.0' };
  if (accept) headers.Accept = accept;
  if (new URL(url).hostname === 'api.github.com' && process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(90_000), redirect: 'error' });
  if (!response.ok) throw new Error(`Source fetch failed (${response.status}): ${new URL(url).hostname}`);
  if (Number(response.headers.get('content-length')) > limit) throw new Error('Source exceeds download limit.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Source returned no body.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error('Source exceeds download limit.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

async function enrichDescriptions(resources: Resource[], commit: string): Promise<number> {
  const repositoryResources = new Map<string, Resource[]>();
  for (const resource of resources) {
    if (!canEnrichResource(resource)) continue;
    const url = new URL(resource.url);
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.hostname !== 'github.com' || parts.length < 2) continue;
    const key = `${parts[0]}/${parts[1]}`.toLowerCase();
    repositoryResources.set(key, [...(repositoryResources.get(key) || []), resource]);
  }
  // The source includes a very large archive/ tree. A partial clone transfers tree
  // metadata first, then only the exact selected description blobs in one checkout.
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ags-catalog-source-'));
  const git = async (...command: string[]) => exec('git', ['-c', 'core.hooksPath=/dev/null', ...command], {
    cwd: directory, timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
  });
  try {
    await git('init', '--quiet');
    await git('remote', 'add', 'origin', `https://github.com/${REPOSITORY}.git`);
    await git('config', 'remote.origin.promisor', 'true');
    await git('config', 'remote.origin.partialclonefilter', 'blob:none');
    await git('fetch', '--quiet', '--filter=blob:none', '--depth=1', '--no-tags', 'origin', commit);
    const tree = await git('ls-tree', '-r', '--name-only', commit, '--', 'description');
    const selected = new Map<string, { key: string; locale: typeof LOCALES[number] }>();
    for (const filename of tree.stdout.split('\n')) {
      const match = /^description\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/description_([^/]+)\.txt$/.exec(filename);
      if (!match || filename.includes('..') || !repositoryResources.has(`${match[1]}/${match[2]}`.toLowerCase()) || !(LOCALES as readonly string[]).includes(match[3])) continue;
      selected.set(filename, { key: `${match[1]}/${match[2]}`.toLowerCase(), locale: match[3] as typeof LOCALES[number] });
    }
    if (!selected.size || selected.size > 20_000) throw new Error('Unexpected description selection size.');
    await git('sparse-checkout', 'init', '--no-cone');
    await writeFile(path.join(directory, '.git/info/sparse-checkout'), [...selected.keys()].map(filename => `/${filename}`).join('\n') + '\n');
    await git('checkout', '--quiet', '--detach', commit);
    let totalBytes = 0;
    let count = 0;
    for (const [filename, entry] of selected) {
      const absolute = path.join(directory, filename);
      const metadata = await lstat(absolute);
      if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 16_384) throw new Error('Description is not a bounded plain text file.');
      totalBytes += metadata.size;
      if (totalBytes > 32 * 1024 * 1024) throw new Error('Descriptions exceed memory limit.');
      const text = (await readFile(absolute, 'utf8')).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
      if (!text || text.length > 6000) continue;
      for (const resource of repositoryResources.get(entry.key) || []) {
        resource.summaries = { ...resource.summaries, [entry.locale]: text };
        count++;
      }
    }
    return count;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  let previous: Catalog | undefined;
  try { const loaded: unknown = JSON.parse(await readFile(output, 'utf8')); validateCatalog(loaded); previous = loaded; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  let commit = option('--commit');
  if (!commit) {
    const metadata = JSON.parse(new TextDecoder().decode(await fetchBytes(`https://api.github.com/repos/${REPOSITORY}/git/ref/heads/main`, 128 * 1024, 'application/vnd.github+json'))) as { object: { sha: string } };
    commit = metadata.object?.sha;
  }
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Expected a full pinned Git commit SHA.');
  console.log(`Syncing pinned source ${commit}.`);
  const observedAt = new Date().toISOString();
  const localReadme = option('--readme');
  const markdown = localReadme ? await readFile(localReadme, 'utf8') : new TextDecoder().decode(await fetchBytes(`https://raw.githubusercontent.com/${REPOSITORY}/${commit}/README.md`, 4 * 1024 * 1024));
  const parsed = parseReadme(markdown, observedAt);
  if (parsed.resources.length < 100 || parsed.sourceEntryCount < 1000) throw new Error('Source appears truncated or its format changed; snapshot preserved.');
  if (previous && parsed.resources.length < previous.resources.length * 0.8 && !args.includes('--allow-large-removal')) throw new Error('More than 20% of resources disappeared; review upstream before using --allow-large-removal.');
  if (!args.includes('--no-descriptions')) {
    console.log('Importing selected multilingual descriptions with a partial Git checkout.');
    const summaryCount = await enrichDescriptions(parsed.resources, commit);
    if (summaryCount < 100) throw new Error('Multilingual description import appears incomplete; snapshot preserved.');
    console.log(`Imported ${summaryCount} upstream localized descriptions.`);
  } else if (previous) {
    // Skipping the optional enrichment must not silently remove existing translations.
    const old = new Map(previous.resources.map(resource => [resource.id, resource]));
    for (const resource of parsed.resources) resource.summaries = canEnrichResource(resource) ? old.get(resource.id)?.summaries : undefined;
  }
  const catalog = buildCatalog(parsed, previous, commit, observedAt);
  if (args.includes('--no-wiki')) {
    if (previous?.wiki && previous.wiki.sourceCommit !== commit) throw new Error('Cannot preserve a wiki snapshot from a different source commit.');
    catalog.wiki = previous?.wiki;
  } else {
    const boundedBytes = (name: string, fallback: number, maximum: number) => {
      const value = Number(process.env[name] || fallback);
      if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error(`Invalid ${name}.`);
      return value;
    };
    catalog.wiki = await syncWiki(catalog.resources, commit, observedAt, previous?.wiki, {
      cacheDirectory: process.env.WIKI_CACHE_DIR,
      allowLargeRemoval: args.includes('--allow-large-removal'),
      limits: { ...DEFAULT_WIKI_LIMITS, documentBytes: boundedBytes('WIKI_MAX_DOCUMENT_BYTES', DEFAULT_WIKI_LIMITS.documentBytes, 16 * 1024 * 1024), totalBytes: boundedBytes('WIKI_MAX_TEXT_BYTES', DEFAULT_WIKI_LIMITS.totalBytes, 128 * 1024 * 1024) },
    });
  }
  if (catalog.wiki) validateWikiSnapshot(catalog.wiki, catalog.resources, commit);
  validateCatalog(catalog);
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`);
  await rename(temporary, output);
  console.log(`Saved ${catalog.resources.length} resources from ${catalog.sourceEntryCount} source entries at ${commit}. ${previous ? 'Observation history preserved.' : 'Initial observation baseline; update feed starts empty.'}`);
}

main().catch(error => { console.error(`Catalog sync failed: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
