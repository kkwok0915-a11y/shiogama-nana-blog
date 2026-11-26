/** Date filter helpers shared by the 文章 list and the 相簿 gallery (dates are YYYY-MM-DD). */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dateFromLocation(loc: Location = window.location): string | null {
  const v = new URLSearchParams(loc.search).get("date");
  return v && DATE_RE.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
}

/** Unique dates, newest first. */
export function uniqueDates(list: (string | null | undefined)[]): string[] {
  return [...new Set(list.filter((d): d is string => Boolean(d && DATE_RE.test(d))))].sort((a, b) => b.localeCompare(a));
}

const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400000;

/** The available date closest to `want` (ties go to the newer date); null if nothing is available. */
export function nearestDate(dates: string[], want: string | null): string | null {
  if (!want || !dates.length) return null;
  if (dates.includes(want)) return want;
  const w = day(want);
  let best = dates[0];
  for (const d of dates) if (Math.abs(day(d) - w) < Math.abs(day(best) - w)) best = d;
  return best;
}
