import { getCatalog } from './catalog';
import type { WikiDocument, WikiReference, WikiSnapshot } from './wiki-types';
import type { WikiListDocument } from './wiki-search';

// Only server components and server route handlers import this module. Client
// discovery imports wiki-search.ts and receives an explicit metadata projection.
const wiki = getCatalog().wiki;
const documents = wiki?.documents || [];
const documentById = new Map(documents.map(document => [document.id, document]));
const referencesByDocument = new Map<string, WikiReference[]>();
const backlinksByDocument = new Map<string, WikiReference[]>();
const resourceDocuments = new Map<string, Set<string>>();

for (const reference of wiki?.references || []) {
  const references = referencesByDocument.get(reference.documentId) || [];
  references.push(reference);
  referencesByDocument.set(reference.documentId, references);
  if (reference.status === 'resolved' && reference.targetDocumentId) {
    const backlinks = backlinksByDocument.get(reference.targetDocumentId) || [];
    backlinks.push(reference);
    backlinksByDocument.set(reference.targetDocumentId, backlinks);
  }
  for (const id of reference.status === 'resolved' ? reference.resourceIds : []) {
    const ids = resourceDocuments.get(id) || new Set<string>();
    ids.add(reference.documentId);
    resourceDocuments.set(id, ids);
  }
}

function listDocument(document: WikiDocument): WikiListDocument {
  return {
    id: document.id, title: document.title, kind: document.kind,
    topics: [...document.topics], language: document.language,
    ...(document.upstreamUpdatedAt ? { upstreamUpdatedAt: document.upstreamUpdatedAt } : {}),
    firstSeenAt: document.firstSeenAt, contentChangedAt: document.contentChangedAt,
  };
}

const listDocuments = documents.map(listDocument);
const listById = new Map(listDocuments.map(document => [document.id, document]));

export function getWiki(): WikiSnapshot | undefined { return wiki; }
export function getWikiDocument(id: string): WikiDocument | undefined { return documentById.get(id); }
export function getWikiListDocuments(): WikiListDocument[] { return listDocuments; }
export function getWikiDocumentReferences(id: string): WikiReference[] { return referencesByDocument.get(id) || []; }
export function getWikiBacklinks(id: string): WikiReference[] { return backlinksByDocument.get(id) || []; }
export function getResourceWikiDocuments(resourceId: string): WikiListDocument[] {
  return [...(resourceDocuments.get(resourceId) || [])].map(id => listById.get(id))
    .filter((document): document is WikiListDocument => document !== undefined)
    .sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id));
}
