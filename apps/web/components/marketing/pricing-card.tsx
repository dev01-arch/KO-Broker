import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';

export type PricingCardProps = {
  tier: string;
  price: string;
  features: string[];
  mostPopular?: boolean;
  buttonText: string;
  buttonHref?: string;
  v2Design?: 'starter' | 'professional' | 'enterprise';
};

export function PricingCard({
  tier,
  price,
  features,
  mostPopular = false,
  buttonText,
  buttonHref,
  v2Design,
}: PricingCardProps) {
  const subtitle =
    tier === 'Starter'
      ? 'Solo brokers getting set up.'
      : tier === 'Professional'
        ? 'Growing brokerages'
        : 'Networks & multi-office firms.';

  const designTier = v2Design;

  const checkTint =
    designTier === 'professional'
      ? 'bg-[#FFF5E0] text-[#C4903D]'
      : designTier === 'enterprise'
        ? 'bg-[#E8F7FE] text-[#619DB3]'
        : designTier === 'starter'
          ? 'bg-[#EEF0FF] text-[#7C79A8]'
          : 'bg-brand-blue-tint text-brand-blue';

  if (v2Design) {
    const isV2 = Boolean(v2Design);
    const shell: CSSProperties =
      designTier === 'starter'
        ? {
            width: '100%',
            maxWidth: '349.959px',
            padding: isV2 ? '22px 26px' : '32.106px 31.036px',
            borderRadius: '25.685px',
            border: '1.07px solid #A19BBF',
            background: 'linear-gradient(207deg, #E9ECFF -9.75%, #FFF 38.67%)',
          }
        : designTier === 'professional'
          ? {
              width: '100%',
              maxWidth: '369.223px',
              padding: isV2 ? '22px 26px' : '32.106px 31.036px',
              borderRadius: '25.685px',
              border: isV2 ? '1.07px solid #EEC25A' : '1.07px solid #D9F3FF',
              background: 'linear-gradient(207deg, #FEE3A5 -9.75%, #FFF 38.67%)',
            }
          : {
              width: '100%',
              maxWidth: '349.959px',
              padding: isV2 ? '22px 26px' : '32.106px 31.036px',
              borderRadius: '25.685px',
              border: '1.07px solid #D9F3FF',
              background: 'linear-gradient(207deg, #B8E8FD -9.75%, #FFF 38.67%)',
            };

    const hoverShell =
      designTier === 'starter'
        ? 'shadow-[0_6.421px_11.558px_0_#F0F2FF] hover:-translate-y-2 hover:shadow-[0_22px_44px_-14px_rgba(161,155,191,0.45)] hover:ring-2 hover:ring-[#A19BBF]/25'
        : designTier === 'professional'
          ? 'shadow-[0_16.053px_28.575px_0_rgba(128,108,64,0.14)] hover:-translate-y-2 hover:shadow-[0_28px_52px_-12px_rgba(128,108,64,0.32)] hover:ring-2 hover:ring-[#EEC25A]/40'
          : 'shadow-[0_6.421px_8.883px_0_rgba(167,187,196,0.24)] hover:-translate-y-2 hover:shadow-[0_22px_44px_-14px_rgba(103,141,156,0.38)] hover:ring-2 hover:ring-[#619DB3]/25';

    const buttonClass = `relative z-10 w-full rounded-xl text-sm font-bold transition-all duration-200 ${isV2 ? 'py-3' : 'py-4'} ${
      designTier === 'professional'
        ? 'bg-[#CE652D] text-white group-hover:bg-[#b85728] group-hover:shadow-md'
        : 'bg-white/80 text-gray-700 ring-1 ring-gray-200/80 group-hover:bg-white group-hover:ring-brand-teal/25 group-hover:shadow-sm'
    }`;

    const buttonInner = buttonHref ? (
      <Link href={buttonHref} className={`block text-center ${buttonClass}`}>
        {buttonText}
      </Link>
    ) : (
      <button type="button" className={buttonClass}>
        {buttonText}
      </button>
    );

    return (
      <div
        className={`group relative flex w-full shrink-0 cursor-pointer flex-col items-start transition-all duration-300 ease-out will-change-transform ${isV2 ? 'gap-3' : 'gap-[19.264px]'} ${designTier === 'professional' ? 'z-20' : 'z-[1]'} ${hoverShell} active:translate-y-0 active:shadow-md`}
        style={shell}
      >
        {mostPopular && designTier === 'professional' && (
          <div
            className="absolute z-30 flex items-center gap-[11.596px] text-[10px] font-bold tracking-wide text-white uppercase"
            style={{
              right: '-16.447px',
              top: '-12.843px',
              padding: '8.378px 31.309px 8.117px 31.309px',
              borderRadius: '29.767px 0',
              border: '1.24px solid #6B2E9A',
              background: '#9144CB',
              boxShadow:
                '0 4.281px 4.281px 0 rgba(97, 40, 140, 0.80) inset, 0 6.453px 6.453px 0 rgba(0, 0, 0, 0.12)',
            }}
          >
            <Sparkles className="h-3 w-3 shrink-0" />
            Most popular
          </div>
        )}
        <div>
          <h4 className="text-2xl font-bold">{tier}</h4>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="heading-bold text-3xl md:text-4xl">£</span>
          <span className="heading-bold text-5xl md:text-7xl">{price}</span>
          <span className="text-xs tracking-tight text-gray-400">/adviser/mo</span>
        </div>
        {features.length > 0 ? (
          <ul className="flex min-h-0 flex-1 flex-col gap-4 text-xs text-gray-600">
            {features.map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 rounded-full p-0.5 ${checkTint}`}>
                  <Check className="h-3 w-3" />
                </div>
                {f}
              </li>
            ))}
          </ul>
        ) : null}
        {buttonInner}
      </div>
    );
  }

  return null;
}
