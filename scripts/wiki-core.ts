import { createHash } from 'node:crypto';
import path from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Nodes } from 'mdast';
import { isSeq, parseDocument } from 'yaml';
import GithubSlugger from 'github-slugger';
import type { Resource } from '../src/lib/types';
import type { WikiDocument, WikiKind, WikiReference, WikiSnapshot } from '../src/lib/wiki-types';
import { canonicalUrl } from './catalog-core';

export const WIKI_REPOSITORY = 'gmh5225/awesome-game-security';
export interface WikiFile { path: string; sha: string; size: number; mode: string }
export interface ParsedWiki {
  path: string;
  title: string;
  kind: WikiKind;
  topics: string[];
  language: string;
  confidence: WikiDocument['confidence'];
  upstreamUpdatedAt?: string;
  anchors: string[];
  lineCount: number;
  links: { rawTarget: string; line: number; syntax: 'wiki' | 'markdown' | 'source' }[];
}
export const wikiId = (value: string) => createHash('sha256').update(`${WIKI_REPOSITORY}:${value}`).digest('hex').slice(0, 16);
export const wikiSourceUrl = (file: string, commit: string, fragment = '') => `https://github.com/${WIKI_REPOSITORY}/blob/${commit}/${file.split('/').map(encodeURIComponent).join('/')}${fragment}`;
export const isWikiDocumentPath = (file: string) => /^wiki\/(?:concepts|entities|overviews)\/[^\0\\]+\.md$/.test(file) && !file.split('/').some(part => part === '..' || part === '.');
export const gitBlobSha = (bytes: Uint8Array) => createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
const cleanLabel = (value: string) => value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const lineAt = (text: string, offset: number) => text.slice(0, offset).split('\n').length;

function visit(node: Nodes, callback: (node: Nodes) => boolean | void) {
  if (callback(node) === false) return;
  if ('children' in node) for (const child of node.children) visit(child, callback);
}

function markdownLinks(markdown: string, lineOffset = 0): ParsedWiki['links'] {
  const tree = fromMarkdown(markdown);
  const definitions = new Map<string, string>();
  visit(tree, node => { if (node.type === 'definition') definitions.set(node.identifier, node.url); });
  const links: ParsedWiki['links'] = [];
  visit(tree, node => {
    if (['code', 'inlineCode', 'html', 'definition'].includes(node.type)) return false;
    const line = (node.position?.start.line || 1) + lineOffset;
    if (node.type === 'link' || node.type === 'linkReference') {
      const rawTarget = node.type === 'link' ? node.url : definitions.get(node.identifier);
      if (rawTarget) links.push({ rawTarget, line, syntax: 'markdown' });
      return false;
    }
    if (node.type !== 'text') return;
    const add = (rawTarget: string, index: number, syntax: ParsedWiki['links'][number]['syntax']) => links.push({ rawTarget, line: line + lineAt(node.value, index) - 1, syntax });
    for (const match of node.value.matchAll(/\[\[([^\]\n]+)\]\]/g)) add(match[1], match.index!, 'wiki');
    for (const match of node.value.matchAll(/\bsource:\s*(wiki\/sources\/[^\s)\],;]+)/g)) add(match[1], match.index!, 'source');
    for (const match of node.value.matchAll(/https?:\/\/[^\s<>]+/g)) {
      let target = match[0].replace(/[.,;:!?]+$/, '');
      while (target.endsWith(')') && (target.match(/\)/g)?.length || 0) > (target.match(/\(/g)?.length || 0)) target = target.slice(0, -1);
      add(target, match.index!, 'markdown');
    }
  });
  return links;
}

function headingAnchors(markdown: string) {
  const slugger = new GithubSlugger();
  const anchors: string[] = [];
  visit(fromMarkdown(markdown), node => {
    if (node.type !== 'heading') return;
    let title = '';
    visit(node, child => {
      if (child.type === 'text' || child.type === 'inlineCode') title += child.value;
      else if (child.type === 'image') title += child.alt || '';
    });
    anchors.push(slugger.slug(title));
  });
  return anchors;
}

