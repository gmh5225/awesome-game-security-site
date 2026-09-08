import type { Metadata } from 'next';
import { LOCALES, type Locale } from './types';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gs.awesome.rip').replace(/\/$/, '');
export const SOURCE_URL = 'https://github.com/gmh5225/awesome-game-security';
const ogLocales:Record<Locale,string>={en:'en_US','zh-CN':'zh_CN','zh-TW':'zh_TW',ja:'ja_JP',ko:'ko_KR',de:'de_DE',fr:'fr_FR',es:'es_ES',it:'it_IT',ru:'ru_RU'};
export function pageMetadata(locale: Locale, path: string, title: string, description: string): Metadata {
  const canonical = `${SITE_URL}/${locale}${path}`;
  return {
    title, description, metadataBase:new URL(SITE_URL),
    alternates: { canonical, languages: { ...Object.fromEntries(LOCALES.map(lang => [lang, `${SITE_URL}/${lang}${path}`])), 'x-default': `${SITE_URL}/en${path}` } },
    openGraph: { title, description, url: canonical, siteName: 'Awesome Game Security', type: 'website', locale: ogLocales[locale], images:[{url:`${SITE_URL}/opengraph-image`,width:1200,height:630,alt:'Awesome Game Security'}] },
    twitter: { card: 'summary_large_image', title, description, images:[`${SITE_URL}/opengraph-image`] },
  };
}
export function formatDate(value: string | undefined, locale: Locale): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}
