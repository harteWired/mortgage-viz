import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Controls from "./components/Controls";
import Heatmap from "./components/Heatmap";
import TabBar from "./components/TabBar";
import AmortizationChart from "./components/AmortizationChart";
import AffordabilityControls from "./components/AffordabilityControls";
import CompareControls from "./components/CompareControls";
import SummaryStats from "./components/SummaryStats";
import ExportButton from "./components/ExportButton";
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

  // Scenario B overrides for compare tab (only the fields that differ from A)
  const [compareOverrides, setCompareOverrides] = useState(() => ({
    annualRate: Math.max(0.01, initial.params.annualRate - 0.01),
    termYears: initial.params.termYears,
    downPaymentPct: initial.params.downPaymentPct,
  }));

  // Dark mode
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("mortgage-viz-theme");
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mortgage-viz-theme", theme);
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => t === "dark" ? "light" : "dark"), []);

  // Controls panel open/close — start collapsed on mobile
  const [controlsOpen, setControlsOpen] = useState(() => window.innerWidth > 700);
  const toggleControls = useCallback(() => setControlsOpen((v) => !v), []);

  // Tab crossfade key
  const [tabKey, setTabKey] = useState(0);
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setTabKey((k) => k + 1);
  }, []);

  // Pinned cells (click-to-pin)
  const [pinnedCells, setPinnedCells] = useState([]);
  // Selected cell for amortization
  const [selectedCell, setSelectedCell] = useState(null);

  // Sync state to URL (replaceState — no history entries per slider drag)
  useEffect(() => {
    replaceState(params, { activeTab, valueMode, grossIncome });
  }, [params, activeTab, valueMode, grossIncome]);

  const handleCellClick = useCallback((cell) => {
    // For amortization tab, select cell
    if (activeTab === "amortization") {
      setSelectedCell(cell);
      return;
    }
    // For other tabs, toggle pin
    setPinnedCells((prev) => {
      const exists = prev.findIndex((p) => p.price === cell.price && p.tax === cell.tax);
      if (exists >= 0) return prev.filter((_, i) => i !== exists);
      if (prev.length >= 5) return [...prev.slice(1), cell];
      return [...prev, cell];
    });
  }, [activeTab]);

  const clearPins = useCallback(() => setPinnedCells([]), []);

  // Heatmap data for summary stats
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

  const showAffordability = activeTab === "affordability";
  const compareParams = activeTab === "compare" ? compareOverrides : null;

  return (
    <div className="app">
      <header>
        <div className="header-top">
          <div className="header-brand">
            <img src={import.meta.env.BASE_URL + "icon.svg"} alt="" className="header-icon" width="36" height="36" />
            <div>
              <h1>Mortgage <em>Viz</em></h1>
              <p>Explore how home price and property tax affect your monthly payment</p>
            </div>
          </div>
          <div className="header-actions">
            {pinnedCells.length > 0 && (
              <button className="clear-pins-btn" onClick={clearPins}>
                Clear {pinnedCells.length} pin{pinnedCells.length > 1 ? "s" : ""}
              </button>
            )}
            <ExportButton containerSelector=".heatmap-container" theme={theme} />
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode" title="Toggle dark mode">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {theme === "dark"
                  ? <circle cx="8" cy="8" r="4" />
                  : <path d="M13.5 8.5a5.5 5.5 0 0 1-6-6 5.5 5.5 0 1 0 6 6z" />}
              </svg>
            </button>
          </div>
        </div>
        <TabBar active={activeTab} onChange={handleTabChange} />
      </header>

      <main>
        {controlsOpen && <div className="sheet-backdrop" onClick={toggleControls} />}
        <div className={`controls-wrapper${controlsOpen ? "" : " collapsed"}`}>
          <button
            className="sheet-handle"
            onClick={toggleControls}
            aria-label={controlsOpen ? "Collapse controls" : "Expand controls"}
          >
            <span className="sheet-handle-label">
              Controls
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={controlsOpen ? "M3 5 L6 8 L9 5" : "M3 7 L6 4 L9 7"} />
              </svg>
            </span>
          </button>
          <Controls
            params={params}
            onChange={setParams}
            onReset={handleReset}
            valueMode={valueMode}
            onValueModeChange={setValueMode}
          />
          {showAffordability && (
            <AffordabilityControls grossIncome={grossIncome} onChange={setGrossIncome} />
          )}
          {activeTab === "compare" && (
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
          )}
        </div>

        <button
          className="controls-toggle"
          onClick={toggleControls}
          aria-label={controlsOpen ? "Collapse controls" : "Expand controls"}
          title={controlsOpen ? "Collapse controls" : "Expand controls"}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d={controlsOpen ? "M10 3 L5 8 L10 13" : "M6 3 L11 8 L6 13"}
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="viz-area">
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
            {activeTab === "amortization" && (
              <AmortizationChart params={params} selectedCell={selectedCell} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
