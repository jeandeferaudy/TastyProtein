// src/lib/money.ts
export function formatMoney(n: unknown): string {
  const num = Number(n ?? 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function calculateSteakCredits(subtotal: unknown): number {
  const amount = Number(subtotal ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.max(0, Math.round(amount * 0.05));
}

export function formatCurrencyPHP(n: unknown): string {
  return `₱${formatMoney(n)}`;
}
