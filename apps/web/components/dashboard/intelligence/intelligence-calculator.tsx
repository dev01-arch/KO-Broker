'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  Calculator,
  Clock,
  Home,
  Percent,
  Stamp,
  type LucideIcon,
} from 'lucide-react';
import {
  earlyRepaymentCharge,
  equityAmount,
  ltv as calcLtv,
  maxBorrowing,
  maxPurchasePrice,
  monthlyPaymentRepayment,
  stampDuty,
} from '@/lib/calculators/formulas';
import { useCurrentIntelligenceRates } from '@/hooks/use-intelligence';
import { MarketContextPanel } from './market-context-panel';

type CalcId = 'affordability' | 'monthly-payment' | 'stamp-duty' | 'ltv' | 'erc';

/** Same palette as the standalone Calculator page (`MortgageCalculators`). */
const CALC_ITEMS: {
  id: CalcId;
  name: string;
  icon: LucideIcon;
  containerBg: string;
  iconColor: string;
}[] = [
  { id: 'affordability', name: 'Affordability', icon: Calculator, containerBg: '#d5fef0', iconColor: '#00bc7d' },
  { id: 'monthly-payment', name: 'Monthly Payment', icon: Home, containerBg: '#e5efff', iconColor: '#2B7FFF' },
  { id: 'stamp-duty', name: 'Stamp Duty', icon: Stamp, containerBg: '#f0defe', iconColor: '#AD46FF' },
  { id: 'ltv', name: 'LTV', icon: Percent, containerBg: '#fff2de', iconColor: '#FE9A00' },
  { id: 'erc', name: 'ERC', icon: AlertCircle, containerBg: '#ffe6ec', iconColor: '#FF2056' },
];

function formatGbp(n: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3.5">
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink">{label}</label>
      {children}
    </div>
  );
}

function inputClassName() {
  return 'w-full rounded-lg border border-ink-08 bg-input-background px-4 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-primary';
}

