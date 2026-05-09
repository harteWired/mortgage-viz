import { useMemo } from "react";
import { calcBreakdown } from "../utils/mortgage";

const fmt = (v) => "$" + Math.round(v).toLocaleString();

const SEGMENTS = [
  { key: "pi",        label: "P&I",       cls: "breakdown-stack__seg--pi" },
  { key: "tax",       label: "Tax",       cls: "breakdown-stack__seg--tax" },
  { key: "insurance", label: "Insurance", cls: "breakdown-stack__seg--insurance" },
  { key: "hoa",       label: "HOA",       cls: "breakdown-stack__seg--hoa" },
  { key: "pmi",       label: "PMI",       cls: "breakdown-stack__seg--pmi" },
];

export default function BreakdownStack({ params, selectedCell, fallback }) {
  const cell = selectedCell || fallback;
  const breakdown = useMemo(() => {
    if (!cell) return null;
    return calcBreakdown({
      homePrice: cell.price,
      downPaymentPct: params.downPaymentPct,
      annualRate: params.annualRate,
      termYears: params.termYears,
      annualTax: cell.tax,
      insuranceRate: params.insuranceRate,
      monthlyHOA: params.monthlyHOA,
    });
  }, [cell, params]);

  if (!cell || !breakdown) {
    return (
      <div className="breakdown-stack">
        <p className="breakdown-stack__title">Monthly breakdown</p>
        <div className="amort-empty">
          Click a cell on the heatmap to see the monthly composition
        </div>
      </div>
    );
  }

  const total = breakdown.total;
  const segs = SEGMENTS.map((s) => ({
    ...s,
    value: breakdown[s.key] || 0,
  })).filter((s) => s.value > 0);

  return (
    <div className="breakdown-stack">
      <p className="breakdown-stack__title">
        Monthly composition
      </p>
      <div className="breakdown-stack__total">{fmt(total)}</div>
      <p className="breakdown-stack__totalmeta">
        per month · {fmt(cell.price)} home · ${cell.tax.toLocaleString()}/yr tax
      </p>
      <div className="breakdown-stack__bar" role="img" aria-label={`Monthly ${fmt(total)} composed of ${segs.map((s) => `${s.label} ${fmt(s.value)}`).join(", ")}`}>
        {segs.map((s) => {
          const pct = (s.value / total) * 100;
          return (
            <div
              key={s.key}
              className={`breakdown-stack__seg ${s.cls}`}
              style={{ flex: s.value }}
              title={`${s.label} · ${fmt(s.value)} (${pct.toFixed(1)}%)`}
            >
              {pct >= 8 ? `${pct.toFixed(0)}%` : ""}
            </div>
          );
        })}
      </div>
      <div className="breakdown-stack__legend">
        {segs.map((s) => (
          <div className="breakdown-stack__legend-item" key={s.key}>
            <span className={`breakdown-stack__legend-swatch ${s.cls}`} />
            <span className="breakdown-stack__legend-label">{s.label}</span>
            <span className="breakdown-stack__legend-val">{fmt(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
