export default function DashboardPage() {
  return (
    <div>
      {/* Top bar */}
      <div className="flex h-[52px] items-center justify-between border-b border-ink-20 bg-white px-7">
        <h1 className="font-heading text-[15px] font-bold text-ink">Good morning 👋</h1>
        <div className="flex gap-2">
          <button className="rounded-md bg-ink px-4 py-1.5 text-sm font-medium text-white hover:bg-ink/80">
            + New Client
          </button>
          <button className="rounded-md bg-brand-teal-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-teal-400">
            + New Case
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-5 p-7">
        {/* Stat cards row */}
        <div className="grid grid-cols-4 gap-3.5">
          {[
            { label: 'Active Cases', value: '24', sub: '+3 this week', accent: 'green' },
            { label: 'Total Clients', value: '187', sub: '+12 this month', accent: 'green' },
            { label: 'Unread Messages', value: '8', sub: '3 from clients', accent: 'blue' },
            { label: 'Pipeline Value', value: '£4.2M', sub: 'On track', accent: 'green' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-ink-20 bg-white px-5 py-4"
            >
              <div className="mb-1.5 text-xs font-medium text-ink-60">{stat.label}</div>
              <div className="mb-1 font-heading text-3xl font-extrabold leading-none text-ink">
                {stat.value}
              </div>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  stat.accent === 'green'
                    ? 'bg-brand-teal-700/10 text-brand-teal-700'
                    : 'bg-blue/10 text-blue'
                }`}
              >
                {stat.sub}
              </span>
            </div>
          ))}
        </div>

        {/* Pipeline panel placeholder */}
        <div className="rounded-lg border border-ink-20 bg-white">
          <div className="flex items-center justify-between border-b border-ink-20 px-5 py-4">
            <h2 className="font-heading text-sm font-bold text-ink">Case Pipeline</h2>
            <a
              href="/dashboard/cases"
              className="rounded-md bg-surface px-3 py-1.5 text-sm text-ink-60 hover:text-ink"
            >
              View all
            </a>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-5 gap-2.5">
              {[
                { stage: 'Enquiry', count: 2, color: 'stage-enquiry' },
                { stage: 'Fact-Find', count: 5, color: 'stage-factfind' },
                { stage: 'Research', count: 4, color: 'stage-research' },
                { stage: 'DIP', count: 7, color: 'stage-dip' },
                { stage: 'Offer', count: 6, color: 'stage-offer' },
              ].map((col) => (
                <div
                  key={col.stage}
                  className={`rounded-lg border p-2.5`}
                  style={{
                    backgroundColor: `var(--color-${col.color}-bg)`,
                    borderColor: `var(--color-${col.color}-border)`,
                  }}
                >
                  <div
                    className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide"
                    style={{ color: `var(--color-${col.color}-text)` }}
                  >
                    {col.stage}
                    <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px]">
                      {col.count}
                    </span>
                  </div>
                  {/* Case cards will be rendered here — PRD-06 */}
                  <div className="rounded-md border border-ink-08 bg-white px-3 py-2.5">
                    <div className="text-xs font-semibold text-ink">Placeholder</div>
                    <div className="text-[11px] text-ink-60">Case card — PRD-06</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
