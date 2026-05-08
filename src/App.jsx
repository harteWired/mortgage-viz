import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Thesis from "./components/Thesis";
import Controls from "./components/Controls";
import Heatmap from "./components/Heatmap";
import TabBar from "./components/TabBar";
import AmortizationChart from "./components/AmortizationChart";
import AffordabilityControls from "./components/AffordabilityControls";
import CompareControls from "./components/CompareControls";
import SummaryStats from "./components/SummaryStats";
import ExportButton from "./components/ExportButton";
import PinnedCellsCard from "./components/PinnedCellsCard";
import BreakdownStack from "./components/BreakdownStack";
import Methodology from "./components/Methodology";
import Footer from "./components/Footer";
import { generateHeatmapData, linspace, GRID_STEPS } from "./utils/mortgage";
import { decodeParams, replaceState } from "./utils/urlState";
import "./styles/index.css";

const DEFAULT_PARAMS = {
  annualRate: 0.065,
  termYears: 30,
  downPaymentPct: 0.2,
  insuranceRate: 0.005,
  monthlyHOA: 0,
  currentRent: 2500,
  priceMin: 100000,
  priceMax: 800000,
  taxMin: 1000,
  taxMax: 15000,
};

const REPO_URL = "https://github.com/harteWired/mortgage-viz";

