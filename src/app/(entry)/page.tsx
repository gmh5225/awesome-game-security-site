import { redirect } from 'next/navigation';
export default async function Entry({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const original = await searchParams;
  const next = new URLSearchParams();
  const q = typeof original.q === 'string' ? original.q : '';
  const parent = typeof original.parent === 'string' ? original.parent : '';
  if (q) {
    if (original.isTag === 'true' || parent) next.set('category', parent && parent !== q ? `${parent} / ${q}` : q);
    else next.set('q', q);
  }
  redirect(`/en${next.size ? `?${next}` : ''}`);
}
