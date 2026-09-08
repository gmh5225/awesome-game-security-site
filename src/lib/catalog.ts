import snapshot from '../data/catalog.json';
import type { Catalog, Resource } from './types';
import { canonicalUrl } from '../../scripts/catalog-core';

// Checked in, pinned source data keeps rendering independent of GitHub availability.
const catalog = snapshot as Catalog;
const resourcesById = new Map(catalog.resources.map(resource => [resource.id, resource]));
const resourcesByUrl = new Map(catalog.resources.map(resource => [resource.url, resource]));
const categories = [...new Set(catalog.resources.flatMap(resource => resource.categories))].sort((a, b) => a.localeCompare(b, 'en'));

export function getCatalog(): Catalog { return catalog; }
export function getResource(id: string): Resource | undefined { return resourcesById.get(id); }
export function getResourceByUrl(url: string): Resource | undefined {
  const canonical = canonicalUrl(url);
  return canonical ? resourcesByUrl.get(canonical) : undefined;
}
export function getCategories(): string[] { return categories; }
