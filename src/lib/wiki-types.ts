/** Passive metadata from the pinned upstream wiki; no article bodies are stored. */
export type WikiKind = 'overview' | 'concept' | 'entity';
export type WikiConfidence = 'high' | 'medium' | 'low' | 'unknown';
export interface WikiDocument {
  id: string;
  path: string;
  slug: string;
  title: string;
  kind: WikiKind;
  topics: string[];
  language: string;
  confidence: WikiConfidence;
  /** Date declared by upstream frontmatter, not a verified Git modification date. */
  upstreamUpdatedAt?: string;
  blobSha: string;
  sourceUrl: string;
  firstSeenAt: string;
  contentChangedAt: string;
}
export interface WikiReference {
  id: string;
  documentId: string;
  type: 'wiki' | 'resource' | 'source' | 'external';
  rawTarget: string;
  /** One-based line in the original Markdown, including its frontmatter. */
  line: number;
  status: 'resolved' | 'unresolved' | 'ambiguous' | 'external';
  targetDocumentId?: string;
  candidateDocumentIds?: string[];
  /** Only exact canonical URL matches; no title or projected-filename inference. */
  resourceIds: string[];
  /** Present for real tracked source files or valid public HTTP(S) references. */
  resolvedUrl?: string;
  reason?: 'missing-anchor' | 'unverified-anchor' | 'projection-source';
  mappedSourcePath?: string;
  candidateSourcePaths?: string[];
}
export interface WikiChange {
  documentId: string;
  title: string;
  path: string;
  topics: string[];
  sourceUrl: string;
  type: 'added' | 'updated' | 'removed';
  date: string;
}
export interface WikiSnapshot {
  version: 1;
  sourceCommit: string;
  syncedAt: string;
  baselineAt: string;
  indexPath: 'wiki/index.md';
  indexBlobSha: string;
  sourceFileCount: number;
  documents: WikiDocument[];
  references: WikiReference[];
  changes: WikiChange[];
}
