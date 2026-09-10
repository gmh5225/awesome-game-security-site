import Link from 'next/link';
import { getResourceWikiDocuments } from '@/lib/wiki';
import { getWikiDictionary } from '@/lib/wiki-i18n';
import { getDictionary } from '@/lib/i18n';
import type { Locale } from '@/lib/types';
import Icon from './Icon';

export default function ResourceWikiReferences({resourceId, locale, page = 1}: {resourceId:string;locale:Locale;page?:number}) {
  const documents = getResourceWikiDocuments(resourceId);
  if (!documents.length) return null;
  const w = getWikiDictionary(locale);
  const d = getDictionary(locale);
  const kinds = {overview:w.overviews, concept:w.concepts, entity:w.entities};
  const pages = Math.ceil(documents.length / 8);
  const current = Math.min(pages, Number.isSafeInteger(page) && page > 0 ? page : 1);
  const href = (value: number) => `/${locale}/resources/${resourceId}?wikiPage=${value}#wiki-references`;
  return <section className="detail-section" id="wiki-references">
    <div className="section-heading"><h2>{w.wikiReferences} <span className="result-count">{new Intl.NumberFormat(locale).format(documents.length)}</span></h2></div>
    <ul className="wiki-inline-list">{documents.slice((current - 1) * 8, current * 8).map(doc => <li key={doc.id}><Link href={`/${locale}/wiki/${doc.id}`}><span className="mono">{doc.title}</span><span className="small muted">{kinds[doc.kind]}</span><Icon name="arrow" size={15}/></Link></li>)}</ul>
    {pages > 1 && <nav className="pagination" aria-label={w.wikiReferences}>{current > 1 ? <Link className="button secondary" href={href(current - 1)}>{d.previous}</Link> : <span/>}<span>{d.page} {current} {d.of} {pages}</span>{current < pages ? <Link className="button secondary" href={href(current + 1)}>{d.next}</Link> : <span/>}</nav>}
  </section>;
}
