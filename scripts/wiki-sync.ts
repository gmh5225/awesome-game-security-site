import { readFile, writeFile, mkdir, mkdtemp, rename, rm, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Resource } from '../src/lib/types';
import type { WikiSnapshot } from '../src/lib/wiki-types';
import { buildWikiSnapshot, gitBlobSha, isWikiDocumentPath, parseWikiDocument, validateWikiIndex, validateWikiSnapshot, WIKI_REPOSITORY, type WikiFile } from './wiki-core';

const exec = promisify(execFile);
const SHA = /^[a-f0-9]{40}$/;
interface Tree { truncated?: boolean; tree: { path: string; sha: string; mode: string; type: string; size?: number }[] }
export interface WikiLimits { documentBytes: number; totalBytes: number; fileCount: number }
export const DEFAULT_WIKI_LIMITS: WikiLimits = { documentBytes: 1024 * 1024, totalBytes: 32 * 1024 * 1024, fileCount: 20_000 };

export async function fetchWikiTree(commit: string, fetcher: typeof fetch = fetch): Promise<WikiFile[]> {
  if (!SHA.test(commit)) throw new Error('Wiki import requires a full pinned commit SHA.');
  let requests = 0;
  async function tree(sha: string, recursive = false): Promise<Tree> {
    if (!SHA.test(sha) || ++requests > 128) throw new Error('Wiki tree request limit exceeded.');
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'GameSecurityAtlas-WikiSync/1.0' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const response = await fetcher(`https://api.github.com/repos/${WIKI_REPOSITORY}/git/trees/${sha}${recursive ? '?recursive=1' : ''}`, { headers, redirect: 'error', signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Wiki tree request failed (${response.status}).`);
    const maximum = 16 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > maximum) throw new Error('Wiki tree response exceeds limit.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Missing wiki tree response.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new Error('Wiki tree response exceeds limit.'); }
      chunks.push(next.value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Tree;
    if (!Array.isArray(result.tree) || result.tree.length > 100_000) throw new Error('Invalid wiki tree response.');
    return result;
  }
  const root = await tree(commit);
  if (root.truncated) throw new Error('Root tree is incomplete.');
  const wiki = root.tree.find(entry => entry.path === 'wiki' && entry.type === 'tree');
  if (!wiki) throw new Error('Pinned source has no wiki tree.');
  const entries: { prefix: string; item: Tree['tree'][number] }[] = [];
  async function appendTree(sha: string, prefix: string) {
    const recursive = await tree(sha, true);
    if (!recursive.truncated) entries.push(...recursive.tree.map(item => ({ prefix, item })));
    else {
      // Never accept a partial list as evidence that documents were deleted.
      const queue = [{ sha, prefix }];
      while (queue.length) {
        const next = queue.shift()!;
        const result = await tree(next.sha);
        if (result.truncated) throw new Error('Wiki source subtree is incomplete.');
        for (const item of result.tree) {
          if (item.type === 'tree') queue.push({ sha: item.sha, prefix: `${next.prefix}${item.path}/` });
          else entries.push({ prefix: next.prefix, item });
        }
      }
    }
  }
  await appendTree(wiki.sha, 'wiki/');
  // Only metadata is listed for original projection inputs. Their text is not fetched.
  for (const source of root.tree) {
    if (source.path === 'README.md' && source.type === 'blob') entries.push({ prefix: '', item: source });
    if (['description', '.claude'].includes(source.path) && source.type === 'tree') await appendTree(source.sha, `${source.path}/`);
  }
  const files: WikiFile[] = [];
  const paths = new Set<string>();
  for (const { prefix, item } of entries) {
    if (item.type !== 'blob') continue;
    const filename = `${prefix}${item.path}`;
    if (paths.has(filename) || !SHA.test(item.sha) || /[\0\r\n\\]/.test(filename) || filename.split('/').some(part => part === '..' || part === '.') || !Number.isSafeInteger(item.size) || item.size! < 0) throw new Error('Invalid or duplicate wiki file entry.');
    paths.add(filename);
    files.push({ path: filename, sha: item.sha, size: item.size!, mode: item.mode });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

export function selectWikiFiles(files: WikiFile[], limits = DEFAULT_WIKI_LIMITS): WikiFile[] {
  const selected = files.filter(file => isWikiDocumentPath(file.path) || file.path === 'wiki/index.md');
  if (!selected.some(file => file.path === 'wiki/index.md') || selected.length < 2 || selected.length > limits.fileCount) throw new Error('Unexpected wiki document count.');
  let bytes = 0;
  for (const file of selected) {
    if (!['100644', '100755'].includes(file.mode) || file.size > limits.documentBytes) throw new Error(`Wiki file exceeds bounds or is not a regular file: ${file.path}`);
    bytes += file.size;
    if (bytes > limits.totalBytes) throw new Error('Wiki text exceeds total size limit.');
  }
  return selected;
}

/** Cache entries are verified Git blobs, never executable modules or rendered Markdown. */
export async function loadWikiBlobs(files: WikiFile[], commit: string, cacheDirectory: string): Promise<Map<string, string>> {
  await mkdir(cacheDirectory, { recursive: true });
  const texts = new Map<string, string>();
  const missing: WikiFile[] = [];
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (const file of files) {
    const cached = path.join(cacheDirectory, `${file.sha}.md`);
    try {
      const info = await lstat(cached);
      if (!info.isFile() || info.isSymbolicLink() || info.size !== file.size) throw new Error('Invalid cached blob.');
      const bytes = await readFile(cached);
      if (gitBlobSha(bytes) !== file.sha) throw new Error('Cached blob hash mismatch.');
      texts.set(file.path, decoder.decode(bytes));
    } catch { missing.push(file); }
  }
  if (!missing.length) { console.log(`Wiki cache: ${files.length} verified files reused.`); return texts; }
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ags-wiki-source-'));
  const git = (...command: string[]) => exec('git', ['-c', 'core.hooksPath=/dev/null', ...command], { cwd: directory, timeout: 240_000, maxBuffer: 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_LFS_SKIP_SMUDGE: '1' } });
  try {
    await git('init', '--quiet');
    await git('remote', 'add', 'origin', `https://github.com/${WIKI_REPOSITORY}.git`);
    await git('config', 'remote.origin.promisor', 'true');
    await git('config', 'remote.origin.partialclonefilter', 'blob:none');
    await git('fetch', '--quiet', '--filter=blob:none', '--depth=1', '--no-tags', 'origin', commit);
    await git('sparse-checkout', 'init', '--no-cone');
    // Gitignore metacharacters are escaped so an upstream filename cannot widen checkout.
    await writeFile(path.join(directory, '.git/info/sparse-checkout'), missing.map(file => `/${file.path.replace(/[\\*?\[\]!#]/g, '\\$&')}`).join('\n') + '\n');
    await git('checkout', '--quiet', '--detach', commit);
    for (const file of missing) {
      const absolute = path.join(directory, file.path);
      const info = await lstat(absolute);
      if (!info.isFile() || info.isSymbolicLink() || info.size !== file.size) throw new Error('Downloaded wiki blob metadata mismatch.');
      const bytes = await readFile(absolute);
      if (gitBlobSha(bytes) !== file.sha) throw new Error('Downloaded wiki blob hash mismatch.');
      texts.set(file.path, decoder.decode(bytes));
      const destination = path.join(cacheDirectory, `${file.sha}.md`);
      const temporary = `${destination}.${process.pid}.tmp`;
      await writeFile(temporary, bytes);
      await rename(temporary, destination);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
  console.log(`Wiki cache: ${files.length - missing.length} files reused; ${missing.length} verified blobs imported.`);
  return texts;
}

export async function syncWiki(resources: Resource[], commit: string, observedAt: string, previous?: WikiSnapshot, options: { cacheDirectory?: string; limits?: WikiLimits; allowLargeRemoval?: boolean } = {}): Promise<WikiSnapshot> {
  const files = await fetchWikiTree(commit);
  const selected = selectWikiFiles(files, options.limits);
  const documents = selected.filter(file => isWikiDocumentPath(file.path));
  if (previous && documents.length < previous.documents.length * 0.8 && !options.allowLargeRemoval) throw new Error('More than 20% of wiki documents disappeared; snapshot preserved.');
  const texts = await loadWikiBlobs(selected, commit, options.cacheDirectory || path.resolve('node_modules/.cache/ags-wiki-blobs'));
  validateWikiIndex(texts.get('wiki/index.md')!, documents.map(file => file.path));
  const parsed = documents.map(file => parseWikiDocument(file.path, texts.get(file.path)!));
  const snapshot = buildWikiSnapshot(parsed, files.filter(file => ['100644', '100755'].includes(file.mode)), selected.find(file => file.path === 'wiki/index.md')!, resources, commit, observedAt, previous);
  if (snapshot.references.length > 200_000) throw new Error('Wiki reference count exceeds limit.');
  validateWikiSnapshot(snapshot, resources, commit, { files, parsed });
  console.log(`Wiki: ${snapshot.documents.length} indexed documents, ${snapshot.references.length} citations, ${snapshot.references.filter(ref => ref.status === 'unresolved').length} unresolved, ${snapshot.references.filter(ref => ref.status === 'ambiguous').length} ambiguous.`);
  return snapshot;
}
