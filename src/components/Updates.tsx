'use client';
import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getDictionary } from '@/lib/i18n';
import { useLocalList } from '@/lib/local-state';
import { formatDate } from '@/lib/seo';
import type { CatalogChange, Locale } from '@/lib/types';
import Icon from './Icon';
import { getWikiDictionary } from '@/lib/wiki-i18n';
import type { WikiChange } from '@/lib/wiki-types';
export default function Updates({locale,changes,baselineAt,topicIds,wikiChanges=[],wikiBaselineAt,wikiDocumentIds=[]}: {locale:Locale;changes:CatalogChange[];baselineAt:string;topicIds:Record<string,string[]>;wikiChanges?:WikiChange[];wikiBaselineAt?:string;wikiDocumentIds?:string[]}) {
  const d=getDictionary(locale); const w=getWikiDictionary(locale); const [followed]=useLocalList('ags:topics'); const [followedWiki]=useLocalList('ags:wiki-topics'); const [onlyFollowed,setOnlyFollowed]=useState(false);
  const params=useSearchParams(); const pathname=usePathname(); const wikiScope=params.get('scope')==='wiki'; const topic=wikiScope?params.get('topic')||'':'';
  function update(key:string,value:string) {const next=new URLSearchParams(params.toString());if(value)next.set(key,value);else next.delete(key);if(key!=='page')next.delete('page');if(key==='scope')next.delete('topic');window.history.pushState(null,'',`${pathname}${next.size?`?${next}`:''}`);}
  const ids=new Set(followed.flatMap(slug=>topicIds[slug]||[]));
  const currentWikiIds=new Set(wikiDocumentIds);
  const available = wikiScope ? wikiChanges.filter(change=>(!topic||change.topics.includes(topic))&&(!onlyFollowed||change.topics.some(value=>followedWiki.includes(value)))).map(change=>({id:change.documentId,title:change.title,type:change.type,date:change.date,url:change.sourceUrl,external:change.type==='removed'||!currentWikiIds.has(change.documentId),href:`/${locale}/wiki/${change.documentId}`})) : changes.filter(change=>!onlyFollowed||ids.has(change.resourceId)).map(change=>({id:change.resourceId,title:change.title,type:change.type,date:change.date,url:change.url,external:change.type==='removed',href:`/${locale}/resources/${change.resourceId}`}));
  const pages=Math.max(1,Math.ceil(available.length/40));const rawPage=Number(params.get('page')||1);const page=Number.isSafeInteger(rawPage)&&rawPage>0?Math.min(rawPage,pages):1;const visible=available.slice((page-1)*40,page*40);
  const rssParams=new URLSearchParams();if(wikiScope)rssParams.set('scope','wiki');if(topic)rssParams.set('topic',topic);
  const labels={added:d.added,updated:d.updated,removed:d.removed};
  return <><div className="segmented collection-scopes" aria-label={d.updates}><button type="button" className={!wikiScope?'is-active':''} onClick={()=>update('scope','')} aria-pressed={!wikiScope}>{w.resources}</button><button type="button" className={wikiScope?'is-active':''} onClick={()=>update('scope','wiki')} aria-pressed={wikiScope}>{w.wikiUpdates}</button></div>{wikiScope&&<p className="small muted wiki-updates-note">{w.wikiChangesHelp}</p>}
    <div className="updates-toolbar"><div className="segmented"><button type="button" className={!onlyFollowed?'is-active':''} onClick={()=>{setOnlyFollowed(false);update('page','');}} aria-pressed={!onlyFollowed}>{d.allUpdates}</button><button type="button" className={onlyFollowed?'is-active':''} onClick={()=>{setOnlyFollowed(true);update('page','');}} aria-pressed={onlyFollowed}>{d.followedUpdates}</button></div><a className="updates-rss" href={`/${locale}/feed.xml${rssParams.size?`?${rssParams}`:''}`}><Icon name="rss" size={17}/>{d.subscribeRss}</a></div><p className="small muted">{d.followingLocal}</p>
    {topic&&<div className="active-filters"><span>{w.topics}: {topic}</span><button type="button" className="text-button" onClick={()=>update('topic','')}>{d.clear}</button></div>}
    {visible.length ? <ol className="change-list">{visible.map((change,index)=><li key={`${change.id}-${change.date}-${index}`}><time dateTime={change.date}>{formatDate(change.date,locale)}</time><div><span className={`change-label ${change.type}`}>{labels[change.type]}</span><h2>{change.external?<a href={change.url} target="_blank" rel="noopener noreferrer">{change.title}<Icon name="external" size={15}/></a>:<Link href={change.href}>{change.title}<Icon name="arrow" size={16}/></Link>}</h2></div></li>)}</ol> : <div className="empty-state updates-empty"><Icon name="clock" size={34}/><h2>{onlyFollowed&&!(wikiScope?followedWiki:followed).length?d.noFollowed:d.noChanges}</h2><p>{wikiScope?w.indexBaseline:d.baselineNote}</p><span className="small muted">{d.firstObserved}: {formatDate(wikiScope?wikiBaselineAt:baselineAt,locale)}</span><Link className="button secondary" href={`/${locale}/${wikiScope?'wiki':'topics'}`}>{wikiScope?w.knowledge:d.topics}<Icon name="arrow" size={16}/></Link></div>}
    {pages>1&&<nav className="pagination" aria-label={d.page}><button type="button" className="button secondary" disabled={page===1} onClick={()=>update('page',String(page-1))}>{d.previous}</button><span>{d.page} {page} {d.of} {pages}</span><button type="button" className="button secondary" disabled={page===pages} onClick={()=>update('page',String(page+1))}>{d.next}</button></nav>}
  </>;
}
