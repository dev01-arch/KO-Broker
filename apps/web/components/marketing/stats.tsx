export function MarketingStats() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 text-gray-900 md:grid-cols-3">
        {[
          { val: '5,000+', label: 'Mortgage products indexed', valColor: '#857ABE' },
          { val: '65%', label: 'Less admin per case', valColor: '#D8AE39' },
          { val: '30 min', label: 'From enquiry to DIP-ready', valColor: '#7AA0AE' },
        ].map((s, i) => (
          <div
            key={i}
            className="space-y-2 border-b border-gray-100 pb-10 text-center last:border-b-0 last:pb-0 md:border-r md:border-b-0 md:border-gray-200 md:pb-0 md:pr-10 md:last:border-r-0"
          >
            <div className="heading-bold text-6xl md:text-7xl" style={{ color: s.valColor }}>
              {s.val}
            </div>
            <div className="text-xs font-medium tracking-wider text-gray-500 uppercase">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
