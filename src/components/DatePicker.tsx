interface Props {
  /** Dates that have content, newest first (YYYY-MM-DD). */
  dates: string[];
  /** The date being shown (already snapped to an available date), or null for all dates. */
  value: string | null;
  /** The date that was asked for (URL), used to explain a snap to the nearest date. */
  requested: string | null;
  onChange: (date: string | null) => void;
  noun: string; // 文章 / 照片
}

const fmt = (d: string) => d.replace(/-/g, ".");

export default function DatePicker({ dates, value, requested, onChange, noun }: Props) {
  if (!dates.length) return null;
  const i = value ? dates.indexOf(value) : -1;
  const older = i >= 0 && i < dates.length - 1 ? dates[i + 1] : null;
  const newer = i > 0 ? dates[i - 1] : null;
  return (
    <div className="date-filter">
      <div className="date-picker" role="group" aria-label="依日期篩選">
        <label className={"date-field" + (value ? " has-value" : "")}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          <span className="visually-hidden">選擇日期</span>
          <input
            type="date"
            min={dates[dates.length - 1]}
            max={dates[0]}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            onClick={(e) => {
              // Open the calendar on any click (desktop Chrome otherwise only opens it from its own icon).
              try {
                e.currentTarget.showPicker?.();
              } catch {
                /* not allowed in this context; the field still accepts typing */
              }
            }}
          />
          {!value && (
            <span className="date-placeholder" aria-hidden="true">
              全部日期
            </span>
          )}
        </label>
        {value && (
          <>
            <button type="button" className="date-step" onClick={() => older && onChange(older)} disabled={!older} aria-label="上一個有內容的日期（較早）">
              ‹
            </button>
            <button type="button" className="date-step" onClick={() => newer && onChange(newer)} disabled={!newer} aria-label="下一個有內容的日期（較新）">
              ›
            </button>
            <button type="button" className="date-clear" onClick={() => onChange(null)} aria-label="清除日期，顯示全部日期">
              全部
            </button>
          </>
        )}
      </div>
      {value && requested && requested !== value && (
        <p className="date-note" role="status">
          {fmt(requested)} 沒有{noun}，已顯示最接近的 {fmt(value)}。
        </p>
      )}
    </div>
  );
}
