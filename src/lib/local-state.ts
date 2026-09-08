'use client';
import { useMemo, useSyncExternalStore } from 'react';
const EVENT = 'ags:preferences';
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener(EVENT, callback); };
}
function read(key: string) {
  try { return window.localStorage.getItem(key) || '[]'; } catch { return '[]'; }
}
function parse(value: string): string[] {
  try { const items: unknown = JSON.parse(value); return Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string') : []; } catch { return []; }
}
export function useLocalList(key: 'ags:saved' | 'ags:topics') {
  const value = useSyncExternalStore(subscribe, () => read(key), () => '[]');
  const items = useMemo(()=>parse(value),[value]);
  function toggle(id: string): boolean {
    const previous = parse(read(key));
    const next = previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id];
    try { window.localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event(EVENT)); return true; } catch { return false; }
  }
  return [items, toggle] as const;
}
