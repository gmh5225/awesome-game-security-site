import { NextResponse, type NextRequest } from 'next/server';
import { LOCALES, type Locale } from '@/lib/types';

const locales = new Set<string>(LOCALES);
const localizedIndexes = new Set(['about', 'saved', 'topics', 'wiki', 'updates', 'feed.xml']);
const publicRoutes = new Set([
  'opengraph-image', 'icon.svg', 'favicon.ico', 'robots.txt', 'sitemap.xml',
  'window.svg', 'globe.svg', 'next.svg', 'vercel.svg', 'file.svg',
]);

function missing(request: NextRequest, locale: Locale) {
  const target = request.nextUrl.clone();
  target.pathname = `/${locale}/404`;
  target.search = '';
  return NextResponse.rewrite(target, {
    status: 404,
    headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' },
  });
}

export async function proxy(request: NextRequest) {
  let segments: string[];
  try { segments = request.nextUrl.pathname.split('/').filter(Boolean).map(decodeURIComponent); }
  catch { return missing(request, 'en'); }
  const [first, section, id] = segments;
  if (first === 'sitemaps' && segments.length === 2 && /^(en|zh-CN|zh-TW|ja|ko|de|fr|es|it|ru)-[1-9][0-9]*\.xml$/.test(section)) return NextResponse.next();
  if (!first || publicRoutes.has(first) || first === '_next') return NextResponse.next();
  if (!locales.has(first)) return missing(request, 'en');
  const locale = first as Locale;
  if (segments.length === 1) return NextResponse.next();
  if (section === '404' && segments.length === 2) return missing(request, locale);
  if (segments.length === 2 && localizedIndexes.has(section)) return NextResponse.next();
  if (section === 'resources' && segments.length === 3) {
    if (!/^[a-f0-9]{16}$/.test(id)) return missing(request, locale);
    // Load the server snapshot only for resource-detail requests, never into a
    // browser bundle or for ordinary home, asset, topic-index, and feed requests.
    const { getResource } = await import('@/lib/catalog');
    if (!getResource(id)) return missing(request, locale);
    return NextResponse.next();
  }
  if (section === 'topics' && segments.length === 3) {
    const { getTopic } = await import('@/data/topics');
    if (!getTopic(id)) return missing(request, locale);
    return NextResponse.next();
  }
  if (section === 'wiki' && segments.length === 3) {
    const { getWikiDocument } = await import('@/lib/wiki');
    if (!getWikiDocument(id)) return missing(request, locale);
    return NextResponse.next();
  }
  // Production caches global-not-found in English. Known locale prefixes must
  // use their own static 404 page, including arbitrary unmatched subpaths.
  return missing(request, locale);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
