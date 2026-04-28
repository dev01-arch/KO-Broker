import { redirect } from 'next/navigation';

export default function MarketingPage() {
  // Landing page — PRD-01
  return (
    <main className="flex min-h-screen flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-white/[0.07] bg-ink/[0.92] px-10 backdrop-blur-md">
        <div className="flex items-center gap-2.5 font-heading text-lg font-bold text-white">
          <svg viewBox="0 0 28 28" fill="none" className="h-7 w-7">
            <path d="M14 3L3 12.5V25h7v-8h8v8h7V12.5L14 3Z" fill="#1D9E75" />
            <path d="M11 25v-6h6v6" stroke="#0F6E56" strokeWidth="1.5" fill="none" />
          </svg>
          KO Platform
        </div>
        <div className="flex items-center gap-2.5">
          <a
            href="/sign-in"
            className="rounded-md bg-white/[0.08] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/[0.14]"
          >
            Sign in
          </a>
          <a
            href="/sign-up"
            className="rounded-md bg-brand-teal-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-teal-400"
          >
            Start free trial
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center overflow-hidden bg-ink px-20 pt-40 pb-20 text-center">
        <div className="pointer-events-none absolute -top-16 left-1/2 h-[400px] w-[700px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(29,158,117,0.22)_0%,transparent_70%)]" />
        <div className="mb-7 inline-flex items-center gap-1.5 rounded-full border border-brand-teal-500/30 bg-brand-teal-500/15 px-3.5 py-1.5 text-xs font-medium text-brand-teal-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-teal-500" />
          Built for UK mortgage brokerages
        </div>
        <h1 className="mx-auto mb-5 max-w-[820px] font-heading text-[clamp(42px,5.5vw,72px)] leading-[1.04] font-extrabold tracking-tight text-white">
          The <em className="not-italic text-brand-teal-400">smarter</em> broker platform
        </h1>
        <p className="mx-auto mb-10 max-w-[540px] text-lg font-light leading-relaxed text-white/55">
          AI-powered suitability reports, built-in FCA compliance, messaging, and full CRM —
          designed by practitioners, priced for everyone.
        </p>
        <div className="flex gap-3">
          <a
            href="/dashboard"
            className="rounded-lg bg-brand-teal-500 px-7 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-brand-teal-400"
          >
            ↗ Open live demo
          </a>
          <button className="rounded-lg bg-white/[0.08] px-7 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-white/[0.14]">
            Book a walkthrough
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-white/[0.07] bg-ink px-20 py-10">
        <div className="flex items-center gap-2.5 font-heading text-sm font-bold text-white">
          <svg viewBox="0 0 28 28" fill="none" className="h-5 w-5">
            <path d="M14 3L3 12.5V25h7v-8h8v8h7V12.5L14 3Z" fill="#1D9E75" />
          </svg>
          KO Platform
        </div>
        <p className="text-xs text-white/35">
          © 2026 KO Realtors · Powered by Luxcity Technology
        </p>
      </footer>
    </main>
  );
}
