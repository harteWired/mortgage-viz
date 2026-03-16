import { useState, useEffect, useMemo, useCallback } from "react";
import Controls from "./components/Controls";
import Heatmap from "./components/Heatmap";
import TabBar from "./components/TabBar";
import AmortizationChart from "./components/AmortizationChart";
import AffordabilityControls from "./components/AffordabilityControls";
import SummaryStats from "./components/SummaryStats";
import ExportButton from "./components/ExportButton";
import { generateHeatmapData, linspace } from "./utils/mortgage";
import { decodeParams, pushState } from "./utils/urlState";
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

const GRID_STEPS = 30;

export default function App() {
  // Load initial state from URL
  const initial = useMemo(() => {
    const { params, extra } = decodeParams(window.location.search, DEFAULT_PARAMS);
    return { params, extra };
  }, []);

  const [params, setParams] = useState(initial.params);
  const [activeTab, setActiveTab] = useState(initial.extra.activeTab || "payment");
  const [valueMode, setValueMode] = useState(initial.extra.valueMode || "monthly");
  const [grossIncome, setGrossIncome] = useState(initial.extra.grossIncome || 100000);

  // Scenario B overrides for compare tab (only the fields that differ from A)
  const [compareOverrides, setCompareOverrides] = useState(() => ({
    annualRate: Math.max(0.01, initial.params.annualRate - 0.01),
    termYears: initial.params.termYears,
    downPaymentPct: initial.params.downPaymentPct,
  }));

  // Pinned cells (click-to-pin)
  const [pinnedCells, setPinnedCells] = useState([]);
  // Selected cell for amortization
  const [selectedCell, setSelectedCell] = useState(null);

  // Sync state to URL
  useEffect(() => {
    pushState(params, { activeTab, valueMode, grossIncome });
  }, [params, activeTab, valueMode, grossIncome]);

  // Handle popstate for back/forward
  useEffect(() => {
    const onPop = () => {
      const { params: p, extra } = decodeParams(window.location.search, DEFAULT_PARAMS);
      setParams(p);
      if (extra.activeTab) setActiveTab(extra.activeTab);
      if (extra.valueMode) setValueMode(extra.valueMode);
      if (extra.grossIncome) setGrossIncome(extra.grossIncome);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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
          <div>
            <h1>Mortgage Viz</h1>
            <p>Explore how home price and property tax affect your monthly payment</p>
          </div>
          <div className="header-actions">
            {pinnedCells.length > 0 && (
              <button className="clear-pins-btn" onClick={clearPins}>
                Clear {pinnedCells.length} pin{pinnedCells.length > 1 ? "s" : ""}
              </button>
            )}
            <ExportButton containerSelector=".heatmap-container" />
          </div>
        </div>
        <TabBar active={activeTab} onChange={setActiveTab} />
      </header>

      <main>
        <div className="controls-wrapper">
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
            <div className="compare-controls">
              <h2>What if?</h2>
              <p className="compare-hint">Adjust to see a second break-even line on the heatmap</p>

              <label>
                <span>Interest Rate</span>
                <div className="input-row">
                  <input type="range" min="1" max="12" step="0.125"
                    value={compareOverrides.annualRate * 100}
                    onChange={(e) => updateOverride("annualRate", parseFloat(e.target.value) / 100)} />
                  <input type="number" className="value-input compare-value-input" min={1} max={12} step={0.125}
                    value={(compareOverrides.annualRate * 100).toFixed(2)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) updateOverride("annualRate", Math.max(0.01, Math.min(0.12, v / 100)));
                    }} />
                  <span className="value-unit compare-unit">%</span>
                </div>
                {compareOverrides.annualRate !== params.annualRate && (
                  <span className="compare-delta">
                    {compareOverrides.annualRate > params.annualRate ? "+" : ""}
                    {((compareOverrides.annualRate - params.annualRate) * 100).toFixed(2)}% vs current
                  </span>
                )}
              </label>

              <fieldset className="term-fieldset">
                <legend>Loan Term</legend>
                <div className="term-buttons compare-term-buttons">
                  {[15, 30].map((t) => (
                    <button key={t} className={compareOverrides.termYears === t ? "active" : ""}
                      onClick={() => updateOverride("termYears", t)}>{t} yr</button>
                  ))}
                </div>
              </fieldset>

              <label>
                <span>Down Payment</span>
                <div className="input-row">
                  <input type="range" min="0" max="50" step="1"
                    value={compareOverrides.downPaymentPct * 100}
                    onChange={(e) => updateOverride("downPaymentPct", parseFloat(e.target.value) / 100)} />
                  <span className="value compare-value">{(compareOverrides.downPaymentPct * 100).toFixed(0)}%</span>
                </div>
                {compareOverrides.downPaymentPct !== params.downPaymentPct && (
                  <span className="compare-delta">
                    {compareOverrides.downPaymentPct > params.downPaymentPct ? "+" : ""}
                    {((compareOverrides.downPaymentPct - params.downPaymentPct) * 100).toFixed(0)}% vs current
                  </span>
                )}
              </label>

              <div className="compare-legend">
                <div className="compare-legend-item">
                  <span className="compare-legend-line a"></span> Current scenario
                </div>
                <div className="compare-legend-item">
                  <span className="compare-legend-line b"></span> What if scenario
                </div>
              </div>

              <button className="reset-btn" onClick={() => setCompareOverrides({
                annualRate: Math.max(0.01, params.annualRate - 0.01),
                termYears: params.termYears,
                downPaymentPct: params.downPaymentPct,
              })}>
                Reset What-If
              </button>
            </div>
          )}
        </div>

        <div className="viz-area">
          <Heatmap
            params={params}
            valueMode={valueMode}
            showAffordability={showAffordability}
            grossIncome={grossIncome}
            compareParams={compareParams}
            onCellClick={handleCellClick}
            pinnedCells={pinnedCells}
          />
          <SummaryStats data={heatmapData} valueMode={valueMode} />
          {activeTab === "amortization" && (
            <AmortizationChart params={params} selectedCell={selectedCell} />
          )}
        </div>
      </main>
    </div>
  );
}
