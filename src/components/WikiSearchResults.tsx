'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { searchWikiDocuments, type WikiListDocument } from '@/lib/wiki-search';
import { getWikiDictionary } from '@/lib/wiki-i18n';
import type { Locale } from '@/lib/types';
import Icon from './Icon';

export default function WikiSearchResults({documents, query, locale}: {documents:WikiListDocument[];query:string;locale:Locale}) {
  const w = getWikiDictionary(locale);
  const results = useMemo(() => query.trim() ? searchWikiDocuments(documents, {q:query}) : [], [documents, query]);
  if (!query.trim()) return null;
  const kinds = {overview:w.overviews, concept:w.concepts, entity:w.entities};
  return <section className="wiki-search-results" aria-labelledby="wiki-search-heading">
    <div className="section-heading"><h2 id="wiki-search-heading">{w.wikiTitle}<span className="result-count" aria-live="polite">{new Intl.NumberFormat(locale).format(results.length)}</span></h2><Link href={`/${locale}/wiki?q=${encodeURIComponent(query)}`}>{w.viewAll}<Icon name="arrow" size={15}/></Link></div>
    {results.length ? <ul className="wiki-inline-list">{results.slice(0, 4).map(doc => <li key={doc.id}><Link href={`/${locale}/wiki/${doc.id}`}><span className="mono">{doc.title}</span><span className="small muted">{kinds[doc.kind]}</span><Icon name="arrow" size={15}/></Link></li>)}</ul> : <p className="small muted">{w.noResults}</p>}
  </section>;
}
