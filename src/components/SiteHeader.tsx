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
    <nav aria-label={d.menu} className="top-nav">{links.map(([path, label, icon]) => <Link key={path} href={`/${locale}${path}`} aria-current={(path ? pathname.includes(`/${locale}${path}`) : pathname === `/${locale}`) ? 'page' : undefined}><Icon name={icon} size={17}/><span>{label}</span></Link>)}</nav>
    <label className="language-picker"><Icon name="globe" size={17}/><span className="sr-only">{d.language}</span><select value={locale} aria-label={d.language} onChange={event => changeLanguage(event.target.value)}>{LOCALES.map(lang => <option key={lang} value={lang}>{localeNames[lang]}</option>)}</select></label>
  </div></header>;
}
