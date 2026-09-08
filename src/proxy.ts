import { NextResponse, type NextRequest } from 'next/server';
import { LOCALES, type Locale } from '@/lib/types';

const locales = new Set<string>(LOCALES);
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
  if (!first || publicRoutes.has(first) || first === '_next') return NextResponse.next();
  if (!locales.has(first)) return missing(request, 'en');
  const locale = first as Locale;
  if (section === '404' && segments.length === 2) return missing(request, locale);
  if (section === 'resources' && segments.length === 3) {
    if (!/^[a-f0-9]{16}$/.test(id)) return missing(request, locale);
    // Load the server snapshot only for resource-detail requests, never into a
    // browser bundle or for ordinary home, asset, topic-index, and feed requests.
    const { getResource } = await import('@/lib/catalog');
    if (!getResource(id)) return missing(request, locale);
  }
  if (section === 'topics' && segments.length === 3) {
    const { getTopic } = await import('@/data/topics');
    if (!getTopic(id)) return missing(request, locale);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
