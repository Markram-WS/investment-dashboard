import { EXCHANGE_RATE } from '../constants/colors';

export type Currency = "USD" | "THB";

const moneyFormatters: Record<Currency, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  THB: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "THB",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

/** Single money source: `$1,234.56` / `฿1,234.56`, with `-$5.00` for negatives. */
export function formatMoney(value: number | null | undefined, currency: Currency = "USD"): string {
  const n = value == null || !Number.isFinite(value) ? 0 : value;
  return moneyFormatters[currency].format(n);
}

/**
 * Signed percentage with one decimal: `+2.3%`, `-1.0%`, `0.0%`.
 * The sign is omitted only for an exact zero.
 */
export function formatPct(value: number | null | undefined): string {
  const n = value == null || !Number.isFinite(value) ? 0 : value;
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

export function fmtAmount(n: number | null | undefined, currency: Currency): string {
  const base = n == null ? 0 : n;
  return formatMoney(currency === "THB" ? base * EXCHANGE_RATE : base, currency);
}

export function formatCurrency(amount: number | null | undefined, currency: Currency): string {
  return fmtAmount(amount, currency);
}

/**
 * Order quantities come back as Numeric strings ("100.00000000"). Print the
 * number, trimmed of trailing zeros, never the raw database string.
 */
export function formatQty(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

/**
 * Zone labels that are prices ("32.0") render as `$32.00`; other labels pass through.
 */
export function priceLabel(label: string): string {
  const trimmed = (label ?? "").trim();
  if (trimmed === "") return label;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return label;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
  return new Date(dateString).toLocaleDateString("en-US", options);
}

const dateTimeParts = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Stable `YYYY-MM-DD HH:mm:ss` in the viewer's local time. */
export function formatDateTime(dateString: string | null): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "";
  const parts: Record<string, string> = {};
  for (const part of dateTimeParts.formatToParts(d)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}`;
}