export default function App() {
  // Load initial state from URL
  const initial = useMemo(() => {
    const { params, extra } = decodeParams(window.location.search, DEFAULT_PARAMS);
    return { params, extra };
  }, []);

  const [params, setParams] = useState(initial.params);
  const [activeTab, setActiveTab] = useState(initial.extra.activeTab || "payment");
  const [valueMode, setValueMode] = useState(initial.extra.valueMode || "monthly");
  const [grossIncome, setGrossIncome] = useState(initial.extra.grossIncome ?? 100000);

  // Scenario B overrides for compare tab
  const [compareOverrides, setCompareOverrides] = useState(() => ({
    annualRate: Math.max(0.01, initial.params.annualRate - 0.01),
    termYears: initial.params.termYears,
    downPaymentPct: initial.params.downPaymentPct,
  }));

  // Theme — dark default for v2 editorial. Light is opt-in via toggle.
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("mortgage-viz-theme");
    if (stored === "light" || stored === "dark") return stored;
    return "dark";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mortgage-viz-theme", theme);
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => t === "dark" ? "light" : "dark"), []);

  // Tab crossfade key
  const [tabKey, setTabKey] = useState(0);
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setTabKey((k) => k + 1);
  }, []);

  // Pinned cells (click-to-pin)
  const [pinnedCells, setPinnedCells] = useState([]);
  // Selected cell for amortization + breakdown
  const [selectedCell, setSelectedCell] = useState(null);

  // Refs for smooth scroll-to-section
  const toolRef = useRef(null);
  const drilldownRef = useRef(null);

  // Sync state to URL (replaceState — no history entries per slider drag)
  useEffect(() => {
    replaceState(params, { activeTab, valueMode, grossIncome });
  }, [params, activeTab, valueMode, grossIncome]);

  const handleCellClick = useCallback((cell) => {
    let isUnpin = false;
    setPinnedCells((prev) => {
      const exists = prev.findIndex((p) => p.price === cell.price && p.tax === cell.tax);
      if (exists >= 0) {
        isUnpin = true;
        return prev.filter((_, i) => i !== exists);
      }
      if (prev.length >= 5) return [...prev.slice(1), cell];
      return [...prev, cell];
    });

    // Only set selection + scroll on add/replace. Un-pinning shouldn't
    // jump the page to a drilldown showing the cell the user just
    // removed.
    if (!isUnpin) {
      setSelectedCell(cell);
      if (drilldownRef.current) {
        window.requestAnimationFrame(() => {
          drilldownRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }
  }, []);

  const removePin = useCallback((cell) => {
    setPinnedCells((prev) => prev.filter((p) => !(p.price === cell.price && p.tax === cell.tax)));
    // Keep drilldown in sync — if the removed pin is what the
    // drilldown is showing, fall back to the median cell.
    setSelectedCell((prev) =>
      prev && prev.price === cell.price && prev.tax === cell.tax ? null : prev,
    );
  }, []);

  const clearPins = useCallback(() => {
    setPinnedCells([]);
    setSelectedCell(null);
  }, []);

  // Heatmap data
  const prices = useMemo(() => linspace(params.priceMin, params.priceMax, GRID_STEPS), [params.priceMin, params.priceMax]);
  const taxes = useMemo(() => linspace(params.taxMin, params.taxMax, GRID_STEPS), [params.taxMin, params.taxMax]);
  const heatmapData = useMemo(() => generateHeatmapData(params, prices, taxes, valueMode), [params, prices, taxes, valueMode]);

  const handleReset = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setPinnedCells([]);
    setSelectedCell(null);
  }, []);

  const updateOverride = useCallback((key, value) => {
    setCompareOverrides((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Scroll-to-tool from hero CTA
  const scrollToTool = useCallback(() => {
    if (toolRef.current) {
      toolRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Share — copy URL with copy-flash feedback
  const [copyFlash, setCopyFlash] = useState(false);
  const flashTimer = useRef(null);
  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setCopyFlash(false), 1400);
    } catch {
      // Fallback — open share sheet if available
      if (navigator.share) {
        navigator.share({ title: "Mortgage Viz", url: window.location.href }).catch(() => {});
      }
    }
  }, []);

  // Median cell (for default breakdown when nothing selected). Depend
  // only on the axes — pulling heatmapData into the deps would mint a
  // fresh object every valueMode flip and bust downstream useMemo hooks.
  const medianCell = useMemo(() => {
    if (!prices.length || !taxes.length) return null;
    const midPrice = prices[Math.floor(prices.length / 2)];
    const midTax = taxes[Math.floor(taxes.length / 2)];
    return { price: midPrice, tax: midTax };
  }, [prices, taxes]);

  const showAffordability = activeTab === "affordability";
  const compareParams = activeTab === "compare" ? compareOverrides : null;

  return (
    <div className="app">
      <Nav theme={theme} onToggleTheme={toggleTheme} onShare={handleShare} repoUrl={REPO_URL} />

      <main>
        <Hero onScrollToTool={scrollToTool} />

        <Thesis />

        <section className="heatmap-section" id="tool" ref={toolRef}>
          <div className="heatmap-section__inner">
            <div className="heatmap-section__header">
              <div>
                <p className="heatmap-section__overline">The grid</p>
                <h2 className="heatmap-section__title">
                  Every plausible <em>monthly</em>, on one canvas
                </h2>
              </div>
              <div className="heatmap-section__actions">
                <ExportButton containerSelector=".heatmap-container" theme={theme} />
              </div>
            </div>

            <TabBar active={activeTab} onChange={handleTabChange} />

            <div className="heatmap-layout">
              <div className="heatmap-main">
                <SummaryStats data={heatmapData} valueMode={valueMode} />

                <div className="tab-content" key={tabKey}>
                  <Heatmap
                    params={params}
                    data={heatmapData}
                    prices={prices}
                    taxes={taxes}
                    valueMode={valueMode}
                    showAffordability={showAffordability}
                    grossIncome={grossIncome}
                    compareParams={compareParams}
                    onCellClick={handleCellClick}
                    pinnedCells={pinnedCells}
                  />
                </div>

                {showAffordability && (
                  <div className="module-card">
                    <p className="module-card__title rent">Affordability — DTI overlay</p>
                    <AffordabilityControls grossIncome={grossIncome} onChange={setGrossIncome} />
                  </div>
                )}

                {activeTab === "compare" && (
                  <div className="module-card">
                    <p className="module-card__title compare">Scenario B — what-if</p>
                    <CompareControls
                      compareOverrides={compareOverrides}
                      params={params}
                      onChange={updateOverride}
                      onReset={() => setCompareOverrides({
                        annualRate: Math.max(0.01, params.annualRate - 0.01),
                        termYears: params.termYears,
                        downPaymentPct: params.downPaymentPct,
                      })}
                    />
                  </div>
                )}

                <div className="controls-card">
                  <p className="controls-card__title">Inputs</p>
                  <Controls
                    params={params}
                    onChange={setParams}
                    onReset={handleReset}
                    valueMode={valueMode}
                    onValueModeChange={setValueMode}
                  />
                </div>
              </div>

              <aside className="heatmap-rail">
                <PinnedCellsCard
                  pinnedCells={pinnedCells}
                  params={params}
                  onRemove={removePin}
                  onClear={clearPins}
                />
              </aside>
            </div>
          </div>
        </section>

        <section className="drilldown" id="drilldown" ref={drilldownRef}>
          <div className="drilldown__inner">
            <p className="drilldown__overline">Cell drilldown</p>
            <h2 className="drilldown__title">
              Thirty years of <em>this</em> payment
            </h2>
            <div className="drilldown__grid">
              <BreakdownStack
                params={params}
                selectedCell={selectedCell}
                fallback={medianCell}
              />
              <AmortizationChart
                params={params}
                selectedCell={selectedCell || medianCell}
              />
            </div>
          </div>
        </section>

        <Methodology />

        <Footer repoUrl={REPO_URL} />
      </main>

      <div className={`copy-flash${copyFlash ? " visible" : ""}`} role="status" aria-live="polite">
        {copyFlash ? "URL copied" : ""}
      </div>
    </div>
  );
}
