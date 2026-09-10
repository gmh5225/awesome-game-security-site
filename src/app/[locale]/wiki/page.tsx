import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale } from '@/lib/i18n';
import { getWiki, getWikiListDocuments } from '@/lib/wiki';
import { getWikiDictionary } from '@/lib/wiki-i18n';
import { searchWikiDocuments } from '@/lib/wiki-search';
import { pageMetadata } from '@/lib/seo';
import WikiDirectory from '@/components/WikiDirectory';
import styles from '@/components/Wiki.module.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const d = getWikiDictionary(locale);
  return pageMetadata(locale, '/wiki', d.wikiTitle, d.subtitle);
}

export default async function WikiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const wiki = getWiki();
  const documents = getWikiListDocuments();
  const d = getWikiDictionary(locale);
  const kinds = { overview: d.overviews, concept: d.concepts, entity: d.entities };
  // The locale index is prerendered. URL search state hydrates inside Suspense,
  // while the initial HTML still contains a useful, linked document index.
  const fallback = <div className={styles.shell}><header className={styles.intro}><h1>{d.wikiTitle}</h1><p>{d.subtitle}</p><p>{new Intl.NumberFormat(locale).format(documents.length)} {d.documentCount}</p></header><ul className={styles.entries}>{searchWikiDocuments(documents).slice(0, 24).map(document => <li key={document.id} className={styles.entry}><div className={styles.entryBody}><h2><Link href={`/${locale}/wiki/${document.id}`}>{document.title}</Link></h2><div className={styles.entryMeta}><span className={styles.kind}>{kinds[document.kind]}</span></div></div></li>)}</ul>{!documents.length && <p className={styles.notice}>{d.noWikiData}</p>}</div>;
  return <Suspense fallback={fallback}><WikiDirectory documents={documents} locale={locale} sourceCommit={wiki?.sourceCommit} syncedAt={wiki?.syncedAt}/></Suspense>;
}
