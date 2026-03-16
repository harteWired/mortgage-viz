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

  // Aggregate to yearly
  const yearly = useMemo(() => {
    if (!schedule.length) return [];
    const years = [];
    for (let y = 1; y <= params.termYears; y++) {
      const months = schedule.filter((m) => m.year === y);
      years.push({
        year: y,
        principal: d3.sum(months, (m) => m.principal),
        interest: d3.sum(months, (m) => m.interest),
        tax: d3.sum(months, (m) => m.tax),
        insurance: d3.sum(months, (m) => m.insurance),
        hoa: d3.sum(months, (m) => m.hoa),
        pmi: d3.sum(months, (m) => m.pmi),
        balance: months[months.length - 1].balance,
        totalEquity: months[months.length - 1].totalEquity,
        totalInterest: months[months.length - 1].totalInterest,
      });
    }
    return years;
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
      balance: "#e94560",
      equity: "#00e5ff",
      interest: "#f0a030",
    };

    const line = d3.line().x((d) => x(d.year)).curve(d3.curveMonotoneX);

    // Balance line
    g.append("path")
      .datum(yearly)
      .attr("d", line.y((d) => y(d.balance)))
      .attr("fill", "none")
      .attr("stroke", colors.balance)
      .attr("stroke-width", 2.5);

    // Equity line
    g.append("path")
      .datum(yearly)
      .attr("d", line.y((d) => y(d.totalEquity)))
      .attr("fill", "none")
      .attr("stroke", colors.equity)
      .attr("stroke-width", 2.5);

    // Total interest line
    g.append("path")
      .datum(yearly)
      .attr("d", line.y((d) => y(d.totalInterest)))
      .attr("fill", "none")
      .attr("stroke", colors.interest)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6,3");

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
        .attr("fill", "var(--text-muted)").attr("font-size", "9px")
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
            <span>Total paid: <strong>{fmt(lastYear.totalInterest + selectedCell.price * (1 - params.downPaymentPct))}</strong></span>
          </div>
        )}
      </div>
      <svg ref={svgRef}></svg>
    </div>
  );
}
