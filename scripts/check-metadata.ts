import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { Resource } from '../src/lib/types';
import { validateCatalog } from './catalog-core';

type MetadataStatus = 'ok' | 'unavailable' | 'restricted' | 'unknown';
type MetadataFetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export interface MetadataResult {
  status: MetadataStatus;
  maintenance?: Resource['maintenance'];
  upstreamUpdatedAt?: string;
  stop?: boolean;
}

export function githubRepository(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (url.hostname !== 'github.com' || url.username || url.password || url.port) return;
    const [owner, repository] = url.pathname.split('/').filter(Boolean);
    if (!owner || !repository || !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(owner) || !/^[a-z\d_.-]{1,100}$/i.test(repository) || ['features', 'topics', 'collections', 'orgs', 'users', 'settings', 'login', 'signup', 'search', 'sponsors', 'marketplace', 'notifications'].includes(owner.toLowerCase())) return;
    return `${owner}/${repository.replace(/\.git$/i, '')}`.toLowerCase();
  } catch { return; }
}

function validTimestamp(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(raw)) return;
  const time = Date.parse(raw);
  if (!Number.isFinite(time)) return;
  const normalized = new Date(time).toISOString();
  // Date.parse silently rolls dates such as February 30 into March.
  if (normalized.slice(0, 19) !== raw.slice(0, 19)) return;
  return normalized;
}

/** GitHub's archived=false only proves that the repository is not archived. */
export function mapGithubMetadata(payload: unknown): MetadataResult {
  if (!payload || typeof payload !== 'object' || typeof (payload as { archived?: unknown }).archived !== 'boolean') return { status: 'unknown' };
  const data = payload as { archived: boolean; pushed_at?: unknown };
  return {
    status: 'ok', maintenance: data.archived ? 'archived' : 'active',
    upstreamUpdatedAt: validTimestamp(data.pushed_at),
  };
}

export function allowedMetadataEndpoint(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'api.github.com' && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/(?:repos\/[A-Za-z\d_.-]+\/[A-Za-z\d_.-]+|repositories\/\d+)$/.test(url.pathname);
  } catch { return false; }
}

async function boundedJson(response: Response): Promise<unknown> {
  const maximum = 128 * 1024;
  if (Number(response.headers.get('content-length')) > maximum) throw new Error('Metadata response exceeds limit.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Metadata response is empty.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maximum) { await reader.cancel(); throw new Error('Metadata response exceeds limit.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function checkGithubMetadata(repository: string, options: { token?: string; fetcher?: MetadataFetcher } = {}): Promise<MetadataResult> {
  if (githubRepository(`https://github.com/${repository}`) !== repository) return { status: 'unknown' };
  let endpoint = `https://api.github.com/repos/${repository}`;
  const fetcher = options.fetcher || fetch;
  const signal = AbortSignal.timeout(12_000);
  try {
    for (let redirects = 0; redirects <= 2; redirects++) {
      if (!allowedMetadataEndpoint(endpoint)) return { status: 'unknown' };
      // Only approved api.github.com endpoints can ever receive this credential.
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'GameSecurityAtlas-MetadataCheck/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      };
      if (options.token) headers.Authorization = `Bearer ${options.token}`;
      const response = await fetcher(endpoint, { method: 'GET', headers, redirect: 'manual', signal });
      if ([301, 302, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) return { status: 'unknown' };
        endpoint = new URL(location, endpoint).toString();
        continue;
      }
      if (response.status === 401 || response.status === 403 || response.status === 429) {
        await response.body?.cancel();
        return { status: 'restricted', stop: true };
      }
      if (response.status === 404 || response.status === 410) {
        await response.body?.cancel();
        return { status: 'unavailable' };
      }
      if (!response.ok) { await response.body?.cancel(); return { status: 'unknown' }; }
      return mapGithubMetadata(await boundedJson(response));
    }
    return { status: 'unknown' };
  } catch { return { status: 'unknown' }; }
}

export function applyMetadata(resource: Resource, result: MetadataResult, checkedAt: string): void {
  if (!validTimestamp(checkedAt)) throw new Error('Metadata observation timestamp is invalid.');
  resource.metadataCheckedAt = checkedAt;
  resource.metadataStatus = result.status;
  if (result.status !== 'ok') return;
  resource.metadataVerifiedAt = checkedAt;
  resource.maintenance = result.maintenance || 'unknown';
  // A null or invalid pushed_at is unknown, not the time the API request ran.
  resource.upstreamUpdatedAt = result.upstreamUpdatedAt;
}

export function metadataRotation(resources: Resource[], limit: number): { repository: string; resources: Resource[] }[] {
  const groups = new Map<string, Resource[]>();
  for (const resource of resources) {
    const repository = githubRepository(resource.url);
    if (repository) groups.set(repository, [...(groups.get(repository) || []), resource]);
  }
  const lastAttempt = (items: Resource[]) => items.map(resource => resource.metadataCheckedAt || '').sort()[0];
  return [...groups.entries()].map(([repository, members]) => ({ repository, resources: members }))
    .sort((a, b) => lastAttempt(a.resources).localeCompare(lastAttempt(b.resources)) || a.repository.localeCompare(b.repository))
    .slice(0, Math.max(0, Math.min(100, Math.floor(limit))));
}

async function main() {
  const args = process.argv.slice(2);
  const number = (name: string, fallback: number, maximum: number) => {
    const index = args.indexOf(name);
    const value = index < 0 ? fallback : Number(args[index + 1]);
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} requires a positive integer.`);
    return Math.min(value, maximum);
  };
  const limit = number('--limit', 40, 100);
  const concurrency = number('--concurrency', 2, 3);
  const filename = path.resolve('src/data/catalog.json');
  const catalog: unknown = JSON.parse(await readFile(filename, 'utf8'));
  validateCatalog(catalog);
  const selected = metadataRotation(catalog.resources, limit);
  let index = 0;
  let stopped = false;
  const counts: Record<MetadataStatus, number> = { ok: 0, unavailable: 0, restricted: 0, unknown: 0 };
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (!stopped && index < selected.length) {
      const group = selected[index++];
      const result = await checkGithubMetadata(group.repository, { token: process.env.GITHUB_TOKEN });
      const checkedAt = new Date().toISOString();
      for (const resource of group.resources) applyMetadata(resource, result, checkedAt);
      counts[result.status]++;
      if (result.stop) stopped = true;
    }
  }));
  validateCatalog(catalog);
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`);
  await rename(temporary, filename);
  console.log(`GitHub metadata checks: ${JSON.stringify(counts)}.${stopped ? ' Stopped early after API restriction.' : ''} Nonarchived status does not establish recent maintenance; repository push dates are upstream evidence.`);
}

if (import.meta.main) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
