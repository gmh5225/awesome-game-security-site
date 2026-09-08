import type { ReactNode } from 'react';
import { getDictionary, localizedTag } from '@/lib/i18n';
import { formatDate } from '@/lib/seo';
import type { Locale, Resource, ResourceKind, ResourceLevel } from '@/lib/types';

interface MetadataFactsProps {
  resource: Resource;
  locale: Locale;
  level?: ResourceLevel;
  kind?: ResourceKind;
}

/** Source observations, repository evidence and link checks are independent signals. */
export default function MetadataFacts({ resource, locale, level, kind }: MetadataFactsProps) {
  const d = getDictionary(locale);
  const timestamp = (value: string | undefined): number | undefined => {
    if (!value) return undefined;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const date = (value: string | undefined): ReactNode => {
    const parsed = timestamp(value);
    if (parsed === undefined) return d.unknown;
    const utc = new Date(parsed).toISOString();
    return <time dateTime={utc} title={utc}>{formatDate(utc, locale)}</time>;
  };
  const verifiedAt = timestamp(resource.metadataVerifiedAt);
  const attemptedAt = timestamp(resource.metadataCheckedAt);
  const stale = verifiedAt !== undefined && attemptedAt !== undefined && attemptedAt >= verifiedAt
    && resource.metadataStatus !== undefined && resource.metadataStatus !== 'ok';
  let scheduledRepositoryCheck = false;
  try {
    const url = new URL(resource.url);
    const [owner, repository] = url.pathname.split('/').filter(Boolean);
    const reserved = ['features', 'topics', 'collections', 'orgs', 'users', 'settings', 'login', 'signup', 'search', 'sponsors', 'marketplace', 'notifications'];
    scheduledRepositoryCheck = url.hostname === 'github.com' && Boolean(owner && repository)
      && !reserved.includes(owner.toLowerCase());
  } catch { /* An unknown source does not imply that a repository check is scheduled. */ }
  const maintenance = resource.maintenance === 'active' ? d.active
    : resource.maintenance === 'archived' ? d.archived : d.unknown;
  const linkStatuses = {
    ok: d.linkOk, unavailable: d.linkUnavailable, restricted: d.linkRestricted,
    unknown: timestamp(resource.lastCheckedAt) === undefined ? d.linkUnknown : d.unknown,
  };
  const technologies = (values: string[] | undefined) => values?.filter(Boolean).map(value => localizedTag(value, locale)).join(' / ') || d.unknown;
  const facts: { key: string; label: string; value: ReactNode }[] = [
    { key: 'kind', label: d.kind, value: localizedTag(kind || resource.kind, locale) },
    { key: 'level', label: d.level, value: localizedTag(level || resource.level, locale) },
    { key: 'platform', label: d.platform, value: technologies(resource.platforms) },
    { key: 'engine', label: d.engine, value: technologies(resource.engines) },
    { key: 'maintenance', label: d.maintenance, value: maintenance },
    { key: 'firstObserved', label: d.firstObserved, value: date(resource.firstSeenAt) },
    { key: 'indexUpdated', label: d.indexUpdated, value: date(resource.contentChangedAt) },
    { key: 'upstreamUpdated', label: d.upstreamUpdated, value: date(resource.upstreamUpdatedAt) },
    { key: 'metadataVerified', label: d.metadataVerified, value: date(resource.metadataVerifiedAt) },
    { key: 'metadataAttempted', label: d.metadataAttempted, value: date(resource.metadataCheckedAt) },
    { key: 'lastChecked', label: d.lastChecked, value: date(resource.lastCheckedAt) },
    { key: 'linkStatus', label: d.linkStatus, value: linkStatuses[resource.linkStatus] || d.unknown },
  ];

  return <div className="detail-facts">
    <h2>{d.freshness}</h2>
    {stale ? <p className="small muted" role="note">{d.metadataStale}</p>
      : verifiedAt === undefined && scheduledRepositoryCheck ? <p className="small muted" role="note">{d.metadataPending}</p> : null}
    <dl>{facts.map(fact => <div key={fact.key}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
    <p className="small muted">{d.observedNotPublished}</p>
    <p className="small muted">{d.checkedNotEndorsed}</p>
  </div>;
}
