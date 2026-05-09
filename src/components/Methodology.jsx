// SVG-rendered P&I formula. ~3KB; KaTeX would be ~280KB for one expression.
// All visuals derived from CSS custom properties so light/dark theming works.
function FormulaSVG() {
  return (
    <svg
      viewBox="0 0 560 110"
      width="100%"
      role="img"
      aria-label="P and I equals P times r times one plus r to the n, divided by one plus r to the n minus one"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>{`
          .f-var   { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-size: 28px; fill: var(--color-fg-base); }
          .f-num   { font-family: 'JetBrains Mono', monospace; font-size: 18px; fill: var(--color-fg-muted); }
          .f-op    { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; fill: var(--color-ember); }
          .f-eq    { font-family: 'Playfair Display', Georgia, serif; font-size: 32px; fill: var(--color-ember); }
          .f-frac  { stroke: var(--color-ember); stroke-width: 1.4; }
          .f-paren { font-family: 'Playfair Display', Georgia, serif; font-size: 36px; fill: var(--color-fg-muted); }
        `}</style>
      </defs>

      {/* P&I = */}
      <text className="f-var" x="0"  y="65">P</text>
      <text className="f-num" x="22" y="65" dy="-2">&amp;</text>
      <text className="f-var" x="44" y="65">I</text>
      <text className="f-eq"  x="78" y="68">=</text>

      {/* P · */}
      <text className="f-var" x="118" y="65">P</text>
      <text className="f-op"  x="138" y="65">·</text>

      {/* Numerator: r(1+r)ⁿ */}
      <text className="f-var" x="180" y="48">r</text>
      <text className="f-paren" x="196" y="55">(</text>
      <text className="f-num" x="216" y="48">1</text>
      <text className="f-op"  x="232" y="48">+</text>
      <text className="f-var" x="252" y="48">r</text>
      <text className="f-paren" x="268" y="55">)</text>
      <text className="f-var" x="288" y="34" fontSize="18">n</text>

      {/* Fraction bar */}
      <line className="f-frac" x1="170" y1="60" x2="332" y2="60" />

      {/* Denominator: (1+r)ⁿ − 1 */}
      <text className="f-paren" x="170" y="92">(</text>
      <text className="f-num" x="190" y="85">1</text>
      <text className="f-op"  x="206" y="85">+</text>
      <text className="f-var" x="226" y="85">r</text>
      <text className="f-paren" x="242" y="92">)</text>
      <text className="f-var" x="262" y="71" fontSize="18">n</text>
      <text className="f-op"  x="282" y="85">−</text>
      <text className="f-num" x="306" y="85">1</text>
    </svg>
  );
}

export default function Methodology() {
  return (
    <section className="methodology" id="methodology">
      <div className="methodology__inner">
        <p className="methodology__overline">Methodology</p>
        <h2 className="methodology__title">
          The math, <em>unhidden</em>
        </h2>

        <div className="methodology__body">
          <p>
            Principal and interest is the only nonlinear piece. Tax,
            insurance, HOA, and PMI are all simple division — annualized
            costs spread across twelve months. The mortgage formula itself
            is the standard amortizing-loan equation, expressed in monthly
            terms.
          </p>
        </div>

        <div className="methodology__formula">
          <FormulaSVG />
        </div>

        <table className="methodology__var-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>P</td>
              <td>Loan principal — home price minus down payment</td>
            </tr>
            <tr>
              <td>r</td>
              <td>Monthly rate — annual rate divided by 12</td>
            </tr>
            <tr>
              <td>n</td>
              <td>Total months — loan term in years times 12</td>
            </tr>
          </tbody>
        </table>

        <div className="methodology__body" style={{ marginTop: "var(--space-xl)" }}>
          <p>
            <strong style={{ color: "var(--color-fg-base)" }}>Total monthly</strong> is then
            P&amp;I plus monthly tax (annual tax / 12), monthly insurance
            (home price × insurance rate / 12), monthly HOA, and PMI when
            down payment is below 20% (loan × 0.5% / 12, dropping at 78%
            LTV per the federal rule).
          </p>
          <p>What this tool doesn't model:</p>
        </div>

        <ol className="methodology__assumptions">
          <li>
            Property tax assessment changes over time. Real bills creep.
            Treat the y-axis as today's bill.
          </li>
          <li>
            Insurance escrow analysis. Real escrows true up annually; this
            assumes a flat monthly throughline.
          </li>
          <li>
            Federal/state tax deductions. Mortgage interest and SALT
            deductions can knock the effective monthly down — but only if
            you itemize and only above the standard deduction floor.
          </li>
          <li>
            Closing costs and origination fees. They live on the down
            payment side of the ledger, not the monthly.
          </li>
          <li>
            HELOCs, second mortgages, ARM resets. The math here is fixed-rate
            for the full term.
          </li>
        </ol>
      </div>
    </section>
  );
}
