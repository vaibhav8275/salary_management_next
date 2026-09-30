/**
 * Formatting helpers for money, dates and counts.
 *
 * Two rules run through all of it:
 *
 * - Money arrives as a decimal string and is only ever converted to a number
 *   for display. Parsing is done with `Number()` and then re-formatted, which is
 *   safe for the magnitudes here (the largest payroll total in the seeded data
 *   is ~1e10, well inside the 2^53 exact-integer range) but keeps the *string*
 *   as the source of truth everywhere else.
 *
 - Nothing is summed across currencies. The reports return one row per
 *   (group, currency) pair — GBP and JPY side by side — and adding them
 *   together would be a category error, not a rounding one. `money()` therefore
 *   always takes an explicit currency.
 */

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function parseAmount(value: string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Full-precision money, e.g. `194,622.00 CAD`. Falls back to the raw string if
 * it will not parse, so a surprising value is visible rather than shown as 0.
 */
export function money(
  value: string | number | null | undefined,
  currency?: string | null,
  options: { compact?: boolean } = {},
): string {
  if (value === null || value === undefined || value === "") return "—";

  const amount = typeof value === "number" ? value : parseAmount(value);
  if (!Number.isFinite(amount)) return String(value);

  const body = options.compact
    ? compactFormatter.format(amount)
    : decimalFormatter.format(amount);

  return currency ? `${body} ${currency}` : body;
}

/** Axis labels and table cells where the cents are noise. */
export function moneyShort(value: string | number, currency?: string | null): string {
  return money(value, currency, { compact: true });
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return numberFormatter.format(value);
}

export function compactCount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return compactFormatter.format(value);
}

export function percent(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

/** `2026-01-01` → `1 Jan 2026`. The API uses ISO dates, so this is local-only. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** `2026-01-01` → `Jan 2026`, for axis ticks. */
export function formatMonth(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

/** `2026-09-29T11:11:39Z` → `29 Sep 2026, 11:11`. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatDate(value)}, ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Turns `50000-75000` into `[50000, 75000]`, for distribution buckets. */
export function parseRange(range: string): [number, number] {
  const [low, high] = range.split("-");
  return [parseAmount(low), parseAmount(high)];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
