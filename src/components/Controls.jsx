const TERMS = [15, 30];
const VALUE_MODES = [
  { id: "monthly", label: "Monthly" },
  { id: "totalCost", label: "Total Cost" },
  { id: "totalInterest", label: "Total Interest" },
];

export default function Controls({ params, onChange, onReset, valueMode, onValueModeChange }) {
  const update = (key, value) => {
    const next = { ...params, [key]: value };
    if (key === "priceMin") next.priceMin = Math.max(0, Math.min(value, params.priceMax - 25000));
    if (key === "priceMax") next.priceMax = Math.max(params.priceMin + 25000, value);
    if (key === "taxMin") next.taxMin = Math.max(0, Math.min(value, params.taxMax - 500));
    if (key === "taxMax") next.taxMax = Math.max(params.taxMin + 500, value);
    onChange(next);
  };

  const midPrice = (params.priceMin + params.priceMax) / 2;

  return (
    <div className="controls">
      <h2>Loan</h2>

      <label>
        <span>Interest Rate</span>
        <div className="input-row">
          <input
            type="range" min="1" max="12" step="0.125"
            value={params.annualRate * 100}
            onChange={(e) => update("annualRate", parseFloat(e.target.value) / 100)}
          />
          <input
            type="number" className="value-input" min={1} max={12} step={0.125}
            value={(params.annualRate * 100).toFixed(2)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) update("annualRate", Math.max(0.01, Math.min(0.12, v / 100)));
            }}
          />
          <span className="value-unit">%</span>
        </div>
      </label>

      <fieldset className="term-fieldset">
        <legend>Loan Term</legend>
        <div className="term-buttons">
          {TERMS.map((t) => (
            <button key={t} className={params.termYears === t ? "active" : ""}
              aria-pressed={params.termYears === t}
              onClick={() => update("termYears", t)}>
              {t} yr
            </button>
          ))}
        </div>
      </fieldset>

      <label>
        <span>Down Payment</span>
        <div className="input-row">
          <input type="range" min="0" max="50" step="1"
            value={params.downPaymentPct * 100}
            onChange={(e) => update("downPaymentPct", parseFloat(e.target.value) / 100)}
          />
          <span className="value">{(params.downPaymentPct * 100).toFixed(0)}%</span>
        </div>
        {params.downPaymentPct < 0.2 && (
          <span className="hint pmi-hint">PMI applies below 20% down</span>
        )}
      </label>

      <h2>Costs</h2>

      <label>
        <span>Insurance Rate</span>
        <div className="input-row">
          <input type="range" min="0" max="2" step="0.05"
            value={params.insuranceRate * 100}
            onChange={(e) => update("insuranceRate", parseFloat(e.target.value) / 100)}
          />
          <span className="value">{(params.insuranceRate * 100).toFixed(2)}%</span>
        </div>
        <span className="hint">
          {"\u2248"} ${Math.round(midPrice * params.insuranceRate / 12).toLocaleString()}/mo ($
          {Math.round(midPrice * params.insuranceRate).toLocaleString()}/yr at $
          {(midPrice / 1000).toFixed(0)}k)
        </span>
      </label>

      <label>
        <span>Monthly HOA</span>
        <div className="input-row">
          <input type="range" min="0" max="800" step="25"
            value={params.monthlyHOA}
            onChange={(e) => update("monthlyHOA", parseFloat(e.target.value))}
          />
          <span className="value">${params.monthlyHOA}</span>
        </div>
      </label>

      <div className="rent-section">
        <label>
          <span>Current Monthly Rent</span>
          <div className="input-row">
            <input type="range" min="500" max="8000" step="50"
              value={params.currentRent}
              onChange={(e) => update("currentRent", parseFloat(e.target.value))}
            />
            <span className="value">${params.currentRent.toLocaleString()}</span>
          </div>
        </label>
      </div>

      <div className="value-mode-section">
        <h2>Display</h2>
        <fieldset className="term-fieldset">
          <legend>Cell Value</legend>
          <div className="term-buttons mode-buttons">
            {VALUE_MODES.map((m) => (
              <button key={m.id}
                className={valueMode === m.id ? "active" : ""}
                aria-pressed={valueMode === m.id}
                onClick={() => onValueModeChange(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="axis-ranges">
        <h3>Axis Ranges</h3>
        <label>
          <span>Price Range</span>
          <div className="range-inputs">
            <input type="number" value={params.priceMin} step="25000"
              onChange={(e) => update("priceMin", parseInt(e.target.value) || 0)} />
            <span>to</span>
            <input type="number" value={params.priceMax} step="25000"
              onChange={(e) => update("priceMax", parseInt(e.target.value) || 0)} />
          </div>
        </label>
        <label>
          <span>Annual Tax Range</span>
          <div className="range-inputs">
            <input type="number" value={params.taxMin} step="500"
              onChange={(e) => update("taxMin", parseInt(e.target.value) || 0)} />
            <span>to</span>
            <input type="number" value={params.taxMax} step="500"
              onChange={(e) => update("taxMax", parseInt(e.target.value) || 0)} />
          </div>
        </label>
      </div>

      {onReset && (
        <button className="reset-btn" onClick={onReset}>Reset defaults</button>
      )}
    </div>
  );
}
