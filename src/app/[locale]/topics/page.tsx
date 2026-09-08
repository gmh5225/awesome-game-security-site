import { notFound } from 'next/navigation';
import { getDictionary, isLocale } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';
import TopicCards from '@/components/TopicCards';
export async function generateMetadata({params}: {params:Promise<{locale:string}>}) { const {locale}=await params; if(!isLocale(locale)) return {}; const d=getDictionary(locale); return pageMetadata(locale,'/topics',d.topics,d.editorialNote); }
export default async function Topics({params}: {params:Promise<{locale:string}>}) { const {locale}=await params; if(!isLocale(locale)) notFound(); const d=getDictionary(locale); return <div className="content-page"><header className="page-intro"><span className="eyebrow">{d.featuredTopics}</span><h1>{d.topics}</h1><p>{d.editorialNote}</p></header><TopicCards locale={locale}/></div>; }
