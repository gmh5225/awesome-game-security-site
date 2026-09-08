import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDictionary, isLocale, localizedCategory } from '@/lib/i18n';
import { getResource } from '@/lib/catalog';
import { getEditorial, resourceDescription, summaryInfo } from '@/lib/editorial';
import { pageMetadata } from '@/lib/seo';
import { SaveButton, ShareButton } from '@/components/ResourceActions';
import Icon from '@/components/Icon';
import MetadataFacts from '@/components/MetadataFacts';
export async function generateMetadata({params}: {params:Promise<{locale:string;id:string}>}) { const {locale,id}=await params; const resource=getResource(id); if(!isLocale(locale)||!resource) return {}; return pageMetadata(locale,`/resources/${id}`,resource.title,resourceDescription(resource,locale).slice(0,180)); }
export default async function ResourcePage({params}: {params:Promise<{locale:string;id:string}>}) {
  const {locale,id}=await params; const resource=getResource(id); if(!isLocale(locale)||!resource) notFound(); const d=getDictionary(locale); const editorial=getEditorial(resource.url); const summary=summaryInfo(resource,locale); const destination=resource.sourceUrl||resource.url;
  const kinds={tool:d.tools,guide:d.guides,reference:d.references,library:d.libraries,collection:d.collections};
  return <div className="content-page resource-page"><Link className="back-link" href={`/${locale}`}>← {d.backToResources}</Link><div className="detail-layout"><article><header className="page-intro"><span className="eyebrow">{kinds[editorial?.kind||resource.kind]} {editorial && ` / ${d.curated}`}</span><h1>{resource.title}</h1><p lang={summary.language}>{summary.text}</p>{!editorial&&<p className="source-provenance">{summary.provenance==='upstream'?d.sourceGenerated:d.originalLanguage}{summary.language!==locale?` · ${d.translationFallback}`:''}</p>}<div className="resource-tags">{resource.categories.map(value=><Link className="tag" key={value} href={`/${locale}?category=${encodeURIComponent(value)}`}>{localizedCategory(value,locale)}</Link>)}</div><div className="action-row"><a className="button primary" href={destination} target="_blank" rel="noopener noreferrer">{d.visitResource}<Icon name="external" size={17}/></a><SaveButton id={id} locale={locale}/><ShareButton locale={locale}/></div></header>
    {editorial ? <><section className="detail-section"><h2>{d.whySelected}</h2><p>{editorial.reason[locale]}</p></section><section className="detail-section"><h2>{d.limitations}</h2><p>{editorial.limitation[locale]}</p></section><p className="method-note">{d.editorialNote}</p></> : <section className="detail-section"><h2>{summary.provenance==='upstream'?d.sourceSummary:d.originalLanguage}</h2><p lang={summary.language}>{summary.text}</p><p className="method-note">{d.sourceNote}</p></section>}
    <section className="detail-section"><h2>{d.source}</h2><a className="source-url" href={destination} target="_blank" rel="noopener noreferrer">{destination}<Icon name="external" size={15}/></a><p><a href={`https://github.com/gmh5225/awesome-game-security/issues/new?title=${encodeURIComponent(`Resource feedback: ${resource.title}`)}&body=${encodeURIComponent(resource.url)}`} target="_blank" rel="noopener noreferrer">{d.reportIssue}</a></p></section></article>
    <aside className="detail-aside"><MetadataFacts resource={resource} locale={locale} level={editorial?.level} kind={editorial?.kind}/></aside></div></div>;
}
