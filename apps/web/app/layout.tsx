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

/** Outfit digit glyphs inside next/font Syne / DM Sans family names (0–9, %, £, $, €). */
const DIGIT_UNICODE_RANGE = 'U+0030-0039, U+0025, U+00A3, U+0024, U+20AC';
const OUTFIT_LATIN_WOFF2 = 'https://fonts.gstatic.com/s/outfit/v15/QGYvz_MVcBeNP4NJtEtq.woff2';

function primaryFontFamily(fontFamily: string): string {
  return fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') ?? fontFamily;
}

function digitOverrideFaces(familyName: string, weights: number[]): string {
  return weights
    .map(
      (weight) => `@font-face{font-family:'${familyName}';font-style:normal;font-weight:${weight};font-display:swap;src:url(${OUTFIT_LATIN_WOFF2}) format('woff2');unicode-range:${DIGIT_UNICODE_RANGE}}`,
    )
    .join('');
}

const universalDigitCss = [
  digitOverrideFaces(primaryFontFamily(syne.style.fontFamily), [400, 500, 600, 700, 800]),
  digitOverrideFaces(primaryFontFamily(dmSans.style.fontFamily), [300, 400, 500, 600, 700]),
].join('');

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
      <head>
        <style dangerouslySetInnerHTML={{ __html: universalDigitCss }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
