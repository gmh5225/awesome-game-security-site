import { isLocale } from '@/lib/i18n';
import { getTopic } from '@/data/topics';
import { renderFeed } from '@/lib/feed';
import { hasWikiTopic, renderWikiFeed } from '@/lib/wiki-feed';
export async function GET(request:Request,{params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;
  if(!isLocale(locale))return new Response('Not found',{status:404});
  const query=new URL(request.url).searchParams;
  const topic=query.get('topic')||undefined;
  const scope=query.get('scope');
  if(scope&&scope!=='wiki')return new Response('Not found',{status:404});
  if(topic&&!(scope==='wiki'?hasWikiTopic(topic):getTopic(topic)))return new Response('Not found',{status:404});
  return new Response(scope==='wiki'?renderWikiFeed(locale,topic):renderFeed(locale,topic),{headers:{'Content-Type':'application/rss+xml; charset=utf-8','Cache-Control':'public, max-age=1800'}});
}
