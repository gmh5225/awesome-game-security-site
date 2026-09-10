import Link from 'next/link';
import type { ReactNode } from 'react';
import { getResource } from '@/lib/catalog';
import { getWikiBacklinks, getWikiDocument, getWikiDocumentReferences } from '@/lib/wiki';
import { getWikiDictionary } from '@/lib/wiki-i18n';
import { paginateWiki } from '@/lib/wiki-search';
import type { Locale } from '@/lib/types';
import type { WikiDocument, WikiReference } from '@/lib/wiki-types';
import Icon from './Icon';
import styles from './Wiki.module.css';

export type WikiReferenceParams = Record<string, string | string[] | undefined>;
const PAGE_KEYS = ['wikiPage', 'backlinksPage', 'resourcesPage', 'sourcesPage'] as const;
function httpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}

/** Reference lists remain on the server. Only eight rows per group are rendered. */
export default function WikiReferences({ document, locale, searchParams = {} }: { document: WikiDocument; locale: Locale; searchParams?: WikiReferenceParams }) {
  const d = getWikiDictionary(locale);
  const count = (value: number) => new Intl.NumberFormat(locale).format(value);
  const references = getWikiDocumentReferences(document.id);
  const wikiReferences = references.filter(reference => reference.type === 'wiki');
  const resources = references.filter(reference => reference.status === 'resolved' && reference.resourceIds.length > 0);
  const sources = references.filter(reference => reference.type !== 'wiki' && !(reference.status === 'resolved' && reference.resourceIds.length > 0));
  // The backlink heading counts citing documents, not repeated links in one file.
  const backlinks = [...new Map(getWikiBacklinks(document.id).map(reference => [reference.documentId, reference])).values()];

  function status(reference: WikiReference): string {
    if (reference.reason === 'missing-anchor') return d.missingAnchor;
    if (reference.reason === 'unverified-anchor') return d.unverifiedAnchor;
    if (reference.reason === 'projection-source' && reference.status === 'resolved') return d.sourceProjection;
    if (reference.status === 'ambiguous') return d.ambiguous;
    if (reference.status === 'unresolved') return d.unresolved;
    return reference.status === 'external' ? d.externalReference : d.sourceResolved;
  }

  function evidence(reference: WikiReference, origin = document) {
    const source = httpUrl(origin.sourceUrl);
    return <div className={styles.referenceInfo}>
      <span className={reference.status === 'unresolved' || reference.status === 'ambiguous' ? styles.unresolved : undefined}>{status(reference)}</span>
      {source && <a href={`${source.split('#')[0]}#L${reference.line}`} target="_blank" rel="noopener noreferrer">{d.referenceEvidence} <span className="mono">L{reference.line}</span><Icon name="external" size={12}/></a>}
    </div>;
  }

  function pageLink(key: typeof PAGE_KEYS[number], page: number, section: string) {
    const params = new URLSearchParams();
    for (const name of PAGE_KEYS) {
      const value = searchParams[name];
      if (typeof value === 'string' && /^\d+$/.test(value)) params.set(name, value);
    }
    params.set(key, String(page));
    return `/${locale}/wiki/${document.id}?${params}#${section}`;
  }

  function section(title: string, id: string, key: typeof PAGE_KEYS[number], items: WikiReference[], render: (reference: WikiReference) => ReactNode) {
    if (!items.length) return null;
    const input = searchParams[key];
    const page = paginateWiki(items, typeof input === 'string' ? input : undefined, 8);
    return <section className={styles.references} id={id} key={key}>
      <h2>{title}<span>{count(items.length)}</span></h2>
      <ul className={styles.referenceList}>{page.items.map(reference => <li className={styles.reference} key={reference.id}>{render(reference)}</li>)}</ul>
      {page.pageCount > 1 && <nav className={styles.pagination} aria-label={`${title}: ${d.page}`}>
        {page.page > 1 ? <Link className={`button secondary ${styles.previous}`} prefetch={false} href={pageLink(key, page.page - 1, id)}><Icon name="arrow" size={15}/>{d.previous}</Link> : <button type="button" className={`button secondary ${styles.previous}`} disabled><Icon name="arrow" size={15}/>{d.previous}</button>}
        <span>{d.page} {count(page.page)} {d.of} {count(page.pageCount)}</span>
        {page.page < page.pageCount ? <Link className="button secondary" prefetch={false} href={pageLink(key, page.page + 1, id)}>{d.next}<Icon name="arrow" size={15}/></Link> : <button type="button" className="button secondary" disabled>{d.next}<Icon name="arrow" size={15}/></button>}
      </nav>}
    </section>;
  }

  return <>
    {section(d.resourceReferences, 'resource-references', 'resourcesPage', resources, reference => <>
      <div className={`${styles.referenceTitle} ${styles.resourceLinks}`}>{reference.resourceIds.map(id => {
        const resource = getResource(id);
        return resource ? <Link key={id} href={`/${locale}/resources/${resource.id}`}>{resource.title}</Link> : <span key={id}>{id}</span>;
      })}</div>
      <p className={styles.referenceTarget}>{reference.rawTarget}</p>{evidence(reference)}
    </>)}
    {section(d.wikiReferences, 'wiki-references', 'wikiPage', wikiReferences, reference => {
      const target = reference.targetDocumentId ? getWikiDocument(reference.targetDocumentId) : undefined;
      const canLinkDocument = target && (reference.status === 'resolved' || reference.reason === 'missing-anchor' || reference.reason === 'unverified-anchor');
      return <><div className={styles.referenceTitle}>{canLinkDocument ? <Link href={`/${locale}/wiki/${target.id}`}>{target.title}</Link> : reference.rawTarget}</div>{canLinkDocument && <p className={styles.referenceTarget}>{reference.rawTarget}</p>}{evidence(reference)}</>;
    })}
    {section(d.backlinks, 'backlinks', 'backlinksPage', backlinks, reference => {
      const origin = getWikiDocument(reference.documentId);
      return <><div className={styles.referenceTitle}>{origin ? <Link href={`/${locale}/wiki/${origin.id}`}>{origin.title}</Link> : reference.documentId}</div>{origin && evidence(reference, origin)}</>;
    })}
    {section(d.sources, 'source-references', 'sourcesPage', sources, reference => {
      const destination = reference.status !== 'ambiguous' ? httpUrl(reference.resolvedUrl) : undefined;
      return <><div className={styles.referenceTitle}>{destination ? <a href={destination} target="_blank" rel="noopener noreferrer">{reference.mappedSourcePath || reference.rawTarget} <Icon name="external" size={13}/></a> : reference.rawTarget}</div>{reference.mappedSourcePath && <p className={styles.referenceTarget}>{d.originalReference}: {reference.rawTarget}</p>}{evidence(reference)}</>;
    })}
    {!references.length && !backlinks.length && <section className={styles.references}><h2>{d.references}</h2><p className={styles.emptyReferences}>{d.noReferences}</p></section>}
  </>;
}
