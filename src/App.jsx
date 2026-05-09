import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Nav from "./components/Nav";
import Controls from "./components/Controls";
import Heatmap from "./components/Heatmap";
import TabBar from "./components/TabBar";
import AmortizationChart from "./components/AmortizationChart";
import CompareControls from "./components/CompareControls";
import SummaryStats from "./components/SummaryStats";
import ExportButton from "./components/ExportButton";
import PinnedCellsCard from "./components/PinnedCellsCard";
import BreakdownStack from "./components/BreakdownStack";
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
  // Initial state from URL
  const initial = useMemo(() => {
    const { params, extra } = decodeParams(window.location.search, DEFAULT_PARAMS);
    return { params, extra };
  }, []);

  const [params, setParams] = useState(initial.params);
  const [activeTab, setActiveTab] = useState(initial.extra.activeTab || "payment");
  const [valueMode, setValueMode] = useState(initial.extra.valueMode || "monthly");

  const [compareOverrides, setCompareOverrides] = useState(() => ({
    annualRate: Math.max(0.01, initial.params.annualRate - 0.01),
    termYears: initial.params.termYears,
    downPaymentPct: initial.params.downPaymentPct,
  }));

  // Theme — dark default. Light is opt-in via toggle.
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("mortgage-viz-theme");
    return stored === "light" || stored === "dark" ? stored : "dark";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mortgage-viz-theme", theme);
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  // Tab crossfade key
  const [tabKey, setTabKey] = useState(0);
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setTabKey((k) => k + 1);
  }, []);

  // Pinned + selected
  const [pinnedCells, setPinnedCells] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);

  // Drilldown drawer (mobile/tablet — collapsed by default; full-screen modal)
  const [drilldownOpen, setDrilldownOpen] = useState(false);

  // Sidebar / bottom-sheet open state for mobile
  const [controlsOpen, setControlsOpen] = useState(() => window.innerWidth > 900);
  const toggleControls = useCallback(() => setControlsOpen((v) => !v), []);

  // URL sync
  useEffect(() => {
    replaceState(params, { activeTab, valueMode });
  }, [params, activeTab, valueMode]);

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
    if (!isUnpin) {
      setSelectedCell(cell);
    }
  }, []);

  const removePin = useCallback((cell) => {
    setPinnedCells((prev) => prev.filter((p) => !(p.price === cell.price && p.tax === cell.tax)));
    setSelectedCell((prev) =>
      prev && prev.price === cell.price && prev.tax === cell.tax ? null : prev,
    );
  }, []);

  const clearPins = useCallback(() => {
    setPinnedCells([]);
    setSelectedCell(null);
  }, []);

  const prices = useMemo(
    () => linspace(params.priceMin, params.priceMax, GRID_STEPS),
    [params.priceMin, params.priceMax],
  );
  const taxes = useMemo(
    () => linspace(params.taxMin, params.taxMax, GRID_STEPS),
    [params.taxMin, params.taxMax],
  );
  const heatmapData = useMemo(
    () => generateHeatmapData(params, prices, taxes, valueMode),
    [params, prices, taxes, valueMode],
  );

  const handleReset = useCallback(() => {
    setParams(DEFAULT_PARAMS);
    setPinnedCells([]);
    setSelectedCell(null);
  }, []);

  const updateOverride = useCallback((key, value) => {
    setCompareOverrides((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Median cell — fallback for breakdown when nothing is selected.
  const medianCell = useMemo(() => {
    if (!prices.length || !taxes.length) return null;
    return {
      price: prices[Math.floor(prices.length / 2)],
      tax: taxes[Math.floor(taxes.length / 2)],
    };
  }, [prices, taxes]);

  // Share
  const [copyFlash, setCopyFlash] = useState(false);
  const flashTimer = useRef(null);
  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyFlash(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setCopyFlash(false), 1400);
    } catch {
      if (navigator.share) {
        navigator.share({ title: "Mortgage Viz", url: window.location.href }).catch(() => {});
      }
    }
  }, []);

  const compareParams = activeTab === "compare" ? compareOverrides : null;
  const detailCell = selectedCell || medianCell;

  return (
    <div className="app app--tool">
      <Nav
        theme={theme}
        onToggleTheme={toggleTheme}
        onShare={handleShare}
        repoUrl={REPO_URL}
        compact
        slot={<ExportButton containerSelector=".heatmap-container" theme={theme} />}
      />

      <main className={"tool-main" + (controlsOpen ? "" : " tool-main--rail-collapsed")}>
        {controlsOpen && <div className="sheet-backdrop" onClick={toggleControls} />}

        <aside className={`tool-rail tool-rail--left${controlsOpen ? "" : " collapsed"}`}>
          <button
            className="sheet-handle"
            onClick={toggleControls}
            aria-label={controlsOpen ? "Collapse inputs" : "Expand inputs"}
          >
            <span className="sheet-handle-label">
              Inputs
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={controlsOpen ? "M3 5 L6 8 L9 5" : "M3 7 L6 4 L9 7"} />
              </svg>
            </span>
          </button>
          <div className="tool-rail__scroll">
            <Controls
              params={params}
              onChange={setParams}
              onReset={handleReset}
              valueMode={valueMode}
              onValueModeChange={setValueMode}
            />
            {activeTab === "compare" && (
              <CompareControls
                compareOverrides={compareOverrides}
                params={params}
                onChange={updateOverride}
                onReset={() =>
                  setCompareOverrides({
                    annualRate: Math.max(0.01, params.annualRate - 0.01),
                    termYears: params.termYears,
                    downPaymentPct: params.downPaymentPct,
                  })
                }
              />
            )}
          </div>
        </aside>

        <button
          className="rail-toggle rail-toggle--left"
          onClick={toggleControls}
          aria-label={controlsOpen ? "Collapse inputs" : "Expand inputs"}
          title={controlsOpen ? "Collapse inputs" : "Expand inputs"}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d={controlsOpen ? "M10 3 L5 8 L10 13" : "M6 3 L11 8 L6 13"}
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>

        <section className="tool-center">
          <div className="tool-center__topbar">
            <TabBar active={activeTab} onChange={handleTabChange} />
            <SummaryStats data={heatmapData} valueMode={valueMode} />
          </div>

          <div className="tool-viz" key={tabKey}>
            <Heatmap
              params={params}
              data={heatmapData}
              prices={prices}
              taxes={taxes}
              valueMode={valueMode}
              compareParams={compareParams}
              onCellClick={handleCellClick}
              pinnedCells={pinnedCells}
            />
          </div>

          <button
            className="drilldown-toggle"
            onClick={() => setDrilldownOpen(true)}
            aria-label="Open amortization drilldown"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 8h12M8 2v12" />
            </svg>
            Open amortization
          </button>
        </section>

        <aside className="tool-rail tool-rail--right">
          <div className="tool-rail__scroll">
            <BreakdownStack
              params={params}
              selectedCell={selectedCell}
              fallback={medianCell}
            />
            <PinnedCellsCard
              pinnedCells={pinnedCells}
              params={params}
              onRemove={removePin}
              onClear={clearPins}
            />
          </div>
        </aside>
      </main>

      {drilldownOpen && (
        <div
          className="drilldown-modal"
          role="dialog"
          aria-label="Amortization schedule"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrilldownOpen(false);
          }}
        >
          <div className="drilldown-modal__panel">
            <div className="drilldown-modal__header">
              <p className="drilldown-modal__overline">Amortization · 30-year payoff</p>
              <button
                className="icon-btn"
                onClick={() => setDrilldownOpen(false)}
                aria-label="Close drilldown"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 3l10 10M13 3l-10 10" />
                </svg>
              </button>
            </div>
            <AmortizationChart params={params} selectedCell={detailCell} />
          </div>
        </div>
      )}

      <div className={`copy-flash${copyFlash ? " visible" : ""}`} role="status" aria-live="polite">
        {copyFlash ? "URL copied" : ""}
      </div>
    </div>
  );
}
