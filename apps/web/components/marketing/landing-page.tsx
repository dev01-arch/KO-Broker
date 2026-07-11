'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Clock,
  FileText,
  Lock,
  ArrowRight,
  Check,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { MarketingNavbar } from '@/components/marketing/navbar';
import { MarketingSiteFooter } from '@/components/marketing/site-footer';
import { MarketingStats } from '@/components/marketing/stats';
import { PricingCard } from '@/components/marketing/pricing-card';
import { marketingImages } from '@/components/marketing/marketing-assets';

const KEY_FEATURE_ROWS: { name: string; tiers: [boolean, boolean, boolean] }[] = [
  { name: 'Core CRM & Pipeline', tiers: [true, true, true] },
  { name: 'Compliance Engine', tiers: [true, true, true] },
  { name: 'All 8 Calculators', tiers: [true, true, true] },
  { name: 'Basic Integrations', tiers: [true, true, true] },
  { name: 'Messages & Notifications', tiers: [false, true, true] },
  { name: 'AI Report Generation', tiers: [false, true, true] },
  { name: 'Client Portal', tiers: [false, true, true] },
  { name: 'Advanced Reporting', tiers: [false, true, true] },
  { name: 'Full AI Intelligence Suite', tiers: [false, false, true] },
  { name: 'Lender API Submissions', tiers: [false, false, true] },
  { name: 'Custom Domain', tiers: [false, false, true] },
];

