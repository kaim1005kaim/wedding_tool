import '@total-typescript/ts-reset';
import './globals.css';
import '../lib/sentry.client.config';
import type { Metadata } from 'next';
import Providers from './providers';
import { Noto_Sans_JP, Playfair_Display } from 'next/font/google';

export const metadata: Metadata = {
  title: 'wedding_tool',
  description: 'Real-time wedding_tool experience with Supabase or LAN fallbacks.'
};

const sans = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  display: 'swap',
  variable: '--font-sans'
});

const serif = Playfair_Display({
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-serif'
});

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${sans.variable} ${serif.variable}`}>
      <body className="min-h-screen bg-ecru text-ink lace-overlay font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
