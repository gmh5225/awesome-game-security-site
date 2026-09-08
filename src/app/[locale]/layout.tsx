import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import localFont from 'next/font/local';
import type { Viewport } from 'next';
import { getDictionary, isLocale } from '@/lib/i18n';
import { LOCALES } from '@/lib/types';
import { getCatalog } from '@/lib/catalog';
import { formatDate, pageMetadata, SOURCE_URL } from '@/lib/seo';
import SiteHeader from '@/components/SiteHeader';
import Icon from '@/components/Icon';
import '../directory.css';
const sans = localFont({ src: '../fonts/GeistVF.woff', variable: '--font-geist-sans', weight: '100 900', display: 'swap' });
const mono = localFont({ src: '../fonts/GeistMonoVF.woff', variable: '--font-geist-mono', weight: '100 900', display: 'swap' });
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#101716' };
export const generateStaticParams = () => LOCALES.map(locale => ({locale}));
export async function generateMetadata({params}: {params:Promise<{locale:string}>}) { const {locale}=await params; if(!isLocale(locale)) return {}; const d=getDictionary(locale); return pageMetadata(locale,'',d.siteName,d.heroDescription); }
export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{locale:string}> }) {
  const {locale} = await params;
  if (!isLocale(locale)) notFound();
  const d = getDictionary(locale);
  const catalog = getCatalog();
  return <html lang={locale}><body className={`${sans.variable} ${mono.variable}`}><a href="#main-content" className="skip-link">{d.skipToContent}</a><Suspense fallback={<header className="site-header header-fallback">Awesome Game Security</header>}><SiteHeader locale={locale}/></Suspense><main id="main-content">{children}</main><footer className="site-footer"><div className="footer-inner"><div><strong>Awesome Game Security</strong><p>{d.footerNote}</p></div><div className="footer-links"><Link href={`/${locale}/about`}>{d.about}</Link><Link href={`/${locale}/about#privacy`}>{d.privacy}</Link><a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">GitHub<Icon name="external" size={13}/></a><a href={`/${locale}/feed.xml`}>RSS<Icon name="rss" size={13}/></a></div></div><div className="footer-meta"><span>{d.lastSync}: {formatDate(catalog.syncedAt,locale)} <span className="mono">UTC</span></span><a href={`${SOURCE_URL}/commit/${catalog.sourceCommit}`} target="_blank" rel="noopener noreferrer">{d.sourceVersion} <span className="mono">{catalog.sourceCommit.slice(0,7)}</span></a><span>MIT · gmh5225</span></div></footer></body></html>;
}
