/**
 * Encode/decode app params to/from URL search params for shareable links.
 */

const PARAM_MAP = {
  annualRate: { key: "r", encode: (v) => (v * 100).toFixed(3), decode: (v) => parseFloat(v) / 100 },
  termYears: { key: "t", encode: String, decode: Number },
  downPaymentPct: { key: "dp", encode: (v) => (v * 100).toFixed(0), decode: (v) => parseFloat(v) / 100 },
  insuranceRate: { key: "ir", encode: (v) => (v * 100).toFixed(2), decode: (v) => parseFloat(v) / 100 },
  monthlyHOA: { key: "hoa", encode: String, decode: Number },
  currentRent: { key: "rent", encode: String, decode: Number },
  priceMin: { key: "pmin", encode: String, decode: Number },
  priceMax: { key: "pmax", encode: String, decode: Number },
  taxMin: { key: "tmin", encode: String, decode: Number },
  taxMax: { key: "tmax", encode: String, decode: Number },
};

// Extra keys for overlay state
const EXTRA_MAP = {
  activeTab: { key: "tab", encode: String, decode: String },
  valueMode: { key: "mode", encode: String, decode: String },
  grossIncome: { key: "income", encode: String, decode: Number },
};

export function encodeParams(params, extra = {}) {
  const sp = new URLSearchParams();
  for (const [field, { key, encode }] of Object.entries(PARAM_MAP)) {
    if (params[field] !== undefined) sp.set(key, encode(params[field]));
  }
  for (const [field, { key, encode }] of Object.entries(EXTRA_MAP)) {
    if (extra[field] !== undefined && extra[field] !== null) sp.set(key, encode(extra[field]));
  }
  return sp.toString();
}

export function decodeParams(search, defaults) {
  const sp = new URLSearchParams(search);
  const params = { ...defaults };
  const extra = {};

  for (const [field, { key, decode }] of Object.entries(PARAM_MAP)) {
    const val = sp.get(key);
    if (val !== null) {
      const parsed = decode(val);
      if (!isNaN(parsed)) params[field] = parsed;
    }
  }

  for (const [field, { key, decode }] of Object.entries(EXTRA_MAP)) {
    const val = sp.get(key);
    if (val !== null) {
      const parsed = decode(val);
      if (typeof parsed === "string" || !isNaN(parsed)) extra[field] = parsed;
    }
  }

  return { params, extra };
}

export function replaceState(params, extra = {}) {
  const encoded = encodeParams(params, extra);
  const url = `${window.location.pathname}?${encoded}`;
  window.history.replaceState(null, "", url);
}
