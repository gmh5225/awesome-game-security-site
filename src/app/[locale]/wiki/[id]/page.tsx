import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDictionary, isLocale } from '@/lib/i18n';
import { getWiki, getWikiDocument } from '@/lib/wiki';
import { getWikiDictionary } from '@/lib/wiki-i18n';
import { formatDate, pageMetadata, SOURCE_URL } from '@/lib/seo';
import Icon from '@/components/Icon';
import Tooltip from '@/components/Tooltip';
import WikiSaveButton from '@/components/WikiSaveButton';
import WikiFollowButton from '@/components/WikiFollowButton';
import WikiReferences, { type WikiReferenceParams } from '@/components/WikiReferences';
import { ShareButton } from '@/components/ResourceActions';
import styles from '@/components/Wiki.module.css';

type DocumentParams = Promise<{ locale: string; id: string }>;
export async function generateMetadata({ params }: { params: DocumentParams }) {
  const { locale, id } = await params;
  const document = getWikiDocument(id);
  if (!isLocale(locale) || !document) return {};
  return pageMetadata(locale, `/wiki/${id}`, document.title, getWikiDictionary(locale).indexOnly);
}

// No document generateStaticParams: thousands of documents render on demand.
export default async function WikiDocumentPage({ params, searchParams }: { params: DocumentParams; searchParams: Promise<WikiReferenceParams> }) {
  const { locale, id } = await params;
  const document = getWikiDocument(id);
  const wiki = getWiki();
  if (!isLocale(locale) || !document || !wiki) notFound();
  const query = await searchParams;
  const d = getWikiDictionary(locale);
  const shared = getDictionary(locale);
  const kind = { overview: d.overviews, concept: d.concepts, entity: d.entities }[document.kind];
  const confidence = { high: d.confidenceHigh, medium: d.confidenceMedium, low: d.confidenceLow, unknown: d.confidenceUnknown }[document.confidence];
  const sourceLanguage = document.language && document.language !== 'unknown' ? document.language : undefined;
  const date = (value: string) => {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return shared.unknown;
    const utc = new Date(parsed).toISOString();
    const label = formatDate(value, locale);
    return <Tooltip content={utc}><time className="tooltip-trigger" dateTime={utc} aria-label={`${label} (${utc})`} tabIndex={0}>{label}</time></Tooltip>;
  };

  return <div className={styles.shell}>
    <Link href={`/${locale}/wiki`} className={styles.back}><span aria-hidden="true">←</span>{d.backToKnowledge}</Link>
    <header className={styles.documentIntro}>
      <span className={`eyebrow ${styles.kind}`}>{d.wiki} / {kind}</span>
      <h1 lang={sourceLanguage}>{document.title}</h1>
      <div className={styles.entryMeta}><span>{d.originalLanguage}: {sourceLanguage ? sourceLanguage.toUpperCase() : d.languageUnknown}</span>{document.upstreamUpdatedAt && <span>{d.upstreamUpdated}: {date(document.upstreamUpdatedAt)}</span>}</div>
    </header>
    <div className={styles.documentLayout}>
      <article className={styles.main}>
        <p className={styles.notice}>{d.indexOnly}</p>
        {sourceLanguage && sourceLanguage.toLowerCase() !== locale.toLowerCase() && <p className={styles.inlineNote}>{d.noTranslation}</p>}
        <div className={styles.documentActions}><a className="button primary" href={document.sourceUrl} target="_blank" rel="noopener noreferrer">{d.readOriginal}<Icon name="external" size={17}/></a><WikiSaveButton id={id} locale={locale}/><ShareButton locale={locale}/></div>
        <WikiReferences document={document} locale={locale} searchParams={query}/>
      </article>
      <aside className={styles.aside}>
        <section><h2>{d.originalSource}</h2><dl className={styles.facts}>
          <div><dt>{d.sourcePath}</dt><dd><a href={document.sourceUrl} target="_blank" rel="noopener noreferrer"><code>{document.path}</code></a></dd></div>
          <div><dt>{d.sourceVersion}</dt><dd><a href={`${SOURCE_URL}/commit/${wiki.sourceCommit}`} target="_blank" rel="noopener noreferrer"><code>{wiki.sourceCommit.slice(0, 7)}</code></a></dd></div>
          <div><dt>{d.firstObserved}</dt><dd>{date(document.firstSeenAt)}</dd></div>
          <div><dt>{d.indexUpdated}</dt><dd>{date(document.contentChangedAt)}</dd></div>
          <div><dt>{d.lastSync}</dt><dd>{date(wiki.syncedAt)}</dd></div>
        </dl><p className={styles.inlineNote}>{d.indexBaseline}</p>{document.upstreamUpdatedAt && <p className={styles.inlineNote}>{d.upstreamDateNote}</p>}</section>
        {document.topics.length > 0 && <section><h2>{d.topics}</h2><ul className={styles.topicRows}>{document.topics.map(topic => <li key={topic}><Link href={`/${locale}/wiki?topic=${encodeURIComponent(topic)}`}>{topic}</Link><WikiFollowButton topic={topic} locale={locale} compact/></li>)}</ul><p className={styles.inlineNote}>{d.localNote}</p></section>}
        {document.confidence !== 'unknown' && <section><h2>{d.upstreamConfidence}</h2><p>{confidence}</p><p className={styles.inlineNote}>{d.confidenceNote}</p></section>}
      </aside>
    </div>
  </div>;
}
