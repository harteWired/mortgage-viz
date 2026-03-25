/** Annual PMI rate as a fraction of loan amount (typical for good credit, LTV > 80%). */
export const PMI_RATE = 0.005;

export const GRID_STEPS = 30;

export function calcMonthlyPI(principal, annualRate, termYears) {
  if (principal <= 0) return 0;
  if (annualRate === 0) return principal / (termYears * 12);
  const r = annualRate / 12;
  const n = termYears * 12;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function calcTotalMonthly({ homePrice, downPaymentPct, annualRate, termYears, annualTax, insuranceRate, monthlyHOA }) {
  const loanAmount = homePrice * (1 - downPaymentPct);
  const pi = calcMonthlyPI(loanAmount, annualRate, termYears);
  const monthlyTax = annualTax / 12;
  const monthlyInsurance = (homePrice * insuranceRate) / 12;
  const monthlyPMI = downPaymentPct < 0.20 ? (loanAmount * PMI_RATE) / 12 : 0;
  return pi + monthlyTax + monthlyInsurance + monthlyHOA + monthlyPMI;
}

export function calcBreakdown({ homePrice, downPaymentPct, annualRate, termYears, annualTax, insuranceRate, monthlyHOA }) {
  const loanAmount = homePrice * (1 - downPaymentPct);
  const pi = calcMonthlyPI(loanAmount, annualRate, termYears);
  const tax = annualTax / 12;
  const insurance = (homePrice * insuranceRate) / 12;
  const pmi = downPaymentPct < 0.20 ? (loanAmount * PMI_RATE) / 12 : 0;
  return { pi, tax, insurance, hoa: monthlyHOA, pmi, total: pi + tax + insurance + monthlyHOA + pmi };
}

/**
 * Total cost over full loan term: sum of all monthly payments.
 * Does NOT include down payment — just the recurring cost.
 */
export function calcTotalCost({ homePrice, downPaymentPct, annualRate, termYears, annualTax, insuranceRate, monthlyHOA }) {
  const monthly = calcTotalMonthly({ homePrice, downPaymentPct, annualRate, termYears, annualTax, insuranceRate, monthlyHOA });
  return monthly * termYears * 12;
}

/**
 * Total interest paid over life of loan (just the interest portion of P&I).
 */
export function calcTotalInterest(homePrice, downPaymentPct, annualRate, termYears) {
  const loanAmount = homePrice * (1 - downPaymentPct);
  const monthlyPI = calcMonthlyPI(loanAmount, annualRate, termYears);
  return monthlyPI * termYears * 12 - loanAmount;
}

/**
 * Generate heatmap data grid.
 * @param {string} mode - "monthly" | "totalCost" | "totalInterest"
 */
export function generateHeatmapData(params, prices, taxes, mode = "monthly") {
  const data = [];
  for (const tax of taxes) {
    for (const price of prices) {
      const args = { ...params, homePrice: price, annualTax: tax };
      const breakdown = calcBreakdown(args);
      let value;
      if (mode === "totalCost") {
        value = calcTotalCost(args);
      } else if (mode === "totalInterest") {
        value = calcTotalInterest(price, params.downPaymentPct, params.annualRate, params.termYears);
      } else {
        value = breakdown.total;
      }
      data.push({
        price, tax, payment: value,
        pi: breakdown.pi, monthlyTax: breakdown.tax,
        insurance: breakdown.insurance, hoa: breakdown.hoa,
        pmi: breakdown.pmi, total: breakdown.total,
      });
    }
  }
  return data;
}

export function linspace(start, end, steps) {
  const arr = [];
  const step = (end - start) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    arr.push(Math.round(start + step * i));
  }
  return arr;
}

export function rentBoundaryPoints(params, taxMin, taxMax, numPoints = 200) {
  const { annualRate, termYears, downPaymentPct, insuranceRate, monthlyHOA, currentRent } = params;
  const r = annualRate / 12;
  const n = termYears * 12;

  let piCoeff;
  if (annualRate === 0) {
    piCoeff = (1 - downPaymentPct) / n;
  } else {
    piCoeff = (1 - downPaymentPct) * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  const pmiCoeff = downPaymentPct < 0.20 ? (1 - downPaymentPct) * PMI_RATE / 12 : 0;
  const totalCoeff = piCoeff + insuranceRate / 12 + pmiCoeff;
  if (totalCoeff <= 0) return [];

  const points = [];
  const taxStep = (taxMax - taxMin) / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const tax = taxMin + taxStep * i;
    const price = (currentRent - tax / 12 - monthlyHOA) / totalCoeff;
    if (price > 0) {
      points.push({ price, tax });
    }
  }
  return points;
}

/**
 * Generate amortization schedule for a specific scenario.
 * Returns array of monthly entries with running balances.
 */
export function generateAmortizationSchedule({ homePrice, downPaymentPct, annualRate, termYears, annualTax, insuranceRate, monthlyHOA }) {
  const loanAmount = homePrice * (1 - downPaymentPct);
  const monthlyPI = calcMonthlyPI(loanAmount, annualRate, termYears);
  const r = annualRate / 12;
  const n = termYears * 12;
  const monthlyTax = annualTax / 12;
  const monthlyInsurance = (homePrice * insuranceRate) / 12;
  const monthlyPMI = downPaymentPct < 0.20 ? (loanAmount * PMI_RATE) / 12 : 0;

  const schedule = [];
  let balance = loanAmount;
  let totalInterest = 0;
  let totalEquity = homePrice * downPaymentPct;

  for (let month = 1; month <= n; month++) {
    const interestPayment = balance * r;
    const principalPayment = monthlyPI - interestPayment;
    balance -= principalPayment;
    totalInterest += interestPayment;
    totalEquity += principalPayment;

    // PMI drops off at 78% LTV (22% equity)
    const ltv = Math.max(0, balance) / homePrice;
    const pmi = ltv > 0.78 ? monthlyPMI : 0;

    schedule.push({
      month,
      year: Math.ceil(month / 12),
      principal: principalPayment,
      interest: interestPayment,
      tax: monthlyTax,
      insurance: monthlyInsurance,
      hoa: monthlyHOA,
      pmi,
      totalPayment: monthlyPI + monthlyTax + monthlyInsurance + monthlyHOA + pmi,
      balance: Math.max(0, balance),
      totalInterest,
      totalEquity,
    });
  }
  return schedule;
}

/**
 * Compute DTI ratio for a given monthly payment and gross monthly income.
 */
export function calcDTI(monthlyPayment, grossMonthlyIncome) {
  if (grossMonthlyIncome <= 0) return 0;
  return monthlyPayment / grossMonthlyIncome;
}

/**
 * DTI band thresholds (front-end ratio — housing only).
 */
export const DTI_BANDS = [
  { max: 0.28, label: "Comfortable", color: "comfortable" },
  { max: 0.36, label: "Stretching", color: "stretching" },
  { max: 0.43, label: "Maximum", color: "maximum" },
  { max: Infinity, label: "Over limit", color: "overlimit" },
];

export function getDTIBand(dti) {
  return DTI_BANDS.find((b) => dti <= b.max);
}
