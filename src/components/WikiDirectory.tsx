'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { getWikiDictionary } from '@/lib/wiki-i18n';
import { useLocalList } from '@/lib/local-state';
import { paginateWiki, searchWikiDocuments, type WikiListDocument } from '@/lib/wiki-search';
import { formatDate, SOURCE_URL } from '@/lib/seo';
import type { Locale } from '@/lib/types';
import type { WikiKind } from '@/lib/wiki-types';
import Icon from './Icon';
import SelectControl from './SelectControl';
import WikiSaveButton from './WikiSaveButton';
import WikiFollowButton from './WikiFollowButton';
import styles from './Wiki.module.css';

export interface WikiDirectoryProps {
  documents: WikiListDocument[];
  locale: Locale;
  savedOnly?: boolean;
  embedded?: boolean;
  sourceCommit?: string;
  syncedAt?: string;
}

export default function WikiDirectory({ documents, locale, savedOnly = false, embedded = false, sourceCommit, syncedAt }: WikiDirectoryProps) {
  const d = getWikiDictionary(locale);
  const shared = getDictionary(locale);
  const params = useSearchParams();
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [saved] = useLocalList('ags:wiki-saved');
  const [removedPage, setRemovedPage] = useState(1);
  const query = params.get('q') || '';
  const kind = params.get('kind') || '';
  const topic = params.get('topic') || '';
  const sortValue = params.get('sort');
  const sort = sortValue === 'name' || sortValue === 'recent' ? sortValue : 'relevance';
  const kinds: [WikiKind, string][] = [['overview', d.overviews], ['concept', d.concepts], ['entity', d.entities]];
  const kindsByKey = Object.fromEntries(kinds);
  const available = useMemo(() => savedOnly ? documents.filter(document => saved.includes(document.id)) : documents, [documents, savedOnly, saved]);
  const missingIds = useMemo(() => {
    if (!savedOnly) return [];
    const known = new Set(documents.map(document => document.id));
    return [...new Set(saved)].filter(id => !known.has(id));
  }, [documents, saved, savedOnly]);
  const removed = paginateWiki(missingIds, removedPage, 8);
  const topics = useMemo(() => [...new Set(available.flatMap(document => document.topics))].sort(), [available]);
  const found = useMemo(() => searchWikiDocuments(available, { q: query, kind, topic, sort }), [available, query, kind, topic, sort]);
  const page = paginateWiki(found, params.get('page') || undefined);
  const count = (value: number) => new Intl.NumberFormat(locale).format(value);
  const counts = Object.fromEntries(kinds.map(([key]) => [key, available.filter(document => document.kind === key).length]));
  const filtered = Boolean(query || kind || topic);
  const heading = savedOnly ? d.savedWiki : d.wikiTitle;
  const EntryHeading = embedded ? 'h3' : 'h2';

  function update(key: string, value: string, replace = false) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    const destination = `${pathname}${next.size ? `?${next}` : ''}`;
    if (replace) window.history.replaceState(null, '', destination);
    else window.history.pushState(null, '', destination);
  }
  function reset() {
    const next = new URLSearchParams(params.toString());
    for (const key of ['q', 'kind', 'topic', 'page']) next.delete(key);
    window.history.pushState(null, '', `${pathname}${next.size ? `?${next}` : ''}`);
  }
  function turnPage(value: number) {
    update('page', String(value));
    resultRef.current?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView({ block: 'start' });
  }

  return <div className={embedded ? styles.embedded : styles.shell}>
    <header className={styles.intro}>
      {embedded ? <h2>{heading}</h2> : <h1>{heading}</h1>}
      <p>{savedOnly ? d.localNote : d.subtitle}</p>
      {!savedOnly && <div className={styles.counts}><span><strong>{count(documents.length)}</strong> {d.documentCount}</span>{kinds.map(([key, label]) => <span key={key}><strong>{count(counts[key])}</strong> {label}</span>)}</div>}
    </header>
    <div className={!savedOnly ? styles.layout : undefined}>
      <div className={styles.main}>
        {(!savedOnly || available.length > 0 || filtered) && <>
          <form className={`search-form ${styles.search}`} role="search" onSubmit={event => { event.preventDefault(); resultRef.current?.focus(); }}>
            <Icon name="search" size={21}/><label className="sr-only" htmlFor="wiki-search">{d.searchLabel}</label>
            <input ref={searchRef} id="wiki-search" type="search" value={query} placeholder={d.searchPlaceholder} autoComplete="off" maxLength={300} onChange={event => update('q', event.target.value, true)}/>
            {query && <button className="search-clear" type="button" aria-label={d.clear} onClick={() => { update('q', '', true); searchRef.current?.focus(); }}><Icon name="close" size={16}/></button>}
            <button className="search-submit" type="submit" aria-label={d.searchLabel}><Icon name="arrow" size={18}/></button>
          </form>
          <div className={styles.toolbar}>
            <div className={styles.tabs} role="group" aria-label={d.documentType}>
              <button type="button" aria-pressed={!kind} onClick={() => update('kind', '')}>{d.allTypes}</button>
              {kinds.map(([key, label]) => <button key={key} type="button" aria-pressed={kind === key} onClick={() => update('kind', key)}>{label}</button>)}
            </div>
          </div>
          <div className={styles.filters}>
            <SelectControl label={d.topics} value={topic} onValueChange={value => update('topic', value)} searchable options={[{ value: '', label: d.allTopics }, ...topics.map(value => ({ value, label: value }))]} searchPlaceholder={d.topics} emptyText={d.noResults}/>
            <SelectControl label={shared.sort} value={sort} onValueChange={value => update('sort', value)} variant="quiet" align="end" options={[{ value: 'relevance', label: shared.relevance }, { value: 'name', label: d.nameSort }, { value: 'recent', label: d.recentSort }]}/>
          </div>
        </>}
        <div className={styles.resultNote} ref={resultRef} tabIndex={-1} id="wiki-results"><span role="status">{count(found.length)} {d.results}</span>{filtered && <button type="button" className="text-button" onClick={reset}>{shared.resetFilters}</button>}</div>
        {page.items.length ? <ul className={styles.entries}>{page.items.map(document => <li key={document.id} className={styles.entry}>
          <div className={styles.entryBody}>
            <EntryHeading><Link href={`/${locale}/wiki/${document.id}`}>{document.title}</Link></EntryHeading>
            <div className={styles.entryMeta}><span className={styles.kind}>{kindsByKey[document.kind]}</span>{document.topics.length > 0 && <span className={styles.entryTopics}>{document.topics.join(' · ')}</span>}{document.language && document.language !== 'unknown' && <span>{document.language.toUpperCase()}</span>}</div>
          </div>
          <div className={styles.entryActions}><WikiSaveButton id={document.id} locale={locale} compact/><Link href={`/${locale}/wiki/${document.id}`} aria-label={document.title}><Icon name="arrow" size={17}/></Link></div>
        </li>)}</ul> : <div className="empty-state"><Icon name={savedOnly ? 'bookmark' : 'search'} size={30}/><h3>{savedOnly && !available.length && !filtered ? d.noSavedWiki : d.noResults}</h3><p>{filtered ? d.noResultsHelp : savedOnly ? d.localNote : d.noWikiData}</p>{filtered ? <button type="button" className="button secondary" onClick={reset}>{shared.resetFilters}</button> : savedOnly && <Link className="button secondary" href={`/${locale}/wiki`}>{d.backToKnowledge}<Icon name="arrow" size={16}/></Link>}</div>}
        {page.pageCount > 1 && <nav className={styles.pagination} aria-label={`${d.wiki} ${d.page}`}><button type="button" className={`button secondary ${styles.previous}`} disabled={page.page <= 1} onClick={() => turnPage(page.page - 1)}><Icon name="arrow" size={15}/>{d.previous}</button><span>{d.page} {count(page.page)} {d.of} {count(page.pageCount)}</span><button type="button" className="button secondary" disabled={page.page >= page.pageCount} onClick={() => turnPage(page.page + 1)}>{d.next}<Icon name="arrow" size={15}/></button></nav>}
        {missingIds.length > 0 && <section className={styles.removed}><h3>{d.missingDocument}</h3><p>{d.removedSaved}</p><ul>{removed.items.map(id => <li key={id}><code>{id}</code><WikiSaveButton id={id} locale={locale}/></li>)}</ul>{removed.pageCount > 1 && <nav className={styles.pagination} aria-label={`${d.missingDocument}: ${d.page}`}><button type="button" className="button secondary" disabled={removed.page <= 1} onClick={() => setRemovedPage(removed.page - 1)}>{d.previous}</button><span>{count(removed.page)} / {count(removed.pageCount)}</span><button type="button" className="button secondary" disabled={removed.page >= removed.pageCount} onClick={() => setRemovedPage(removed.page + 1)}>{d.next}</button></nav>}</section>}
      </div>
      {!savedOnly && <aside className={styles.aside}>
        <section><h2>{d.browseTypes}</h2>{kinds.map(([key, label]) => <button key={key} type="button" className={styles.asideLink} aria-pressed={kind === key} onClick={() => update('kind', key)}><span>{label}</span><span>{count(counts[key])}</span></button>)}</section>
        {topic && topics.includes(topic) && <section><h2>{d.topics}</h2><div className={styles.selectedTopic}><span>{topic}</span><WikiFollowButton topic={topic} locale={locale} compact/></div><Link className={styles.sourceLink} href={`/${locale}/updates?scope=wiki&topic=${encodeURIComponent(topic)}`}>{d.wikiUpdates}<Icon name="arrow" size={15}/></Link><br/><a className={styles.sourceLink} href={`/${locale}/feed.xml?scope=wiki&topic=${encodeURIComponent(topic)}`}><Icon name="rss" size={15}/>{shared.subscribeRss}</a><p className={styles.inlineNote}>{d.localNote}</p></section>}
        <section><h2>{d.curatedTopics}</h2><Link className={styles.sourceLink} href={`/${locale}/topics`}>{shared.topics}<Icon name="arrow" size={15}/></Link><p className={styles.inlineNote}>{shared.editorialNote}</p></section>
        <section><h2>{d.originalSource}</h2><p>{d.indexOnly}</p>{sourceCommit && <a className={styles.sourceLink} href={`${SOURCE_URL}/tree/${sourceCommit}/wiki`} target="_blank" rel="noopener noreferrer">{d.viewAll}<Icon name="external" size={14}/></a>}{syncedAt && <p className={styles.inlineNote}>{d.lastSync}: <time dateTime={syncedAt}>{formatDate(syncedAt, locale)}</time> UTC</p>}</section>
      </aside>}
    </div>
  </div>;
}
