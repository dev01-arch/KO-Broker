export default function AIReportsPage() {
  return (
    <div>
      <div className="flex h-[52px] items-center justify-between border-b border-ink-20 bg-white px-7">
        <h1 className="font-heading text-[15px] font-bold text-ink">AI Report Generation</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-teal-700/25 bg-brand-teal-700/10 px-3 py-1 text-[11px] font-semibold text-brand-teal-700">
          ✍️ Powered by Azure AI
        </span>
      </div>
      <div className="p-7">
        <div className="rounded-lg border border-ink-20 bg-white p-5">
          <p className="text-sm text-ink-60">AI report generation — PRD-09</p>
        </div>
      </div>
    </div>
  );
}
