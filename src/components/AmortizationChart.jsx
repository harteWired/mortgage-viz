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
    const containerHeight = Math.min(280, containerRef.current.clientHeight || 280);
    const margin = { top: 20, right: 80, bottom: 36, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", containerWidth).attr("height", containerHeight);

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

    const colors = {
      balance: "#8b4534",
      equity: "#3d5a68",
      interest: "#b08d57",
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

    // Legend
    const legendData = [
      { label: "Remaining Balance", color: colors.balance, dash: null },
      { label: "Total Equity", color: colors.equity, dash: null },
      { label: "Total Interest Paid", color: colors.interest, dash: "6,3" },
    ];
    const lg = g.append("g").attr("transform", `translate(${width + 12}, 0)`);
    legendData.forEach((d, i) => {
      const row = lg.append("g").attr("transform", `translate(0, ${i * 18})`);
      row.append("line")
        .attr("x1", 0).attr("x2", 16).attr("y1", 5).attr("y2", 5)
        .attr("stroke", d.color).attr("stroke-width", 2)
        .attr("stroke-dasharray", d.dash);
      row.append("text")
        .attr("x", 20).attr("y", 9)
        .attr("fill", "var(--text-muted)").attr("font-size", "10px")
        .text(d.label);
    });
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
        <h3>Amortization — {fmt(selectedCell.price)} home, {fmt(selectedCell.tax)}/yr tax</h3>
        {lastYear && (
          <div className="amort-stats">
            <span>Total interest: <strong>{fmt(lastYear.totalInterest)}</strong></span>
            <span>Total paid: <strong>{fmt(d3.sum(schedule, (m) => m.totalPayment))}</strong></span>
          </div>
        )}
      </div>
      <svg ref={svgRef}></svg>
    </div>
  );
}
