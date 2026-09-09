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
  const sourceUrl = resource.sourceUrl || resource.url;
  const detailUrl = `/${locale}/resources/${resource.id}`;
  return <article className="resource-card resource-record">
    <div className="card-top"><span className="resource-kind">{index !== undefined && <span className="item-number">{String(index + 1).padStart(2, '0')}</span>}{kinds[resource.kind]}</span><SaveButton id={resource.id} locale={locale} compact/></div>
    <dl className="resource-fields">
      <div className="resource-field">
        <dt className="resource-field-label" lang="en">Name:</dt>
        <dd className="resource-field-value"><h3><Link href={detailUrl}>{resource.title}</Link></h3></dd>
      </div>
      <div className="resource-field">
        <dt className="resource-field-label" lang="en">Desc:</dt>
        <dd className="resource-field-value">
          <p className="resource-description" lang={summary.language}>{summary.text}</p>
          {!editorial && <p className="source-provenance" title={summary.language!==locale?d.translationFallback:d.sourceNote}>{summary.provenance==='upstream'?d.sourceGenerated:d.originalLanguage}{summary.language&&summary.language!==locale?' · EN':''}</p>}
        </dd>
      </div>
      <div className="resource-field">
        <dt className="resource-field-label" lang="en">URL:</dt>
        <dd className="resource-field-value"><a className="url-text" href={sourceUrl} target="_blank" rel="noopener noreferrer" title={d.visitResource}>{sourceUrl}</a></dd>
      </div>
      <div className="resource-field">
        <dt className="resource-field-label" lang="en">Tags:</dt>
        <dd className="resource-field-value"><div className="resource-tags">{resource.engines.slice(0, 2).map(value => <span key={value} className="tag">{value}</span>)}{resource.categories.filter(value => !value.includes(' / ')).slice(0, 2).map(value => <Link key={value} className="tag" href={`/${locale}?category=${encodeURIComponent(value)}`}>{localizedCategory(value, locale)}</Link>)}</div></dd>
      </div>
    </dl>
    {showEditorial && editorial && <div className="editorial-preview"><strong>{d.whySelected}</strong><p>{editorial.reason[locale]}</p></div>}
    <div className="card-bottom"><span>{editorial && <span className="curated-label"><span className="status-dot"/>{d.curated}</span>}</span><Link className="view-details" href={detailUrl}>{d.viewResource}<Icon name="arrow" size={16}/></Link></div>
  </article>;
}
