import type { Metadata } from 'next';
import { getDictionary } from '@/lib/i18n';
import { SITE_URL } from '@/lib/seo';
import { NotFoundDocument } from './_not-found/content';
import './globals.css';

const d = getDictionary('en');
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `404 · ${d.notFoundTitle}`,
  description: d.notFoundMessage,
  robots: { index: false, follow: true },
  openGraph: {
    title: `404 · ${d.notFoundTitle}`,
    description: d.notFoundMessage,
    siteName: 'Awesome Game Security',
    images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630, alt: 'Awesome Game Security' }],
  },
};

export default function GlobalNotFound() {
  return <NotFoundDocument/>;
}
