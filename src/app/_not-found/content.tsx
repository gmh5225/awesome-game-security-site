'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getDictionary, isLocale, localeNames } from '@/lib/i18n';
import { LOCALES, type Locale } from '@/lib/types';

function useNotFoundLocale(): Locale {
  const pathname = usePathname();
  const candidate = pathname?.split('/')[1] || '';
  return isLocale(candidate) ? candidate : 'en';
}

export function NotFoundContent() {
  const locale = useNotFoundLocale();
  const d = getDictionary(locale);
  return <section className="content-page" lang={locale}>
    <div className="empty-state">
      <span className="eyebrow">404</span>
      <h1>{d.notFoundTitle}</h1>
      <p>{d.notFoundMessage}</p>
      <Link className="button primary" href={`/${locale}`}>{d.backToResources}</Link>
      <nav className="footer-links" aria-label={d.language}>
        {LOCALES.map(language => <a key={language} href={`/${language}`} lang={language} hrefLang={language}>{localeNames[language]}</a>)}
      </nav>
    </div>
  </section>;
}

// Global not-found bypasses every root layout and therefore owns the document.
export function NotFoundDocument() {
  const locale = useNotFoundLocale();
  return <html lang={locale}><body><main id="main-content"><NotFoundContent/></main></body></html>;
}
