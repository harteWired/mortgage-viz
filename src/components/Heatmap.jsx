import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import * as d3 from "d3";
import { generateHeatmapData, linspace, rentBoundaryPoints, calcBreakdown, calcTotalMonthly, calcDTI, getDTIBand } from "../utils/mortgage";

const GRID_STEPS = 30;
const MARGIN = { top: 24, right: 90, bottom: 70, left: 100 };

function applyTextHalo(sel) {
  sel
    .attr("paint-order", "stroke")
    .attr("stroke", "rgba(15, 20, 25, 0.9)")
    .attr("stroke-width", 4)
    .attr("stroke-linejoin", "round");
}

function niceTicksForBand(values, targetCount = 5) {
  const min = values[0];
  const max = values[values.length - 1];
  const range = max - min;
  if (range <= 0) return values.map(String);

  const roughStep = range / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const r = roughStep / mag;
  const niceStep = r <= 1.5 ? mag : r <= 3.5 ? 2 * mag : r <= 7.5 ? 5 * mag : 10 * mag;

  const ticks = [];
  const start = Math.ceil(min / niceStep) * niceStep;
  for (let v = start; v <= max; v += niceStep) {
    const closest = values.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
    const s = String(closest);
    if (!ticks.includes(s)) ticks.push(s);
  }
  return ticks;
}

function findLabelPos(points, xScale, yScale, width, height) {
  for (const frac of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    const idx = Math.floor(points.length * frac);
    const p = points[idx];
    if (!p) continue;
    const lx = xScale(p.price);
    const ly = yScale(p.tax);
    if (lx > 60 && lx < width - 60 && ly > 20 && ly < height - 20) {
      return { x: lx, y: ly };
    }
  }
  return null;
}

function mortgagePalette(t) {
  const stops = [
    [0.00, [25, 45, 70]],
    [0.20, [30, 65, 100]],
    [0.40, [30, 90, 110]],
    [0.60, [70, 140, 120]],
    [0.80, [180, 155, 80]],
    [1.00, [201, 165, 92]],
  ];
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1][0] < t) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const f = (t - t0) / (t1 - t0);
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
  return `rgb(${r},${g},${b})`;
}

const DTI_COLORS = {
  comfortable: "rgba(63, 185, 80, 0.0)",
  stretching: "rgba(210, 153, 34, 0.18)",
  maximum: "rgba(219, 109, 40, 0.28)",
  overlimit: "rgba(248, 81, 73, 0.38)",
};

