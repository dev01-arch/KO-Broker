import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Brand logos',
  description: 'Download KO Platform logo assets',
};

const LOGOS = [
  {
    href: '/assets/brand/ko-mark.svg',
    filename: 'ko-mark.svg',
    title: 'Icon mark',
    description: 'House icon only',
    previewClass: 'h-10 w-10',
    dark: false,
  },
  {
    href: '/assets/brand/ko-logo.svg',
    filename: 'ko-logo.svg',
    title: 'Logo (teal wordmark)',
    description: 'For light backgrounds',
    previewClass: 'h-10 w-40',
    dark: false,
  },
  {
    href: '/assets/brand/ko-logo-white.svg',
    filename: 'ko-logo-white.svg',
    title: 'Logo (white wordmark)',
    description: 'For dark backgrounds',
    previewClass: 'h-10 w-40',
    dark: true,
  },
] as const;

export default function BrandLogosPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm font-medium text-brand-teal-700 hover:underline">
        ← Back to home
      </Link>

      <h1 className="mt-6 font-heading text-3xl font-bold text-brand-teal-700">KO Platform logos</h1>
      <p className="mt-2 text-sm text-ink-60">
        Download SVG brand marks for use in the client portal, emails, and partner sites.
      </p>

      <ul className="mt-8 space-y-4">
        {LOGOS.map((logo) => (
          <li
            key={logo.filename}
            className={`flex flex-wrap items-center gap-5 rounded-xl border px-6 py-5 ${
              logo.dark
                ? 'border-brand-teal-400/25 bg-hero-dark'
                : 'border-brand-teal-700/10 bg-white'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.href} alt={logo.title} className={`shrink-0 object-contain ${logo.previewClass}`} />
            <div className="min-w-0 flex-1">
              <h2 className={`text-sm font-semibold ${logo.dark ? 'text-white' : 'text-ink'}`}>
                {logo.title}
              </h2>
              <p className={`text-xs ${logo.dark ? 'text-white/55' : 'text-ink-60'}`}>
                {logo.filename} — {logo.description}
              </p>
            </div>
            <a
              href={logo.href}
              download={logo.filename}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-teal-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal-400 hover:text-ink"
            >
              Download
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-ink-60">
        Primary button green: <code className="rounded bg-brand-teal-50 px-1.5 py-0.5 text-brand-teal-700">#1D9E75</code>
        {' · '}
        Wordmark / dark green:{' '}
        <code className="rounded bg-brand-teal-50 px-1.5 py-0.5 text-brand-teal-700">#0F6E56</code>
      </p>
    </main>
  );
}
