import type { MonthGroup } from "../lib/posts";

export default function MonthNav({ months, prefix = "month" }: { months: MonthGroup<unknown>[]; prefix?: string }) {
  if (months.length === 0) return null;
  return (
    <nav className="months" aria-label="依月份跳轉">
      {months.map((m) => (
        <a key={m.key} className="chip" href={`#${prefix}-${m.key}`}>
          {m.label} <span className="count">{m.count}</span>
        </a>
      ))}
    </nav>
  );
}
