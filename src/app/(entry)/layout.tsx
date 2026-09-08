import '../globals.css';
import {SITE_URL} from '@/lib/seo';
export const metadata={metadataBase:new URL(SITE_URL)};
export default function EntryLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
