import { useRef, useEffect, useMemo } from "react";
import * as d3 from "d3";
import { generateAmortizationSchedule } from "../utils/mortgage";

export default function AmortizationChart({ params, selectedCell }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const schedule = useMemo(() => {
    if (!selectedCell) return [];
    return generateAmortizationSchedule({
      homePrice: selectedCell.price,
      downPaymentPct: params.downPaymentPct,
      annualRate: params.annualRate,
      termYears: params.termYears,
      annualTax: selectedCell.tax,
      insuranceRate: params.insuranceRate,
      monthlyHOA: params.monthlyHOA,
    });
  }, [selectedCell, params]);

  // Total paid across the full schedule — memoized so we don't reduce
  // ~360 entries on every render of the panel header.
  const totalPaid = useMemo(
    () => schedule.reduce((acc, m) => acc + m.totalPayment, 0),
    [schedule],
  );

  // Aggregate to yearly (single O(n) pass)
  const yearly = useMemo(() => {
    if (!schedule.length) return [];
    const buckets = Array.from({ length: params.termYears }, (_, i) => ({
      year: i + 1, principal: 0, interest: 0, tax: 0, insurance: 0, hoa: 0, pmi: 0,
      balance: 0, totalEquity: 0, totalInterest: 0,
    }));
    for (const m of schedule) {
      const b = buckets[m.year - 1];
      b.principal += m.principal;
      b.interest += m.interest;
      b.tax += m.tax;
      b.insurance += m.insurance;
      b.hoa += m.hoa;
      b.pmi += m.pmi;
      b.balance = m.balance;
      b.totalEquity = m.totalEquity;
      b.totalInterest = m.totalInterest;
    }
    return buckets;
  }, [schedule, params.termYears]);

  useEffect(() => {
    if (!yearly.length || !containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = Math.min(320, containerRef.current.clientHeight || 320);
    const margin = { top: 20, right: 24, bottom: 36, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", containerWidth).attr("height", containerHeight)
       .style("overflow", "visible");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([1, params.termYears]).range([0, width]);
    const yMax = d3.max(yearly, (d) => Math.max(d.balance, d.totalEquity, d.totalInterest));
    const y = d3.scaleLinear().domain([0, yMax]).range([height, 0]);

    // Grid lines
    g.append("g")
      .attr("class", "grid")
      .selectAll("line")
      .data(y.ticks(4))
      .join("line")
      .attr("x1", 0).attr("x2", width)
      .attr("y1", (d) => y(d)).attr("y2", (d) => y(d))
      .attr("stroke", "var(--border-subtle)")
      .attr("stroke-dasharray", "2,4");

    // Pass var() strings straight to d3 so the SVG resolves them at
    // paint time — chart re-themes via CSS inheritance without any
    // JS re-execution on theme toggle.
    const colors = {
      balance:  "var(--color-ember)",
      equity:   "var(--color-sage)",
      interest: "var(--color-iris)",
    };

    const line = d3.line().x((d) => x(d.year)).curve(d3.curveMonotoneX);

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function drawLine(data, yAccessor, color, strokeWidth, dash) {
      const path = g.append("path")
        .datum(data)
        .attr("d", line.y(yAccessor))
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", strokeWidth);

      if (dash) path.attr("stroke-dasharray", dash);

      // Line-drawing animation via stroke-dashoffset
      if (!prefersReduced && !dash) {
        const totalLength = path.node().getTotalLength();
        path
          .attr("stroke-dasharray", totalLength)
          .attr("stroke-dashoffset", totalLength)
          .transition()
          .duration(1200)
          .ease(d3.easeCubicOut)
          .attr("stroke-dashoffset", 0);
      }
      return path;
    }

    // Balance line
    drawLine(yearly, (d) => y(d.balance), colors.balance, 2.5);

    // Equity line
    drawLine(yearly, (d) => y(d.totalEquity), colors.equity, 2.5);

    // Total interest line (dashed — skip draw animation)
    drawLine(yearly, (d) => y(d.totalInterest), colors.interest, 2, "6,3");

    // X axis
    const xAxisG = g.append("g").attr("transform", `translate(0,${height})`).call(
      d3.axisBottom(x).ticks(Math.min(params.termYears, 10)).tickFormat((d) => `Yr ${d}`)
    );
    xAxisG.select(".domain").remove();
    xAxisG.selectAll("text").attr("fill", "var(--text-muted)").attr("font-size", "10px");
    xAxisG.selectAll(".tick line").attr("stroke", "var(--border)");

    // Y axis
    const yAxisG = g.append("g").call(
      d3.axisLeft(y).ticks(4).tickFormat((d) => `$${(d / 1000).toFixed(0)}k`)
    );
    yAxisG.select(".domain").remove();
    yAxisG.selectAll("text").attr("fill", "var(--text-muted)").attr("font-size", "10px");
    yAxisG.selectAll(".tick line").attr("stroke", "var(--border)");

    // (Legend rendered as HTML below the chart — see JSX.)
  }, [yearly, params.termYears]);

  if (!selectedCell) {
    return (
      <div className="amortization-panel">
        <div className="amort-empty">Click a cell on the heatmap to see the amortization schedule</div>
      </div>
    );
  }

  const fmt = (v) => "$" + Math.round(v).toLocaleString();
  const lastYear = yearly[yearly.length - 1];

  return (
    <div className="amortization-panel" ref={containerRef}>
      <div className="amort-header">
        <h3>Amortization · {fmt(selectedCell.price)} home, {fmt(selectedCell.tax)}/yr tax</h3>
        {lastYear && (
          <div className="amort-stats">
            <span>Total interest <strong>{fmt(lastYear.totalInterest)}</strong></span>
            <span>Total paid <strong>{fmt(totalPaid)}</strong></span>
          </div>
        )}
      </div>
      <svg ref={svgRef}></svg>
      <div className="amort-legend">
        <span className="amort-legend-item">
          <span className="amort-legend-line" style={{ background: "var(--color-ember)" }} />
          Remaining balance
        </span>
        <span className="amort-legend-item">
          <span className="amort-legend-line" style={{ background: "var(--color-sage)" }} />
          Total equity
        </span>
        <span className="amort-legend-item">
          <span className="amort-legend-line amort-legend-line--dashed" style={{ background: "var(--color-iris)" }} />
          Total interest paid
        </span>
      </div>
    </div>
  );
}
