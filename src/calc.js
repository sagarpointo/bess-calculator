// calc.js
// Reproduces the BESS vs DG model from the source spreadsheet (MAIN SHEET, cols F->R).
// Every tunable constant lives in CONFIG so the model is easy to adjust later.

export const CONFIG = {
  // --- Operating model ---
  POWER_FACTOR: 0.8, // kW = kVA x PF                       (sheet I6 = I5*0.8)
  DIESEL_RATE: 0.3, // litres of diesel per kWh delivered  (sheet I9 / I10 = I8*I9)
  BESS_EFFICIENCY: 0.9, // grid units drawn = kWh / 0.9        (sheet L9 / L10 = L8/L9)
  DAYS_PER_MONTH: 30, // sheet I12 = I11*30

  // --- DG fixed running costs (per year), from sheet O/P block ---
  DG_MAINT_YR: 70000, // scheduled + breakdown + AMC (25k+15k+30k) -> P4+P5+P6
  DG_OPERATOR_YR: 216000, // operator salary 18,000/mo x 12          -> P7*12

  // --- System price (constant: Rs 17 per Wh of kW capacity) ---
  PRICE_PER_WH: 17, // sheet R3 = 17 * 1000 * kW

  // --- Customer price add-ons ---
  PROCESSING_FEE_PCT: 0.015, // 1.5%        (sheet Q24 / Q44)
  GST_SOLAR: 0.05, // 5%  with solar    (sheet Q45 path for solar = 5%)
  GST_NO_SOLAR: 0.18, // 18% without solar (sheet Q45 = 18%*Q43)

  // --- Financing ---
  ANNUAL_INTEREST: 0.12, // 12% p.a.    (sheet Q26 = 12%/12 monthly)

  // --- Environmental ---
  CO2_PER_LITRE: 2.68, // kg CO2 per litre of diesel
  TREES_PER_TONNE: 50, // trees equivalent per tonne CO2/yr
};

// --- DG purchase price by kVA (from dealer quotes) ---
export const DG_PRICE_TABLE = [
  { kva: 5, price: 190000 },
  { kva: 10, price: 280000 },
  { kva: 20, price: 450000 },
  { kva: 30, price: 550000 },
  { kva: 40, price: 600000 },
  { kva: 50, price: 750000 },
  { kva: 60, price: 850000 },
  { kva: 70, price: 950000 },
  { kva: 80, price: 1000000 },
  { kva: 90, price: 1050000 },
  { kva: 100, price: 1150000 },
  { kva: 110, price: 1300000 },
  { kva: 120, price: 1350000 },
  { kva: 130, price: 1450000 },
  { kva: 140, price: 1550000 },
  { kva: 150, price: 1700000 },
];

/** Linearly interpolate DG price for any kVA value */
export function getDgPrice(kva) {
  const t = DG_PRICE_TABLE;
  if (kva <= t[0].kva) return t[0].price;
  if (kva >= t[t.length - 1].kva) return t[t.length - 1].price;
  for (let i = 0; i < t.length - 1; i++) {
    if (kva >= t[i].kva && kva <= t[i + 1].kva) {
      const frac = (kva - t[i].kva) / (t[i + 1].kva - t[i].kva);
      return Math.round(t[i].price + frac * (t[i + 1].price - t[i].price));
    }
  }
  return t[t.length - 1].price;
}

// PMT (same as Excel PMT) -> monthly payment for a loan
function pmt(monthlyRate, months, principal) {
  if (monthlyRate === 0) return principal / months;
  const f = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * f) / (f - 1);
}

/**
 * @param {object} inputs
 * @param {number} inputs.kva        connected load (kVA)
 * @param {number} inputs.hours      daily backup hours
 * @param {number} inputs.dieselPrice  diesel price (Rs / litre)
 * @param {number} inputs.gridTariff   grid tariff (Rs / unit) used for BESS charging
 * @param {boolean} inputs.solar     true -> 5% GST, false -> 18% GST
 */
