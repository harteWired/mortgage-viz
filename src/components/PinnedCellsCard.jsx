import { calcTotalMonthly } from "../utils/mortgage";

const fmt = (v) => "$" + Math.round(v).toLocaleString();
const priceLabel = (p) =>
  p >= 1_000_000 ? `$${(p / 1e6).toFixed(1)}M` : `$${(p / 1000).toFixed(0)}k`;

export default function PinnedCellsCard({ pinnedCells, params, onRemove, onClear }) {
  if (!pinnedCells.length) {
    return (
      <div className="module-card pinned-cells-card">
        <p className="module-card__title">Pinned cells</p>
        <p style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem",
          color: "var(--color-fg-subtle)",
          textTransform: "uppercase",
          letterSpacing: "var(--letter-spacing-overline)"
        }}>
          Click any cell on the heatmap to pin it for comparison.
        </p>
      </div>
    );
  }

  return (
    <div className="module-card pinned-cells-card">
      <p className="module-card__title">Pinned · {pinnedCells.length}/5</p>
      <div className="pinned-list">
        {pinnedCells.map((c, i) => {
          const monthly = calcTotalMonthly({
            homePrice: c.price,
            downPaymentPct: params.downPaymentPct,
            annualRate: params.annualRate,
            termYears: params.termYears,
            annualTax: c.tax,
            insuranceRate: params.insuranceRate,
            monthlyHOA: params.monthlyHOA,
          });
          return (
            <div className="pinned-cell" key={`${c.price}-${c.tax}`}>
              <span className="pinned-cell__num">{i + 1}</span>
              <span className="pinned-cell__data">
                <span className="pinned-cell__primary">{fmt(monthly)}/mo</span>
                <span className="pinned-cell__meta">
                  {priceLabel(c.price)} · ${c.tax.toLocaleString()}/yr tax
                </span>
              </span>
              <button
                className="pinned-cell__remove"
                onClick={() => onRemove(c)}
                aria-label="Remove pin"
                title="Remove pin"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 3l8 8M11 3l-8 8" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      <button className="clear-pins-btn" onClick={onClear}>
        Clear all pins
      </button>
    </div>
  );
}
