import Link from 'next/link';
import { topics } from '@/data/topics';
import { getDictionary } from '@/lib/i18n';
import type { Locale, Topic } from '@/lib/types';
import Icon from './Icon';

const topicVisuals: Record<string, { number: string; icon: string; className: string }> = {
  'testing-observability': { number: '01', icon: 'clock', className: 'topic-0' },
  'engine-foundations': { number: '02', icon: 'book', className: 'topic-1' },
  'multiplayer-foundations': { number: '03', icon: 'globe', className: 'topic-2' },
};

export default function TopicCards({ locale, items = topics }: { locale: Locale; items?: Topic[] }) {
  const d = getDictionary(locale);
  return <div className="topic-grid">{items.map(topic => {
    const visual = topicVisuals[topic.slug];
    return <Link className={`topic-card ${visual?.className || ''}`} key={topic.slug} href={`/${locale}/topics/${topic.slug}`}><div className="topic-eyebrow"><span className="mono">{visual?.number}</span><Icon name={visual?.icon || 'book'}/></div><h3>{topic.title[locale]}</h3><p>{topic.description[locale]}</p><div className="topic-bottom"><span>{topic.entries.length} {d.resourcesCountLabel}</span><Icon name="arrow" size={18}/></div></Link>;
  })}</div>;
}
