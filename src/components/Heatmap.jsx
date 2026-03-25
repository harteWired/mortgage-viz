import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import * as d3 from "d3";
import { rentBoundaryPoints, calcTotalMonthly, calcDTI, getDTIBand } from "../utils/mortgage";
const MARGIN_DESKTOP = { top: 24, right: 90, bottom: 70, left: 100 };
const MARGIN_MOBILE = { top: 16, right: 50, bottom: 50, left: 60 };

function applyTextHalo(sel) {
  sel
    .attr("paint-order", "stroke")
    .attr("stroke", "rgba(205, 200, 190, 0.9)")
    .attr("stroke-width", 5)
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

// OKLCH → sRGB conversion (so D3 transitions can parse the output)
function oklchToRgb(L, C, H) {
  const hRad = H * Math.PI / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
  // OKLab to LMS (cube root domain)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  // LMS to linear sRGB
  let rl = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let gl = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  // Gamma compress
  const gamma = (x) => x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x;
  const clamp = (x) => Math.round(Math.max(0, Math.min(1, gamma(Math.max(0, x)))) * 255);
  return `rgb(${clamp(rl)},${clamp(gl)},${clamp(bl)})`;
}

// Perceptually uniform palette — interpolates in OKLCH, outputs rgb for D3
// Cool teal → sage green → warm gold → terracotta → deep rust
function mortgagePalette(t) {
  const stops = [
    [0.00, [0.44, 0.06, 220]],  // deep teal
    [0.15, [0.50, 0.06, 195]],  // muted teal-green
    [0.35, [0.58, 0.07, 145]],  // sage green
    [0.55, [0.68, 0.08, 85]],   // warm gold
    [0.75, [0.58, 0.11, 55]],   // terracotta
    [0.90, [0.48, 0.13, 35]],   // burnt sienna
    [1.00, [0.40, 0.13, 25]],   // deep rust
  ];
  let i = 0;
  while (i < stops.length - 2 && stops[i + 1][0] < t) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const f = (t - t0) / (t1 - t0);

  // Interpolate in OKLCH, handling hue wrap
  const L = c0[0] + (c1[0] - c0[0]) * f;
  const C = c0[1] + (c1[1] - c0[1]) * f;
  let dH = c1[2] - c0[2];
  if (dH > 180) dH -= 360;
  if (dH < -180) dH += 360;
  const H = c0[2] + dH * f;

  return oklchToRgb(L, C, H);
}

const DTI_COLORS = {
  comfortable: "rgba(92, 122, 77, 0.0)",
  stretching: "rgba(176, 141, 87, 0.2)",
  maximum: "rgba(184, 90, 56, 0.25)",
  overlimit: "rgba(139, 69, 52, 0.35)",
};

export default function Heatmap({
  params,
  data,
  prices,
  taxes,
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
    const isMobile = containerWidth < 500;
    const MARGIN = isMobile ? MARGIN_MOBILE : MARGIN_DESKTOP;
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
    const x = d3.scaleBand().domain(prices.map(String)).range([0, width]).padding(0.03);
    const y = d3.scaleBand().domain(taxes.map(String)).range([height, 0]).padding(0.03);

    const payments = data.map((d) => d.payment);
    const paymentMin = d3.min(payments);
    const paymentMax = d3.max(payments);

    const color = d3.scaleSequential().domain([paymentMin, paymentMax]).interpolator(mortgagePalette);

    // Crosshair group
    const crosshairG = g.append("g").attr("class", "crosshair").style("pointer-events", "none");
    const crosshairV = crosshairG.append("line")
      .attr("stroke", "rgba(46, 42, 36, 0.35)").attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3").attr("stroke-linecap", "round").attr("opacity", 0);
    const crosshairH = crosshairG.append("line")
      .attr("stroke", "rgba(46, 42, 36, 0.35)").attr("stroke-width", 1)
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
      const affData = data.filter((d) => {
        const dti = calcDTI(d.payment, grossMonthly);
        const band = getDTIBand(dti);
        return band && band.color !== "comfortable";
      });
      const affG = g.append("g").attr("class", "affordability-overlay").style("pointer-events", "none");
      affG.selectAll("rect").data(affData, (d) => `${d.price}-${d.tax}`).join("rect")
        .attr("x", (d) => x(String(d.price)))
        .attr("y", (d) => y(String(d.tax)))
        .attr("width", bw).attr("height", bh)
        .attr("fill", (d) => {
          const dti = calcDTI(d.payment, grossMonthly);
          const band = getDTIBand(dti);
          return DTI_COLORS[band.color];
        })
        .attr("rx", 1);
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

    // Build tooltip content (uses breakdown fields stored in cell data)
    function buildTooltipHTML(d) {
      let rows =
        `<span>P&amp;I</span><span>${fmtFull(d.pi)}</span>` +
        `<span>Tax</span><span>${fmtFull(d.monthlyTax)}</span>` +
        `<span>Insurance</span><span>${fmtFull(d.insurance)}</span>`;
      if (d.hoa > 0) rows += `<span>HOA</span><span>${fmtFull(d.hoa)}</span>`;
      if (d.pmi > 0) rows += `<span>PMI</span><span>${fmtFull(d.pmi)}</span>`;

      const priceLabel = d.price >= 1000000
        ? `$${(d.price / 1e6).toFixed(1)}M`
        : `$${(d.price / 1000).toFixed(0)}k`;

      let extra = "";
      if (showAffordability) {
        const dti = calcDTI(d.total, grossMonthly);
        const band = getDTIBand(dti);
        extra = `<div class="tooltip-dti ${band.color}">DTI: ${(dti * 100).toFixed(1)}% — ${band.label}</div>`;
      }

      if (compareParams) {
        const fullB = { ...params, ...compareParams };
        const bPayment = calcTotalMonthly({ homePrice: d.price, downPaymentPct: fullB.downPaymentPct, annualRate: fullB.annualRate, termYears: fullB.termYears, annualTax: d.tax, insuranceRate: fullB.insuranceRate, monthlyHOA: fullB.monthlyHOA });
        const diff = d.total - bPayment;
        const sign = diff >= 0 ? "+" : "-";
        extra += `<div class="tooltip-diff"><span class="tooltip-diff-label">A</span> ${fmtFull(d.total)}/mo &nbsp; <span class="tooltip-diff-label b">B</span> ${fmtFull(bPayment)}/mo &nbsp; <span class="tooltip-diff-delta ${diff >= 0 ? "pos" : "neg"}">${sign}${fmtFull(Math.abs(diff))}</span></div>`;
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
        d3.select(this).transition().duration(80)
          .attr("stroke", "#2e2a24").attr("stroke-width", 2);

        const cx = x(String(d.price)) + bw / 2;
        const cy = y(String(d.tax)) + bh / 2;
        crosshairV.attr("x1", cx).attr("x2", cx).attr("y1", 0).attr("y2", height)
          .transition().duration(100).attr("opacity", 0.35);
        crosshairH.attr("x1", 0).attr("x2", width).attr("y1", cy).attr("y2", cy)
          .transition().duration(100).attr("opacity", 0.35);

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

        // Compute visibleB once for reuse in zone fill and line drawing
        const visibleB = isComparing
          ? compareBoundaryPoints.filter(
              (d) => d.price >= prices[0] && d.price <= prices[prices.length - 1],
            )
          : [];

        // Filled zone between A and B when comparing
        if (isComparing && visibleB.length >= 2) {
          // Define gradient BEFORE the path that references it
          const zoneGrad = defs.append("linearGradient").attr("id", "compare-zone-gradient")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
          zoneGrad.append("stop").attr("offset", "0%").attr("stop-color", "var(--rent)").attr("stop-opacity", 0.6);
          zoneGrad.append("stop").attr("offset", "50%").attr("stop-color", "#fff").attr("stop-opacity", 0.15);
          zoneGrad.append("stop").attr("offset", "100%").attr("stop-color", "var(--compare)").attr("stop-opacity", 0.6);

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
              .attr("fill", "var(--rent)").attr("font-size", isMobile ? "11px" : "14px").attr("font-weight", "700")
              .text(labelText),
          );
        }

        // Zone annotations (only when NOT comparing — they'd clutter the dual-line view)
        if (!isComparing && !isMobile) {
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
        if (isComparing && visibleB.length >= 2) {
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

    // Responsive font sizes
    const axisFontSize = isMobile ? "10px" : "13px";
    const labelFontSize = isMobile ? "10px" : "13px";
    const legendFontSize = isMobile ? "10px" : "12px";
    const axisTickCount = isMobile ? 4 : 5;

    // X axis
    const xTickValues = niceTicksForBand(prices, axisTickCount);
    const xAxisG = g.append("g").attr("transform", `translate(0,${height})`).call(
      d3.axisBottom(x).tickValues(xTickValues)
        .tickFormat((d) => `$${(+d / 1000).toFixed(0)}k`),
    );
    xAxisG.select(".domain").remove();
    xAxisG.selectAll("text").attr("fill", "var(--text)").attr("font-size", axisFontSize);
    xAxisG.selectAll(".tick line").attr("stroke", "var(--border)").attr("y2", 8);

    g.append("text").attr("x", width / 2).attr("y", height + (isMobile ? 38 : 54))
      .attr("text-anchor", "middle").attr("fill", "var(--text-muted)")
      .attr("font-size", labelFontSize).attr("font-weight", "500").text("Home Price");

    // Y axis
    const yTickValues = niceTicksForBand(taxes, axisTickCount);
    const yAxisG = g.append("g").call(
      d3.axisLeft(y).tickValues(yTickValues)
        .tickFormat((d) => `$${(+d / 1000).toFixed(isMobile ? 0 : 1)}k`),
    );
    yAxisG.select(".domain").remove();
    yAxisG.selectAll("text").attr("fill", "var(--text)").attr("font-size", axisFontSize);
    yAxisG.selectAll(".tick line").attr("stroke", "var(--border)").attr("x2", -8);

    g.append("text").attr("transform", "rotate(-90)")
      .attr("x", -height / 2).attr("y", isMobile ? -42 : -75)
      .attr("text-anchor", "middle").attr("fill", "var(--text-muted)")
      .attr("font-size", labelFontSize).attr("font-weight", "500").text(isMobile ? "Property Tax" : "Annual Property Tax");

    // Color legend
    const legendWidth = isMobile ? 12 : 16;
    const legendHeight = height;
    const legendX = width + (isMobile ? 10 : 24);

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
      .attr("font-size", legendFontSize).attr("font-weight", "600")
      .text(modeLabels[valueMode] || "$/mo");

    legendG.append("rect").attr("width", legendWidth).attr("height", legendHeight)
      .attr("rx", 4).style("fill", "url(#legend-gradient)");

    const legendFmt = (d) => {
      if (d >= 1e6) return `$${(d / 1e6).toFixed(1)}M`;
      if (d >= 10000) return `$${(d / 1000).toFixed(0)}k`;
      return `$${(d / 1000).toFixed(1)}k`;
    };

    const legendAxis = d3.axisRight(legendScale).ticks(isMobile ? 3 : 5).tickFormat(legendFmt);
    const legendAxisG = legendG.append("g").attr("transform", `translate(${legendWidth}, 0)`).call(legendAxis);
    legendAxisG.select(".domain").remove();
    legendAxisG.selectAll("text").attr("fill", "var(--text)").attr("font-size", legendFontSize);
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

      d3.select(cell).attr("stroke", "#2e2a24").attr("stroke-width", 2);
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
