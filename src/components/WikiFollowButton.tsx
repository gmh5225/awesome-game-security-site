'use client';
import { useState } from 'react';
import { useLocalList } from '@/lib/local-state';
import { getWikiDictionary } from '@/lib/wiki-i18n';
import type { Locale } from '@/lib/types';
import Icon from './Icon';
import Tooltip from './Tooltip';

export function WikiFollowButton({ topic, locale, compact = false }: { topic: string; locale: Locale; compact?: boolean }) {
  const d = getWikiDictionary(locale);
  const [followed, toggle] = useLocalList('ags:wiki-topics');
  const [error, setError] = useState(false);
  const selected = followed.includes(topic);
  const label = selected ? d.unfollowTopic : d.followTopic;
  const button = <button type="button" className={`${compact ? 'icon-button' : 'button secondary'} ${selected ? 'selected' : ''}`} aria-label={`${label}: ${topic}`} aria-pressed={selected} onClick={() => setError(!toggle(topic))}><Icon name={selected ? 'check' : 'bookmark'} size={18}/>{!compact && label}</button>;
  return <>{compact ? <Tooltip content={`${label}: ${topic}`}>{button}</Tooltip> : button}{error && <span role="status" className="small muted">{d.storageUnavailable}</span>}</>;
}

export default WikiFollowButton;
