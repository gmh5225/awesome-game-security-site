export default function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    github: <path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7M15 22v-3.9a3.4 3.4 0 0 0-1-2.6c3.3-.4 6.8-1.6 6.8-7.4a5.8 5.8 0 0 0-1.6-4 5.4 5.4 0 0 0-.1-4s-1.3-.4-4.2 1.5a14.5 14.5 0 0 0-7.6 0C4.4-.3 3.1.1 3.1.1a5.4 5.4 0 0 0-.1 4 5.8 5.8 0 0 0-1.6 4c0 5.8 3.5 7 6.8 7.4a3.4 3.4 0 0 0-1 2.6V22" transform="translate(2 1) scale(.85)"/>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    external: <><path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></>,
    bookmark: <path d="M6 3h12v18l-6-4-6 4z"/>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    book: <><path d="M12 6v15M12 6C9 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2Z"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    filter: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></>,
    rss: <><path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></>,
    link: <><path d="m10 13 4-4M9 15l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M15 9l2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"/></>,
    shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6z"/><path d="m8 12 3 3 5-6"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.book}</svg>;
}
