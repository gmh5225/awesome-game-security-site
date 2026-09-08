import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary, isLocale } from '@/lib/i18n';
import { SITE_URL } from '@/lib/seo';
import { NotFoundContent } from '../../_not-found/content';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const d = getDictionary(isLocale(locale) ? locale : 'en');
  return {
    metadataBase: new URL(SITE_URL),
    title: `404 · ${d.notFoundTitle}`,
    description: d.notFoundMessage,
    robots: { index: false, follow: true },
    alternates: { canonical: null, languages: {} },
    openGraph: {
      title: `404 · ${d.notFoundTitle}`,
      description: d.notFoundMessage,
      siteName: 'Awesome Game Security',
      images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: 'Awesome Game Security' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `404 · ${d.notFoundTitle}`,
      description: d.notFoundMessage,
      images: [`${SITE_URL}/opengraph-image`],
    },
  };
}

// Proxy sets status 404 before rendering this page. Returning visible content
// avoids Next's client-only recovery shell for pre-stream notFound() exceptions.
export default async function NotFoundPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <NotFoundContent/>;
}
