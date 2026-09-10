'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { getDictionary } from '@/lib/i18n';
import { getWikiDictionary } from '@/lib/wiki-i18n';
import { useLocalList } from '@/lib/local-state';
import type { Locale, Resource } from '@/lib/types';
import type { WikiListDocument } from '@/lib/wiki-search';
import Directory from './Directory';
import WikiDirectory from './WikiDirectory';

export default function SavedCollections({locale, resources, documents}: {locale:Locale;resources:Resource[];documents:WikiListDocument[]}) {
  const d = getDictionary(locale);
  const w = getWikiDictionary(locale);
  const params = useSearchParams();
  const pathname = usePathname();
  const wiki = params.get('type') === 'wiki';
  const [saved] = useLocalList('ags:saved');
  const [savedWiki] = useLocalList('ags:wiki-saved');
  const number = (value:number) => new Intl.NumberFormat(locale).format(value);
  function changeType(value: boolean) {
    window.history.pushState(null, '', `${pathname}${value ? '?type=wiki' : ''}`);
  }
  return <>
    <div className="saved-collection-switch"><div className="segmented" aria-label={d.saved}><button type="button" className={!wiki ? 'is-active' : ''} aria-pressed={!wiki} onClick={() => changeType(false)}>{w.resources} <span className="count">{number(saved.length)}</span></button><button type="button" className={wiki ? 'is-active' : ''} aria-pressed={wiki} onClick={() => changeType(true)}>Wiki <span className="count">{number(savedWiki.length)}</span></button></div></div>
    {wiki ? <WikiDirectory documents={documents} locale={locale} savedOnly/> : <Directory resources={resources} locale={locale} savedOnly/>}
  </>;
}
