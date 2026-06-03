'use client';

import Link from 'next/link';
import { Building2 } from 'lucide-react';

export function MarketingNavbar() {
  return (
    <nav className="fixed top-0 right-0 left-0 z-50 border-b border-gray-100 bg-white">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex cursor-pointer items-center gap-2">
          <div className="rounded-md bg-brand-teal p-1.5">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-brand-teal">KO Platform</span>
        </Link>

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
          <Link
            href="/sign-in"
            className="text-sm font-semibold text-gray-600 transition-colors hover:text-brand-teal"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-md bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-teal-light"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </nav>
  );
}
