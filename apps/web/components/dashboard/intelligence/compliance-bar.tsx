'use client';

import { AlertTriangle } from 'lucide-react';

export const COMPLIANCE_BAR_COPY =
  'Market context only. This is not a mortgage recommendation, a lender acceptance indication, or a regulated affordability assessment. No lender, product or rate offer is implied. Official statistics reused under the Open Government Licence.';

export function ComplianceBar() {
  return (
    <div
      role="note"
      className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#f0dfae] bg-[#fff8ea] px-4 py-3 text-[12.5px] leading-relaxed text-[#7a5b12]"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 stroke-[#b0791a]" aria-hidden />
      <p>{COMPLIANCE_BAR_COPY}</p>
    </div>
  );
}
