'use client';
import { useState } from 'react';
import { useLocalList } from '@/lib/local-state';
import { getWikiDictionary } from '@/lib/wiki-i18n';
import type { Locale } from '@/lib/types';
import Icon from './Icon';
import Tooltip from './Tooltip';

export function WikiSaveButton({ id, locale, compact = false }: { id: string; locale: Locale; compact?: boolean }) {
  const d = getWikiDictionary(locale);
  const [saved, toggle] = useLocalList('ags:wiki-saved');
  const [error, setError] = useState(false);
  const selected = saved.includes(id);
  const label = selected ? d.unsave : d.save;
  const button = <button type="button" className={`${compact ? 'icon-button' : 'button secondary'} ${selected ? 'selected' : ''}`} aria-label={label} aria-pressed={selected} onClick={() => setError(!toggle(id))}><Icon name={selected ? 'check' : 'bookmark'} size={18}/>{!compact && (selected ? d.saved : d.save)}</button>;
  return <>{compact ? <Tooltip content={label}>{button}</Tooltip> : button}{error && <span role="status" className="small muted">{d.storageUnavailable}</span>}</>;
}

export default WikiSaveButton;
