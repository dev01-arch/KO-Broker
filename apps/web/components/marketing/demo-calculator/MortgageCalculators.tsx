'use client';

import React, { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Calculator,
  Home,
  Stamp,
  Percent,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CreditCard,
  BarChart3,
  Building,
  Calendar,
  PiggyBank,
  Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "./components/ui/tooltip";

type CalculatorType = 
  | 'affordability' 
  | 'monthly-payment' 
  | 'stamp-duty' 
  | 'ltv' 
  | 'erc' 
  | 'rental-yield' 
  | 'remortgage' 
  | 'debt-consolidation';

const calculators = [
  { id: 'affordability',      name: 'Affordability',      icon: Calculator, containerBg: '#d5fef0', iconColor: '#00bc7d' },
  { id: 'monthly-payment',    name: 'Monthly Payment',    icon: Home,       containerBg: '#e5efff', iconColor: '#2B7FFF' },
  { id: 'stamp-duty',         name: 'Stamp Duty',         icon: Stamp,      containerBg: '#f0defe', iconColor: '#AD46FF' },
  { id: 'ltv',                name: 'LTV',                icon: Percent,    containerBg: '#fff2de', iconColor: '#FE9A00' },
  { id: 'erc',                name: 'ERC',                icon: AlertCircle,containerBg: '#ffe6ec', iconColor: '#FF2056' },
  { id: 'rental-yield',       name: 'Rental Yield',       icon: TrendingUp, containerBg: '#d4f7fe', iconColor: '#00B8DB' },
  { id: 'remortgage',         name: 'Remortgage Saving',  icon: RefreshCw,  containerBg: '#e3e3ff', iconColor: '#615FFF' },
  { id: 'debt-consolidation', name: 'Debt Consolidation', icon: CreditCard, containerBg: '#ffdeef', iconColor: '#F6339A' },
] as const;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center text-[#535e5b] opacity-40 hover:opacity-70 transition-opacity cursor-help"
          >
            <Info size={13} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[230px] text-center leading-relaxed bg-[#061f18] text-white text-[11px] px-3 py-2 rounded-lg"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FieldLabel({ children, tooltip }: { children: React.ReactNode; tooltip?: string }) {
  return (
    <label className="text-sm font-medium flex items-center gap-1.5">
      {children}
      {tooltip && <InfoTooltip text={tooltip} />}
    </label>
  );
}

function MetricCard({
  label,
  description,
  value,
  subtext,
  gradient,
  shadow,
  icon,
  tooltip,
}: {
  label: string;
  description: string;
  value: string;
  subtext: string;
  gradient: string;
  shadow: string;
  icon: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <div
      className="relative flex flex-col gap-3 rounded-[15px] border border-ink-08 px-[18px] py-[19px]"
      style={{ backgroundImage: gradient, boxShadow: shadow }}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <p className="font-semibold text-[13px] text-[#061f18] leading-tight">{label}</p>
            {tooltip && <InfoTooltip text={tooltip} />}
          </div>
          <p className="text-[#535e5b] text-[10px] leading-tight">{description}</p>
        </div>
        <div className="text-[#535e5b] opacity-70 mt-0.5">{icon}</div>
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-numeric font-bold text-[26px] text-[#061f18] leading-none tracking-tight">{value}</p>
        <p className="text-[#16856f] text-[10px]">{subtext}</p>
      </div>
    </div>
  );
}

function AffordabilityCalculator() {
  const [income, setIncome] = useState(50000);
  const [secondIncome, setSecondIncome] = useState(0);
  const [deposit, setDeposit] = useState(50000);
  const [monthlyCommitments, setMonthlyCommitments] = useState(500);
  const [multiplier, setMultiplier] = useState(4.5);

  const totalIncome = income + secondIncome;
  const maxBorrowing = totalIncome * multiplier;
  const maxPurchasePrice = maxBorrowing + deposit;
  const annualCommitments = monthlyCommitments * 12;
  const affordabilityScore = annualCommitments / totalIncome;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel tooltip="Your gross (pre-tax) annual salary. Include all regular employment income.">Annual Income</FieldLabel>
          <input
            type="number"
            value={income}
            onChange={(e) => setIncome(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tooltip="A second applicant's gross annual salary. Lenders will usually consider both incomes when calculating affordability.">Second Income (optional)</FieldLabel>
          <input
            type="number"
            value={secondIncome}
            onChange={(e) => setSecondIncome(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tooltip="The amount you have saved to put towards the purchase. A larger deposit reduces the loan required and typically unlocks better interest rates.">Deposit</FieldLabel>
          <input
            type="number"
            value={deposit}
            onChange={(e) => setDeposit(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tooltip="Regular debt repayments: credit cards, car finance, personal loans. Do not include rent or household bills â€” lenders look at committed credit obligations only.">Monthly Commitments</FieldLabel>
          <input
            type="number"
            value={monthlyCommitments}
            onChange={(e) => setMonthlyCommitments(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tooltip="Most high-street lenders use 4xâ€“4.5x income. Specialist lenders may offer up to 5.5xâ€“6x for higher earners or certain professions.">Income Multiplier</FieldLabel>
          <input
            type="range"
            min="3"
            max="6"
            step="0.5"
            value={multiplier}
            onChange={(e) => setMultiplier(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-sm text-muted-foreground text-center">{multiplier}x</div>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Max Borrowing"
          description="Based on income Ã— multiplier"
          value={formatCurrency(maxBorrowing)}
          subtext={`${multiplier}x income applied`}
          gradient="linear-gradient(197deg, rgb(209,250,229) 10%, rgb(255,255,255) 39%)"
          shadow="0px 3.758px 3.382px rgba(190,200,202,0.19)"
          icon={<Calculator size={18} />}
          tooltip="An estimate based on the income multiplier. Lenders also stress-test repayments at a higher rate (typically ~7â€“8%) to confirm you can afford it."
        />
        <MetricCard
          label="Max Purchase Price"
          description="Borrowing + deposit combined"
          value={formatCurrency(maxPurchasePrice)}
          subtext={`Deposit: ${formatCurrency(deposit)}`}
          gradient="linear-gradient(197deg, rgb(219,234,254) 10%, rgb(255,255,255) 39%)"
          shadow="0px 6.421px 5.779px rgba(165,180,252,0.18)"
          icon={<Home size={18} />}
          tooltip="The maximum property value you could theoretically purchase, combining your max borrowing with the deposit amount entered."
        />
        <MetricCard
          label="Debt-to-Income"
          description="Monthly commitments vs income"
          value={formatPercent(affordabilityScore * 100)}
          subtext={affordabilityScore < 0.15 ? "Healthy ratio" : affordabilityScore < 0.35 ? "Moderate ratio" : "High ratio â€” review"}
          gradient={affordabilityScore < 0.35 ? "linear-gradient(197deg, rgb(219,250,255) 10%, rgb(255,255,255) 39%)" : "linear-gradient(197deg, rgb(254,215,215) 10%, rgb(255,255,255) 39%)"}
          shadow="0px 3.758px 3.382px rgba(190,200,202,0.19)"
          icon={<Percent size={18} />}
          tooltip="Annual debt commitments as a percentage of gross income. Below 15% is healthy; 15â€“35% is moderate; above 35% may restrict lender options."
        />
      </div>
    </div>
  );
}

function MonthlyPaymentCalculator() {
  const [loanAmount, setLoanAmount] = useState(300000);
  const [interestRate, setInterestRate] = useState(5);
  const [term, setTerm] = useState(25);

  const monthlyRate = interestRate / 100 / 12;
  const numPayments = term * 12;
  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  const totalPaid = monthlyPayment * numPayments;
  const totalInterest = totalPaid - loanAmount;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <FieldLabel tooltip="The total mortgage amount you are borrowing, not including the deposit.">Loan Amount</FieldLabel>
          <input
            type="number"
            value={loanAmount}
            onChange={(e) => setLoanAmount(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tooltip="Use your initial deal rate (fixed or tracker). SVR rates are typically 6â€“8%. Try stress-testing at 8% to check affordability if rates rise.">Interest Rate (%)</FieldLabel>
          <input
            type="number"
            step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tooltip="The full mortgage term. Longer terms reduce monthly payments but significantly increase total interest paid.">Term (years)</FieldLabel>
          <input
            type="number"
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-[19px] items-start">
        {/* Donut chart â€” left, expands to fill space */}
        <div className="flex flex-col flex-1 min-w-0 pt-4">
          <p className="text-xs font-medium text-[#535e5b] mb-1">What you pay back</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={[
                  { name: "Principal", value: loanAmount },
                  { name: "Interest", value: totalInterest },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={74}
                outerRadius={104}
                paddingAngle={3}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                <Cell fill="#10b981" />
                <Cell fill="#f43f5e" />
              </Pie>
              <ChartTooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ fontSize: 11, color: "#535e5b" }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Metric cards â€” right, fixed narrow column */}
        <div className="flex flex-col gap-4 w-full md:w-[300px] shrink-0">
          <MetricCard
            label="Monthly Payment"
            description="Capital + interest repayment"
            value={formatCurrency(monthlyPayment)}
            subtext={`Over ${term}-year term`}
            gradient="linear-gradient(197deg, rgb(219,234,254) 10%, rgb(255,255,255) 39%)"
            shadow="0px 3.758px 3.382px rgba(147,197,253,0.19)"
            icon={<Home size={18} />}
          />
          <MetricCard
            label="Total Paid"
            description="Sum of all repayments"
            value={formatCurrency(totalPaid)}
            subtext={`${term * 12} monthly payments`}
            gradient="linear-gradient(197deg, rgb(224,231,255) 10%, rgb(255,255,255) 39%)"
            shadow="0px 6.421px 5.779px rgba(165,180,252,0.18)"
            icon={<BarChart3 size={18} />}
          />
          <MetricCard
            label="Total Interest"
            description="Cost of borrowing over term"
            value={formatCurrency(totalInterest)}
            subtext={`${((totalInterest / loanAmount) * 100).toFixed(1)}% of loan amount`}
            gradient="linear-gradient(197deg, rgb(255,228,230) 10%, rgb(255,255,255) 39%)"
            shadow="0px 3.758px 3.382px rgba(252,165,165,0.19)"
            icon={<TrendingUp size={18} />}
            tooltip="The total interest paid over the full mortgage term. Reducing the term or overpaying regularly can significantly cut this figure."
          />
        </div>
      </div>
    </div>
  );
}

function StampDutyCalculator() {
  const [propertyPrice, setPropertyPrice] = useState(350000);
  const [firstTimeBuyer, setFirstTimeBuyer] = useState(false);
  const [additionalProperty, setAdditionalProperty] = useState(false);

  const calculateStampDuty = () => {
    let duty = 0;
    
    if (additionalProperty) {
      // Additional property surcharge: 3% on entire amount + standard rates
      const surcharge = propertyPrice * 0.03;
      
      if (propertyPrice > 1500000) {
        duty += (propertyPrice - 1500000) * 0.12;
        duty += (1500000 - 925000) * 0.10;
        duty += (925000 - 250000) * 0.05;
        duty += 250000 * 0;
      } else if (propertyPrice > 925000) {
        duty += (propertyPrice - 925000) * 0.10;
        duty += (925000 - 250000) * 0.05;
        duty += 250000 * 0;
      } else if (propertyPrice > 250000) {
        duty += (propertyPrice - 250000) * 0.05;
        duty += 250000 * 0;
      }
      
      duty += surcharge;
    } else if (firstTimeBuyer && propertyPrice <= 625000) {
      // First-time buyer relief
      if (propertyPrice > 425000) {
        duty = (propertyPrice - 425000) * 0.05;
      }
    } else {
      // Standard rates
      if (propertyPrice > 1500000) {
        duty += (propertyPrice - 1500000) * 0.12;
        duty += (1500000 - 925000) * 0.10;
        duty += (925000 - 250000) * 0.05;
        duty += 250000 * 0;
      } else if (propertyPrice > 925000) {
        duty += (propertyPrice - 925000) * 0.10;
        duty += (925000 - 250000) * 0.05;
        duty += 250000 * 0;
      } else if (propertyPrice > 250000) {
        duty += (propertyPrice - 250000) * 0.05;
        duty += 250000 * 0;
      }
    }
    
    return duty;
  };

  const stampDuty = calculateStampDuty();
  const effectiveRate = (stampDuty / propertyPrice) * 100;

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Property Price</label>
          <input
            type="number"
            value={propertyPrice}
            onChange={(e) => setPropertyPrice(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={firstTimeBuyer}
              onChange={(e) => {
                setFirstTimeBuyer(e.target.checked);
                if (e.target.checked) setAdditionalProperty(false);
              }}
              className="w-4 h-4"
            />
            <span className="text-sm">First-time buyer</span>
            <InfoTooltip text="Relief applies to properties up to Â£625,000. No SDLT on the first Â£425,000, then 5% on the portion up to Â£625,000." />
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={additionalProperty}
              onChange={(e) => {
                setAdditionalProperty(e.target.checked);
                if (e.target.checked) setFirstTimeBuyer(false);
              }}
              className="w-4 h-4"
            />
            <span className="text-sm">Additional property</span>
            <InfoTooltip text="A 3% surcharge applies on top of standard SDLT rates for second homes, buy-to-let, and investment properties." />
          </label>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          label="Stamp Duty (UK 2024)"
          description={additionalProperty ? "Incl. 3% surcharge" : firstTimeBuyer ? "First-time buyer relief applied" : "Standard SDLT rates"}
          value={formatCurrency(stampDuty)}
          subtext={stampDuty === 0 ? "No duty payable" : "Due on completion"}
          gradient="linear-gradient(197deg, rgb(243,232,255) 10%, rgb(255,255,255) 39%)"
          shadow="0px 3.758px 3.382px rgba(216,180,254,0.19)"
          icon={<Stamp size={18} />}
        />
        <MetricCard
          label="Effective Rate"
          description="Duty as % of property price"
          value={formatPercent(effectiveRate)}
          subtext={`On Â£${propertyPrice.toLocaleString('en-GB')} property`}
          gradient="linear-gradient(197deg, rgb(237,233,254) 10%, rgb(255,255,255) 39%)"
          shadow="0px 6.421px 5.779px rgba(196,181,253,0.18)"
          icon={<Percent size={18} />}
        />
      </div>
      
      {firstTimeBuyer && propertyPrice > 625000 && (
        <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          First-time buyer relief only applies to properties up to Â£625,000
        </div>
      )}
    </div>
  );
}

function LTVCalculator() {
  const [propertyValue, setPropertyValue] = useState(400000);
  const [loanAmount, setLoanAmount] = useState(320000);

  const ltv = (loanAmount / propertyValue) * 100;
  const equity = propertyValue - loanAmount;
  const equityPercent = (equity / propertyValue) * 100;

  const getLTVCategory = (ltv: number) => {
    if (ltv <= 60) return { text: 'Excellent', color: 'text-emerald-600' };
    if (ltv <= 75) return { text: 'Good', color: 'text-green-600' };
    if (ltv <= 85) return { text: 'Fair', color: 'text-amber-600' };
    if (ltv <= 95) return { text: 'High', color: 'text-orange-600' };
    return { text: 'Very High', color: 'text-rose-600' };
  };

  const category = getLTVCategory(ltv);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel tooltip="The current market value or purchase price of the property. Use a surveyor valuation for the most accurate LTV.">Property Value</FieldLabel>
          <input
            type="number"
            value={propertyValue}
            onChange={(e) => setPropertyValue(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tooltip="The outstanding mortgage balance or the amount you wish to borrow. Lenders typically lend up to 95% LTV (5% minimum deposit).">Loan Amount</FieldLabel>
          <input
            type="number"
            value={loanAmount}
            onChange={(e) => setLoanAmount(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      <div className="flex flex-col md:flex-row gap-[19px] items-start">
        {/* Donut chart â€” left, expands to fill space */}
        <div className="flex flex-col flex-1 min-w-0 pt-4">
          <p className="text-xs font-medium text-[#535e5b] mb-1">Loan vs equity</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={[
                  { name: "Loan", value: loanAmount },
                  { name: "Equity", value: equity },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={74}
                outerRadius={104}
                paddingAngle={3}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                <Cell fill="#F59E0B" />
                <Cell fill="#10B981" />
              </Pie>
              <ChartTooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ fontSize: 11, color: "#535e5b" }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Metric cards â€” right, fixed narrow column */}
        <div className="flex flex-col gap-4 w-full md:w-[300px] shrink-0">
          <MetricCard
            label="Loan-to-Value"
            description="Loan as % of property value"
            value={formatPercent(ltv)}
            subtext={category.text}
            gradient={
              ltv <= 75
                ? "linear-gradient(197deg, rgb(209,250,229) 10%, rgb(255,255,255) 39%)"
                : ltv <= 85
                ? "linear-gradient(197deg, rgb(254,243,199) 10%, rgb(255,255,255) 39%)"
                : "linear-gradient(197deg, rgb(255,228,230) 10%, rgb(255,255,255) 39%)"
            }
            shadow="0px 3.758px 3.382px rgba(190,200,202,0.19)"
            icon={<Percent size={18} />}
            tooltip="LTV determines the mortgage products available to you. â‰¤60% unlocks the best rates; each 5% tier typically improves the rate band."
          />
          <MetricCard
            label="Equity Amount"
            description="Property value minus loan"
            value={formatCurrency(equity)}
            subtext={`${formatPercent(equityPercent)} of property`}
            gradient="linear-gradient(197deg, rgb(209,250,229) 10%, rgb(255,255,255) 39%)"
            shadow="0px 3.758px 3.382px rgba(110,231,183,0.19)"
            icon={<Building size={18} />}
          />
          <MetricCard
            label="Equity Percentage"
            description="Share of property you own"
            value={formatPercent(equityPercent)}
            subtext={`LTV band: ${category.text}`}
            gradient="linear-gradient(197deg, rgb(207,250,254) 10%, rgb(255,255,255) 39%)"
            shadow="0px 6.421px 5.779px rgba(103,232,249,0.18)"
            icon={<BarChart3 size={18} />}
          />
        </div>
      </div>
    </div>
  );
}

function ERCCalculator() {
  const [outstandingBalance, setOutstandingBalance] = useState(250000);
  const [ercPercentage, setErcPercentage] = useState(3);
  const [monthsRemaining, setMonthsRemaining] = useState(24);

  const erc = outstandingBalance * (ercPercentage / 100);
  const monthlyReduction = erc / monthsRemaining;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <FieldLabel tooltip="The current outstanding mortgage balance at the point of early repayment or remortgage.">Outstanding Balance</FieldLabel>
          <input
            type="number"
            value={outstandingBalance}
            onChange={(e) => setOutstandingBalance(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tooltip="ERCs typically range from 1â€“5% and reduce each year of a fixed term. Check your mortgage offer document for the exact schedule.">ERC Percentage (%)</FieldLabel>
          <input
            type="number"
            step="0.1"
            value={ercPercentage}
            onChange={(e) => setErcPercentage(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tooltip="Months left in your current fixed-rate deal. The ERC usually falls to zero on the day the deal ends. Timing a remortgage close to that date avoids the charge entirely.">Months Remaining</FieldLabel>
          <input
            type="number"
            value={monthsRemaining}
            onChange={(e) => setMonthsRemaining(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          label="Early Repayment Charge"
          description="Penalty for exiting deal early"
          value={formatCurrency(erc)}
          subtext={`${ercPercentage}% of outstanding balance`}
          gradient="linear-gradient(197deg, rgb(255,228,230) 10%, rgb(255,255,255) 39%)"
          shadow="0px 3.758px 3.382px rgba(252,165,165,0.19)"
          icon={<AlertCircle size={18} />}
        />
        <MetricCard
          label="Monthly Reduction"
          description="ERC decrease per month waited"
          value={formatCurrency(monthlyReduction)}
          subtext={`Over ${monthsRemaining} months remaining`}
          gradient="linear-gradient(197deg, rgb(209,250,229) 10%, rgb(255,255,255) 39%)"
          shadow="0px 3.758px 3.382px rgba(134,239,172,0.19)"
          icon={<Calendar size={18} />}
        />
      </div>
      
      <div className="text-sm text-muted-foreground bg-muted p-4 rounded-lg">
        If you wait {monthsRemaining} months, the ERC will reduce to Â£0. Consider whether potential savings from remortgaging now outweigh the charge.
      </div>
    </div>
  );
}

function RentalYieldCalculator() {
  const [propertyPrice, setPropertyPrice] = useState(300000);
  const [monthlyRent, setMonthlyRent] = useState(1500);
  const [annualCosts, setAnnualCosts] = useState(3000);
  const [mortgage, setMortgage] = useState(240000);
  const [interestRate, setInterestRate] = useState(5);

  const annualRent = monthlyRent * 12;
  const grossYield = (annualRent / propertyPrice) * 100;
  
  const annualInterest = mortgage * (interestRate / 100);
  const netIncome = annualRent - annualCosts - annualInterest;
  const netYield = (netIncome / propertyPrice) * 100;
  const cashOnCashReturn = (netIncome / (propertyPrice - mortgage)) * 100;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Property Price</label>
          <input
            type="number"
            value={propertyPrice}
            onChange={(e) => setPropertyPrice(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Monthly Rent</label>
          <input
            type="number"
            value={monthlyRent}
            onChange={(e) => setMonthlyRent(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tooltip="Include letting agent fees (8â€“15% of rent), maintenance (~1% of property value/year), landlord insurance, void periods, and any management costs.">Annual Costs</FieldLabel>
          <input
            type="number"
            value={annualCosts}
            onChange={(e) => setAnnualCosts(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Mortgage Amount</label>
          <input
            type="number"
            value={mortgage}
            onChange={(e) => setMortgage(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Interest Rate (%)</label>
          <input
            type="number"
            step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Gross Yield"
          description="Annual rent Ã· property value"
          value={formatPercent(grossYield)}
          subtext={grossYield >= 7 ? "Strong yield" : grossYield >= 5 ? "Good yield" : "Below average"}
          gradient="linear-gradient(197deg, rgb(207,250,254) 10%, rgb(255,255,255) 39%)"
          shadow="0px 3.758px 3.382px rgba(103,232,249,0.19)"
          icon={<TrendingUp size={18} />}
          tooltip="Annual rent divided by property purchase price. UK BTL average is ~5%. Above 7% is considered strong, though location and property type vary widely."
        />
        <MetricCard
          label="Net Yield"
          description="After costs & mortgage interest"
          value={formatPercent(netYield)}
          subtext={netYield < 0 ? "Negative â€” review costs" : "After all deductions"}
          gradient={netYield >= 0 ? "linear-gradient(197deg, rgb(209,250,229) 10%, rgb(255,255,255) 39%)" : "linear-gradient(197deg, rgb(255,228,230) 10%, rgb(255,255,255) 39%)"}
          shadow="0px 6.421px 5.779px rgba(110,231,183,0.18)"
          icon={netYield >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
        />
        <MetricCard
          label="Cash-on-Cash Return"
          description="Net income Ã· equity invested"
          value={formatPercent(cashOnCashReturn)}
          subtext="Return on deposited capital"
          gradient="linear-gradient(197deg, rgb(224,231,255) 10%, rgb(255,255,255) 39%)"
          shadow="0px 3.758px 3.382px rgba(165,180,252,0.19)"
          icon={<PiggyBank size={18} />}
          tooltip="Net annual income divided by the equity you've invested (deposit). Shows the real return on your capital, accounting for leverage. More useful than yield alone for comparing deals."
        />
      </div>
      
      <div className="grid gap-3 text-sm md:grid-cols-2 items-start">
        <div className="space-y-3">
          <div className="flex justify-between p-3 bg-muted rounded">
            <span className="text-muted-foreground">Annual Rent</span>
            <span className="font-medium">{formatCurrency(annualRent)}</span>
          </div>
          <div className="flex justify-between p-3 bg-muted rounded">
            <span className="text-muted-foreground">Net Annual Income</span>
            <span className={`font-medium ${netIncome < 0 ? 'text-destructive' : 'text-primary'}`}>
              {formatCurrency(netIncome)}
            </span>
          </div>
        </div>
        <div className="flex flex-col">
          <p className="text-xs font-medium text-[#535e5b] mb-1">Annual rent allocation</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={[
                  { name: "Net Income", value: Math.max(0, netIncome) },
                  { name: "Running Costs", value: annualCosts },
                  { name: "Mortgage Interest", value: annualInterest },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={76}
                paddingAngle={3}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                <Cell fill="#10b981" />
                <Cell fill="#f59e0b" />
                <Cell fill="#f43f5e" />
              </Pie>
              <ChartTooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ fontSize: 10, color: "#535e5b" }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function RemortgageCalculator() {
  const [currentBalance, setCurrentBalance] = useState(280000);
  const [currentRate, setCurrentRate] = useState(6);
  const [newRate, setNewRate] = useState(4.5);
  const [remainingTerm, setRemainingTerm] = useState(20);
  const [fees, setFees] = useState(1500);

  const calculateMonthlyPayment = (balance: number, rate: number, years: number) => {
    const monthlyRate = rate / 100 / 12;
    const numPayments = years * 12;
    return balance * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  };

  const currentPayment = calculateMonthlyPayment(currentBalance, currentRate, remainingTerm);
  const newPayment = calculateMonthlyPayment(currentBalance, newRate, remainingTerm);
  const monthlySaving = currentPayment - newPayment;
  const annualSaving = monthlySaving * 12;
  const breakEvenMonths = fees / monthlySaving;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Current Balance</label>
          <input
            type="number"
            value={currentBalance}
            onChange={(e) => setCurrentBalance(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Remaining Term (years)</label>
          <input
            type="number"
            value={remainingTerm}
            onChange={(e) => setRemainingTerm(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Current Rate (%)</label>
          <input
            type="number"
            step="0.1"
            value={currentRate}
            onChange={(e) => setCurrentRate(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">New Rate (%)</label>
          <input
            type="number"
            step="0.1"
            value={newRate}
            onChange={(e) => setNewRate(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tooltip="Typical remortgage costs include a product/arrangement fee (Â£0â€“Â£2,000), valuation fee (~Â£300), and legal fees (~Â£500). Some deals offer free legals and valuation.">Remortgage Fees</FieldLabel>
          <input
            type="number"
            value={fees}
            onChange={(e) => setFees(Number(e.target.value))}
            className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          label="Monthly Saving"
          description="Reduction vs current payment"
          value={formatCurrency(monthlySaving)}
          subtext={monthlySaving > 0 ? `Break-even in ${breakEvenMonths.toFixed(1)} months` : "New rate is higher"}
          gradient={monthlySaving > 0 ? "linear-gradient(197deg, rgb(209,250,229) 10%, rgb(255,255,255) 39%)" : "linear-gradient(197deg, rgb(255,228,230) 10%, rgb(255,255,255) 39%)"}
          shadow="0px 3.758px 3.382px rgba(110,231,183,0.19)"
          icon={<RefreshCw size={18} />}
          tooltip="The break-even point is how many months of savings it takes to recoup the remortgage fees. Remortgaging is usually worthwhile if you plan to stay in the deal past this point."
        />
        <MetricCard
          label="Annual Saving"
          description="Full-year benefit after remortgage"
          value={formatCurrency(annualSaving)}
          subtext={`${(currentRate - newRate).toFixed(2)}% rate reduction`}
          gradient="linear-gradient(197deg, rgb(167,243,208) 10%, rgb(255,255,255) 39%)"
          shadow="0px 6.421px 5.779px rgba(52,211,153,0.18)"
          icon={<TrendingDown size={18} />}
        />
      </div>
      
      <div className="grid gap-3">
        <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">Current monthly payment</span>
          <span className="text-lg font-semibold font-numeric">{formatCurrency(currentPayment)}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">New monthly payment</span>
          <span className="text-lg font-semibold font-numeric text-primary">{formatCurrency(newPayment)}</span>
        </div>
        <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border-2 border-primary">
          <span className="text-sm font-medium">Break-even period</span>
          <span className="text-lg font-semibold font-numeric text-primary">
            {breakEvenMonths.toFixed(1)} months
          </span>
        </div>
      </div>

      <div className="flex flex-col">
        <p className="text-xs font-medium text-[#535e5b] mb-1">Monthly payment comparison</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={[
              { name: "Current", value: currentPayment },
              { name: "New", value: newPayment },
            ]}
            barSize={52}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#535e5b" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `Â£${(v / 1000).toFixed(1)}k`} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={48} />
            <ChartTooltip formatter={(v) => [formatCurrency(Number(v)), 'Monthly Payment']} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              <Cell fill="#f43f5e" />
              <Cell fill="#10b981" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DebtConsolidationCalculator() {
  const [debt1, setDebt1] = useState(15000);
  const [rate1, setRate1] = useState(18);
  const [debt2, setDebt2] = useState(8000);
  const [rate2, setRate2] = useState(21);
  const [debt3, setDebt3] = useState(5000);
  const [rate3, setRate3] = useState(15);
  const [consolidationRate, setConsolidationRate] = useState(5);
  const [consolidationTerm, setConsolidationTerm] = useState(10);

  const totalDebt = debt1 + debt2 + debt3;
  const weightedRate = ((debt1 * rate1) + (debt2 * rate2) + (debt3 * rate3)) / totalDebt;
  
  // Assume average 3 year term for existing debts
  const calculatePayment = (amount: number, rate: number, years: number) => {
    if (amount === 0) return 0;
    const monthlyRate = rate / 100 / 12;
    const numPayments = years * 12;
    return amount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  };

  const currentPayment1 = calculatePayment(debt1, rate1, 3);
  const currentPayment2 = calculatePayment(debt2, rate2, 3);
  const currentPayment3 = calculatePayment(debt3, rate3, 3);
  const totalCurrentPayment = currentPayment1 + currentPayment2 + currentPayment3;

  const consolidatedPayment = calculatePayment(totalDebt, consolidationRate, consolidationTerm);
  const monthlySaving = totalCurrentPayment - consolidatedPayment;
  const annualSaving = monthlySaving * 12;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium">Current Debts</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Debt 1 Amount</label>
            <input
              type="number"
              value={debt1}
              onChange={(e) => setDebt1(Number(e.target.value))}
              className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Debt 1 Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={rate1}
              onChange={(e) => setRate1(Number(e.target.value))}
              className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Debt 2 Amount</label>
            <input
              type="number"
              value={debt2}
              onChange={(e) => setDebt2(Number(e.target.value))}
              className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Debt 2 Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={rate2}
              onChange={(e) => setRate2(Number(e.target.value))}
              className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Debt 3 Amount</label>
            <input
              type="number"
              value={debt3}
              onChange={(e) => setDebt3(Number(e.target.value))}
              className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Debt 3 Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={rate3}
              onChange={(e) => setRate3(Number(e.target.value))}
              className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Consolidation Loan</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel tooltip="The interest rate on the consolidation loan â€” typically a secured loan or further advance on your mortgage. Much lower than unsecured debt but the loan is secured against your home.">Consolidation Rate (%)</FieldLabel>
            <input
              type="number"
              step="0.1"
              value={consolidationRate}
              onChange={(e) => setConsolidationRate(Number(e.target.value))}
              className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel tooltip="Extending short-term debts over a long mortgage term reduces monthly payments but significantly increases total interest paid. Consider a shorter term if cash flow allows.">Term (years)</FieldLabel>
            <input
              type="number"
              value={consolidationTerm}
              onChange={(e) => setConsolidationTerm(Number(e.target.value))}
              className="w-full px-4 py-2 bg-input-background border border-ink-08 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Total Debt"
          description="Combined debts to consolidate"
          value={formatCurrency(totalDebt)}
          subtext={`Avg rate: ${formatPercent(weightedRate)}`}
          gradient="linear-gradient(197deg, rgb(255,228,230) 10%, rgb(255,255,255) 39%)"
          shadow="0px 3.758px 3.382px rgba(252,165,165,0.19)"
          icon={<CreditCard size={18} />}
          tooltip="The weighted average rate across all debts. Consolidating makes most sense when this is significantly higher than the consolidation rate on offer."
        />
        <MetricCard
          label="Monthly Saving"
          description="vs current combined payments"
          value={formatCurrency(monthlySaving)}
          subtext={monthlySaving > 0 ? "Positive cash flow improvement" : "Review consolidation rate"}
          gradient={monthlySaving > 0 ? "linear-gradient(197deg, rgb(209,250,229) 10%, rgb(255,255,255) 39%)" : "linear-gradient(197deg, rgb(254,243,199) 10%, rgb(255,255,255) 39%)"}
          shadow="0px 3.758px 3.382px rgba(110,231,183,0.19)"
          icon={<TrendingDown size={18} />}
        />
        <MetricCard
          label="Annual Saving"
          description="Full-year consolidated benefit"
          value={formatCurrency(annualSaving)}
          subtext={`${consolidationRate}% consolidation rate`}
          gradient="linear-gradient(197deg, rgb(167,243,208) 10%, rgb(255,255,255) 39%)"
          shadow="0px 6.421px 5.779px rgba(52,211,153,0.18)"
          icon={<PiggyBank size={18} />}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 items-start">
        <div className="space-y-3">
          <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Current total monthly payment</span>
            <span className="text-lg font-semibold">{formatCurrency(totalCurrentPayment)}</span>
          </div>
          <div className="flex justify-between items-center p-4 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">New consolidated payment</span>
            <span className="text-lg font-semibold text-primary">{formatCurrency(consolidatedPayment)}</span>
          </div>
          <div className="flex justify-between items-center rounded-lg border border-ink-08 bg-primary/10 p-4">
            <span className="text-sm font-medium">Average current rate</span>
            <span className="text-lg font-semibold text-primary">{formatPercent(weightedRate)}</span>
          </div>
        </div>
        <div className="flex flex-col">
          <p className="text-xs font-medium text-[#535e5b] mb-1">Monthly payments â€” before vs after</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart
              data={[
                { name: "Debt 1", value: currentPayment1 },
                { name: "Debt 2", value: currentPayment2 },
                { name: "Debt 3", value: currentPayment3 },
                { name: "Consolidated", value: consolidatedPayment },
              ]}
              barSize={36}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#535e5b" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `Â£${Math.round(v)}`} tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={44} />
              <ChartTooltip formatter={(v) => [formatCurrency(Number(v)), 'Monthly']} />
              <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                <Cell fill="#f43f5e" />
                <Cell fill="#f97316" />
                <Cell fill="#f59e0b" />
                <Cell fill="#10b981" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default function MortgageCalculators() {
  const [activeCalculator, setActiveCalculator] = useState<CalculatorType>("affordability");

  const renderCalculator = () => {
    switch (activeCalculator) {
      case 'affordability':
        return <AffordabilityCalculator />;
      case 'monthly-payment':
        return <MonthlyPaymentCalculator />;
      case 'stamp-duty':
        return <StampDutyCalculator />;
      case 'ltv':
        return <LTVCalculator />;
      case 'erc':
        return <ERCCalculator />;
      case 'rental-yield':
        return <RentalYieldCalculator />;
      case 'remortgage':
        return <RemortgageCalculator />;
      case 'debt-consolidation':
        return <DebtConsolidationCalculator />;
    }
  };

  const activeCalc = calculators.find(c => c.id === activeCalculator);

  return (
    <div className="mortgage-calculators w-full bg-background">
      <div className="mx-auto w-full max-w-7xl py-2">
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-3">
            <div className="bg-card rounded-lg border border-ink-08 p-4 sticky top-8">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">CALCULATORS</h3>
              <nav className="space-y-1">
                {calculators.map((calc) => {
                  const Icon = calc.icon;
                  const isActive = activeCalculator === calc.id;
                  return (
                    <button
                      key={calc.id}
                      onClick={() => setActiveCalculator(calc.id as CalculatorType)}
                      className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all bg-white hover:bg-gray-50 ${
                        isActive ? 'ring-1 ring-ink-20 shadow-sm' : 'border border-transparent'
                      }`}
                    >
                      <div
                        className="w-[28px] h-[28px] rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: calc.containerBg }}
                      >
                        <Icon className="w-[14px] h-[14px]" style={{ color: calc.iconColor }} />
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

          {/* Main Content */}
          <main className="lg:col-span-9">
            <div className="bg-card rounded-lg border border-ink-08 overflow-hidden">
              {/* Calculator Header */}
              <div className="px-6 py-5 border-b border-ink-08 bg-accent/50">
                <div className="flex items-center gap-3">
                  {activeCalc && (
                    <>
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: activeCalc.containerBg }}
                      >
                        <activeCalc.icon className="w-5 h-5" style={{ color: activeCalc.iconColor }} />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold">{activeCalc.name} Calculator</h2>
                        <p className="text-sm text-muted-foreground">All results update in real-time</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Calculator Content */}
              <div className="p-6">
                {renderCalculator()}
              </div>
            </div>

            {/* Footer Note */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-ink-08">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Note:</strong> These calculators provide estimates for guidance only. 
                Actual figures may vary based on individual circumstances and lender criteria. Always consult with a qualified 
                mortgage adviser for personalized advice.
              </p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
