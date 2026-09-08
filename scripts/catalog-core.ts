import { createHash } from 'node:crypto';
import type { Catalog, Resource, ResourceKind } from '../src/lib/types';

/** Preserve the source taxonomy; enrichment is separately limited to conceptual material. */
const SOURCE_SECTIONS = new Set([
  'Game Engine', 'Mathematics', 'Renderer', '3D Graphics', 'AI', 'Image Codec',
  'Wavefront Obj', 'Task Scheduler', 'Game Network', 'PhysX SDK', 'Game Develop',
  'Game Assets', 'Game Hot Patch', 'Game Testing', 'Game Tools', 'Game Manager',
  'Game CI', 'DirectX', 'OpenGL', 'Vulkan', 'Anti Cheat', 'Windows Security Features',
  'WSL', 'WSA', 'Windows Emulator', 'Linux Emulator', 'Android Emulator',
  'IOS Emulator', 'Game Boy', 'GameCube/Wii', 'Nintendo 3DS', 'Nintendo Switch',
  'Xbox', 'PlayStation', 'Cheat', 'Some Tricks',
]);
const UNSAFE = /\b(?:bypass(?:es|ing)?|exploit(?:s|ation|ing)?|payloads?|shellcode|aimbot|wallhack|speedhack|inject(?:ion|or|ing)?|spoof(?:er|ing)?|hijack(?:ing)?|evasion|rootkit|keylogger|ransomware|malware|crack(?:ing)?|jailbreak|dumper|dumping|vulnerable[-_ ]drivers?|cve[-_ ]\d|kernel[-_ ]loader|dll[-_ ]loader|manual[-_ ]map(?:per|ping)?|game[-_ ]hack(?:ing)?|piracy)\b/i;
const UNSAFE_SUBSECTION = /\b(?:hook|overlay|injection|bypass|exploit|cheat|attack)\b/i;
const OFFICIAL_DEFENSE_HOSTS = new Set([
  'learn.microsoft.com', 'docs.microsoft.com', 'developer.microsoft.com',
  'dev.epicgames.com', 'technology.riotgames.com', 'developer.valvesoftware.com',
  'partner.steamgames.com', 'www.easy.ac', 'easy.ac', 'developer.android.com',
  'source.android.com', 'developer.apple.com', 'support.apple.com',
]);

