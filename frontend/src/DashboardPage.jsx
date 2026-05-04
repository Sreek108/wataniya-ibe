import { useState, useEffect, useCallback } from 'react'
import { getPortfolioSummary, getDashboardOverview, getDashboardPerformance } from './api'
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend, LabelList,
} from 'recharts'

// ── Colour palette ─────────────────────────────────────────────
const C = {
  purple: '#6c63ff', blue: '#3b82f6', green: '#22c55e',
  amber: '#f59e0b', red: '#ef4444', teal: '#14b8a6', gray: '#94a3b8',
}

const PRODUCT_COLORS = {
  'Cash Loan':        '#6c63ff',
  'Other Partners':   '#3b82f6',
  'Premium Partners': '#ef4444',
  'Jarir':            '#f59e0b',
  'Noon':             '#22c55e',
}
const PRODUCTS = ['Cash Loan', 'Other Partners', 'Premium Partners', 'Jarir', 'Noon']

const BUCKET_COLORS = {
  '0 Days':    '#22c55e',
  '1-30':      '#3b82f6',
  '31-60':     '#f59e0b',
  '61-90':     '#f97316',
  'NPA':       '#ef4444',
  'Write-Off': '#6b7280',
}

const RISK_COLORS = {
  'Low Risk': '#22c55e', 'Medium Risk': '#f59e0b',
  'High Risk': '#f97316', 'Very High Risk': '#ef4444',
}

// ── Small helpers ──────────────────────────────────────────────
const sar = (v, decimals = 1) => v != null ? `SAR ${(v / 1e6).toFixed(decimals)}M` : '—'
const pct = v => v != null ? `${v.toFixed(1)}%` : '—'

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>⏳</div>
        <div style={{ color: '#888', fontSize: 14 }}>Loading dashboard...</div>
      </div>
    </div>
  )
}

function ErrorBanner({ msg }) {
  return (
    <div style={{ margin: 24 }}>
      <div style={{ background: '#fef2f2', border: '0.5px solid #fca5a5', borderRadius: 10, padding: 20, color: '#dc2626' }}>
        Failed to load dashboard: {msg}
      </div>
    </div>
  )
}

