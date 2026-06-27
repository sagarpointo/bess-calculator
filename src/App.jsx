import { useEffect, useMemo, useRef, useState } from 'react';
import { calculate, CONFIG, inr, inrNum } from './calc.js';

// Apps Script Web App URL — set VITE_SHEET_ENDPOINT in Vercel / .env
const SHEET_ENDPOINT = import.meta.env.VITE_SHEET_ENDPOINT || '';

// ---------- small animated number hook ----------
function useCountUp(target, duration = 500) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const to = target;
    if (from === to) return;
    cancelAnimationFrame(rafRef.current);
    startRef.current = 0;
    const step = (t) => {
      if (!startRef.current) startRef.current = t;
      const p = Math.min((t - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return val;
}

// ---------- inline icons (no font dependency) ----------
const Icon = {
  phone: (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z' />
    </svg>
  ),
  leaf: (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.8'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z' />
      <path d='M2 21c0-3 1.85-5.36 5.08-6' />
    </svg>
  ),
  bolt: (
    <svg viewBox='0 0 24 24' fill='currentColor'>
      <path d='M13 2 3 14h7l-1 8 10-12h-7l1-8z' />
    </svg>
  ),
  check: (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2.4'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <polyline points='20 6 9 17 4 12' />
    </svg>
  ),
  arrow: (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <line x1='5' y1='12' x2='19' y2='12' />
      <polyline points='12 5 19 12 12 19' />
    </svg>
  ),
};

function Logo() {
  return (
    <div className='logo'>
      <span className='logo-mark'>{Icon.bolt}</span>
      <span className='logo-word'>Pointo</span>
    </div>
  );
}

// ---------- slider control ----------
function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  className = '',
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`input-card${className ? ' ' + className : ''}`}>
      <div className='input-top'>
        <span className='input-label'>{label}</span>
        <span className='val-badge'>{format(value)}</span>
      </div>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={{ '--pct': pct + '%' }}
      />
    </div>
  );
}

