import { renderSitemapIndex } from '@/lib/sitemap';

export const dynamic = 'force-static';
export function GET() {
  return new Response(renderSitemapIndex(), {headers:{'Content-Type':'application/xml; charset=utf-8', 'Cache-Control':'public, max-age=3600'}});
}
