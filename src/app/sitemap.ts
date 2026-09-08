import type { MetadataRoute } from 'next';
import { LOCALES } from '@/lib/types';
import { SITE_URL } from '@/lib/seo';
import { getCatalog } from '@/lib/catalog';
import { topics } from '@/data/topics';
export default function sitemap():MetadataRoute.Sitemap {const catalog=getCatalog();const paths=['','/topics','/updates','/about',...topics.map(topic=>`/topics/${topic.slug}`)];return LOCALES.flatMap(locale=>[...paths.map(path=>({url:`${SITE_URL}/${locale}${path}`,lastModified:catalog.syncedAt,alternates:{languages:Object.fromEntries(LOCALES.map(lang=>[lang,`${SITE_URL}/${lang}${path}`]))}})),...catalog.resources.map(resource=>({url:`${SITE_URL}/${locale}/resources/${resource.id}`,lastModified:resource.contentChangedAt}))]);}
