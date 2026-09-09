'use client';
import { useState } from 'react';
import { useLocalList } from '@/lib/local-state';
import { getDictionary } from '@/lib/i18n';
import type { Locale } from '@/lib/types';
import Icon from './Icon';
import Tooltip from './Tooltip';

export function SaveButton({ id, locale, compact = false }: { id: string; locale: Locale; compact?: boolean }) {
  const d = getDictionary(locale);
  const [saved, toggle] = useLocalList('ags:saved');
  const [error, setError] = useState(false);
  const selected = saved.includes(id);
  const label = selected ? d.unsave : d.save;
  const button = <button type="button" className={`${compact ? 'icon-button' : 'button secondary'} ${selected ? 'selected' : ''}`} aria-label={label} aria-pressed={selected} onClick={() => setError(!toggle(id))}><Icon name={selected ? 'check' : 'bookmark'} size={18}/>{!compact && (selected ? d.saved : d.save)}</button>;
  return <>{compact ? <Tooltip content={label}>{button}</Tooltip> : button}{error && <span role="status" className="small muted">{d.storageUnavailable}</span>}</>;
}
export function FollowButton({ slug, locale }: { slug: string; locale: Locale }) {
  const d = getDictionary(locale);
  const [followed, toggle] = useLocalList('ags:topics');
  const [error, setError] = useState(false);
  const selected = followed.includes(slug);
  return <><button type="button" className={`button secondary ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => setError(!toggle(slug))}><Icon name={selected ? 'check' : 'bookmark'} size={18}/>{selected ? d.unfollowTopic : d.followTopic}</button>{error && <span role="status" className="small muted">{d.storageUnavailable}</span>}</>;
}
export function ShareButton({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const [status, setStatus] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(window.location.href); setStatus(d.copied); } catch { setStatus(d.copyFailed); }
  }
  return <><button className="button secondary" type="button" onClick={copy}><Icon name="link" size={18}/>{d.copyLink}</button><span className="small muted" role="status">{status}</span></>;
}
