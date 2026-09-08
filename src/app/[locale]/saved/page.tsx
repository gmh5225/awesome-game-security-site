import { notFound } from 'next/navigation';
import { getDictionary, isLocale } from '@/lib/i18n';
import { getDisplayResources } from '@/lib/content';
import Directory from '@/components/Directory';
import { pageMetadata } from '@/lib/seo';
export const dynamic = 'force-dynamic';
export async function generateMetadata({params}: {params:Promise<{locale:string}>}) { const {locale}=await params; if(!isLocale(locale)) return {}; const d=getDictionary(locale); return {...pageMetadata(locale,'/saved',d.saved,d.savedLocal),robots:{index:false,follow:true}}; }
export default async function Saved({params}: {params:Promise<{locale:string}>}) { const {locale}=await params; if(!isLocale(locale)) notFound(); return <Directory resources={getDisplayResources(locale)} locale={locale} savedOnly/>; }
