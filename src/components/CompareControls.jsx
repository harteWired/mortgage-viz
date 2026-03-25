export default function CompareControls({ compareOverrides, params, onChange, onReset }) {
  return (
    <div className="compare-controls">
      <h2>What if?</h2>
      <p className="compare-hint">Adjust to see a second break-even line on the heatmap</p>

      <label>
        <span>Interest Rate</span>
        <div className="input-row">
          <input type="range" min="1" max="12" step="0.125"
            value={compareOverrides.annualRate * 100}
            onChange={(e) => onChange("annualRate", parseFloat(e.target.value) / 100)} />
          <input type="number" className="value-input compare-value-input" min={1} max={12} step={0.125}
            value={(compareOverrides.annualRate * 100).toFixed(2)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange("annualRate", Math.max(0.01, Math.min(0.12, v / 100)));
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
              onClick={() => onChange("termYears", t)}>{t} yr</button>
          ))}
        </div>
      </fieldset>

      <label>
        <span>Down Payment</span>
        <div className="input-row">
          <input type="range" min="0" max="50" step="1"
            value={compareOverrides.downPaymentPct * 100}
            onChange={(e) => onChange("downPaymentPct", parseFloat(e.target.value) / 100)} />
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

      <button className="reset-btn" onClick={onReset}>
        Reset What-If
      </button>
    </div>
  );
}
