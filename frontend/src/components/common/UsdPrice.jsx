export function usdFromBdt(priceBdt, pricingSource) {
  if (!pricingSource?.usd_price_display_enabled) return null;
  const rate = Number(pricingSource.usd_bdt_rate || pricingSource.usdt_bdt_rate || 0);
  const price = Number(priceBdt || 0);
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(price)) return null;
  return (price / rate).toFixed(2);
}

export function formatUsd(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;
}

export default function UsdPrice({ value, className = "" }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border border-indigo-500/35 bg-indigo-500/15 px-2 py-0.5 font-mono text-xs font-bold text-indigo-300 ${className}`}
      title="USD equivalent at the current platform rate"
    >
      {formatUsd(value)}
    </span>
  );
}