function ResultTile({
  title,
  value,
  gradient,
  icon,
}: {
  title: string;
  value: string;
  gradient: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="relative flex flex-col gap-2 rounded-[15px] border border-ink-08 px-[18px] py-[19px]"
      style={{ backgroundImage: gradient, boxShadow: '0px 3.758px 3.382px rgba(190,200,202,0.19)' }}
    >
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-semibold leading-tight text-[#061f18]">{title}</p>
        {icon ? <div className="mt-0.5 text-[#535e5b] opacity-70">{icon}</div> : null}
      </div>
      <p className="font-numeric text-[22px] font-bold leading-none tracking-tight text-[#061f18]">
        {value}
      </p>
    </div>
  );
}

function AffordabilityForm({
  onLadderPrincipal,
}: {
  onLadderPrincipal: (n: number) => void;
}) {
  const [income, setIncome] = useState(50_000);
  const [deposit, setDeposit] = useState(50_000);
  const [multiplier, setMultiplier] = useState(4.5);
  const [commitments, setCommitments] = useState(500);

  const borrowing = maxBorrowing(income, 0, multiplier);
  const purchase = maxPurchasePrice(borrowing, deposit);

  useEffect(() => {
    onLadderPrincipal(purchase > 0 ? purchase : 275_000);
  }, [purchase, onLadderPrincipal]);

  return (
    <>
      <Field label="Annual income">
        <input
          type="number"
          className={inputClassName()}
          value={income}
          onChange={(e) => setIncome(Number(e.target.value))}
        />
      </Field>
      <Field label="Deposit">
        <input
          type="number"
          className={inputClassName()}
          value={deposit}
          onChange={(e) => setDeposit(Number(e.target.value))}
        />
      </Field>
      <Field label="Income multiplier">
        <input
          type="number"
          step="0.5"
          min="3"
          max="6"
          className={inputClassName()}
          value={multiplier}
          onChange={(e) => setMultiplier(Number(e.target.value))}
        />
      </Field>
      <Field label="Monthly commitments">
        <input
          type="number"
          className={inputClassName()}
          value={commitments}
          onChange={(e) => setCommitments(Number(e.target.value))}
        />
      </Field>
      <div className="mt-1.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ResultTile
          title="Max borrowing"
          value={formatGbp(borrowing)}
          gradient="linear-gradient(197deg, rgb(209,250,229) 10%, rgb(255,255,255) 39%)"
          icon={<Calculator size={18} />}
        />
        <ResultTile
          title="Max purchase price"
          value={formatGbp(purchase)}
          gradient="linear-gradient(197deg, rgb(219,234,254) 10%, rgb(255,255,255) 39%)"
          icon={<Home size={18} />}
        />
      </div>
    </>
  );
}

function MonthlyPaymentForm({
  onLadder,
}: {
  onLadder: (ctx: { principal: number; termYears: number; ratePct: number }) => void;
}) {
  const [loan, setLoan] = useState(275_000);
  const [rate, setRate] = useState(4.1);
  const [term, setTerm] = useState(30);

  useEffect(() => {
    onLadder({ principal: loan, termYears: term, ratePct: rate });
  }, [loan, term, rate, onLadder]);

  const payment = monthlyPaymentRepayment(loan, rate, term);

  return (
    <>
      <Field label="Loan amount">
        <input
          type="number"
          className={inputClassName()}
          value={loan}
          onChange={(e) => setLoan(Number(e.target.value))}
        />
      </Field>
      <Field label="Interest rate (%)">
        <input
          type="number"
          step="0.1"
          className={inputClassName()}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
        />
      </Field>
      <Field label="Term (years)">
        <input
          type="number"
          className={inputClassName()}
          value={term}
          onChange={(e) => setTerm(Number(e.target.value))}
        />
      </Field>
      <div className="mt-1.5">
        <ResultTile
          title="Monthly payment"
          value={`${formatGbp(payment)}/mo`}
          gradient="linear-gradient(197deg, rgb(219,234,254) 10%, rgb(255,255,255) 39%)"
          icon={<Home size={18} />}
        />
      </div>
    </>
  );
}

function StampDutyForm() {
  const [price, setPrice] = useState(350_000);
  const [firstTime, setFirstTime] = useState(false);
  const [additional, setAdditional] = useState(false);
  const duty = stampDuty(price, { firstTimeBuyer: firstTime, additionalProperty: additional });

  return (
    <>
      <Field label="Property price">
        <input
          type="number"
          className={inputClassName()}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      </Field>
      <label className="mb-2 flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={firstTime} onChange={(e) => setFirstTime(e.target.checked)} />
        First-time buyer
      </label>
      <label className="mb-4 flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={additional}
          onChange={(e) => setAdditional(e.target.checked)}
        />
        Additional property
      </label>
      <ResultTile
        title="Stamp duty"
        value={formatGbp(duty)}
        gradient="linear-gradient(197deg, rgb(243,232,255) 10%, rgb(255,255,255) 39%)"
        icon={<Stamp size={18} />}
      />
    </>
  );
}

function LtvForm() {
  const [value, setValue] = useState(350_000);
  const [loan, setLoan] = useState(280_000);
  const ltvPct = calcLtv(loan, value);
  const equity = equityAmount(value, loan);

  return (
    <>
      <Field label="Property value">
        <input
          type="number"
          className={inputClassName()}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        />
      </Field>
      <Field label="Loan amount">
        <input
          type="number"
          className={inputClassName()}
          value={loan}
          onChange={(e) => setLoan(Number(e.target.value))}
        />
      </Field>
      <div className="mt-1.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ResultTile
          title="LTV"
          value={`${ltvPct.toFixed(1)}%`}
          gradient="linear-gradient(197deg, rgb(209,250,229) 10%, rgb(255,255,255) 39%)"
          icon={<Percent size={18} />}
        />
        <ResultTile
          title="Equity"
          value={formatGbp(equity)}
          gradient="linear-gradient(197deg, rgb(207,250,254) 10%, rgb(255,255,255) 39%)"
          icon={<Home size={18} />}
        />
      </div>
    </>
  );
}

function ErcForm() {
  const [balance, setBalance] = useState(250_000);
  const [pct, setPct] = useState(3);
  const charge = earlyRepaymentCharge(balance, pct);

  return (
    <>
      <Field label="Outstanding balance">
        <input
          type="number"
          className={inputClassName()}
          value={balance}
          onChange={(e) => setBalance(Number(e.target.value))}
        />
      </Field>
      <Field label="ERC percentage (%)">
        <input
          type="number"
          step="0.1"
          className={inputClassName()}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
        />
      </Field>
      <ResultTile
        title="Early repayment charge"
        value={formatGbp(charge)}
        gradient="linear-gradient(197deg, rgb(255,228,230) 10%, rgb(255,255,255) 39%)"
        icon={<AlertCircle size={18} />}
      />
    </>
  );
}

export function IntelligenceCalculator() {
  const [active, setActive] = useState<CalcId>('affordability');
  const [ladderPrincipal, setLadderPrincipal] = useState(275_000);
  const [ladderTerm, setLadderTerm] = useState(30);
  const [comparisonRate, setComparisonRate] = useState<number | null>(null);
  const { data: rates, isLoading } = useCurrentIntelligenceRates(true);

  const activeCalc = CALC_ITEMS.find((c) => c.id === active) ?? CALC_ITEMS[0];

  const setAffordabilityPrincipal = useCallback((n: number) => {
    setLadderPrincipal(n);
    setLadderTerm(30);
    setComparisonRate(null);
  }, []);

  const setMonthlyLadder = useCallback(
    (ctx: { principal: number; termYears: number; ratePct: number }) => {
      setLadderPrincipal(ctx.principal);
      setLadderTerm(ctx.termYears);
      setComparisonRate(ctx.ratePct);
    },
    [],
  );

  return (
    <div className="grid gap-[18px] lg:grid-cols-[240px_1.05fr_0.85fr]">
      {/* Sidebar — matches standalone Calculator nav chips */}
      <aside>
        <div className="sticky top-8 rounded-lg border border-ink-08 bg-card p-4">
          <h3 className="mb-3 px-2 text-sm font-semibold text-muted-foreground">CALCULATORS</h3>
          <nav className="space-y-1" aria-label="Intelligence calculators">
            {CALC_ITEMS.map((calc) => {
              const Icon = calc.icon;
              const isActive = active === calc.id;
              return (
                <button
                  key={calc.id}
                  type="button"
                  onClick={() => {
                    setActive(calc.id);
                    if (calc.id !== 'monthly-payment' && calc.id !== 'affordability') {
                      setComparisonRate(null);
                      setLadderPrincipal(275_000);
                      setLadderTerm(30);
                    }
                  }}
                  className={`relative flex w-full items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-left transition-all hover:bg-gray-50 ${
                    isActive ? 'shadow-sm ring-1 ring-ink-20' : 'border border-transparent'
                  }`}
                >
                  <div
                    className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: calc.containerBg }}
                  >
                    <Icon className="h-[14px] w-[14px]" style={{ color: calc.iconColor }} />
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: isActive ? calc.iconColor : '#0a0a0a' }}
                  >
                    {calc.name}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Active calculator — header + body like standalone Calculator */}
      <div className="overflow-hidden rounded-lg border border-ink-08 bg-card">
        <div className="border-b border-ink-08 bg-accent/50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: activeCalc.containerBg }}
            >
              <activeCalc.icon className="h-5 w-5" style={{ color: activeCalc.iconColor }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink">{activeCalc.name} Calculator</h2>
              <p className="text-sm text-muted-foreground">All results update in real-time</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {active === 'affordability' ? (
            <AffordabilityForm onLadderPrincipal={setAffordabilityPrincipal} />
          ) : null}
          {active === 'monthly-payment' ? (
            <MonthlyPaymentForm onLadder={setMonthlyLadder} />
          ) : null}
          {active === 'stamp-duty' ? <StampDutyForm /> : null}
          {active === 'ltv' ? <LtvForm /> : null}
          {active === 'erc' ? <ErcForm /> : null}

          <p className="mt-6 border-t border-ink-08 pt-4 text-sm text-muted-foreground">
            <Clock className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            <strong className="text-foreground">Note:</strong> These calculators provide estimates for
            guidance only. Actual figures may vary based on individual circumstances and lender
            criteria.
          </p>
        </div>
      </div>

      <MarketContextPanel
        rates={rates}
        isLoading={isLoading}
        principal={ladderPrincipal}
        termYears={ladderTerm}
        comparisonRatePct={comparisonRate}
      />
    </div>
  );
}
