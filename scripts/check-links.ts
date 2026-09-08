import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { Resource } from '../src/lib/types';
import { validateCatalog } from './catalog-core';

const blocked = new BlockList();
const blockedIPv6 = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 96], ['::ffff:0:0', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48],
  ['100::', 64], ['2001::', 23], ['2001:db8::', 32], ['2002::', 16],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blockedIPv6.addSubnet(network, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, 'ipv4') : family === 6 ? !blockedIPv6.check(address, 'ipv6') : false;
}

export function validateLinkUrl(raw: string): URL {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw new Error('Unsupported link destination.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.localhost') || (isIP(hostname) && !isPublicAddress(hostname))) throw new Error('Private link destination.');
  return url;
}

/** Pin the checked DNS address into the actual connection to avoid a second DNS lookup. */
async function requestOnce(url: URL, method: 'HEAD' | 'GET', signal: AbortSignal): Promise<{ status: number; location?: string }> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await Promise.race([
    lookup(hostname, { all: true }),
    new Promise<never>((_resolve, reject) => {
      if (signal.aborted) reject(new Error('Link check timed out.'));
      else signal.addEventListener('abort', () => reject(new Error('Link check timed out.')), { once: true });
    }),
  ]);
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('Destination does not resolve exclusively to public addresses.');
  const target = addresses[0];
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(url, {
      method, signal, timeout: 8000, family: target.family,
      headers: { 'User-Agent': 'GameSecurityAtlas-LinkCheck/1.0', ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}) },
      lookup: (_hostname, _options, callback) => callback(null, target.address, target.family),
    }, response => {
      resolve({ status: response.statusCode || 0, location: response.headers.location });
      response.destroy();
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('Link check timed out.')));
    request.end();
  });
}

export async function checkLink(raw: string): Promise<Resource['linkStatus']> {
  try {
    let url = validateLinkUrl(raw);
    const signal = AbortSignal.timeout(25_000);
    for (let redirects = 0; redirects <= 5; redirects++) {
      let response = await requestOnce(url, 'HEAD', signal);
      if ([405, 501].includes(response.status)) response = await requestOnce(url, 'GET', signal);
      if ([301, 302, 303, 307, 308].includes(response.status) && response.location) {
        url = validateLinkUrl(new URL(response.location, url).toString());
        continue;
      }
      if ([401, 403, 429].includes(response.status)) return 'restricted';
      if (response.status >= 200 && response.status < 400) return 'ok';
      if (response.status >= 400) return 'unavailable';
      return 'unknown';
    }
    return 'unknown';
  } catch { return 'unknown'; }
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name: string, fallback: number) => {
    const index = args.indexOf(name);
    if (index < 0) return fallback;
    const number = Number(args[index + 1]);
    if (!Number.isInteger(number) || number < 1) throw new Error(`${name} requires a positive integer.`);
    return number;
  };
  const limit = Math.min(value('--limit', 25), 200);
  const concurrency = Math.min(value('--concurrency', 3), 5);
  const filename = path.resolve('src/data/catalog.json');
  const catalog: unknown = JSON.parse(await readFile(filename, 'utf8'));
  validateCatalog(catalog);
  const selected = [...catalog.resources].sort((a, b) => (a.lastCheckedAt || '').localeCompare(b.lastCheckedAt || '') || a.id.localeCompare(b.id)).slice(0, limit);
  let index = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (index < selected.length) {
      const resource = selected[index++];
      resource.linkStatus = await checkLink(resource.url);
      resource.lastCheckedAt = new Date().toISOString();
    }
  }));
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(catalog, null, 2)}\n`);
  await rename(temporary, filename);
  const counts = selected.reduce<Record<string, number>>((result, resource) => ({ ...result, [resource.linkStatus]: (result[resource.linkStatus] || 0) + 1 }), {});
  console.log(`Checked ${selected.length} links: ${JSON.stringify(counts)}. Unknown means the check was inconclusive; a link response does not establish project maintenance.`);
}

if (import.meta.main) main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
