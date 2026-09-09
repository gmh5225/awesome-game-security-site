'use client';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getDictionary, localizedCategory } from '@/lib/i18n';
import { searchResources } from '@/lib/search';
import { useLocalList } from '@/lib/local-state';
import type { Locale, Resource } from '@/lib/types';
import Icon from './Icon';
import SelectControl from './SelectControl';
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
  const searchRef = useRef<HTMLInputElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);
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
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    resources.forEach(resource => resource.categories.forEach(value => counts.set(value, (counts.get(value) || 0) + 1)));
    return counts;
  }, [resources]);
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
  const filterSelect = (key: string, label: string, value: string, all: string, values: string[][]) => <div className="filter-field" key={key}><label htmlFor={`filter-${key}`}>{label}</label><SelectControl id={`filter-${key}`} label={label} value={value} onValueChange={selected => update(key, selected)} searchable={key === 'category'} searchPlaceholder={d.searchCategories} emptyText={d.noOptions} options={[{value: '', label: all}, ...values.map(([id, text]) => ({value: id, label: text, keywords: id}))]}/></div>;
  const categoryTree = (mobile = false) => <>
    <button type="button" className={`category-item ${!category ? 'is-active' : ''}`} aria-pressed={!category} onClick={() => {update('category', ''); if (mobile) dialogRef.current?.close();}}><Icon name="grid" size={15}/><span>{d.allResources}</span><span className="count">{number(resources.length)}</span></button>
    <div className="category-list">{mainCategories.map((value, index) => {
      const children = categories.filter(child => child.startsWith(`${value} / `));
      const isExpanded = expanded.includes(value);
      const isSelected = category === value || category.startsWith(`${value} / `);
      const groupId = `category-${mobile ? 'mobile' : 'desktop'}-${index}`;
      return <div className="category-group" key={value}>
        <div className={`category-tree-row ${isSelected ? 'is-active' : ''}`}>
          {children.length > 0 ? <button type="button" className="tree-toggle" aria-label={localizedCategory(value, locale)} aria-expanded={isExpanded} aria-controls={groupId} onClick={() => setExpanded(current => isExpanded ? current.filter(item => item !== value) : [...current, value])}><span aria-hidden="true">{isExpanded ? '⌄' : '›'}</span></button> : <span className="tree-leaf" aria-hidden="true">·</span>}
          <button type="button" className="category-item" aria-pressed={category === value} onClick={() => {update('category', value); if (mobile) dialogRef.current?.close();}}><span>{localizedCategory(value, locale)}</span><span className="count">{number(categoryCounts.get(value) || 0)}</span></button>
        </div>
        {children.length > 0 && <div id={groupId} className="category-children" hidden={!isExpanded}>{children.map(child => <button type="button" key={child} className={`category-item ${category === child ? 'is-active' : ''}`} aria-pressed={category === child} onClick={() => {update('category', child); if (mobile) dialogRef.current?.close();}}><span>{localizedCategory(child.slice(value.length + 3), locale)}</span><span className="count">{number(categoryCounts.get(child) || 0)}</span></button>)}</div>}
      </div>;
    })}</div>
  </>;
  return <div className={`directory-shell ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
    <aside id="category-sidebar" className="sidebar" aria-label={d.category} hidden={!sidebarOpen}>
      <div className="sidebar-title"><h2>{d.category}<span className="count">{mainCategories.length}</span></h2><button type="button" className="icon-button" aria-label={d.closeFilters} onClick={() => {setSidebarOpen(false); sidebarToggleRef.current?.focus();}}><Icon name="close" size={17}/></button></div>
      {categoryTree()}
      <a className="sidebar-source" href="https://github.com/gmh5225/awesome-game-security" target="_blank" rel="noopener noreferrer"><Icon name="link" size={15}/>{d.source}<Icon name="external" size={13}/></a>
    </aside>
    <dialog ref={dialogRef} className="category-dialog" aria-labelledby="mobile-filter-title" onClick={event=>{if(event.target===event.currentTarget)dialogRef.current?.close();}}><div className="dialog-content"><div className="sidebar-title"><h2 id="mobile-filter-title">{d.category}</h2><button type="button" className="icon-button" aria-label={d.closeFilters} onClick={()=>dialogRef.current?.close()}><Icon name="close"/></button></div>{categoryTree(true)}</div></dialog>
    <div className="directory-main">
      <section className="directory-intro"><h1>{savedOnly ? d.saved : 'Awesome Game Security'}{!savedOnly && <a href="https://github.com/gmh5225/awesome-game-security" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><Icon name="github" size={27}/></a>}</h1><p>{savedOnly ? d.savedLocal : d.heroDescription}</p></section>
      <form className="search-form" role="search" onSubmit={event => {event.preventDefault(); document.getElementById('results-heading')?.focus();}}><Icon name="search" size={22}/><label className="sr-only" htmlFor="resource-search">{d.searchLabel}</label><input ref={searchRef} id="resource-search" type="search" value={query} placeholder={d.searchPlaceholder} autoComplete="off" maxLength={300} onChange={event => update('q', event.target.value, true)}/>{query && <button type="button" className="search-clear" aria-label={d.clear} onClick={() => {update('q', '', true); searchRef.current?.focus();}}><Icon name="close" size={16}/></button>}<button className="search-submit" type="submit" aria-label={d.searchLabel}><Icon name="arrow" size={19}/></button></form>
      <div className="search-helper"><span>{d.searchHint}</span><button ref={sidebarToggleRef} type="button" className="button secondary small-button desktop-only" aria-controls="category-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}><Icon name="filter" size={15}/>{d.category}</button><button type="button" className="button secondary small-button mobile-only" onClick={() => dialogRef.current?.showModal()}><Icon name="filter" size={15}/>{d.category}</button></div>
      {topicCards && !hasFilters && !savedOnly && currentPage === 1 && <section className="featured-section"><div className="section-heading"><h2>{d.featuredTopics}</h2><Link href={`/${locale}/topics`}>{d.showAll}<Icon name="arrow" size={16}/></Link></div>{topicCards}</section>}
      <section className="topic-search-results">{matchedTopics.length>0&&<><div className="section-heading"><h2>{d.topics}<span className="result-count">{matchedTopics.length}</span></h2></div><TopicCards locale={locale} items={matchedTopics}/></>}</section>
      <section className="results-section" aria-labelledby="results-heading"><div className="section-heading results-header"><h2 id="results-heading" tabIndex={-1}>{category ? localizedCategory(category, locale) : savedOnly ? d.saved : d.allResources}<span className="result-count" aria-live="polite">{number(results.length)} {d.results}</span></h2><div className="results-tools"><button type="button" className="button secondary small-button" aria-controls="resource-filters" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="filter" size={14}/>{d.filters}</button><div className="sort-picker"><SelectControl label={d.sort} value={sort} onValueChange={selected => update('sort', selected)} variant="quiet" align="end" options={[{value: 'relevance', label: query ? d.relevance : d.curated}, {value: 'name', label: d.nameSort}, {value: 'recent', label: d.recentSort}]}/></div></div></div>
        <div id="resource-filters" className="filter-row" hidden={!filtersOpen}>{filterSelect('category',d.category,category,d.allCategories,categories.map(value => [value,localizedCategory(value,locale)]))}{filterSelect('kind',d.kind,kind,d.allKinds,kinds)}{filterSelect('platform',d.platform,platform,d.allPlatforms,platforms.map(value => [value,value]))}{filterSelect('engine',d.engine,engine,d.allEngines,engines.map(value => [value,value]))}{filterSelect('level',d.level,level,d.allLevels,levels)}</div>
        {hasFilters && <div className="active-filters"><span>{d.selectedFilters}</span>{[['q',query],['category',category],['kind',kind],['platform',platform],['engine',engine],['level',level]].filter(([,value]) => value).map(([key,value]) => <button key={key} type="button" className="filter-chip" aria-label={`${d.clear}: ${value}`} onClick={() => update(key,'')}>{key === 'category' ? localizedCategory(value,locale) : key === 'kind' ? kinds.find(([id])=>id===value)?.[1] : key === 'level' ? levels.find(([id])=>id===value)?.[1] : value}<Icon name="close" size={12}/></button>)}<button type="button" className="text-button" onClick={reset}>{d.resetFilters}</button></div>}
        {visible.length ? <div className="resource-grid">{visible.map(resource => <ResourceCard key={resource.id} resource={resource} locale={locale}/>)}</div> : <div className="empty-state"><Icon name={savedOnly ? 'bookmark' : 'search'} size={32}/><h3>{savedOnly && !saved.length ? d.noSaved : d.noResults}</h3><p>{savedOnly && !saved.length ? d.noSavedHelp : d.noResultsHelp}</p>{hasFilters ? <button type="button" className="button secondary" onClick={reset}>{d.resetFilters}</button> : <Link className="button secondary" href={`/${locale}`}>{d.exploreAll}<Icon name="arrow" size={16}/></Link>}</div>}
        {pageCount > 1 && <nav className="pagination" aria-label={d.page}><button type="button" className="button secondary" disabled={currentPage <= 1} onClick={() => {update('page',String(currentPage-1));document.getElementById('results-heading')?.scrollIntoView({block:'start'});}}>{d.previous}</button><span>{d.page} {number(currentPage)} {d.of} {number(pageCount)}</span><button type="button" className="button secondary" disabled={currentPage >= pageCount} onClick={() => {update('page',String(currentPage+1));document.getElementById('results-heading')?.scrollIntoView({block:'start'});}}>{d.next}</button></nav>}
      </section>
    </div>
  </div>;
}
