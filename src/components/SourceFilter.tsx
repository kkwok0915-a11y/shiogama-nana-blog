export type Source = "all" | "blog" | "ig";

const SOURCES: { id: Source; label: string; short: string }[] = [
  { id: "all", label: "全部", short: "全部" },
  { id: "blog", label: "Blog", short: "Blog" },
  { id: "ig", label: "Instagram", short: "IG" },
];

/** 全部 / Blog / Instagram segmented control with counts (shared by 動態 and 相簿). */
export default function SourceFilter({
  source,
  counts,
  onSource,
  label,
}: {
  source: Source;
  counts: Record<Source, number>;
  onSource: (s: Source) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {SOURCES.map((s) => (
        <button
          key={s.id}
          type="button"
          className={"seg" + (source === s.id ? " current" : "")}
          aria-pressed={source === s.id}
          aria-label={`${s.label} ${counts[s.id]}`}
          onClick={() => onSource(s.id)}
        >
          <span className="seg-long">{s.label}</span>
          <span className="seg-short" aria-hidden="true">
            {s.short}
          </span>
          <span className="count">{counts[s.id]}</span>
        </button>
      ))}
    </div>
  );
}