export function parseWikiDocument(file: string, markdown: string): ParsedWiki {
  if (!isWikiDocumentPath(file)) throw new Error('Unexpected wiki document path.');
  const lines = markdown.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0] !== '---') throw new Error(`Missing wiki frontmatter: ${file}`);
  const ending = lines.findIndex((line, index) => index > 0 && line === '---');
  if (ending < 0) throw new Error(`Unclosed wiki frontmatter: ${file}`);
  let header = lines.slice(1, ending).join('\n');
  let yaml = parseDocument(header, { uniqueKeys: true });
  if (yaml.errors.length) {
    // A known upstream title uses an unquoted colon. Repair only that scalar,
    // and only when every parser error is inside its one original title line.
    const headerLines = header.split('\n');
    const titleLines = headerLines.flatMap((line, index) => line.startsWith('title: ') ? [index] : []);
    if (titleLines.length === 1) {
      const titleIndex = titleLines[0];
      const start = headerLines.slice(0, titleIndex).reduce((length, line) => length + line.length + 1, 0);
      const rawTitle = headerLines[titleIndex].slice(7);
      const plainTitle = rawTitle && !/^["'\[\]{},&*!|>@`%]/.test(rawTitle) && !/(?:^|\s)#/.test(rawTitle);
      if (plainTitle && /:\s/.test(rawTitle) && yaml.errors.every(error => error.code === 'BLOCK_AS_IMPLICIT_KEY' && error.pos[0] >= start && error.pos[0] < start + headerLines[titleIndex].length)) {
        headerLines[titleIndex] = `title: ${JSON.stringify(rawTitle)}`;
        header = headerLines.join('\n');
        yaml = parseDocument(header, { uniqueKeys: true });
      }
    }
  }
  if (yaml.errors.length) throw new Error(`Invalid wiki frontmatter: ${file}`);
  const data: unknown = yaml.toJS({ maxAliasCount: 0 });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(`Invalid wiki fields: ${file}`);
  const fields = data as Record<string, unknown>;
  const expectedKind = file.startsWith('wiki/entities/') ? 'entity' : file.startsWith('wiki/concepts/') ? 'concept' : 'overview';
  if (fields.kind !== expectedKind || typeof fields.title !== 'string' || !fields.title.trim() || fields.title.length > 500) throw new Error(`Invalid wiki title or kind: ${file}`);
  if (!Array.isArray(fields.topics) || fields.topics.some(topic => typeof topic !== 'string' || topic.length > 100) || fields.topics.length > 100) throw new Error(`Invalid wiki topics: ${file}`);
  const confidence = ['high', 'medium', 'low'].includes(String(fields.confidence)) ? fields.confidence as WikiDocument['confidence'] : 'unknown';
  let upstreamUpdatedAt: string | undefined;
  if (fields.updated !== undefined) {
    if (typeof fields.updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fields.updated)) throw new Error(`Invalid declared wiki date: ${file}`);
    const parsed = new Date(`${fields.updated}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== fields.updated) throw new Error(`Invalid declared wiki date: ${file}`);
    upstreamUpdatedAt = parsed.toISOString();
  }
  const links: ParsedWiki['links'] = [];
  const sources = yaml.get('sources', true);
  if (sources !== undefined && !isSeq(sources)) throw new Error(`Invalid wiki sources: ${file}`);
  if (isSeq(sources)) for (const source of sources.items) {
    if (!source || typeof source !== 'object' || !('value' in source) || typeof source.value !== 'string') throw new Error(`Invalid wiki source target: ${file}`);
    const offset = 'range' in source && Array.isArray(source.range) ? source.range[0] : 0;
    links.push({ rawTarget: source.value, line: lineAt(header, offset) + 1, syntax: 'source' });
  }
  links.push(...markdownLinks(lines.slice(ending + 1).join('\n'), ending + 1));
  const unique = new Map<string, ParsedWiki['links'][number]>();
  for (const link of links.sort((a, b) => a.line - b.line)) {
    if (link.rawTarget.length > 4096) throw new Error(`Wiki reference exceeds limit: ${file}`);
    const key = link.rawTarget;
    if (!unique.has(key)) unique.set(key, link);
  }
  return { path: file, title: cleanLabel(fields.title), kind: expectedKind, topics: [...new Set((fields.topics as string[]).map(cleanLabel))].sort(), language: typeof fields.language === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/.test(fields.language) ? fields.language : 'unknown', confidence, upstreamUpdatedAt, anchors: headingAnchors(lines.slice(ending + 1).join('\n')), lineCount: lines.length, links: [...unique.values()] };
}

function relativeTarget(target: string, origin: string): string | undefined {
  let decoded: string;
  try { decoded = decodeURIComponent(target); } catch { return; }
  if (decoded.includes('\0') || decoded.includes('\\')) return;
  const joined = decoded.startsWith('wiki/') ? path.posix.normalize(decoded) : decoded.startsWith('/') ? path.posix.normalize(decoded.slice(1)) : path.posix.normalize(path.posix.join(path.posix.dirname(origin), decoded));
  return joined.startsWith('wiki/') ? joined : undefined;
}

export function validateWikiIndex(markdown: string, documentPaths: string[]) {
  const indexed: string[] = [];
  for (const reference of markdownLinks(markdown)) {
    if (reference.syntax !== 'markdown') continue;
    const file = relativeTarget(reference.rawTarget.split('#')[0], 'wiki/index.md');
    if (file && isWikiDocumentPath(file)) indexed.push(file);
  }
  const known = new Set(documentPaths);
  const unique = new Set(indexed);
  if (unique.size !== indexed.length || unique.size !== known.size || [...unique].some(file => !known.has(file))) throw new Error('Wiki index and tracked document files disagree; snapshot preserved.');
}

export function buildWikiSnapshot(parsed: ParsedWiki[], files: WikiFile[], index: WikiFile, resources: Resource[], commit: string, observedAt: string, previous?: WikiSnapshot): WikiSnapshot {
  const fileMap = new Map(files.map(file => [file.path, file]));
  const old = new Map(previous?.documents.map(doc => [doc.id, doc]) || []);
  const documents: WikiDocument[] = parsed.map(doc => {
    const source = fileMap.get(doc.path);
    if (!source) throw new Error('Wiki document is not tracked.');
    const id = wikiId(doc.path);
    const prior = old.get(id);
    return { id, path: doc.path, slug: doc.path.slice(5, -3), title: doc.title, kind: doc.kind, topics: doc.topics, language: doc.language, confidence: doc.confidence, upstreamUpdatedAt: doc.upstreamUpdatedAt, blobSha: source.sha, sourceUrl: wikiSourceUrl(doc.path, commit), firstSeenAt: prior?.firstSeenAt || observedAt, contentChangedAt: prior?.blobSha === source.sha ? prior.contentChangedAt : observedAt };
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  const byPath = new Map(documents.map(doc => [doc.path, doc]));
  const parsedByPath = new Map(parsed.map(doc => [doc.path, doc]));
  const projections = new Map<string, string[]>();
  const addProjection = (projection: string, source: string) => projections.set(projection, [...(projections.get(projection) || []), source]);
  // These are the deterministic projection rules in the pinned upstream generator.
  // Match from verified source files toward projection names, never guess a split.
  for (const file of files) {
    if (file.path === 'README.md') addProjection('wiki/sources/README-categories.md', file.path);
    const skill = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/.exec(file.path);
    if (skill) addProjection(`wiki/sources/skills/${skill[1]}.md`, file.path);
    const description = /^description\/([^/]+)\/([^/]+)\/description_en\.txt$/.exec(file.path);
    if (description) addProjection(`wiki/sources/descriptions/${description[1]}__${description[2]}.md`, file.path);
  }
  const bySlug = new Map<string, WikiDocument[]>();
  for (const doc of documents) {
    const slug = path.posix.basename(doc.path, '.md');
    bySlug.set(slug, [...(bySlug.get(slug) || []), doc]);
  }
  const byUrl = new Map<string, string[]>();
  for (const resource of resources) byUrl.set(resource.url, [...(byUrl.get(resource.url) || []), resource.id]);
  const references: WikiReference[] = [];
  for (const doc of parsed) for (const link of doc.links) {
    const documentId = wikiId(doc.path);
    const ref: WikiReference = { id: wikiId(`${doc.path}:${link.rawTarget}`), documentId, type: link.syntax === 'source' ? 'source' : 'wiki', rawTarget: link.rawTarget, line: link.line, status: 'unresolved', resourceIds: [] };
    let target = link.syntax === 'wiki' ? link.rawTarget.split('|')[0] : link.rawTarget;
    const hashIndex = target.indexOf('#');
    const fragment = hashIndex >= 0 ? target.slice(hashIndex) : '';
    target = hashIndex >= 0 ? target.slice(0, hashIndex) : target;
    const external = canonicalUrl(link.rawTarget, true);
    if (external) {
      const url = new URL(external);
      const prefix = `/${WIKI_REPOSITORY}/blob/`;
      const parts = url.pathname.slice(prefix.length).split('/');
      if (url.hostname === 'github.com' && url.pathname.startsWith(prefix) && ['main', 'HEAD', commit].includes(parts[0]) && parts[1] === 'wiki') target = parts.slice(1).join('/');
      else {
        ref.resourceIds = byUrl.get(canonicalUrl(external)!) || [];
        ref.type = ref.resourceIds.length ? 'resource' : 'external';
        ref.status = ref.resourceIds.length > 1 ? 'ambiguous' : ref.resourceIds.length === 1 ? 'resolved' : 'external';
        ref.resolvedUrl = external;
        references.push(ref);
        continue;
      }
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) {
      ref.type = 'external'; references.push(ref); continue;
    }
    let candidates: WikiDocument[] = [];
    let file: string | undefined;
    if (!target) candidates = [byPath.get(doc.path)!];
    else if (link.syntax === 'wiki' && !target.includes('/')) {
      candidates = bySlug.get(target.replace(/\.md$/, '')) || [];
    } else {
      const adjusted = link.syntax === 'wiki' && /^(concepts|entities|overviews)\//.test(target) ? `wiki/${target}` : target;
      file = relativeTarget(adjusted, doc.path);
      if (file && !file.endsWith('.md') && link.syntax === 'wiki') file += '.md';
      if (file && byPath.has(file)) candidates = [byPath.get(file)!];
    }
    if (candidates.length === 1) {
      ref.targetDocumentId = candidates[0].id;
      const targetDocument = parsedByPath.get(candidates[0].path)!;
      let anchor: string | undefined;
      try { anchor = decodeURIComponent(fragment.slice(1)); } catch { /* Invalid anchor remains unresolved. */ }
      const lineAnchor = /^L([1-9]\d*)(?:-L([1-9]\d*))?$/.exec(anchor || '');
      const verifiedAnchor = !fragment || (anchor !== undefined && targetDocument.anchors.includes(anchor)) || Boolean(lineAnchor && Number(lineAnchor[1]) <= targetDocument.lineCount && (!lineAnchor[2] || Number(lineAnchor[2]) >= Number(lineAnchor[1]) && Number(lineAnchor[2]) <= targetDocument.lineCount));
      ref.resolvedUrl = wikiSourceUrl(candidates[0].path, commit, verifiedAnchor ? fragment : '');
      ref.status = verifiedAnchor ? 'resolved' : 'unresolved';
      if (!verifiedAnchor) ref.reason = 'missing-anchor';
    } else if (candidates.length > 1) {
      ref.status = 'ambiguous'; ref.candidateDocumentIds = candidates.map(candidate => candidate.id).sort();
    } else if (file && fileMap.has(file)) {
      ref.type = 'source'; ref.status = fragment ? 'unresolved' : 'resolved'; ref.resolvedUrl = wikiSourceUrl(file, commit);
      if (fragment) ref.reason = 'unverified-anchor';
    } else if (file && projections.has(file)) {
      const originals = projections.get(file)!;
      ref.type = 'source';
      if (originals.length === 1) {
        ref.mappedSourcePath = originals[0];
        ref.resolvedUrl = wikiSourceUrl(originals[0], commit);
        ref.status = fragment ? 'unresolved' : 'resolved'; ref.reason = fragment ? 'unverified-anchor' : 'projection-source';
      } else { ref.status = 'ambiguous'; ref.candidateSourcePaths = originals.sort(); }
    }
    references.push(ref);
  }
  const changes: WikiSnapshot['changes'] = [];
  const fresh = new Set(documents.map(doc => doc.id));
  if (previous) {
    for (const doc of documents) {
      const prior = old.get(doc.id);
      if (!prior || prior.blobSha !== doc.blobSha) changes.push({ documentId: doc.id, title: doc.title, path: doc.path, topics: doc.topics, sourceUrl: doc.sourceUrl, type: prior ? 'updated' : 'added', date: observedAt });
    }
    for (const doc of previous.documents) if (!fresh.has(doc.id)) changes.push({ documentId: doc.id, title: doc.title, path: doc.path, topics: doc.topics, sourceUrl: doc.sourceUrl, type: 'removed', date: observedAt });
  }
  const cutoff = Date.parse(observedAt) - 180 * 86_400_000;
  return { version: 1, sourceCommit: commit, syncedAt: observedAt, baselineAt: previous?.baselineAt || observedAt, indexPath: 'wiki/index.md', indexBlobSha: index.sha, sourceFileCount: documents.length, documents, references, changes: [...changes, ...(previous?.changes || [])].filter(change => Date.parse(change.date) >= cutoff).slice(0, 1000) };
}

export function validateWikiSnapshot(value: WikiSnapshot, resources: Resource[], commit: string, evidence?: { files: WikiFile[]; parsed: ParsedWiki[] }) {
  const sha = /^[a-f0-9]{40}$/;
  if (value.version !== 1 || value.sourceCommit !== commit || !sha.test(commit) || !sha.test(value.indexBlobSha) || value.indexPath !== 'wiki/index.md' || value.sourceFileCount !== value.documents.length || !Number.isFinite(Date.parse(value.syncedAt)) || !Number.isFinite(Date.parse(value.baselineAt))) throw new Error('Invalid wiki snapshot metadata.');
  const ids = new Set<string>();
  for (const doc of value.documents) {
    if (ids.has(doc.id) || doc.id !== wikiId(doc.path) || !isWikiDocumentPath(doc.path) || !sha.test(doc.blobSha) || doc.sourceUrl !== wikiSourceUrl(doc.path, commit) || !doc.title || !['overview', 'concept', 'entity'].includes(doc.kind) || !Number.isFinite(Date.parse(doc.firstSeenAt)) || !Number.isFinite(Date.parse(doc.contentChangedAt))) throw new Error('Invalid wiki document.');
    ids.add(doc.id);
  }
  const resourceIds = new Set(resources.map(resource => resource.id));
  const docs = new Map(value.documents.map(doc => [doc.id, doc]));
  const parsedDocs = new Map(evidence?.parsed.map(doc => [wikiId(doc.path), doc]) || []);
  const files = new Set(evidence?.files.filter(file => ['100644', '100755'].includes(file.mode)).map(file => file.path) || []);
  const referenceIds = new Set<string>();
  for (const ref of value.references) {
    const document = docs.get(ref.documentId);
    if (!document || ref.id !== wikiId(`${document.path}:${ref.rawTarget}`) || referenceIds.has(ref.id) || !Number.isInteger(ref.line) || ref.line < 1 || !ref.rawTarget || ref.resourceIds.some(id => !resourceIds.has(id)) || (ref.targetDocumentId && !ids.has(ref.targetDocumentId)) || ref.candidateDocumentIds?.some(id => !ids.has(id)) || (ref.status === 'unresolved' && ref.resolvedUrl && !['missing-anchor', 'unverified-anchor'].includes(ref.reason || ''))) throw new Error('Invalid wiki citation.');
    if (evidence && !parsedDocs.get(ref.documentId)?.links.some(link => link.rawTarget === ref.rawTarget && link.line === ref.line)) throw new Error('Wiki citation has no original line evidence.');
    if (evidence && ref.type === 'source' && ref.resolvedUrl) {
      const prefix = `https://github.com/${WIKI_REPOSITORY}/blob/${commit}/`;
      let targetPath: string;
      try { targetPath = decodeURIComponent(ref.resolvedUrl.slice(prefix.length).split('#')[0]); } catch { throw new Error('Invalid source reference encoding.'); }
      if (!ref.resolvedUrl.startsWith(prefix) || !files.has(targetPath) || (ref.mappedSourcePath && ref.mappedSourcePath !== targetPath)) throw new Error('Wiki source reference is not a verified file.');
    }
    referenceIds.add(ref.id);
  }
  if (value.changes.length > 1000 || value.changes.some(change => !isWikiDocumentPath(change.path) || change.documentId !== wikiId(change.path) || !['added', 'updated', 'removed'].includes(change.type) || !Array.isArray(change.topics) || !Number.isFinite(Date.parse(change.date)) || !change.sourceUrl.startsWith(`https://github.com/${WIKI_REPOSITORY}/blob/`))) throw new Error('Invalid wiki change history.');
}
