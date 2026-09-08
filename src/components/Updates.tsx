'use client';
import { useState } from 'react';
import Link from 'next/link';
import { getDictionary } from '@/lib/i18n';
import { useLocalList } from '@/lib/local-state';
import { formatDate } from '@/lib/seo';
import type { CatalogChange, Locale } from '@/lib/types';
import Icon from './Icon';
export default function Updates({locale,changes,baselineAt,topicIds}: {locale:Locale;changes:CatalogChange[];baselineAt:string;topicIds:Record<string,string[]>}) {
  const d=getDictionary(locale); const [followed]=useLocalList('ags:topics'); const [onlyFollowed,setOnlyFollowed]=useState(false);
  const ids=new Set(followed.flatMap(slug=>topicIds[slug]||[]));
  const visible=changes.filter(change=>!onlyFollowed||ids.has(change.resourceId));
  const labels={added:d.added,updated:d.updated,removed:d.removed};
  return <><div className="updates-toolbar"><div className="segmented"><button type="button" className={!onlyFollowed?'is-active':''} onClick={()=>setOnlyFollowed(false)} aria-pressed={!onlyFollowed}>{d.allUpdates}</button><button type="button" className={onlyFollowed?'is-active':''} onClick={()=>setOnlyFollowed(true)} aria-pressed={onlyFollowed}>{d.followedUpdates}</button></div><a className="button secondary" href={`/${locale}/feed.xml`}><Icon name="rss" size={17}/>{d.subscribeRss}</a></div><p className="small muted">{d.followingLocal}</p>
    {visible.length ? <ol className="change-list">{visible.map((change,index)=><li key={`${change.resourceId}-${change.date}-${index}`}><time dateTime={change.date}>{formatDate(change.date,locale)}</time><div><span className={`change-label ${change.type}`}>{labels[change.type]}</span><h2>{change.type==='removed'?<a href={change.url} target="_blank" rel="noopener noreferrer">{change.title}<Icon name="external" size={15}/></a>:<Link href={`/${locale}/resources/${change.resourceId}`}>{change.title}<Icon name="arrow" size={16}/></Link>}</h2></div></li>)}</ol> : <div className="empty-state updates-empty"><Icon name="clock" size={34}/><h2>{onlyFollowed&&!followed.length?d.noFollowed:d.noChanges}</h2><p>{d.baselineNote}</p><span className="small muted">{d.firstObserved}: {formatDate(baselineAt,locale)}</span><Link className="button secondary" href={`/${locale}/topics`}>{d.topics}<Icon name="arrow" size={16}/></Link></div>}
  </>;
}
