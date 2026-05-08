// v2: Amortization is no longer a tab — the drilldown section below
// the heatmap is always present and reveals on cell click.
const TABS = [
  { id: "payment",       label: "Payment",       subtitle: "Monthly cost heatmap" },
  { id: "affordability", label: "Affordability", subtitle: "DTI income overlay" },
  { id: "compare",       label: "Compare",       subtitle: "What-if scenarios" },
];

export default function TabBar({ active, onChange }) {
  return (
    <div className="tab-bar" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn${active === tab.id ? " active" : ""}`}
          role="tab"
          aria-selected={active === tab.id}
          title={tab.subtitle}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
