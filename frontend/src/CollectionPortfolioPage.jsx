import { useState, useEffect } from 'react'
import { BarChart2 } from 'lucide-react'
import { getPortfolioSummary } from './api'

// ── Constants ────────────────────────────────────────────────────────────────

// Keys as returned by the backend BUCKET_ORDER
const PORT_KEYS   = ['0 Days', '1-30', '31-60', '61-90', 'NPA']           // portfolio / overdue / loan-count tables
const COL_KEYS    = ['0 Days', '1-30', '31-60', '61-90', 'NPA', 'Write-Off'] // collections tables

const BUCKET_LABEL = {
  '0 Days': '0 Days', '1-30': '1-30 Days', '31-60': '31-60 Days',
  '61-90': '61-90 Days', 'NPA': 'NPA', 'Write-Off': 'Write-Off',
}

const TODAY = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

// ── Math helpers ─────────────────────────────────────────────────────────────

const r2   = n => Math.round((n || 0) * 100) / 100
const sum  = (...vals) => r2(vals.reduce((a, v) => a + (v || 0), 0))
const pct  = (num, den) => den > 0 ? Math.round(num / den * 10000) / 100 : 0

function buildRows(matrix, keys) {
  const rows = {}
  for (const k of keys) {
    const m       = (matrix || {})[k] || {}
    const invoice = sum(m.Jarir, m['Premium Partners'], m['Other Partners'], m.Noon)
    const cash    = r2(m['Cash Loan'] || 0)
    const sme     = r2(m.SME || 0)
    const retail  = sum(invoice, cash)
    const grand   = sum(retail, sme)
    rows[k] = { invoice, cash, retail, sme, grand }
  }
  return rows
}

function grandTotalRow(rows, keys) {
  const gt = { invoice: 0, cash: 0, retail: 0, sme: 0, grand: 0 }
  for (const k of keys) {
    const r = rows[k] || {}
    gt.invoice += r.invoice || 0
    gt.cash    += r.cash    || 0
    gt.retail  += r.retail  || 0
    gt.sme     += r.sme     || 0
    gt.grand   += r.grand   || 0
  }
  return { invoice: r2(gt.invoice), cash: r2(gt.cash), retail: r2(gt.retail), sme: r2(gt.sme), grand: r2(gt.grand) }
}

function npaPctRow(rows, gt) {
  const npa = rows['NPA'] || {}
  return {
    invoice: pct(npa.invoice || 0, gt.invoice),
    cash:    pct(npa.cash    || 0, gt.cash),
    retail:  pct(npa.retail  || 0, gt.retail),
    sme:     pct(npa.sme     || 0, gt.sme),
    grand:   pct(npa.grand   || 0, gt.grand),
  }
}

// ── Format helpers ────────────────────────────────────────────────────────────

