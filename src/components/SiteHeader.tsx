'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { getDictionary, localeNames } from '@/lib/i18n';
import { LOCALES, type Locale } from '@/lib/types';
import Icon from './Icon';

export default function SiteHeader({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const pathname = usePathname();
  const params = useSearchParams();
  const links = [['', d.allResources, 'grid'], ['/topics', d.topics, 'book'], ['/updates', d.updates, 'clock'], ['/saved', d.saved, 'bookmark']];
  return <header className="site-header"><div className="header-inner">
    <Link href={`/${locale}`} className="brand" aria-label={d.siteName}><span className="brand-mark"><Icon name="shield" size={24}/></span><span><strong>Awesome Game Security</strong><span className="brand-subtitle">{d.tagline}</span></span></Link>
    <nav aria-label={d.menu} className="top-nav">{links.map(([path, label, icon]) => <Link key={path} href={`/${locale}${path}`} aria-current={(path ? pathname.includes(`/${locale}${path}`) : pathname === `/${locale}`) ? 'page' : undefined}><Icon name={icon} size={17}/><span>{label}</span></Link>)}</nav>
    <label className="language-picker"><Icon name="globe" size={17}/><span className="sr-only">{d.language}</span><select value={locale} aria-label={d.language} onChange={event => { const segments = pathname.split('/'); segments[1] = event.target.value; const query = params.toString(); window.location.assign(`${segments.join('/')}${query ? `?${query}` : ''}`); }}>{LOCALES.map(lang => <option key={lang} value={lang}>{localeNames[lang]}</option>)}</select></label>
  </div></header>;
}
