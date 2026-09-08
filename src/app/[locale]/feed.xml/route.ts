import { isLocale } from '@/lib/i18n';
import { getTopic } from '@/data/topics';
import { renderFeed } from '@/lib/feed';
export async function GET(request:Request,{params}:{params:Promise<{locale:string}>}) {const {locale}=await params;if(!isLocale(locale))return new Response('Not found',{status:404});const topic=new URL(request.url).searchParams.get('topic')||undefined;if(topic&&!getTopic(topic))return new Response('Not found',{status:404});return new Response(renderFeed(locale,topic),{headers:{'Content-Type':'application/rss+xml; charset=utf-8','Cache-Control':'public, max-age=1800'}});}