const scrollReveal = {
  initial: { opacity: 0, y: 32 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.12 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
};

export function LandingPage() {
  const [keyFeaturesOpen, setKeyFeaturesOpen] = useState(false);

  return (
    <div className="min-h-screen bg-brand-bg">
      <div
        className="bg-cover bg-top bg-no-repeat"
        style={{ backgroundImage: `url(${marketingImages.heroBg})` }}
      >
        <MarketingNavbar />

        <motion.section className="flex flex-col overflow-hidden px-6 pt-36 pb-0 md:pt-48" {...scrollReveal}>
          <div className="mx-auto max-w-4xl space-y-12 text-center">
            <div className="space-y-6">
              <h1 className="hero-heading text-3xl text-hero-dark sm:text-4xl md:text-7xl">
                The <span className="text-hero-accent italic">smarter</span>
                <br />
                broker platform
              </h1>
              <p className="mx-auto max-w-2xl text-lg font-medium text-gray-500 md:text-xl">
                AI-powered suitability reports, built-in FCA compliance, messaging, and full CRM —
                designed by practitioners, priced for everyone.
              </p>
            </div>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/demo"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-teal px-8 py-4 font-bold text-white shadow-xl shadow-brand-teal/10 transition-all hover:bg-brand-teal-light sm:w-auto"
              >
                Open Live Demo <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-in"
                className="font-bold text-gray-600 transition-all hover:text-brand-teal sm:w-auto sm:rounded-xl sm:border sm:border-gray-100 sm:bg-white sm:px-8 sm:py-4 sm:hover:bg-gray-50"
              >
                Sign in
              </Link>
            </div>
          </div>
          <div className="mx-auto mt-24 flex w-full max-w-5xl items-end justify-center px-4">
            <img
              src={marketingImages.heroIllustration}
              alt="KO Platform dashboard illustration"
              className="block w-full max-w-3xl"
            />
          </div>
        </motion.section>
      </div>

      <motion.div className="w-full border-y border-gray-100 bg-white" {...scrollReveal}>
        <div className="mx-auto max-w-7xl px-6 py-10 md:py-20">
          <div className="flex flex-col items-stretch md:flex-row">
            {[
              {
                icon: <Clock className="h-6 w-6 text-gray-400" />,
                title: '30–60 min per lender search',
                desc: 'Brokers waste hours toggling between sourcing tools, lender criteria PDFs and spreadsheets.',
              },
              {
                icon: <FileText className="h-6 w-6 text-gray-400" />,
                title: 'Fragmented compliance docs',
                desc: 'Fact-finds in one app, ID checks in another, suitability reports in Word. Audit trails fall through the cracks.',
              },
              {
                icon: <Lock className="h-6 w-6 text-gray-400" />,
                title: 'Enterprise tools out of reach',
                desc: 'The networks have polished CRMs. Independent brokerages get spreadsheets and goodwill.',
              },
            ].map((item, i) => (
              <Fragment key={i}>
                {i > 0 && <div className="mx-12 hidden w-px flex-shrink-0 bg-gray-200 md:block" />}
                <div className="flex-1 space-y-4 py-6 text-center md:py-0 md:text-left">
                  <div className="flex justify-center text-gray-400 md:justify-start">{item.icon}</div>
                  <h4 className="text-lg font-bold">{item.title}</h4>
                  <p className="text-sm leading-relaxed text-gray-500">{item.desc}</p>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.section
        id="features"
        className="w-full bg-cover bg-center bg-no-repeat px-6 py-16 md:py-32"
        style={{ backgroundImage: `url(${marketingImages.modulesBg})` }}
        {...scrollReveal}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 space-y-4 text-center md:mb-20 md:text-left">
            <span className="text-xs font-black tracking-widest text-brand-teal uppercase">
              Platform
            </span>
            <h2 className="heading-bold text-3xl sm:text-4xl md:text-6xl">
              <span className="text-[#061F18]">Five modules</span>
              <br />
              <span className="text-brand-teal">One workflow</span>
            </h2>
            <p className="max-w-xl text-lg text-gray-500">
              Everything a modern brokerage needs to run a clean, compliant, and ridiculously fast
              advice process.
            </p>
          </div>

          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                imageSrc: marketingImages.pipelineCrm,
                title: 'Pipeline CRM',
                desc: 'Drag-and-drop kanban across all five stages, with SLA timers.',
                variant: 1,
              },
              {
                imageSrc: marketingImages.smartFactFind,
                title: 'Smart Fact-Find',
                desc: 'Adaptive forms that pre-fill from open banking and credit data.',
                variant: 2,
              },
              {
                imageSrc: marketingImages.lenderResearch,
                title: 'Lender Research',
                desc: 'Live criteria across 90+ UK lenders, ranked in seconds.',
                variant: 2,
              },
              {
                imageSrc: marketingImages.complianceVault,
                title: 'Compliance Vault',
                desc: 'Encrypted document store with full audit trail and e-sign.',
                variant: 2,
              },
              {
                imageSrc: marketingImages.aiReport,
                title: 'AI Report Generation',
                desc: 'Suitability letters drafted automatically from case notes.',
                variant: 3,
              },
            ].map((m, i) => {
              const isFirst = m.variant === 1;
              const isMid = m.variant === 2;
              const isAi = m.variant === 3;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -5 }}
                  className={[
                    'group flex min-h-[148px] w-full flex-col items-center gap-3 self-start border p-6 text-center',
                    isAi && 'relative z-20 overflow-visible',
                    !isAi && 'rounded-2xl',
                    isFirst && 'border-[#B0EED7] bg-white shadow-[0_22px_18.8px_rgba(159,233,208,0.17)]',
                    isMid && 'border-[#BCD3CB] bg-white',
                    isAi && 'rounded-[24px] border-[#D8AE39]',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={
                    isAi
                      ? { background: 'linear-gradient(195deg, #F4EAD0 7.28%, #FFF 61%)' }
                      : undefined
                  }
                >
                  {isAi && (
                    <div
                      className="absolute z-30 flex items-center gap-[9.35px] text-xs font-bold tracking-wide text-white uppercase"
                      style={{
                        left: '-4px',
                        top: '-6px',
                        padding: '6.545px 25.244px',
                        borderRadius: '24px 0',
                        border: '1px solid #FFF',
                        background: 'linear-gradient(90deg, #9144CB 18.92%, #6D3398 111.58%)',
                        boxShadow: '0 5.203px 5.203px 0 rgba(0, 0, 0, 0.12)',
                      }}
                    >
                      <Sparkles className="h-3 w-3 shrink-0" />
                      New
                    </div>
                  )}
                  <div className="flex w-full shrink-0 justify-center">
                    <img
                      src={m.imageSrc}
                      alt={m.title}
                      className={`h-auto w-full max-w-[11rem] object-contain ${isAi ? 'max-h-[120px]' : 'max-h-[100px]'}`}
                    />
                  </div>
                  <div className="w-full min-w-0 text-center">
                    <h5 className="text-lg font-bold">{m.title}</h5>
                    <div className="overflow-hidden transition-[max-height] duration-300 ease-out max-h-none md:max-h-0 md:group-hover:max-h-[12rem]">
                      <p className="pt-2 text-center text-xs leading-relaxed text-gray-600 opacity-100 md:opacity-0 md:transition-opacity md:duration-200 md:ease-out md:group-hover:opacity-100 md:group-hover:delay-75">
                        {m.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.section>

      <motion.div {...scrollReveal}>
        <MarketingStats />
      </motion.div>

      <motion.section id="pricing" className="bg-[rgba(247,251,249,0.8)] px-6 py-16 backdrop-blur-[3.4px] md:py-32" {...scrollReveal}>
        <div className="mx-auto max-w-7xl space-y-10 md:space-y-20">
          <div className="space-y-4 text-center">
            <span className="text-xs font-black tracking-widest text-brand-teal uppercase">
              Pricing
            </span>
            <h2 className="heading-bold text-3xl text-[#061F18] sm:text-4xl md:text-7xl">
              Per adviser, per month.
            </h2>
            <p className="text-gray-500">No setup fees. No per-case charges. Cancel any time.</p>
          </div>

          {/* Mobile: vertical stack; lg+: row layout */}
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 lg:flex-row lg:items-end lg:justify-center lg:gap-6 xl:gap-8">
            <motion.div className="w-full flex justify-center" {...scrollReveal}>
              <PricingCard
                v2Design="starter"
                tier="Starter"
                price="35"
                buttonText="Get started"
                buttonHref="/sign-up"
                features={[
                  'Core CRM & Pipeline',
                  'Compliance Engine',
                  'All 8 Calculators',
                  'Basic Integrations',
                ]}
              />
            </motion.div>
            <motion.div
              className="w-full flex justify-center"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <PricingCard
                v2Design="professional"
                tier="Professional"
                price="50"
                mostPopular
                buttonText="Try the demo"
                buttonHref="/demo"
                features={[
                  'Everything in Starter',
                  'Messages & Notifications',
                  'AI Report Generation',
                  'Client Portal',
                  'Advanced Reporting',
                ]}
              />
            </motion.div>
            <motion.div
              className="w-full flex justify-center"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.5, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <PricingCard
                v2Design="enterprise"
                tier="Enterprise"
                price="75"
                buttonText="Talk to us"
                buttonHref="/sign-up"
                features={[
                  'Everything in Pro',
                  'Full AI Intelligence Suite',
                  'Lender API Submissions',
                  'Custom Domain',
                ]}
              />
            </motion.div>
          </div>

          <motion.div
            className="mx-auto mt-20 hidden max-w-5xl rounded-[40px] border border-gray-50 bg-white p-8 md:block md:p-12"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              id="key-features-toggle"
              aria-expanded={keyFeaturesOpen}
              aria-controls="key-features-panel"
              onClick={() => setKeyFeaturesOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-4 rounded-lg border-b border-gray-100 pb-6 text-left transition-colors hover:bg-gray-50/50"
            >
              <h3 className="heading-bold text-3xl">Key features</h3>
              <ChevronDown
                className={`h-8 w-8 shrink-0 text-gray-400 transition-transform duration-300 ease-out ${keyFeaturesOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            <div
              id="key-features-panel"
              role="region"
              aria-labelledby="key-features-toggle"
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${keyFeaturesOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="overflow-x-auto pt-8">
                  <table className="w-full min-w-[640px] text-left">
                    <thead className="border-b border-gray-100">
                      <tr className="text-xs font-black tracking-widest text-gray-500 uppercase md:text-sm">
                        <th className="py-5 pr-4 font-semibold">Feature</th>
                        <th className="px-2 py-5 text-center font-semibold">Starter</th>
                        <th className="px-2 py-5 text-center font-semibold text-[#CE652D]">
                          Professional
                        </th>
                        <th className="px-2 py-5 text-center font-semibold">Enterprise</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {KEY_FEATURE_ROWS.map((row, i) => (
                        <tr
                          key={i}
                          className="text-sm text-gray-700 transition-colors hover:bg-gray-50/50 md:text-base"
                        >
                          <td className="py-5 pr-4 font-medium">{row.name}</td>
                          {row.tiers.map((active, j) => (
                            <td key={j} className="px-2 py-5 text-center">
                              {active && (
                                <div
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white md:h-8 md:w-8"
                                  style={{
                                    backgroundColor:
                                      j === 0 ? '#A7A1C3' : j === 1 ? '#CE652D' : '#619DB3',
                                  }}
                                >
                                  <Check className="h-3.5 w-3.5 md:h-4 md:w-4" />
                                </div>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      <MarketingSiteFooter />
    </div>
  );
}
