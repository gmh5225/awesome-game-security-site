import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDictionary, isLocale } from '@/lib/i18n';
import { getTopic, topics } from '@/data/topics';
import { topicResources } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';
import ResourceCard from '@/components/ResourceCard';
import { FollowButton, ShareButton } from '@/components/ResourceActions';
import Icon from '@/components/Icon';
export const generateStaticParams = () => topics.map(topic=>({slug:topic.slug}));
export async function generateMetadata({params}: {params:Promise<{locale:string;slug:string}>}) { const {locale,slug}=await params; const topic=getTopic(slug); if(!isLocale(locale)||!topic) return {}; return pageMetadata(locale,`/topics/${slug}`,topic.title[locale],topic.description[locale]); }
export default async function TopicPage({params}: {params:Promise<{locale:string;slug:string}>}) {
  const {locale,slug}=await params; const topic=getTopic(slug); if(!isLocale(locale)||!topic) notFound(); const d=getDictionary(locale);
  return <div className="content-page"><Link className="back-link" href={`/${locale}/topics`}>← {d.backToTopics}</Link><header className="page-intro topic-intro"><span className="eyebrow">{d.curated} / {topic.entries.length} {d.resourcesCountLabel}</span><h1>{topic.title[locale]}</h1><p>{topic.description[locale]}</p><div className="audience-note"><strong>{d.audience}</strong><p>{topic.audience[locale]}</p></div><div className="action-row"><FollowButton slug={slug} locale={locale}/><a href={`/${locale}/feed.xml?topic=${slug}`} className="button secondary"><Icon name="rss" size={17}/>{d.subscribeRss}</a><ShareButton locale={locale}/></div><p className="small muted">{d.followingLocal}</p></header><div className="section-heading"><h2>{d.topicResources}</h2></div><div className="resource-grid topic-resource-grid">{topicResources(slug,locale).map((resource,index)=><ResourceCard key={resource.id} resource={resource} locale={locale} index={index} editorial/>)}</div><p className="method-note">{d.editorialNote}</p></div>;
}
