import { useMemo } from "react";
import * as d3 from "d3";

const fmt = (v) => "$" + Math.round(v).toLocaleString();

export default function SummaryStats({ data, valueMode }) {
  const stats = useMemo(() => {
    if (!data || !data.length) return null;
    const values = data.map((d) => d.payment);
    return {
      min: d3.min(values),
      max: d3.max(values),
      median: d3.median(values),
      mean: d3.mean(values),
    };
  }, [data]);

  if (!stats) return null;

  const label = valueMode === "totalCost" ? "Total Cost" : valueMode === "totalInterest" ? "Total Interest" : "Monthly";

  return (
    <div className="summary-stats">
      <div className="stat">
        <span className="stat-label">Min {label}</span>
        <span className="stat-value">{fmt(stats.min)}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Median</span>
        <span className="stat-value">{fmt(stats.median)}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Mean</span>
        <span className="stat-value">{fmt(stats.mean)}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Max {label}</span>
        <span className="stat-value">{fmt(stats.max)}</span>
      </div>
    </div>
  );
}
