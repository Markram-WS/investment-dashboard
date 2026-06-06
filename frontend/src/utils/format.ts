import { EXCHANGE_RATE } from '../constants/colors';

export function fmtAmount(n: number | null | undefined, currency: "USD" | "THB"): string {
  if (n == null) n = 0;
  const v = currency === "THB" ? n * EXCHANGE_RATE : n;
  return currency === "USD"
    ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `฿${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function convertAmount(amount: number | null | undefined, currency: "USD" | "THB"): number {
  if (amount == null) return 0;
  return currency === "THB" ? amount * EXCHANGE_RATE : amount;
}

export function formatCurrency(amount: number | null | undefined, currency: "USD" | "THB"): string {
  const converted = convertAmount(amount, currency);
  if (currency === "USD") {
    return `$${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `฿${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

export function formatDateTime(dateString: string | null): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