export default function App() {
  const [kva, setKva] = useState(60);
  const [hours, setHours] = useState(3);
  const [dieselPrice, setDieselPrice] = useState(100);
  const [gridTariff, setGridTariff] = useState(8);
  const [solar, setSolar] = useState(false);
  const [tenureYears, setTenureYears] = useState(5);

  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error

  const r = useMemo(
    () =>
      calculate({ kva, hours, dieselPrice, gridTariff, solar, tenureYears }),
    [kva, hours, dieselPrice, gridTariff, solar, tenureYears],
  );

  const saveAnim = useCountUp(r.totalSaveMonth);
  const dgWidth = 100;
  const bessWidth = Math.max(8, (r.bessCostMonth / r.dgCostMonth) * 100);

  const phoneValid = /^[6-9]\d{9}$/.test(phone);

  async function submit() {
    if (!phoneValid || status === 'sending') return;
    setStatus('sending');
    const payload = {
      phone,
      kva,
      hours,
      solar,
      dieselPrice,
      gridTariff,
      monthlySaving: Math.round(r.totalSaveMonth),
      systemPrice: Math.round(r.customerPrice),
      emi: Math.round(r.emi),
      page: 'bess-calculator',
    };
    try {
      if (!SHEET_ENDPOINT) throw new Error('No endpoint configured');
      await fetch(SHEET_ENDPOINT, {
        method: 'POST',
        // text/plain avoids a CORS preflight that Apps Script can't answer
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      setStatus('done');
    } catch (e) {
      console.error(e);
      // Still show success to the user; failures are logged for you to debug.
      setStatus(SHEET_ENDPOINT ? 'error' : 'done');
    }
  }

  return (
    <div className='page'>
      <div className='wrap'>
        <header className='topbar'>
          <Logo />
          <span className='topbar-tag'>Backup power, costed honestly</span>
        </header>

        {/* HERO */}
        <section className='hero'>
          <div className='hero-eyebrow'>
            Diesel Generator vs Battery Inverter · Savings Calculator
          </div>
          <h1 className='hero-title'>
            What is your diesel backup really costing you?
          </h1>
          <p className='hero-sub'>
            Set your load and backup need. Watch the numbers update live.
          </p>
        </section>

        {/* INPUTS */}
        <div className='section-label'>Your power profile</div>
        <div className='inputs-grid'>
          <Slider
            label='Connected load'
            value={kva}
            min={20}
            max={500}
            step={10}
            onChange={setKva}
            format={(v) => `${v} kVA`}
          />
          <Slider
            label='Daily Backup Hours'
            value={hours}
            min={1}
            max={12}
            step={0.5}
            onChange={setHours}
            format={(v) => `${v} hrs`}
          />
          <Slider
            label='Diesel Price'
            value={dieselPrice}
            min={80}
            max={120}
            step={1}
            onChange={setDieselPrice}
            format={(v) => `₹${v}/L`}
          />
          <Slider
            label='Per Unit Cost'
            value={gridTariff}
            min={5}
            max={12}
            step={0.5}
            onChange={setGridTariff}
            format={(v) => `₹${v} / unit`}
          />
          <Slider
            label='Loan Tenure'
            value={tenureYears}
            min={1}
            max={10}
            step={0.5}
            onChange={setTenureYears}
            format={(v) => `${v} yr (${Math.round(v * 12)} mo)`}
            className='full'
          />
        </div>

        {/* SOLAR TOGGLE */}
        <div className='toggle-card'>
          <div className='toggle-text'>
            <div className='toggle-title'>Pairing with solar?</div>
            <div className='toggle-sub'>
              {solar ? 'Solar applies — GST is 5%.' : 'No solar — GST is 18%.'}
            </div>
          </div>
          <div className='seg' role='tablist' aria-label='Solar option'>
            <button
              className={!solar ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setSolar(false)}
            >
              No solar
            </button>
            <button
              className={solar ? 'seg-btn active' : 'seg-btn'}
              onClick={() => setSolar(true)}
            >
              With solar
            </button>
          </div>
        </div>

        {/* HEADLINE SAVINGS */}
        <div className='section-label'>Your savings</div>
        <div className='banner'>
          <div className='banner-left'>
            <div className='banner-eyebrow'>You save every month</div>
            <div className='banner-big'>{inr(saveAnim)}</div>
            <div className='banner-foot'>
              {inr(r.totalSaveYear)} a year · fuel + maintenance + operator
            </div>
          </div>
          <div className='banner-pill'>
            <div className='pill-num'>{Math.round(r.energySavePct)}%</div>
            <div className='pill-label'>lower energy cost</div>
          </div>
        </div>

        {/* METRIC CARDS */}
        <div className='metrics'>
          <div className='metric dg-card'>
            <div className='metric-label'>Diesel / month</div>
            <div className='metric-val dg'>{inr(r.dgCostMonth)}</div>
            <div className='metric-sub'>{inr(r.dgCostDay)}/day fuel</div>
          </div>
          <div className='metric accent'>
            <div className='metric-label'>Battery / month</div>
            <div className='metric-val bess'>{inr(r.bessCostMonth)}</div>
            <div className='metric-sub'>{inr(r.bessCostDay)}/day grid</div>
          </div>
          <div className='metric'>
            <div className='metric-label'>System size</div>
            <div className='metric-val'>{Math.round(r.kwhPerDay)} kWh</div>
            <div className='metric-sub'>{Math.round(r.kw)} kW power</div>
          </div>
        </div>

        {/* BAR COMPARE */}
        <div className='panel'>
          <div className='panel-title'>Monthly running cost</div>
          <div className='bar-row'>
            <span className='bar-label'>Diesel</span>
            <div className='bar-track'>
              <div className='bar-fill dg' style={{ width: dgWidth + '%' }}>
                <span>{inr(r.dgCostMonth)}</span>
              </div>
            </div>
          </div>
          <div className='bar-row'>
            <span className='bar-label'>Battery</span>
            <div className='bar-track'>
              <div className='bar-fill bess' style={{ width: bessWidth + '%' }}>
                <span>{inr(r.bessCostMonth)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* COMPARISON TABLE */}
        <table className='ctable'>
          <thead>
            <tr>
              <th>Cost factor</th>
              <th>Diesel</th>
              <th>Battery</th>
              <th>You save</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Energy / unit</td>
              <td className='dg'>₹{r.dgUnitCost.toFixed(1)}</td>
              <td className='bess'>₹{r.bessUnitCost.toFixed(1)}</td>
              <td className='diff'>
                ₹{(r.dgUnitCost - r.bessUnitCost).toFixed(1)}
              </td>
            </tr>
            <tr>
              <td>Energy / month</td>
              <td className='dg'>{inr(r.dgCostMonth)}</td>
              <td className='bess'>{inr(r.bessCostMonth)}</td>
              <td className='diff'>{inr(r.energySaveMonth)}</td>
            </tr>
            <tr>
              <td>Energy / year</td>
              <td className='dg'>{inr(r.dgCostYear)}</td>
              <td className='bess'>{inr(r.bessCostYear)}</td>
              <td className='diff'>{inr(r.energySaveYear)}</td>
            </tr>
            <tr>
              <td>Maintenance / year</td>
              <td className='dg'>{inr(r.dgMaintYear)}</td>
              <td className='bess'>Zero</td>
              <td className='diff'>{inr(r.dgMaintYear)}</td>
            </tr>
            <tr>
              <td>Operator / year</td>
              <td className='dg'>{inr(r.dgOperatorYear)}</td>
              <td className='bess'>Not needed</td>
              <td className='diff'>{inr(r.dgOperatorYear)}</td>
            </tr>
          </tbody>
        </table>

        {/* CO2 */}
        <div className='co2'>
          <span className='co2-icon'>{Icon.leaf}</span>
          <span>
            Switching cuts about{' '}
            <strong>{Math.round(r.co2TonnesYear)} tonnes of CO₂</strong> a year
            — like planting <strong>{inrNum(r.trees)} trees</strong>.
          </span>
        </div>

        {/* INVESTMENT BREAKDOWN */}
        <div className='section-label'>Where your money goes</div>
        <div className='invest'>
          <div className='invest-row'>
            <span>Battery system price</span>
            <span>{inr(r.systemPrice)}</span>
          </div>
          <div className='invest-row sub'>
            <span>Processing fee (1.5%)</span>
            <span>{inr(r.processingFee)}</span>
          </div>
          <div className='invest-row sub'>
            <span>
              GST ({Math.round(r.gstRate * 100)}%{solar ? ' · solar' : ''})
            </span>
            <span>{inr(r.gst)}</span>
          </div>
          <div className='invest-row total'>
            <span>Total financed</span>
            <span>{inr(r.customerPrice)}</span>
          </div>
        </div>

        {/* FINANCING */}
        <div className='fin'>
          <div className='fin-title'>Own it on easy EMIs</div>
          <div className='fin-grid'>
            <div className='fin-item'>
              <div className='fin-item-label'>Monthly EMI</div>
              <div className='fin-item-val'>{inr(r.emi)}</div>
            </div>
            <div className='fin-item'>
              <div className='fin-item-label'>Tenure</div>
              <div className='fin-item-val'>{r.tenureMonths} mo</div>
            </div>
            <div className='fin-item'>
              <div className='fin-item-label'>Payback</div>
              <div className='fin-item-val'>
                {r.paybackMonths <= 12
                  ? `${r.paybackMonths} mo`
                  : `${(r.paybackMonths / 12).toFixed(1)} yr`}
              </div>
            </div>
          </div>
          <div className='fin-note'>
            EMI ₹{inrNum(r.emi)}/mo at{' '}
            {Math.round(CONFIG.ANNUAL_INTEREST * 100)}% p.a.
            {r.netGainMonth > 0 ? (
              <>
                {' '}
                — your savings beat the EMI by{' '}
                <strong>{inr(r.netGainMonth)}/month</strong> from day one.
              </>
            ) : (
              <>
                {' '}
                — savings of {inr(r.totalSaveMonth)}/month offset most of it.
              </>
            )}
          </div>
        </div>

        {/* LEAD CAPTURE */}
        {status === 'done' ? (
          <div className='thanks'>
            <div className='thanks-icon'>{Icon.check}</div>
            <div className='thanks-title'>Thank you</div>
            <div className='thanks-sub'>
              Our team will get back to you shortly with your financing
              quotation.
            </div>
          </div>
        ) : (
          <div className='capture'>
            <div className='capture-title'>Get your financing quotation</div>
            <div className='capture-sub'>
              Drop your number — we’ll call with a tailored plan. No spam.
            </div>
            <div className='capture-row'>
              <div
                className={`phone-field ${phone && !phoneValid ? 'invalid' : ''}`}
              >
                <span className='phone-icon'>{Icon.phone}</span>
                <span className='phone-prefix'>+91</span>
                <input
                  type='tel'
                  inputMode='numeric'
                  placeholder='Mobile number'
                  maxLength={10}
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </div>
              <button
                className='cta'
                disabled={!phoneValid || status === 'sending'}
                onClick={submit}
              >
                {status === 'sending' ? (
                  'Sending…'
                ) : (
                  <>
                    Get quotation{' '}
                    <span className='cta-arrow'>{Icon.arrow}</span>
                  </>
                )}
              </button>
            </div>
            {phone && !phoneValid && (
              <div className='capture-err'>
                Enter a valid 10-digit mobile number.
              </div>
            )}
            {status === 'error' && (
              <div className='capture-err'>
                Couldn’t send right now — please try again.
              </div>
            )}
          </div>
        )}

        <footer className='foot'>
          Indicative figures based on your inputs. Final quotation confirmed
          after a site review.
        </footer>
      </div>
    </div>
  );
}
