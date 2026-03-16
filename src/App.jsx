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

  // Scenario B for compare tab
  const [paramsB, setParamsB] = useState(() => ({ ...initial.params, annualRate: initial.params.annualRate - 0.01 }));

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

  // Controls for Scenario B in compare mode
  const updateB = useCallback((key, value) => {
    setParamsB((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "priceMin") next.priceMin = Math.max(0, Math.min(value, prev.priceMax - 25000));
      if (key === "priceMax") next.priceMax = Math.max(prev.priceMin + 25000, value);
      if (key === "taxMin") next.taxMin = Math.max(0, Math.min(value, prev.taxMax - 500));
      if (key === "taxMax") next.taxMax = Math.max(prev.taxMin + 500, value);
      return next;
    });
  }, []);

  const showAffordability = activeTab === "affordability";
  const compareParams = activeTab === "compare" ? paramsB : null;

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
            <div className="controls scenario-b-controls">
              <h2>Scenario B</h2>
              <label>
                <span>Interest Rate</span>
                <div className="input-row">
                  <input type="range" min="1" max="12" step="0.125"
                    value={paramsB.annualRate * 100}
                    onChange={(e) => updateB("annualRate", parseFloat(e.target.value) / 100)} />
                  <input type="number" className="value-input" min={1} max={12} step={0.125}
                    value={(paramsB.annualRate * 100).toFixed(2)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) updateB("annualRate", Math.max(0.01, Math.min(0.12, v / 100)));
                    }} />
                  <span className="value-unit">%</span>
                </div>
              </label>

              <fieldset className="term-fieldset">
                <legend>Loan Term</legend>
                <div className="term-buttons">
                  {[15, 30].map((t) => (
                    <button key={t} className={paramsB.termYears === t ? "active" : ""}
                      onClick={() => updateB("termYears", t)}>{t} yr</button>
                  ))}
                </div>
              </fieldset>

              <label>
                <span>Down Payment</span>
                <div className="input-row">
                  <input type="range" min="0" max="50" step="1"
                    value={paramsB.downPaymentPct * 100}
                    onChange={(e) => updateB("downPaymentPct", parseFloat(e.target.value) / 100)} />
                  <span className="value">{(paramsB.downPaymentPct * 100).toFixed(0)}%</span>
                </div>
              </label>

              <label>
                <span>Insurance Rate</span>
                <div className="input-row">
                  <input type="range" min="0" max="2" step="0.05"
                    value={paramsB.insuranceRate * 100}
                    onChange={(e) => updateB("insuranceRate", parseFloat(e.target.value) / 100)} />
                  <span className="value">{(paramsB.insuranceRate * 100).toFixed(2)}%</span>
                </div>
              </label>

              <label>
                <span>Monthly HOA</span>
                <div className="input-row">
                  <input type="range" min="0" max="800" step="25"
                    value={paramsB.monthlyHOA}
                    onChange={(e) => updateB("monthlyHOA", parseFloat(e.target.value))} />
                  <span className="value">${paramsB.monthlyHOA}</span>
                </div>
              </label>

              <button className="reset-btn" onClick={() => setParamsB({ ...params, annualRate: params.annualRate - 0.01 })}>
                Copy from Scenario A
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
