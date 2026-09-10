import { renderSitemap } from '@/lib/sitemap';

export async function GET(_request: Request, {params}: {params:Promise<{file:string}>}) {
  const {file} = await params;
  const xml = renderSitemap(file);
  return xml ? new Response(xml, {headers:{'Content-Type':'application/xml; charset=utf-8', 'Cache-Control':'public, max-age=3600'}}) : new Response('Not found', {status:404});
}