export function calculate({
  kva,
  hours,
  dieselPrice,
  gridTariff,
  solar,
  tenureYears = 5,
}) {
  const C = CONFIG;
  const tenureMonths = Math.round(tenureYears * 12);

  // ---- DG purchase price (dynamic based on kVA) ----
  const dgPrice = getDgPrice(kva);

  // ---- Power / energy ----
  const kw = kva * C.POWER_FACTOR; // sheet I6
  const kwhPerDay = kw * hours; // energy delivered per day (sheet I7 * hours)

  // ---- DG energy cost ----
  const dieselLitresDay = kwhPerDay * C.DIESEL_RATE;
  const dgCostDay = dieselLitresDay * dieselPrice;
  const dgCostMonth = dgCostDay * C.DAYS_PER_MONTH;
  const dgCostYear = dgCostMonth * 12;
  const dgUnitCost = dieselPrice * C.DIESEL_RATE; // Rs per kWh delivered by DG

  // ---- BESS energy cost ----
  const bessUnitsDay = kwhPerDay / C.BESS_EFFICIENCY;
  const bessCostDay = bessUnitsDay * gridTariff;
  const bessCostMonth = bessCostDay * C.DAYS_PER_MONTH;
  const bessCostYear = bessCostMonth * 12;
  const bessUnitCost = gridTariff / C.BESS_EFFICIENCY;

  // ---- Energy savings ----
  const energySaveMonth = dgCostMonth - bessCostMonth;
  const energySaveYear = energySaveMonth * 12;
  const energySavePct =
    dgCostMonth > 0 ? (energySaveMonth / dgCostMonth) * 100 : 0;

  // ---- Fixed running cost savings (DG only) ----
  const dgFixedYear = C.DG_MAINT_YR + C.DG_OPERATOR_YR;
  const totalSaveMonth = energySaveMonth + dgFixedYear / 12;
  const totalSaveYear = totalSaveMonth * 12;

  // ---- System price (constant Rs 17/Wh x kW) ----
  const systemPrice = C.PRICE_PER_WH * 1000 * kw; // sheet R3

  // ---- Customer price ----
  const processingFee = systemPrice * C.PROCESSING_FEE_PCT;
  const gstRate = solar ? C.GST_SOLAR : C.GST_NO_SOLAR;
  const gst = systemPrice * gstRate;
  const customerPrice = systemPrice + processingFee + gst;

  // ---- 10-year total cost comparison (split by category) ----
  const dgMachine10Yr = dgPrice;
  const dgMaint10Yr = C.DG_MAINT_YR * 10;
  const dgOperator10Yr = C.DG_OPERATOR_YR * 10;
  const dgFuel10Yr = dgCostYear * 10;
  const dgCost10Yr = dgMachine10Yr + dgMaint10Yr + dgOperator10Yr + dgFuel10Yr;

  const bessMachine10Yr = customerPrice;
  const bessMaint10Yr = kva < 100 ? 4000 * 5 : 6000 * 5; // AMC: ₹4k/yr or ₹6k/yr × 5 yrs based on load
  const bessOperator10Yr = 0;
  const bessGrid10Yr = bessCostYear * 10;
  const bessCost10Yr =
    bessMachine10Yr + bessMaint10Yr + bessOperator10Yr + bessGrid10Yr;

  const save10Yr = dgCost10Yr - bessCost10Yr;
  const save10YrPct = dgCost10Yr > 0 ? (save10Yr / dgCost10Yr) * 100 : 0;

  // ---- Financing ----
  const monthlyRate = C.ANNUAL_INTEREST / 12;
  const emi = pmt(monthlyRate, tenureMonths, customerPrice);
  const totalPayable = emi * tenureMonths;
  const totalInterest = totalPayable - customerPrice;
  const netGainMonth = totalSaveMonth - emi; // savings minus EMI

  // ---- Payback (months to recover BESS cost from monthly energy savings vs DG) ----
  const paybackMonths =
    energySaveMonth > 0 ? Math.ceil(customerPrice / energySaveMonth) : 0;

  // ---- CO2 ----
  const co2KgYear = dieselLitresDay * C.CO2_PER_LITRE * 365;
  const co2TonnesYear = co2KgYear / 1000;
  const trees = Math.round(co2TonnesYear * C.TREES_PER_TONNE);

  return {
    kw,
    kwhPerDay,
    dgPrice,
    dgCostDay,
    dgCostMonth,
    dgCostYear,
    dgUnitCost,
    bessCostDay,
    bessCostMonth,
    bessCostYear,
    bessUnitCost,
    energySaveMonth,
    energySaveYear,
    energySavePct,
    dgMaintYear: C.DG_MAINT_YR,
    dgOperatorYear: C.DG_OPERATOR_YR,
    totalSaveMonth,
    totalSaveYear,
    dgCost10Yr,
    dgMachine10Yr,
    dgMaint10Yr,
    dgOperator10Yr,
    dgFuel10Yr,
    bessCost10Yr,
    bessMachine10Yr,
    bessMaint10Yr,
    bessGrid10Yr,
    save10Yr,
    save10YrPct,
    systemPrice,
    processingFee,
    gst,
    gstRate,
    customerPrice,
    emi,
    totalPayable,
    totalInterest,
    netGainMonth,
    tenureMonths,
    paybackMonths,
    co2TonnesYear,
    trees,
  };
}

// Indian-format currency, e.g. 1,21,600
export function inr(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
export function inrNum(n) {
  return Math.round(n).toLocaleString('en-IN');
}