export function canonicalUrl(raw: string, preserveFragment = false): string | undefined {
  try {
    const url = new URL(raw.replace(/&amp;/g, '&'));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost')) return;
    if (host === 'github.com' || host === 'www.github.com') {
      url.protocol = 'https:';
      url.hostname = 'github.com';
      // Repository names are case-insensitive; GitHub file paths are not.
      const parts = url.pathname.split('/');
      if (parts[1]) parts[1] = parts[1].toLowerCase();
      if (parts[2]) parts[2] = parts[2].replace(/\.git$/i, '').toLowerCase();
      url.pathname = parts.join('/');
    }
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.pathname = url.pathname.replace(/\/$/, '') || '/';
    // Identity merges page anchors; sourceUrl retains a useful navigation destination.
    if (!preserveFragment) url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch { return; }
}

export function resourceId(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

function cleanText(value: string, preserveBrackets = false): string {
  return value.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*`]/g, '').replace(preserveBrackets ? /^\s*[-—:]\s*/g : /^\s*(?:[-—:]\s*|\[)|\]\s*$/g, '')
    .replace(/\s+/g, ' ').trim();
}

/** Scan balanced parentheses so URLs such as docs/Foo_(bar) are kept intact. */
function firstLink(line: string): { url: string; label?: string; before: string; after: string } | undefined {
  const match = /https?:\/\//.exec(line);
  if (!match) return;
  const start = match.index;
  let end = start;
  let depth = 0;
  while (end < line.length) {
    const c = line[end];
    if (/\s/.test(c) || c === '<' || c === '>') break;
    if (c === '(') depth++;
    if (c === ')') { if (depth === 0) break; depth--; }
    end++;
  }
  const raw = line.slice(start, end).replace(/[,;]+$/, '');
  const before = line.slice(0, start);
  const labelMatch = /\[([^\]]+)\]\($/.exec(before);
  let after = line.slice(end);
  if (labelMatch && after.startsWith(')')) after = after.slice(1);
  if (before.endsWith('<') && after.startsWith('>')) after = after.slice(1);
  return { url: raw, label: labelMatch?.[1], before, after };
}

export function isEnrichmentEligible(section: string, subsection: string, url: string, text: string): boolean {
  if (!SOURCE_SECTIONS.has(section) || ['Cheat', 'Some Tricks'].includes(section) || UNSAFE_SUBSECTION.test(subsection)) return false;
  const material = `${url} ${text}`.replace(/cheat[-_ ]?sheets?/gi, 'reference');
  if (UNSAFE.test(material) || /\bcheat(?:s|er|ing)?\b/i.test(material)) return false;
  if (section === 'Anti Cheat' && !OFFICIAL_DEFENSE_HOSTS.has(new URL(url).hostname)) return false;
  return true;
}

export function canEnrichResource(resource: Resource): boolean {
  const primary = resource.categories.filter(category => !category.includes(' / '));
  if (primary.some(category => ['Cheat', 'Some Tricks'].includes(category))) return false;
  return primary.some(category => isEnrichmentEligible(category, resource.categories.filter(item => item.startsWith(`${category} / `)).join(' '), resource.url, `${resource.title} ${resource.description}`));
}

function inferMetadata(title: string, description: string, categories: string[]) {
  const text = `${title} ${description} ${categories.join(' ')}`.replace(/([a-z])([A-Z])/g, '$1 $2');
  const engines = [
    ['Unity', /\bunity\b/i], ['Unreal', /\bunreal\b|\bue[45]\b/i], ['Godot', /\bgodot\b/i],
    ['Bevy', /\bbevy\b/i], ['Cocos', /\bcocos(?:2d)?\b/i], ['Source', /\bsource engine\b/i],
  ].filter(([, pattern]) => (pattern as RegExp).test(text)).map(([name]) => name as string);
  const platforms = [
    ['Windows', /windows|directx|\bwin32\b|\bd3d\d*/i], ['Linux', /linux|\bwsl\b/i],
    ['macOS', /macos|osx|\bmetal\b/i], ['Android', /android/i], ['iOS', /\bios\b/i],
    ['Web', /webgl|webgpu|webassembly|\bbrowser\b/i],
  ].filter(([, pattern]) => (pattern as RegExp).test(text)).map(([name]) => name as string);
  let kind: ResourceKind = 'tool';
  if (/awesome|collection|curated|\blists?\b/i.test(`${title} ${description}`)) kind = 'collection';
  else if (/guide|tutorial|book|learn|study|course|beginner/i.test(text)) kind = 'guide';
  else if (/reference|documentation|\bdocs\b|specification/i.test(text)) kind = 'reference';
  else if (/library|framework|\bsdk\b|\bsource\b|\bapi\b/i.test(text)) kind = 'library';
  return { engines, platforms, kind, level: /beginner|getting started|introduction|入门|入門/i.test(`${title} ${description}`) ? 'beginner' as const : 'all' as const };
}

export function parseReadme(markdown: string, observedAt: string): { resources: Resource[]; sourceEntryCount: number } {
  const resources = new Map<string, Resource>();
  let section = '';
  let subsection = '';
  let fenced = false;
  let sourceEntryCount = 0;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const heading = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) { section = cleanText(heading[1], true); subsection = ''; continue; }
    const subheading = /^(?:>\s*|#{3,6}\s+)(.+)$/.exec(line);
    if (subheading) { subsection = cleanText(subheading[1], true); continue; }
    if (!/^\s*[-*+]\s+/.test(line)) continue;
    const link = firstLink(line);
    if (!link) continue;
    if (SOURCE_SECTIONS.has(section)) sourceEntryCount++;
    const url = canonicalUrl(link.url);
    if (!url || !SOURCE_SECTIONS.has(section)) continue;
    const destination = canonicalUrl(link.url, true);
    const sourceUrl = destination !== url ? destination : undefined;
    // Display the source repository spelling even though its identity is case-insensitive.
    const parsed = new URL(link.url);
    const pathname = parsed.pathname.split('/').filter(Boolean);
    const inferredTitle = parsed.hostname === 'github.com' && pathname.length >= 2
      ? pathname[1].replace(/\.git$/i, '') : pathname.at(-1) ? `${parsed.hostname} / ${decodeURIComponent(pathname.at(-1)!)}` : parsed.hostname;
    const title = cleanText(link.label || inferredTitle);
    const description = cleanText(link.after);
    const categories = [section, ...(subsection ? [`${section} / ${subsection}`] : [])];
    const previous = resources.get(url);
    if (previous) {
      previous.categories = [...new Set([...previous.categories, ...categories])];
      previous.sourceUrl ||= sourceUrl;
      if (description.length > previous.description.length) previous.description = description;
      if (link.label && previous.title === inferredTitle) previous.title = title;
      const metadata = inferMetadata(previous.title, previous.description, previous.categories);
      Object.assign(previous, metadata);
      previous.tags = [...new Set([...previous.categories, ...metadata.engines, ...metadata.platforms])];
      continue;
    }
    const metadata = inferMetadata(title, description, categories);
    resources.set(url, {
      id: resourceId(url), title, url, sourceUrl, description, categories,
      tags: [...new Set([...categories, ...metadata.engines, ...metadata.platforms])],
      ...metadata, firstSeenAt: observedAt, contentChangedAt: observedAt,
      linkStatus: 'unknown', maintenance: 'unknown',
    });
  }
  return { resources: [...resources.values()].sort((a, b) => a.url.localeCompare(b.url, 'en')), sourceEntryCount };
}

function contentFingerprint(resource: Resource): string {
  const { title, url, description, summaries, categories, tags, kind, platforms, engines, level } = resource;
  return JSON.stringify({ title, url, description, summaries: Object.fromEntries(Object.entries(summaries || {}).sort()), categories: [...categories].sort(), tags: [...tags].sort(), kind, platforms: [...platforms].sort(), engines: [...engines].sort(), level });
}

/** An initial import establishes an observation baseline, never an invented update feed. */
export function buildCatalog(parsed: ReturnType<typeof parseReadme>, previous: Catalog | undefined, sourceCommit: string, syncedAt: string): Catalog {
  const old = new Map(previous?.resources.map(resource => [resource.id, resource]) || []);
  const fresh = new Set(parsed.resources.map(resource => resource.id));
  const changes: Catalog['changes'] = [];
  const resources = parsed.resources.map(resource => {
    const prior = old.get(resource.id);
    if (!prior) {
      if (previous) changes.push({ resourceId: resource.id, title: resource.title, url: resource.url, type: 'added', date: syncedAt });
      return resource;
    }
    const destinationChanged = (resource.sourceUrl || resource.url) !== (prior.sourceUrl || prior.url);
    // Backfilling destinations from an already observed source commit is a parser
    // correction. A destination changed in a later source revision is an update.
    const changed = contentFingerprint(resource) !== contentFingerprint(prior) || (destinationChanged && sourceCommit !== previous?.sourceCommit);
    if (changed) changes.push({ resourceId: resource.id, title: resource.title, url: resource.url, type: 'updated', date: syncedAt });
    return {
      ...resource, firstSeenAt: prior.firstSeenAt,
      contentChangedAt: changed ? syncedAt : prior.contentChangedAt,
      upstreamUpdatedAt: prior.upstreamUpdatedAt, lastCheckedAt: prior.lastCheckedAt,
      metadataCheckedAt: prior.metadataCheckedAt, metadataStatus: prior.metadataStatus,
      metadataVerifiedAt: prior.metadataVerifiedAt,
      linkStatus: prior.linkStatus, maintenance: prior.maintenance,
    };
  });
  for (const prior of old.values()) {
    if (!fresh.has(prior.id)) changes.push({ resourceId: prior.id, title: prior.title, url: prior.url, type: 'removed', date: syncedAt });
  }
  const cutoff = new Date(syncedAt).getTime() - 180 * 24 * 60 * 60 * 1000;
  const retained = [...changes, ...(previous?.changes || [])].filter(change => new Date(change.date).getTime() >= cutoff).slice(0, 1000);
  return { version: 1, sourceCommit, syncedAt, baselineAt: previous?.baselineAt || syncedAt, resources, changes: retained, sourceEntryCount: parsed.sourceEntryCount };
}

export function validateCatalog(value: unknown): asserts value is Catalog {
  if (!value || typeof value !== 'object') throw new Error('Catalog must be an object.');
  const catalog = value as Catalog;
  if (catalog.version !== 1 || !/^[a-f0-9]{40}$/.test(catalog.sourceCommit) || !Number.isFinite(Date.parse(catalog.syncedAt)) || !Number.isFinite(Date.parse(catalog.baselineAt)) || !Array.isArray(catalog.resources) || !Array.isArray(catalog.changes) || !Number.isInteger(catalog.sourceEntryCount) || catalog.sourceEntryCount < catalog.resources.length) throw new Error('Catalog metadata is invalid.');
  const seen = new Set<string>();
  const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
  for (const resource of catalog.resources) {
    if (typeof resource.url !== 'string' || canonicalUrl(resource.url) !== resource.url || resource.id !== resourceId(resource.url) || seen.has(resource.id) || typeof resource.title !== 'string' || !resource.title || typeof resource.description !== 'string' || !stringArray(resource.categories) || !resource.categories.length || !stringArray(resource.tags) || !stringArray(resource.platforms) || !stringArray(resource.engines) || !['tool', 'guide', 'reference', 'library', 'collection'].includes(resource.kind) || !['beginner', 'intermediate', 'advanced', 'all'].includes(resource.level) || !['unknown', 'ok', 'unavailable', 'restricted'].includes(resource.linkStatus) || !['unknown', 'active', 'archived'].includes(resource.maintenance) || !Number.isFinite(Date.parse(resource.firstSeenAt)) || !Number.isFinite(Date.parse(resource.contentChangedAt)) || (resource.summaries && Object.values(resource.summaries).some(value => typeof value !== 'string'))) throw new Error(`Invalid resource: ${resource.id || 'missing id'}`);
    seen.add(resource.id);
    if (resource.sourceUrl && canonicalUrl(resource.sourceUrl) !== resource.url) throw new Error('Source destination does not match resource identity.');
    for (const date of [resource.upstreamUpdatedAt, resource.lastCheckedAt, resource.metadataCheckedAt, resource.metadataVerifiedAt]) {
      if (date !== undefined && !Number.isFinite(Date.parse(date))) throw new Error('Invalid resource metadata timestamp.');
    }
    if (resource.metadataStatus !== undefined && !['ok', 'unavailable', 'restricted', 'unknown'].includes(resource.metadataStatus)) throw new Error('Invalid repository metadata status.');
  }
  for (const change of catalog.changes) {
    if (!/^[a-f0-9]{16}$/.test(change.resourceId) || !['added', 'updated', 'removed'].includes(change.type) || typeof change.title !== 'string' || !canonicalUrl(change.url) || !Number.isFinite(Date.parse(change.date))) throw new Error('Invalid observation history.');
  }
}
