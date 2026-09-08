import Link from 'next/link';
import { topics } from '@/data/topics';
import { getDictionary } from '@/lib/i18n';
import type { Locale, Topic } from '@/lib/types';
import Icon from './Icon';

export default function TopicCards({ locale, items = topics }: { locale: Locale; items?: Topic[] }) {
  const d = getDictionary(locale);
  return <div className="topic-grid">{items.map((topic, index) => <Link className={`topic-card topic-${index}`} key={topic.slug} href={`/${locale}/topics/${topic.slug}`}><div className="topic-eyebrow"><span className="mono">0{index + 1}</span><Icon name={['clock', 'book', 'globe'][index]}/></div><h3>{topic.title[locale]}</h3><p>{topic.description[locale]}</p><div className="topic-bottom"><span>{topic.entries.length} {d.resourcesCountLabel}</span><Icon name="arrow" size={18}/></div></Link>)}</div>;
}
