import Link from 'next/link';
import { getDictionary, localizedCategory } from '@/lib/i18n';
import { getEditorial, summaryInfo } from '@/lib/editorial';
import type { Locale, Resource } from '@/lib/types';
import Icon from './Icon';
import { SaveButton } from './ResourceActions';

export default function ResourceCard({ resource, locale, index, editorial: showEditorial = false }: { resource: Resource; locale: Locale; index?: number; editorial?: boolean }) {
  const d = getDictionary(locale);
  const editorial = getEditorial(resource.url);
  const summary = summaryInfo(resource,locale);
  const kinds = { tool: d.tools, guide: d.guides, reference: d.references, library: d.libraries, collection: d.collections };
  const host = new URL(resource.url).hostname.replace(/^www\./, '');
  return <article className="resource-card">
    <div className="card-top"><span className="resource-kind">{index !== undefined && <span className="item-number">{String(index + 1).padStart(2, '0')}</span>}{kinds[resource.kind]}</span><SaveButton id={resource.id} locale={locale} compact/></div>
    <h3><Link href={`/${locale}/resources/${resource.id}`}>{resource.title}</Link></h3>
    <p className="resource-summary" lang={summary.language}>{summary.text}</p>
    {!editorial && <p className="source-provenance" title={summary.language!==locale?d.translationFallback:d.sourceNote}>{summary.provenance==='upstream'?d.sourceGenerated:d.originalLanguage}{summary.language&&summary.language!==locale?' · EN':''}</p>}
    <div className="resource-tags">{resource.engines.slice(0, 2).map(value => <span key={value} className="tag">{value}</span>)}{resource.categories.filter(value => !value.includes(' / ')).slice(0, 2).map(value => <Link key={value} className="tag" href={`/${locale}?category=${encodeURIComponent(value)}`}>{localizedCategory(value, locale)}</Link>)}</div>
    {showEditorial && editorial && <div className="editorial-preview"><strong>{d.whySelected}</strong><p>{editorial.reason[locale]}</p></div>}
    <div className="card-bottom"><span className="source-host">{host}</span><div className="card-links">{editorial && <span className="curated-label"><span className="status-dot"/>{d.curated}</span>}<a href={resource.sourceUrl||resource.url} target="_blank" rel="noopener noreferrer" aria-label={`${d.visitResource}: ${resource.title}`} title={d.visitResource}><Icon name="external" size={16}/></a></div></div>
  </article>;
}
