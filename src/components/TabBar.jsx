const TABS = [
  { id: "payment", label: "Payment", subtitle: "Monthly cost heatmap" },
  { id: "amortization", label: "Amortization", subtitle: "Payoff schedule" },
  { id: "affordability", label: "Affordability", subtitle: "DTI income overlay" },
  { id: "compare", label: "Compare", subtitle: "What-if scenarios" },
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
