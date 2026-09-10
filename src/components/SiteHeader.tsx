'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { getDictionary, localeNames } from '@/lib/i18n';
import { LOCALES, type Locale } from '@/lib/types';
import Icon from './Icon';
import SelectControl from './SelectControl';
import { getWikiDictionary } from '@/lib/wiki-i18n';

export default function SiteHeader({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const pathname = usePathname();
  const params = useSearchParams();
  const links = [['', d.allResources, 'grid'], ['/wiki', getWikiDictionary(locale).knowledge, 'book'], ['/updates', d.updates, 'clock'], ['/saved', d.saved, 'bookmark']];
  function changeLanguage(value: string) {
    const language = LOCALES.find(candidate => candidate === value);
    if (!language) return;
    const segments = pathname.split('/');
    segments[1] = language;
    const destination = new URL(window.location.origin);
    destination.pathname = segments.join('/');
    destination.search = params.toString();
    window.location.assign(destination.href);
  }
  return <header className="site-header"><div className="header-inner">
    <Link href={`/${locale}`} className="brand" aria-label={d.siteName}><span className="brand-mark mono" aria-hidden="true">{'</>'}</span><span><strong>Awesome Game Security</strong></span></Link>
    <nav aria-label={d.menu} className="top-nav">{links.map(([path, label, icon]) => <Link key={path} href={`/${locale}${path}`} aria-current={(path ? pathname === `/${locale}${path}` || pathname.startsWith(`/${locale}${path}/`) || (path === '/wiki' && (pathname === `/${locale}/topics` || pathname.startsWith(`/${locale}/topics/`))) : pathname === `/${locale}`) ? 'page' : undefined}><Icon name={icon} size={17}/><span>{label}</span></Link>)}</nav>
    <div className="language-picker"><SelectControl label={d.language} value={locale} onValueChange={changeLanguage} variant="language" align="end" icon={<Icon name="globe" size={16}/>} options={LOCALES.map(lang => ({value: lang, label: localeNames[lang], detail: lang.toUpperCase()}))}/></div>
  </div></header>;
}
