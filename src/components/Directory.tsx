'use client';
import { useMemo, useRef, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getDictionary, localizedCategory } from '@/lib/i18n';
import { searchResources } from '@/lib/search';
import { useLocalList } from '@/lib/local-state';
import type { Locale, Resource } from '@/lib/types';
import Icon from './Icon';
import ResourceCard from './ResourceCard';
import TopicCards from './TopicCards';
import { searchTopics } from '@/lib/topic-search';
import { getEditorial } from '@/lib/editorial';

const PAGE_SIZE = 24;
export default function Directory({ resources, locale, topicCards, savedOnly = false }: { resources: Resource[]; locale: Locale; topicCards?: ReactNode; savedOnly?: boolean }) {
  const d = getDictionary(locale);
  const params = useSearchParams();
  const pathname = usePathname();
  const [saved] = useLocalList('ags:saved');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const query = params.get('q') || '';
  const category = params.get('category') || '';
  const kind = params.get('kind') || '';
  const platform = params.get('platform') || '';
  const engine = params.get('engine') || '';
  const level = params.get('level') || '';
  const sortValue = params.get('sort');
  const sort = sortValue === 'name' || sortValue === 'recent' ? sortValue : 'relevance';
  const rawPage = Number(params.get('page') || '1');
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const categories = useMemo(() => [...new Set(resources.flatMap(resource => resource.categories))].sort(), [resources]);
  const mainCategories = categories.filter(value => !value.includes(' / '));
  const platforms = useMemo(() => [...new Set(resources.flatMap(resource => resource.platforms))].sort(), [resources]);
  const engines = useMemo(() => [...new Set(resources.flatMap(resource => resource.engines))].sort(), [resources]);
  const results = useMemo(() => { const found=searchResources(resources, { q: query, category, kind, platform, engine, level, sort, ...(savedOnly ? {savedIds: saved} : {}) }); if(!query&&sort==='relevance') { const selected=new Set(found.filter(resource=>getEditorial(resource.url)).map(resource=>resource.id)); found.sort((a,b)=>Number(selected.has(b.id))-Number(selected.has(a.id))); } return found; }, [resources, query, category, kind, platform, engine, level, sort, savedOnly, saved]);
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const matchedTopics = query&&!savedOnly?searchTopics(query,locale):[];
  const hasFilters = !!(query || category || kind || platform || engine || level);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  function update(key: string, value: string, replace = false) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    const url = `${pathname}${next.size ? `?${next}` : ''}`;
    if (replace) window.history.replaceState(null, '', url); else window.history.pushState(null, '', url);
  }
  function reset() { window.history.pushState(null, '', pathname); }
  const kinds = [['tool', d.tools], ['guide', d.guides], ['reference', d.references], ['library', d.libraries], ['collection', d.collections]];
  const levels = [['beginner', d.beginner], ['intermediate', d.intermediate], ['advanced', d.advanced], ['all', d.allLevelsLabel]];
  const filterSelect = (key: string, label: string, value: string, all: string, values: string[][]) => <label className="filter-field" key={key}><span>{label}</span><select value={value} onChange={event => update(key, event.target.value)}><option value="">{all}</option>{values.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></label>;
  return <div className="directory-shell">
    <aside className="sidebar" aria-label={d.filters}>
      <div className="sidebar-title"><span>{d.filters}</span><button type="button" className="icon-button mobile-only" aria-label={d.closeFilters} onClick={() => dialogRef.current?.close()}><Icon name="close"/></button></div>
      <button type="button" className={`category-item ${!category ? 'is-active' : ''}`} onClick={() => update('category', '')}><span>{d.allResources}</span><span className="count">{number(resources.length)}</span></button>
      <div className="category-list">{mainCategories.map(value => <button type="button" className={`category-item ${category === value || category.startsWith(`${value} / `) ? 'is-active' : ''}`} key={value} onClick={() => {update('category', value); dialogRef.current?.close();}}><span>{localizedCategory(value, locale)}</span><span className="count">{number(resources.filter(resource => resource.categories.includes(value)).length)}</span></button>)}</div>
      <div className="sidebar-foot"><Icon name="shield" size={17}/><p>{d.collectionScope}</p></div>
    </aside>
    <dialog ref={dialogRef} className="category-dialog" aria-labelledby="mobile-filter-title" onClick={event=>{if(event.target===event.currentTarget)dialogRef.current?.close();}}><div className="dialog-content"><div className="sidebar-title"><h2 id="mobile-filter-title">{d.category}</h2><button type="button" className="icon-button" aria-label={d.closeFilters} onClick={()=>dialogRef.current?.close()}><Icon name="close"/></button></div>{[['',d.allResources],...mainCategories.map(value=>[value,localizedCategory(value,locale)])].map(([value,label])=><button type="button" className={`category-item ${category===value?'is-active':''}`} key={value} onClick={()=>{update('category',value);dialogRef.current?.close();}}>{label}</button>)}</div></dialog>
    <div className="directory-main">
      <section className="directory-intro"><div className="eyebrow"><span className="status-dot"/>{d.builtFor}</div><h1>{savedOnly ? d.saved : d.heroTitle}</h1><p>{savedOnly ? d.savedLocal : d.heroDescription}</p></section>
      <form className="search-form" role="search" onSubmit={event => {event.preventDefault(); document.getElementById('results-heading')?.focus();}}><Icon name="search" size={22}/><label className="sr-only" htmlFor="resource-search">{d.searchLabel}</label><input id="resource-search" type="search" value={query} placeholder={d.searchPlaceholder} autoComplete="off" maxLength={300} onChange={event => update('q', event.target.value, true)}/><button className="search-submit" type="submit" aria-label={d.searchLabel}><Icon name="arrow" size={19}/></button></form>
      <div className="search-helper"><span>{d.searchHint}</span><button type="button" className="button secondary small-button mobile-only" onClick={() => dialogRef.current?.showModal()}><Icon name="filter" size={16}/>{d.showFilters}</button></div>
      {topicCards && !hasFilters && !savedOnly && currentPage === 1 && <section className="featured-section"><div className="section-heading"><h2>{d.featuredTopics}</h2><Link href={`/${locale}/topics`}>{d.showAll}<Icon name="arrow" size={16}/></Link></div>{topicCards}</section>}
      <section className="topic-search-results">{matchedTopics.length>0&&<><div className="section-heading"><h2>{d.topics}<span className="result-count">{matchedTopics.length}</span></h2></div><TopicCards locale={locale} items={matchedTopics}/></>}</section>
      <section className="results-section" aria-labelledby="results-heading"><div className="section-heading results-header"><h2 id="results-heading" tabIndex={-1}>{category ? localizedCategory(category, locale) : savedOnly ? d.saved : d.allResources}<span className="result-count" aria-live="polite">{number(results.length)} {d.results}</span></h2><label className="sort-picker"><span className="sr-only">{d.sort}</span><select value={sort} onChange={event => update('sort', event.target.value)}><option value="relevance">{query?d.relevance:d.curated}</option><option value="name">{d.nameSort}</option><option value="recent">{d.recentSort}</option></select></label></div>
        <div className="filter-row">{filterSelect('category',d.category,category,d.allCategories,categories.map(value => [value,localizedCategory(value,locale)]))}{filterSelect('kind',d.kind,kind,d.allKinds,kinds)}{filterSelect('platform',d.platform,platform,d.allPlatforms,platforms.map(value => [value,value]))}{filterSelect('engine',d.engine,engine,d.allEngines,engines.map(value => [value,value]))}{filterSelect('level',d.level,level,d.allLevels,levels)}</div>
        {hasFilters && <div className="active-filters"><span>{d.selectedFilters}</span>{[['q',query],['category',category],['kind',kind],['platform',platform],['engine',engine],['level',level]].filter(([,value]) => value).map(([key,value]) => <button key={key} type="button" className="filter-chip" aria-label={`${d.clear}: ${value}`} onClick={() => update(key,'')}>{key === 'category' ? localizedCategory(value,locale) : key === 'kind' ? kinds.find(([id])=>id===value)?.[1] : key === 'level' ? levels.find(([id])=>id===value)?.[1] : value}<Icon name="close" size={12}/></button>)}<button type="button" className="text-button" onClick={reset}>{d.resetFilters}</button></div>}
        {visible.length ? <div className="resource-grid">{visible.map(resource => <ResourceCard key={resource.id} resource={resource} locale={locale}/>)}</div> : <div className="empty-state"><Icon name={savedOnly ? 'bookmark' : 'search'} size={32}/><h3>{savedOnly && !saved.length ? d.noSaved : d.noResults}</h3><p>{savedOnly && !saved.length ? d.noSavedHelp : d.noResultsHelp}</p>{hasFilters ? <button type="button" className="button secondary" onClick={reset}>{d.resetFilters}</button> : <Link className="button secondary" href={`/${locale}`}>{d.exploreAll}<Icon name="arrow" size={16}/></Link>}</div>}
        {pageCount > 1 && <nav className="pagination" aria-label={d.page}><button type="button" className="button secondary" disabled={currentPage <= 1} onClick={() => {update('page',String(currentPage-1));document.getElementById('results-heading')?.scrollIntoView({block:'start'});}}>{d.previous}</button><span>{d.page} {number(currentPage)} {d.of} {number(pageCount)}</span><button type="button" className="button secondary" disabled={currentPage >= pageCount} onClick={() => {update('page',String(currentPage+1));document.getElementById('results-heading')?.scrollIntoView({block:'start'});}}>{d.next}</button></nav>}
      </section>
    </div>
  </div>;
}
