'use client';
import {useParams} from 'next/navigation';
import {getDictionary,isLocale} from '@/lib/i18n';
export default function ErrorPage({reset}:{error:Error&{digest?:string};reset:()=>void}) {const params=useParams();const locale=typeof params.locale==='string'&&isLocale(params.locale)?params.locale:'en';const d=getDictionary(locale);return <section className="content-page"><div className="empty-state" role="alert"><h1>{d.errorTitle}</h1><p>{d.errorMessage}</p><button className="button primary" onClick={reset}>{d.retry}</button></div></section>;}
