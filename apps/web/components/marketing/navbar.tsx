'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Menu, X } from 'lucide-react';

export function MarketingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 border-b border-gray-100 bg-white">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex cursor-pointer items-center gap-2">
          <div className="rounded-md bg-brand-teal p-1.5">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-brand-teal">KO Platform</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-10 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-teal"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-teal"
          >
            Pricing
          </a>
          <Link
            href="/demo"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-teal"
          >
            Live Demo
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {/* Desktop CTAs */}
          <Link
            href="/sign-in"
            className="hidden text-sm font-semibold text-gray-600 transition-colors hover:text-brand-teal md:inline"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="hidden rounded-md bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-teal-light md:inline-block"
          >
            Start free trial
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100 md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-6 py-5 md:hidden">
          <div className="flex flex-col gap-5">
            <a
              href="#features"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-teal"
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-teal"
            >
              Pricing
            </a>
            <Link
              href="/demo"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-teal"
            >
              Live Demo
            </Link>
            <hr className="border-gray-100" />
            <Link
              href="/sign-in"
              className="text-sm font-semibold text-gray-600 transition-colors hover:text-brand-teal"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md bg-brand-teal px-5 py-3 text-center text-sm font-semibold text-white transition-all hover:bg-brand-teal-light"
            >
              Start free trial
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
