export default function MessagesPage() {
  return (
    <div>
      <div className="flex h-[52px] items-center justify-between border-b border-ink-20 bg-white px-7">
        <h1 className="font-heading text-[15px] font-bold text-ink">Messages</h1>
        <button className="rounded-md bg-brand-teal-500 px-4 py-1.5 text-sm font-medium text-white">
          + New message
        </button>
      </div>
      <div className="p-7">
        <div className="rounded-lg border border-ink-20 bg-white p-5">
          <p className="text-sm text-ink-60">Messages hub — PRD-10</p>
        </div>
      </div>
    </div>
  );
}
