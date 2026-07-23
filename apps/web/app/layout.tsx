import type { Metadata } from 'next';
import { Syne, DM_Sans, Outfit } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

const syne = Syne({
  variable: '--font-syne',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  preload: false,
});

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
  preload: false,
});

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'KO Platform — The Smarter Broker Platform',
    template: '%s | KO Platform',
  },
  description:
    'AI-powered suitability reports, built-in FCA compliance, messaging, and full CRM — designed by practitioners, priced for everyone.',
  keywords: [
    'mortgage broker',
    'CRM',
    'FCA compliance',
    'suitability report',
    'AI',
    'UK mortgage',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
