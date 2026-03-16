const TABS = [
  { id: "payment", label: "Payment" },
  { id: "amortization", label: "Amortization" },
  { id: "affordability", label: "Affordability" },
  { id: "compare", label: "Compare" },
];

export default function TabBar({ active, onChange }) {
  return (
    <div className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn${active === tab.id ? " active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