export default function Heatmap({
  params,
  valueMode = "monthly",
  showAffordability = false,
  grossIncome = 100000,
  compareParams = null,
  onCellClick,
  pinnedCells = [],
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const prices = useMemo(
    () => linspace(params.priceMin, params.priceMax, GRID_STEPS),
    [params.priceMin, params.priceMax],
  );

  const taxes = useMemo(
    () => linspace(params.taxMin, params.taxMax, GRID_STEPS),
    [params.taxMin, params.taxMax],
  );

  const data = useMemo(
    () => generateHeatmapData(params, prices, taxes, valueMode),
    [params, prices, taxes, valueMode],
  );

  const boundaryPoints = useMemo(
    () =>
      params.currentRent > 0 && valueMode === "monthly"
        ? rentBoundaryPoints(params, params.taxMin, params.taxMax)
        : [],
    [params, valueMode],
  );

  const compareBoundaryPoints = useMemo(() => {
    if (!compareParams || params.currentRent <= 0) return [];
    // Build a full params object for B: use compareParams overrides on top of A's base
    const fullB = { ...params, ...compareParams };
    return rentBoundaryPoints(fullB, params.taxMin, params.taxMax);
  }, [compareParams, params]);

  const handleCellClick = useCallback((d) => {
    if (onCellClick) onCellClick(d);
  }, [onCellClick]);

  useEffect(() => {
    if (!containerRef.current) return;

    const containerWidth = dimensions.width;
    const containerHeight = dimensions.height;
    const width = containerWidth - MARGIN.left - MARGIN.right;
    const height = containerHeight - MARGIN.top - MARGIN.bottom;

    if (width <= 0 || height <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.attr("width", containerWidth).attr("height", containerHeight);

    // Transition: reuse existing cells where possible
    let g = svg.select("g.chart-g");
    if (g.empty()) {
      svg.selectAll("*").remove();
      svg.append("defs");
      g = svg.append("g").attr("class", "chart-g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
    } else {
      // Clear non-cell elements for redraw (axes, legend, overlays)
      g.selectAll(":not(rect.cell)").remove();
      svg.select("defs").selectAll("*").remove();
    }

    const defs = svg.select("defs");
    const tooltip = d3.select(tooltipRef.current);

    // Scales
    const x = d3.scaleBand().domain(prices.map(String)).range([0, width]).padding(0);
    const y = d3.scaleBand().domain(taxes.map(String)).range([height, 0]).padding(0);

    const payments = data.map((d) => d.payment);
    const paymentMin = d3.min(payments);
    const paymentMax = d3.max(payments);

    const color = d3.scaleSequential().domain([paymentMin, paymentMax]).interpolator(mortgagePalette);

    // Crosshair group
    const crosshairG = g.append("g").attr("class", "crosshair").style("pointer-events", "none");
    const crosshairV = crosshairG.append("line")
      .attr("stroke", "rgba(255,255,255,0.35)").attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3").attr("stroke-linecap", "round").attr("opacity", 0);
    const crosshairH = crosshairG.append("line")
      .attr("stroke", "rgba(255,255,255,0.35)").attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3").attr("stroke-linecap", "round").attr("opacity", 0);

    const fmt = (v) => {
      if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
      if (Math.abs(v) >= 10000) return "$" + (v / 1000).toFixed(0) + "k";
      return "$" + Math.round(v).toLocaleString();
    };
    const fmtFull = (v) => "$" + Math.round(v).toLocaleString();
    const bw = x.bandwidth();
    const bh = y.bandwidth();

    const grossMonthly = grossIncome / 12;

    // Cells with animated transitions
    const cells = g.selectAll("rect.cell").data(data, (d) => `${d.price}-${d.tax}`);

    const cellEnter = cells.enter().append("rect").attr("class", "cell")
      .attr("x", (d) => x(String(d.price)))
      .attr("y", (d) => y(String(d.tax)))
      .attr("width", bw).attr("height", bh).attr("rx", 1)
      .attr("fill", (d) => color(d.payment));

    cells.transition().duration(300).ease(d3.easeCubicOut)
      .attr("x", (d) => x(String(d.price)))
      .attr("y", (d) => y(String(d.tax)))
      .attr("width", bw).attr("height", bh)
      .attr("fill", (d) => color(d.payment));

    cells.exit().transition().duration(150).attr("opacity", 0).remove();

    const allCells = cellEnter.merge(cells);

    // Affordability overlay
    if (showAffordability) {
      const affG = g.append("g").attr("class", "affordability-overlay").style("pointer-events", "none");
      allCells.each(function (d) {
        const dti = calcDTI(d.payment, grossMonthly);
        const band = getDTIBand(dti);
        if (band && band.color !== "comfortable") {
          affG.append("rect")
            .attr("x", x(String(d.price)))
            .attr("y", y(String(d.tax)))
            .attr("width", bw).attr("height", bh)
            .attr("fill", DTI_COLORS[band.color])
            .attr("rx", 1);
        }
      });
    }

    // Compare overlay — second rent boundary line + filled zone between A and B

    // Pinned cell markers
    pinnedCells.forEach((pc, idx) => {
      const px = x(String(pc.price));
      const py = y(String(pc.tax));
      if (px === undefined || py === undefined) return;
      g.append("rect")
        .attr("x", px).attr("y", py).attr("width", bw).attr("height", bh)
        .attr("fill", "none").attr("stroke", "var(--text)").attr("stroke-width", 2.5)
        .attr("rx", 2).style("pointer-events", "none");
      g.append("text")
        .attr("x", px + bw / 2).attr("y", py + bh / 2 + 4)
        .attr("text-anchor", "middle").attr("fill", "var(--text)")
        .attr("font-size", "10px").attr("font-weight", "700")
        .style("pointer-events", "none").text(idx + 1);
    });

    // Build tooltip content
    function buildTooltipHTML(d) {
      const b = calcBreakdown({
        homePrice: d.price, downPaymentPct: params.downPaymentPct,
        annualRate: params.annualRate, termYears: params.termYears,
        annualTax: d.tax, insuranceRate: params.insuranceRate,
        monthlyHOA: params.monthlyHOA,
      });
      let rows =
        `<span>P&amp;I</span><span>${fmtFull(b.pi)}</span>` +
        `<span>Tax</span><span>${fmtFull(b.tax)}</span>` +
        `<span>Insurance</span><span>${fmtFull(b.insurance)}</span>`;
      if (b.hoa > 0) rows += `<span>HOA</span><span>${fmtFull(b.hoa)}</span>`;
      if (b.pmi > 0) rows += `<span>PMI</span><span>${fmtFull(b.pmi)}</span>`;

      const priceLabel = d.price >= 1000000
        ? `$${(d.price / 1e6).toFixed(1)}M`
        : `$${(d.price / 1000).toFixed(0)}k`;

      let extra = "";
      if (showAffordability) {
        const dti = calcDTI(b.total, grossMonthly);
        const band = getDTIBand(dti);
        extra = `<div class="tooltip-dti ${band.color}">DTI: ${(dti * 100).toFixed(1)}% — ${band.label}</div>`;
      }

      if (compareParams) {
        const fullB = { ...params, ...compareParams };
        const bPayment = calcTotalMonthly({ homePrice: d.price, downPaymentPct: fullB.downPaymentPct, annualRate: fullB.annualRate, termYears: fullB.termYears, annualTax: d.tax, insuranceRate: fullB.insuranceRate, monthlyHOA: fullB.monthlyHOA });
        const diff = b.total - bPayment;
        const sign = diff >= 0 ? "+" : "";
        extra += `<div class="tooltip-diff"><span class="tooltip-diff-label">A</span> ${fmtFull(b.total)}/mo &nbsp; <span class="tooltip-diff-label b">B</span> ${fmtFull(bPayment)}/mo &nbsp; <span class="tooltip-diff-delta ${diff >= 0 ? "pos" : "neg"}">${sign}${fmtFull(diff)}</span></div>`;
      }

      const modeLabel = valueMode === "totalCost" ? "Total cost" : valueMode === "totalInterest" ? "Total interest" : "Monthly";

      return (
        `<strong>${fmtFull(d.payment)}${valueMode === "monthly" ? "/mo" : ""}</strong>` +
        (valueMode !== "monthly" ? `<div class="tooltip-mode-label">${modeLabel}</div>` : "") +
        `<div class="breakdown">${rows}</div>` +
        extra +
        `<div class="tooltip-meta">${priceLabel} home · $${d.tax.toLocaleString()}/yr tax</div>`
      );
    }

    // Hover/click handlers
    allCells
      .on("mouseenter", function (event, d) {
        d3.select(this).raise().transition().duration(80)
          .attr("stroke", "#fff").attr("stroke-width", 2);

        const cx = x(String(d.price)) + bw / 2;
        const cy = y(String(d.tax)) + bh / 2;
        crosshairV.attr("x1", cx).attr("x2", cx).attr("y1", 0).attr("y2", height)
          .raise().transition().duration(100).attr("opacity", 0.35);
        crosshairH.attr("x1", 0).attr("x2", width).attr("y1", cy).attr("y2", cy)
          .raise().transition().duration(100).attr("opacity", 0.35);

        tooltip.classed("visible", true).html(buildTooltipHTML(d));
      })
      .on("mousemove", (event) => {
        const containerRect = containerRef.current.getBoundingClientRect();
        const tipNode = tooltipRef.current;
        let tx = event.clientX - containerRect.left + 14;
        let ty = event.clientY - containerRect.top - 14;

        if (tipNode) {
          const tipRect = tipNode.getBoundingClientRect();
          if (tx + tipRect.width > containerRect.width - 8)
            tx = event.clientX - containerRect.left - tipRect.width - 14;
          if (ty + tipRect.height > containerRect.height - 8)
            ty = event.clientY - containerRect.top - tipRect.height - 14;
          if (tx < 8) tx = 8;
          if (ty < 8) ty = 8;
        }
        tooltip.style("left", tx + "px").style("top", ty + "px");
      })
      .on("mouseleave", function () {
        d3.select(this).transition().duration(80).attr("stroke", null).attr("stroke-width", null);
        crosshairV.transition().duration(150).attr("opacity", 0);
        crosshairH.transition().duration(150).attr("opacity", 0);
        tooltip.classed("visible", false);
      })
      .on("click", function (event, d) {
        handleCellClick({ price: d.price, tax: d.tax });
      });

    // Shared linear scales for rent boundary lines
    const xLinear = d3.scaleLinear()
      .domain([prices[0], prices[prices.length - 1]])
      .range([bw / 2, width - bw / 2]);
    const yLinear = d3.scaleLinear()
      .domain([taxes[0], taxes[taxes.length - 1]])
      .range([height - bh / 2, bh / 2]);

    const isComparing = compareBoundaryPoints.length >= 2;

    // Rent boundary line (Scenario A)
    if (boundaryPoints.length >= 2) {
      const visiblePoints = boundaryPoints.filter(
        (d) => d.price >= prices[0] && d.price <= prices[prices.length - 1],
      );

      if (visiblePoints.length >= 2) {
        defs.append("clipPath").attr("id", "chart-clip")
          .append("rect").attr("width", width).attr("height", height);

        const lineGen = d3.line()
          .x((d) => xLinear(d.price)).y((d) => yLinear(d.tax))
          .curve(d3.curveMonotoneY);

        const rentLineG = g.append("g").attr("clip-path", "url(#chart-clip)");

        // Filled zone between A and B when comparing
        if (isComparing) {
          const visibleB = compareBoundaryPoints.filter(
            (d) => d.price >= prices[0] && d.price <= prices[prices.length - 1],
          );
          if (visibleB.length >= 2) {
            // Build paired data for the area fill — match by tax value
            const bByTax = new Map(visibleB.map((p) => [p.tax, p.price]));
            const paired = [];
            for (const p of visiblePoints) {
              const bPrice = bByTax.get(p.tax);
              if (bPrice !== undefined) {
                paired.push({ tax: p.tax, priceA: p.price, priceB: bPrice });
              }
            }

            if (paired.length >= 2) {
              const areaGen = d3.area()
                .x0((d) => xLinear(d.priceA))
                .x1((d) => xLinear(d.priceB))
                .y((d) => yLinear(d.tax))
                .curve(d3.curveMonotoneY);

              rentLineG.append("path").datum(paired).attr("d", areaGen)
                .attr("fill", "url(#compare-zone-gradient)")
                .attr("opacity", 0.2);

              // Gradient for the zone fill
              const zoneGrad = defs.append("linearGradient").attr("id", "compare-zone-gradient")
                .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
              zoneGrad.append("stop").attr("offset", "0%").attr("stop-color", "var(--rent)").attr("stop-opacity", 0.6);
              zoneGrad.append("stop").attr("offset", "50%").attr("stop-color", "#fff").attr("stop-opacity", 0.15);
              zoneGrad.append("stop").attr("offset", "100%").attr("stop-color", "var(--compare)").attr("stop-opacity", 0.6);
            }
          }
        }

        // Shadow + main line for Scenario A
        rentLineG.append("path").datum(visiblePoints).attr("d", lineGen)
          .attr("fill", "none").attr("stroke", "rgba(0,0,0,0.4)")
          .attr("stroke-width", 6).attr("opacity", 0.5);

        rentLineG.append("path").datum(visiblePoints).attr("d", lineGen)
          .attr("fill", "none").attr("stroke", "var(--rent)")
          .attr("stroke-width", 2.5).attr("stroke-linecap", "round");

        // Label for Scenario A line
        const lp = findLabelPos(visiblePoints, xLinear, yLinear, width, height);
        if (lp) {
          const labelText = isComparing
            ? "A — Current"
            : `Rent $${params.currentRent.toLocaleString()}/mo`;
          applyTextHalo(
            rentLineG.append("text")
              .attr("x", lp.x).attr("y", lp.y - 14)
              .attr("fill", "var(--rent)").attr("font-size", "14px").attr("font-weight", "700")
              .text(labelText),
          );
        }

        // Zone annotations (only when NOT comparing — they'd clutter the dual-line view)
        if (!isComparing) {
          const buyIdx = Math.floor(visiblePoints.length * 0.3);
          const bp = visiblePoints[buyIdx];
          if (bp) {
            const bx = xLinear(bp.price);
            const by = yLinear(bp.tax);
            if (bx > 80) {
              applyTextHalo(
                rentLineG.append("text")
                  .attr("x", bx - 18).attr("y", by + 22)
                  .attr("text-anchor", "end").attr("fill", "var(--rent)")
                  .attr("font-size", "12px").attr("font-weight", "600").attr("opacity", 0.8)
                  .text("\u2190 buying wins"),
              );
            }
          }
          const rentIdx = Math.floor(visiblePoints.length * 0.7);
          const rp = visiblePoints[rentIdx];
          if (rp) {
            const rx = xLinear(rp.price);
            const ry = yLinear(rp.tax);
            if (rx < width - 80) {
              applyTextHalo(
                rentLineG.append("text")
                  .attr("x", rx + 18).attr("y", ry - 16)
                  .attr("text-anchor", "start").attr("fill", "var(--rent)")
                  .attr("font-size", "12px").attr("font-weight", "600").attr("opacity", 0.8)
                  .text("renting wins \u2192"),
              );
            }
          }
        }

        // Scenario B rent boundary line
        if (isComparing) {
          const visibleB = compareBoundaryPoints.filter(
            (d) => d.price >= prices[0] && d.price <= prices[prices.length - 1],
          );
          if (visibleB.length >= 2) {
            const lineGenB = d3.line()
              .x((d) => xLinear(d.price)).y((d) => yLinear(d.tax))
              .curve(d3.curveMonotoneY);

            rentLineG.append("path").datum(visibleB).attr("d", lineGenB)
              .attr("fill", "none").attr("stroke", "rgba(0,0,0,0.4)")
              .attr("stroke-width", 6).attr("opacity", 0.5);

            rentLineG.append("path").datum(visibleB).attr("d", lineGenB)
              .attr("fill", "none").attr("stroke", "var(--compare)")
              .attr("stroke-width", 2.5).attr("stroke-linecap", "round")
              .attr("stroke-dasharray", "8,4");

            const lpB = findLabelPos(visibleB, xLinear, yLinear, width, height);
            if (lpB) {
              applyTextHalo(
                rentLineG.append("text")
                  .attr("x", lpB.x).attr("y", lpB.y + 22)
                  .attr("fill", "var(--compare)").attr("font-size", "14px").attr("font-weight", "700")
                  .text("B — What if?"),
              );
            }
          }
        }
      }
    }

    // X axis
    const xTickValues = niceTicksForBand(prices);
    const xAxisG = g.append("g").attr("transform", `translate(0,${height})`).call(
      d3.axisBottom(x).tickValues(xTickValues)
        .tickFormat((d) => `$${(+d / 1000).toFixed(0)}k`),
    );
    xAxisG.select(".domain").remove();
    xAxisG.selectAll("text").attr("fill", "var(--text)").attr("font-size", "13px");
    xAxisG.selectAll(".tick line").attr("stroke", "var(--border)").attr("y2", 8);

    g.append("text").attr("x", width / 2).attr("y", height + 54)
      .attr("text-anchor", "middle").attr("fill", "var(--text-muted)")
      .attr("font-size", "13px").attr("font-weight", "500").text("Home Price");

    // Y axis
    const yTickValues = niceTicksForBand(taxes);
    const yAxisG = g.append("g").call(
      d3.axisLeft(y).tickValues(yTickValues)
        .tickFormat((d) => `$${(+d / 1000).toFixed(1)}k`),
    );
    yAxisG.select(".domain").remove();
    yAxisG.selectAll("text").attr("fill", "var(--text)").attr("font-size", "13px");
    yAxisG.selectAll(".tick line").attr("stroke", "var(--border)").attr("x2", -8);

    g.append("text").attr("transform", "rotate(-90)")
      .attr("x", -height / 2).attr("y", -75)
      .attr("text-anchor", "middle").attr("fill", "var(--text-muted)")
      .attr("font-size", "13px").attr("font-weight", "500").text("Annual Property Tax");

    // Color legend
    const legendWidth = 16;
    const legendHeight = height;
    const legendX = width + 24;

    const legendScale = d3.scaleLinear().domain([paymentMin, paymentMax]).range([legendHeight, 0]);

    const gradient = defs.append("linearGradient").attr("id", "legend-gradient")
      .attr("x1", "0%").attr("y1", "100%").attr("x2", "0%").attr("y2", "0%");

    const nStops = Math.max(30, Math.ceil(legendHeight / 8));
    for (let i = 0; i <= nStops; i++) {
      const t = i / nStops;
      const val = paymentMin + t * (paymentMax - paymentMin);
      gradient.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", color(val));
    }

    const legendG = g.append("g").attr("transform", `translate(${legendX}, 0)`);

    const modeLabels = { monthly: "$/mo", totalCost: "Total $", totalInterest: "Int $" };
    legendG.append("text").attr("x", legendWidth / 2).attr("y", -10)
      .attr("text-anchor", "middle").attr("fill", "var(--text)")
      .attr("font-size", "12px").attr("font-weight", "600")
      .text(modeLabels[valueMode] || "$/mo");

    legendG.append("rect").attr("width", legendWidth).attr("height", legendHeight)
      .attr("rx", 4).style("fill", "url(#legend-gradient)");

    const legendFmt = (d) => {
      if (d >= 1e6) return `$${(d / 1e6).toFixed(1)}M`;
      if (d >= 10000) return `$${(d / 1000).toFixed(0)}k`;
      return `$${(d / 1000).toFixed(1)}k`;
    };

    const legendAxis = d3.axisRight(legendScale).ticks(5).tickFormat(legendFmt);
    const legendAxisG = legendG.append("g").attr("transform", `translate(${legendWidth}, 0)`).call(legendAxis);
    legendAxisG.select(".domain").remove();
    legendAxisG.selectAll("text").attr("fill", "var(--text)").attr("font-size", "12px");
    legendAxisG.selectAll(".tick line").attr("stroke", "var(--border)");

    // Touch support
    const svgEl = svgRef.current;
    let activeCell = null;

    function cellFromTouch(touch) {
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      return el && el.classList.contains("cell") ? el : null;
    }

    function showTouchCell(cell, touch) {
      if (!cell) return;
      const d = d3.select(cell).datum();
      if (!d) return;

      d3.select(cell).raise().attr("stroke", "#fff").attr("stroke-width", 2);
      const cx = x(String(d.price)) + bw / 2;
      const cy = y(String(d.tax)) + bh / 2;
      crosshairV.attr("x1", cx).attr("x2", cx).attr("y1", 0).attr("y2", height).attr("opacity", 0.35);
      crosshairH.attr("x1", 0).attr("x2", width).attr("y1", cy).attr("y2", cy).attr("opacity", 0.35);

      const containerRect = containerRef.current.getBoundingClientRect();
      tooltip.classed("visible", true).html(buildTooltipHTML(d));

      let tx = touch.clientX - containerRect.left + 14;
      let ty = touch.clientY - containerRect.top - 60;
      const tipNode = tooltipRef.current;
      if (tipNode) {
        const tipRect = tipNode.getBoundingClientRect();
        if (tx + tipRect.width > containerRect.width - 8)
          tx = touch.clientX - containerRect.left - tipRect.width - 14;
        if (ty < 8) ty = touch.clientY - containerRect.top + 24;
      }
      tooltip.style("left", tx + "px").style("top", ty + "px");
    }

    function clearTouch() {
      if (activeCell) {
        d3.select(activeCell).attr("stroke", null).attr("stroke-width", null);
        activeCell = null;
      }
      crosshairV.attr("opacity", 0);
      crosshairH.attr("opacity", 0);
      tooltip.classed("visible", false);
    }

    function onTouchStart(e) {
      const cell = cellFromTouch(e.touches[0]);
      if (cell) { e.preventDefault(); activeCell = cell; showTouchCell(cell, e.touches[0]); }
    }
    function onTouchMove(e) {
      if (!activeCell && !cellFromTouch(e.touches[0])) return;
      e.preventDefault();
      const cell = cellFromTouch(e.touches[0]);
      if (cell !== activeCell) {
        if (activeCell) d3.select(activeCell).attr("stroke", null).attr("stroke-width", null);
        activeCell = cell;
      }
      if (cell) showTouchCell(cell, e.touches[0]);
      else clearTouch();
    }
    function onTouchEnd() { clearTouch(); }

    svgEl.addEventListener("touchstart", onTouchStart, { passive: false });
    svgEl.addEventListener("touchmove", onTouchMove, { passive: false });
    svgEl.addEventListener("touchend", onTouchEnd);

    return () => {
      svgEl.removeEventListener("touchstart", onTouchStart);
      svgEl.removeEventListener("touchmove", onTouchMove);
      svgEl.removeEventListener("touchend", onTouchEnd);
    };
  }, [data, prices, taxes, dimensions, boundaryPoints, compareBoundaryPoints, params, compareParams, valueMode, showAffordability, grossIncome, pinnedCells, handleCellClick]);

  return (
    <div className="heatmap-container" ref={containerRef}>
      <svg ref={svgRef}></svg>
      <div className="tooltip" ref={tooltipRef}></div>
      {pinnedCells.length === 0 && (
        <div className="heatmap-hint">Click a cell to pin it for comparison</div>
      )}
    </div>
  );
}

// Re-export data generator for SummaryStats
export { generateHeatmapData };