function KPICard({ label, value, sub, color = C.purple, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', border: '0.5px solid #e8eaf0', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 17 }}>{icon}</div>
        <span style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
      <div style={{ padding: '13px 18px', borderBottom: '0.5px solid #f0f2f7' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: '#aaa', marginLeft: 8 }}>{subtitle}</span>}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

function SelectFilter({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: '#888' }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '7px 28px 7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 8,
          fontSize: 13, fontWeight: 500, background: '#fff', color: '#1a1a2e',
          cursor: 'pointer', outline: 'none', appearance: 'none',
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

const TooltipSAR = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1a1a2e', color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
      {label && <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>}
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill || p.color }} />
          <span style={{ color: '#aaa' }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{typeof p.value === 'number' ? `SAR ${p.value.toFixed(1)}M` : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const [starterType, setStarterType] = useState('')
  const [racStatus,   setRacStatus]   = useState('')

  const [portfolio, setPortfolio] = useState(null)
  const [overview,  setOverview]  = useState(null)
  const [perf,      setPerf]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (starterType) params.starter_type = starterType
      if (racStatus)   params.rac_status   = racStatus

      const [port, ov, pf] = await Promise.all([
        getPortfolioSummary(params),
        getDashboardOverview(),
        getDashboardPerformance(),
      ])
      setPortfolio(port)
      setOverview(ov)
      setPerf(pf)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [starterType, racStatus])

  useEffect(() => { load() }, [load])

  if (loading && !portfolio) return <Spinner />
  if (error && !portfolio)   return <ErrorBanner msg={error} />

  // ── Derived data ─────────────────────────────────────────────
  const tp = portfolio?.total_portfolio   || {}
  const ov = portfolio?.overdue           || {}
  const co = portfolio?.collections       || {}

  const byBucketProduct = portfolio?.by_bucket_product || []
  const byProduct       = portfolio?.by_product        || []
  const collByBucket    = co.by_bucket                 || []
  const loanByBucket    = portfolio?.loan_counts?.by_bucket  || []
  const loanByProduct   = portfolio?.loan_counts?.by_product || []

  // Products present in stacked bar data
  const presentProducts = PRODUCTS.filter(p => byBucketProduct.some(row => row[p] != null))

  // Chart data for existing sections
  const bucketData   = Object.entries(overview?.bucket_distribution || {}).map(([name, value]) => ({ name, value }))
  const riskData     = Object.entries(overview?.risk_distribution   || {}).map(([name, value]) => ({ name, value, color: RISK_COLORS[name] }))
  const channelData  = Object.entries(overview?.channel_distribution|| {}).map(([name, value]) => ({ name, value }))
  const bucketPerfData = Object.entries(perf?.by_bucket || {}).map(([bucket, d]) => ({
    bucket: bucket.replace(' DPD', ''),
    total: d.total, paid: d.paid, payRate: Math.round(d.pay_rate * 100),
  }))

  return (
    <div style={{ padding: 24, maxWidth: 1400, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>Finance › Portfolio Dashboard</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#1a1a2e' }}>Portfolio Dashboard</h1>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>Wataniya Finance — Live Portfolio Intelligence</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {loading && <span style={{ fontSize: 12, color: '#aaa' }}>Refreshing…</span>}
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} />
          <span style={{ fontSize: 12, color: '#666' }}>Updated {lastUpdated.toLocaleTimeString()}</span>
          <button onClick={load} style={{
            padding: '6px 14px', border: '0.5px solid #e0e3eb', borderRadius: 7,
            background: '#fff', fontSize: 12, cursor: 'pointer', color: '#555'
          }}>↻ Refresh</button>
        </div>
      </div>

      {/* ── 1. FILTER BAR ── */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0',
        padding: '14px 20px', marginBottom: 20,
        display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap'
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', alignSelf: 'center', marginRight: 8 }}>Filters</div>
        <SelectFilter
          label="Starter Type"
          value={starterType}
          onChange={setStarterType}
          options={[
            { value: '', label: 'All Types' },
            { value: 'Normal', label: 'Normal' },
            { value: 'Non-Starter', label: 'Non-Starter' },
          ]}
        />
        <SelectFilter
          label="RAC Status"
          value={racStatus}
          onChange={setRacStatus}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'Current', label: 'Current' },
            { value: 'Closed', label: 'Closed' },
          ]}
        />
        {(starterType || racStatus) && (
          <button onClick={() => { setStarterType(''); setRacStatus('') }} style={{
            padding: '7px 14px', border: '0.5px solid #e0e3eb', borderRadius: 8,
            background: '#fff', fontSize: 12, cursor: 'pointer', color: '#888', alignSelf: 'flex-end'
          }}>✕ Clear filters</button>
        )}
        {portfolio?.filters_applied && (starterType || racStatus) && (
          <div style={{ fontSize: 12, color: '#6c63ff', alignSelf: 'flex-end', marginLeft: 'auto' }}>
            Showing {tp.total_accounts?.toLocaleString()} accounts
          </div>
        )}
      </div>

      {/* ── 2. KPI CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPICard
          label="Total Portfolio"
          value={sar(tp.grand_total_sar)}
          sub={`${tp.total_accounts?.toLocaleString() || '—'} accounts`}
          color={C.blue} icon="💼"
        />
        <KPICard
          label="Total Retail"
          value={sar(tp.total_retail_sar)}
          sub="0–90 days"
          color={C.purple} icon="🏦"
        />
        <KPICard
          label="Total NPA"
          value={sar(tp.npa_sar)}
          sub={`NPA rate: ${pct(tp.npa_pct)}`}
          color={C.red} icon="⚠️"
        />
        <KPICard
          label="Total Overdue"
          value={sar(ov.grand_total_sar)}
          sub="Past-due amount"
          color={C.red} icon="📛"
        />
        <KPICard
          label="Day Collections"
          value={sar(co.day_collections_sar)}
          sub="Today's PTPs"
          color={C.green} icon="📈"
        />
        <KPICard
          label="MTD Collections"
          value={sar(co.mtd_collections_sar)}
          sub="Month-to-date PTPs"
          color={C.teal} icon="✅"
        />
      </div>

      {/* ── 3 + 4. STACKED BAR + NPA % BY PRODUCT ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16, marginBottom: 16 }}>

        {/* 3. DPD Bucket Breakdown — stacked bar by product */}
        <SectionCard title="Outstanding Balance by DPD Bucket" subtitle="SAR M · stacked by product">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byBucketProduct} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}M`} />
              <Tooltip content={<TooltipSAR />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {presentProducts.map(p => (
                <Bar key={p} dataKey={p} stackId="a" fill={PRODUCT_COLORS[p]} radius={p === presentProducts[presentProducts.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* 4. NPA % by Product — horizontal bar */}
        <SectionCard title="NPA % by Product" subtitle="Color: green <5% · amber 5-12% · red >12%">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              layout="vertical"
              data={byProduct}
              margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
            >
              <XAxis type="number" unit="%" domain={[0, Math.max(...byProduct.map(p => p.npa_pct || 0)) + 3]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="product_type" tick={{ fontSize: 11 }} width={100} />
              <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'NPA %']} />
              <Bar dataKey="npa_pct" radius={[0, 4, 4, 0]}>
                {byProduct.map(entry => (
                  <Cell
                    key={entry.product_type}
                    fill={entry.npa_pct < 5 ? C.green : entry.npa_pct < 12 ? C.amber : C.red}
                  />
                ))}
                <LabelList
                  dataKey="npa_pct"
                  position="right"
                  formatter={v => `${v.toFixed(1)}%`}
                  style={{ fontSize: 11, fontWeight: 700, fill: '#555' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* ── 5 + 6. COLLECTIONS DONUT + LOAN COUNT TABLE ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 16 }}>

        {/* 5. Collections Breakdown — donut */}
        <SectionCard title="MTD Collections by Bucket" subtitle="PTP amounts · April 2026">
          {collByBucket.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 30 }}>No collections data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={collByBucket}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75}
                    paddingAngle={3}
                    dataKey="mtd_sar"
                    nameKey="bucket"
                  >
                    {collByBucket.map(entry => (
                      <Cell key={entry.bucket} fill={BUCKET_COLORS[entry.bucket] || '#aaa'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`SAR ${(v / 1e6).toFixed(2)}M`, 'MTD Collections']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                {collByBucket.map(b => (
                  <div key={b.bucket} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: BUCKET_COLORS[b.bucket] || '#aaa', flexShrink: 0 }} />
                    <span style={{ flex: 1, color: '#555' }}>{b.bucket}</span>
                    <span style={{ fontWeight: 700, color: '#1a1a2e' }}>SAR {b.mtd_sar_m.toFixed(1)}M</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        {/* 6. Loan Count Table */}
        <SectionCard title="Loan Count Summary" subtitle="By bucket and product">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* By bucket */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>By DPD Bucket</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Bucket', 'Count', 'SAR M', 'NPA%'].map(h => (
                      <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#aaa', borderBottom: '0.5px solid #e8eaf0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loanByBucket.map((row, i) => (
                    <tr key={row.bucket} style={{ borderBottom: i < loanByBucket.length - 1 ? '0.5px solid #f5f6fa' : 'none' }}>
                      <td style={{ padding: '7px 8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${BUCKET_COLORS[row.bucket] || '#aaa'}18`, color: BUCKET_COLORS[row.bucket] || '#888' }}>{row.bucket}</span>
                      </td>
                      <td style={{ padding: '7px 8px', fontWeight: 600 }}>{row.count.toLocaleString()}</td>
                      <td style={{ padding: '7px 8px', color: C.blue }}>{row.outstanding_sar_m}</td>
                      <td style={{ padding: '7px 8px', fontWeight: 700, color: row.npa_pct > 12 ? C.red : row.npa_pct > 5 ? C.amber : C.green }}>
                        {row.npa_pct > 0 ? `${row.npa_pct}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* By product */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>By Product</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Product', 'Count', 'SAR M', 'NPA%'].map(h => (
                      <th key={h} style={{ padding: '5px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#aaa', borderBottom: '0.5px solid #e8eaf0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loanByProduct.map((row, i) => (
                    <tr key={row.product} style={{ borderBottom: i < loanByProduct.length - 1 ? '0.5px solid #f5f6fa' : 'none' }}>
                      <td style={{ padding: '7px 8px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: PRODUCT_COLORS[row.product] || '#aaa', flexShrink: 0 }} />
                          <span style={{ color: '#555' }}>{row.product}</span>
                        </span>
                      </td>
                      <td style={{ padding: '7px 8px', fontWeight: 600 }}>{row.count.toLocaleString()}</td>
                      <td style={{ padding: '7px 8px', color: C.blue }}>{row.outstanding_sar_m}</td>
                      <td style={{ padding: '7px 8px', fontWeight: 700, color: row.npa_pct > 12 ? C.red : row.npa_pct > 5 ? C.amber : C.green }}>
                        {row.npa_pct > 0 ? `${row.npa_pct}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Existing ML / Collection charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        <SectionCard title="Delinquency Buckets">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={bucketData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                {bucketData.map(e => <Cell key={e.name} fill={BUCKET_COLORS[e.name] || '#aaa'} />)}
              </Pie>
              <Tooltip formatter={(v) => [v.toLocaleString(), 'Accounts']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {bucketData.map(b => (
              <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: BUCKET_COLORS[b.name] || '#aaa', flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#555' }}>{b.name}</span>
                <span style={{ fontWeight: 600 }}>{b.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="ML Risk Tiers">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={riskData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                {riskData.map(e => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [v.toLocaleString(), 'Accounts']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
            {riskData.map(r => (
              <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#555' }}>{r.name}</span>
                <span style={{ fontWeight: 600 }}>{r.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recommended Channels">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={channelData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name="Accounts" fill={C.purple} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 4 }}>AI-assigned contact channel</div>
        </SectionCard>
      </div>

      {/* Bucket Performance Table */}
      <SectionCard title="Collection Performance by Bucket" subtitle="Pay rate vs volume">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Bucket', 'Total', 'Paid', 'Not Paid', 'Pay Rate', 'Avg Score', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#fafbfc', borderBottom: '0.5px solid #e8eaf0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(perf?.by_bucket || {}).map(([bucket, d]) => {
                const rate = Math.round(d.pay_rate * 100)
                const col = rate >= 70 ? C.green : rate >= 40 ? C.amber : C.red
                return (
                  <tr key={bucket} style={{ borderBottom: '0.5px solid #f0f2f7' }}>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: `${BUCKET_COLORS[bucket] || '#aaa'}18`, color: BUCKET_COLORS[bucket] || '#888' }}>{bucket}</span>
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>{d.total?.toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', color: C.green, fontWeight: 600 }}>{d.paid?.toLocaleString()}</td>
                    <td style={{ padding: '9px 12px', color: C.red }}>{(d.total - d.paid)?.toLocaleString()}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 5, background: '#f0f2f7', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                          <div style={{ height: '100%', width: `${rate}%`, background: col, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontWeight: 700, color: col, minWidth: 34 }}>{rate}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: C.purple }}>{d.avg_score}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: rate >= 50 ? '#dcfce7' : '#fef2f2', color: rate >= 50 ? '#166534' : '#991b1b' }}>
                        {rate >= 70 ? 'On Track' : rate >= 40 ? 'At Risk' : 'Critical'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

    </div>
  )
}
