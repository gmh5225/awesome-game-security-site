import { notFound } from 'next/navigation';
import { getDictionary,isLocale } from '@/lib/i18n';
import { getCatalog } from '@/lib/catalog';
import { topicResources } from '@/lib/content';
import { topics } from '@/data/topics';
import { pageMetadata } from '@/lib/seo';
import Updates from '@/components/Updates';
export async function generateMetadata({params}: {params:Promise<{locale:string}>}) {const {locale}=await params;if(!isLocale(locale))return {};const d=getDictionary(locale);return pageMetadata(locale,'/updates',d.updates,d.freshnessHelp);}
export default async function UpdatesPage({params}: {params:Promise<{locale:string}>}) {const {locale}=await params;if(!isLocale(locale))notFound();const d=getDictionary(locale);const catalog=getCatalog();return <div className="content-page"><header className="page-intro"><span className="eyebrow">{d.recentChanges}</span><h1>{d.updates}</h1><p>{d.freshnessHelp}</p></header><Updates locale={locale} changes={catalog.changes} baselineAt={catalog.baselineAt} topicIds={Object.fromEntries(topics.map(topic=>[topic.slug,topicResources(topic.slug,locale).map(resource=>resource.id)]))}/></div>;}