const fmtSAR  = v => v == null ? '—' : Number(v).toFixed(2)
const fmtInt  = v => v == null ? '—' : Math.round(v).toLocaleString()
const sarM    = v => {
  if (v == null) return '—'
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}B`
  return `SAR ${Number(v).toFixed(0)}M`
}
const npaClr  = p => p > 10 ? '#dc2626' : p >= 5 ? '#d97706' : '#16a34a'
const pctClr  = p => p > 10 ? '#dc2626' : p >= 5 ? '#d97706' : '#16a34a'

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(title, keys, rows, gt, npaPct, fmt) {
  const hdr   = ['DPD Bucket', 'Invoice Loan', 'Cash Loan', 'Total Retail', 'SME', 'Grand Total']
  const lines = [hdr.join(',')]
  for (const k of keys) {
    const r = rows[k] || {}
    lines.push([BUCKET_LABEL[k] || k, fmt(r.invoice), fmt(r.cash), fmt(r.retail), fmt(r.sme), fmt(r.grand)].join(','))
  }
  lines.push(['Grand Total', fmt(gt.invoice), fmt(gt.cash), fmt(gt.retail), fmt(gt.sme), fmt(gt.grand)].join(','))
  if (npaPct) lines.push(['NPA%', npaPct.invoice+'%', npaPct.cash+'%', npaPct.retail+'%', npaPct.sme+'%', npaPct.grand+'%'].join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: title.replace(/\s+/g, '_') + '.csv' }).click()
  URL.revokeObjectURL(url)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, bg }) {
  return (
    <div style={{ flex: 1, minWidth: 140, background: bg || '#fff', border: '0.5px solid #e8eaf0', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || '#1a1a2e', lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const TH = (extra = {}) => ({
  padding: '10px 12px', textAlign: 'right', fontSize: 11, fontWeight: 700,
  color: '#fff', whiteSpace: 'nowrap', background: '#1e3a5f',
  borderRight: '1px solid #2d5080', ...extra,
})
const TD = (extra = {}) => ({
  padding: '8px 12px', textAlign: 'right', fontSize: 12,
  color: '#374151', borderRight: '0.5px solid #f0f2f7',
  whiteSpace: 'nowrap', ...extra,
})

function TableSection({ title, exportName, bucketKeys, rows, gt, npaPct, fmt, isCount }) {
  return (
    <div style={{ background: '#fff', border: '0.5px solid #e8eaf0', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '0.5px solid #e8eaf0', background: '#f8fafc' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>{title}</span>
        <button onClick={() => exportCSV(exportName, bucketKeys, rows, gt, npaPct, fmt)}
          style={{ fontSize: 11, fontWeight: 600, color: '#6c63ff', background: '#f0eeff', border: '0.5px solid #c4b5fd', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Export CSV
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...TH({ textAlign: 'left', minWidth: 110 }) }}>DPD Bucket</th>
              <th style={TH()}>Invoice Loan</th>
              <th style={TH()}>Cash Loan</th>
              <th style={{ ...TH(), background: '#163057', borderLeft: '2px solid #2d5080' }}>Total Retail</th>
              <th style={TH()}>SME</th>
              <th style={{ ...TH(), background: '#0f2240', borderLeft: '2px solid #2d5080' }}>Grand Total</th>
            </tr>
          </thead>
          <tbody>
            {bucketKeys.map((k, i) => {
              const r     = rows[k] || {}
              const isNPA = k === 'NPA'
              const rowBg = isNPA ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#f8fafc'
              const tc    = isNPA ? '#dc2626' : '#374151'
              return (
                <tr key={k} style={{ background: rowBg, borderBottom: '0.5px solid #f0f2f7' }}>
                  <td style={{ ...TD({ textAlign: 'left', fontWeight: 600, color: isNPA ? '#dc2626' : '#374151' }) }}>{BUCKET_LABEL[k] || k}</td>
                  <td style={TD({ color: tc })}>{fmt(r.invoice)}</td>
                  <td style={TD({ color: tc })}>{fmt(r.cash)}</td>
                  <td style={{ ...TD({ background: isNPA ? '#fee2e2' : i%2===0?'#f0f4ff':'#eaefff', borderLeft: '2px solid #e8eaf0', fontWeight: 600, color: isNPA?'#dc2626':'#1e3a5f' }) }}>{fmt(r.retail)}</td>
                  <td style={TD({ color: tc })}>{fmt(r.sme)}</td>
                  <td style={{ ...TD({ background: isNPA ? '#fee2e2' : i%2===0?'#eef2ff':'#e8edff', borderLeft: '2px solid #e8eaf0', fontWeight: 700, color: isNPA?'#dc2626':'#1e3a5f' }) }}>{fmt(r.grand)}</td>
                </tr>
              )
            })}
            <tr style={{ background: '#1e293b', borderTop: '2px solid #0f172a' }}>
              <td style={{ ...TD({ textAlign: 'left', fontWeight: 700, color: '#fff', background: '#1e293b' }) }}>Grand Total</td>
              {['invoice','cash'].map(f => (
                <td key={f} style={{ ...TD({ color: '#e2e8f0', fontWeight: 700, background: '#1e293b' }) }}>{fmt(gt[f])}</td>
              ))}
              <td style={{ ...TD({ color: '#93c5fd', fontWeight: 800, background: '#162032', borderLeft: '2px solid #2d5080' }) }}>{fmt(gt.retail)}</td>
              <td style={{ ...TD({ color: '#e2e8f0', fontWeight: 700, background: '#1e293b' }) }}>{fmt(gt.sme)}</td>
              <td style={{ ...TD({ color: '#67e8f9', fontWeight: 800, background: '#0d1829', borderLeft: '2px solid #2d5080' }) }}>{fmt(gt.grand)}</td>
            </tr>
            {npaPct && (
              <tr style={{ background: '#fffbeb', borderTop: '0.5px solid #fde68a' }}>
                <td style={{ ...TD({ textAlign: 'left', fontWeight: 700, color: '#92400e' }) }}>NPA %</td>
                <td style={{ ...TD({ fontWeight: 700, color: pctClr(npaPct.invoice) }) }}>{npaPct.invoice}%</td>
                <td style={{ ...TD({ fontWeight: 700, color: pctClr(npaPct.cash) }) }}>{npaPct.cash}%</td>
                <td style={{ ...TD({ fontWeight: 800, color: pctClr(npaPct.retail), borderLeft: '2px solid #e8eaf0' }) }}>{npaPct.retail}%</td>
                <td style={{ ...TD({ fontWeight: 700, color: npaPct.sme >= 90 ? '#dc2626' : pctClr(npaPct.sme) }) }}>{npaPct.sme}%</td>
                <td style={{ ...TD({ fontWeight: 800, color: pctClr(npaPct.grand), borderLeft: '2px solid #e8eaf0' }) }}>{npaPct.grand}%</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CollectionPortfolioPage() {
  const [filter,  setFilter]  = useState('All')
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Map toggle label → API param
  const starterParam = { All: undefined, Normal: 'Normal', 'Non-Starter': 'Non-Starter' }

  useEffect(() => {
    setLoading(true)
    setError(null)
    const param = starterParam[filter]
    const q     = param ? `?starter_type=${encodeURIComponent(param)}` : ''
    getPortfolioSummary(param ? { starter_type: param } : {})
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message || 'Failed to load'); setLoading(false) })
  }, [filter])

  // ── Derive table data from API response ──────────────────────────────────
  const portRows = buildRows(data?.by_bucket_product_matrix, PORT_KEYS)
  const portGT   = grandTotalRow(portRows, PORT_KEYS)
  const portNPA  = npaPctRow(portRows, portGT)

  const cntRows  = buildRows(data?.loan_count_matrix, PORT_KEYS)
  const cntGT    = grandTotalRow(cntRows, PORT_KEYS)
  const cntNPA   = npaPctRow(cntRows, cntGT)

  const ovdRows  = buildRows(data?.overdue_matrix, PORT_KEYS)
  const ovdGT    = grandTotalRow(ovdRows, PORT_KEYS)
  const ovdNPA   = npaPctRow(ovdRows, ovdGT)

  const dayRows  = buildRows(data?.day_collections_matrix, COL_KEYS)
  const dayGT    = grandTotalRow(dayRows, COL_KEYS)

  const mtdRows  = buildRows(data?.mtd_collections_matrix, COL_KEYS)
  const mtdGT    = grandTotalRow(mtdRows, COL_KEYS)

  // ── KPI values ───────────────────────────────────────────────────────────
  const kpi = {
    total_sar:      data ? (data.total_portfolio.grand_total_sar / 1e6).toFixed(2) : '—',
    loan_count:     data ? data.total_portfolio.total_accounts.toLocaleString() : '—',
    retail_npa_pct: portGT.retail > 0 ? pct(portRows['NPA']?.retail || 0, portGT.retail) : 0,
    sme_npa_pct:    portGT.sme    > 0 ? pct(portRows['NPA']?.sme    || 0, portGT.sme)    : 0,
    total_npa_pct:  data?.total_portfolio.npa_pct ?? 0,
    mtd_sar:        data ? (data.collections.mtd_collections_sar / 1e6).toFixed(2) : '—',
  }

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#1e3a5f,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart2 size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Collection Portfolio</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 1 }}>LC DPD MIS Summary — Total Portfolio View</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#888', background: '#fff', border: '0.5px solid #e8eaf0', borderRadius: 6, padding: '5px 10px' }}>{TODAY}</span>
          <div style={{ display: 'flex', background: '#fff', border: '0.5px solid #e8eaf0', borderRadius: 9, padding: 3, gap: 2 }}>
            {['All', 'Normal', 'Non-Starter'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '6px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  background: filter === f ? '#1e3a5f' : 'transparent',
                  color:      filter === f ? '#fff'    : '#555' }}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 80, color: '#aaa', fontSize: 14 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8eaf0', borderTopColor: '#6c63ff', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          Loading portfolio data...
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {error && !loading && (
        <div style={{ background: '#fef2f2', border: '0.5px solid #fca5a5', borderRadius: 12, padding: '20px 24px', color: '#dc2626', fontSize: 13 }}>
          Failed to load portfolio data: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            <KpiCard
              label="Total Portfolio"
              value={`SAR ${kpi.total_sar}M`}
              sub={`Starter Type: ${filter}`}
              color="#1e3a5f" bg="#eff6ff"
            />
            <KpiCard
              label="Total Customers"
              value={kpi.loan_count}
              sub="Loan accounts"
              color="#1e40af" bg="#eff6ff"
            />
            <KpiCard
              label="Retail NPA %"
              value={`${kpi.retail_npa_pct}%`}
              sub="Total Retail portfolio"
              color={npaClr(kpi.retail_npa_pct)}
              bg={kpi.retail_npa_pct > 10 ? '#fef2f2' : kpi.retail_npa_pct >= 5 ? '#fffbeb' : '#f0fdf4'}
            />
            <KpiCard
              label="SME NPA %"
              value={`${kpi.sme_npa_pct}%`}
              sub="SME portfolio"
              color={kpi.sme_npa_pct >= 90 ? '#dc2626' : npaClr(kpi.sme_npa_pct)}
              bg={kpi.sme_npa_pct >= 90 ? '#fef2f2' : '#fff'}
            />
            <KpiCard
              label="Total NPA %"
              value={`${kpi.total_npa_pct}%`}
              sub="Grand total portfolio"
              color={npaClr(kpi.total_npa_pct)}
              bg={kpi.total_npa_pct > 10 ? '#fef2f2' : '#fffbeb'}
            />
            <KpiCard
              label="MTD Collections"
              value={`SAR ${kpi.mtd_sar}M`}
              sub="Month-to-date collected"
              color="#16a34a" bg="#f0fdf4"
            />
          </div>

          {/* Table 1 — Portfolio */}
          <TableSection
            title={`Total Collection (SAR M)   |   ${filter}`}
            exportName={`portfolio_${filter}`}
            bucketKeys={PORT_KEYS}
            rows={portRows}
            gt={portGT}
            npaPct={portNPA}
            fmt={fmtSAR}
          />

          {/* Table 2 — Loan Count */}
          <TableSection
            title={`Loan Account Count   |   ${filter}`}
            exportName={`loan_count_${filter}`}
            bucketKeys={PORT_KEYS}
            rows={cntRows}
            gt={cntGT}
            npaPct={cntNPA}
            fmt={fmtInt}
            isCount
          />

          {/* Table 3 — Overdue */}
          <TableSection
            title={`Overdue Amount (SAR M)   |   ${filter}`}
            exportName={`overdue_${filter}`}
            bucketKeys={PORT_KEYS}
            rows={ovdRows}
            gt={ovdGT}
            npaPct={ovdNPA}
            fmt={fmtSAR}
          />

          {/* Table 4 — Day Collections */}
          <TableSection
            title={`Day Collections (SAR M) — ${TODAY}   |   ${filter}`}
            exportName={`day_collections_${filter}`}
            bucketKeys={COL_KEYS}
            rows={dayRows}
            gt={dayGT}
            npaPct={null}
            fmt={fmtSAR}
          />

          {/* Table 5 — MTD Collections */}
          <TableSection
            title={`MTD Collections (SAR M)   |   ${filter}`}
            exportName={`mtd_collections_${filter}`}
            bucketKeys={COL_KEYS}
            rows={mtdRows}
            gt={mtdGT}
            npaPct={null}
            fmt={fmtSAR}
          />
        </>
      )}
    </div>
  )
}
