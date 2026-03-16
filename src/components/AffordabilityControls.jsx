export default function AffordabilityControls({ grossIncome, onChange }) {
  return (
    <div className="affordability-controls">
      <h2>Affordability</h2>
      <label>
        <span>Gross Annual Income</span>
        <div className="input-row">
          <input
            type="range"
            min="30000"
            max="500000"
            step="5000"
            value={grossIncome}
            onChange={(e) => onChange(parseFloat(e.target.value))}
          />
          <span className="value">${(grossIncome / 1000).toFixed(0)}k</span>
        </div>
        <span className="hint">Monthly: ${Math.round(grossIncome / 12).toLocaleString()}</span>
      </label>
      <div className="dti-legend">
        <div className="dti-band comfortable"><span className="dti-swatch"></span> Comfortable (&le;28%)</div>
        <div className="dti-band stretching"><span className="dti-swatch"></span> Stretching (28-36%)</div>
        <div className="dti-band maximum"><span className="dti-swatch"></span> Maximum (36-43%)</div>
        <div className="dti-band overlimit"><span className="dti-swatch"></span> Over limit (&gt;43%)</div>
      </div>
    </div>
  );
}
