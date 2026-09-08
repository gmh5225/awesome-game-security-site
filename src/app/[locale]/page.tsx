import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getDisplayResources } from '@/lib/content';
import Directory from '@/components/Directory';
import TopicCards from '@/components/TopicCards';
export const dynamic = 'force-dynamic';
export default async function Home({params}: {params:Promise<{locale:string}>}) { const {locale}=await params; if(!isLocale(locale)) notFound(); return <Directory resources={getDisplayResources(locale)} locale={locale} topicCards={<TopicCards locale={locale}/>}/>; }
