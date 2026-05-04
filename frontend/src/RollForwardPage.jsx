import { useState, useEffect } from 'react'
import { getRollForward, getCollectionEfficiency } from './api'

// Bucket names exactly as returned by the API (best → worst)
const API_BUCKETS = ['0 Days', '1-30 Days', '31-60 Days', '61-90 Days', 'NPA 91-180', 'NPA 181-360', 'NPA 361-450', 'Write-Off']

const BUCKET_LABEL = {
  '0 Days':      'Current',
  '1-30 Days':   '1-30 DPD',
  '31-60 Days':  '31-60 DPD',
  '61-90 Days':  '61-90 DPD',
  'NPA 91-180':  'NPA 91-180',
  'NPA 181-360': 'NPA 181-360',
  'NPA 361-450': 'NPA 361-450',
  'Write-Off':   'Write-Off',
}

const BUCKET_COLORS = {
  '0 Days':      '#22c55e',
  '1-30 Days':   '#86efac',
  '31-60 Days':  '#f59e0b',
  '61-90 Days':  '#f97316',
  'NPA 91-180':  '#ef4444',
  'NPA 181-360': '#dc2626',
  'NPA 361-450': '#991b1b',
  'Write-Off':   '#6b7280',
}

function fmt(n) { return n != null ? Number(n).toLocaleString() : '—' }
function sarM(n) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return String(n)
}

function KpiCard({ label, value, sub, color, bg }) {
  return (
    <div style={{ background: bg || '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '18px 22px', flex: 1 }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || '#1a1a2e', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

function HBar({ label, count, sar, max, color }) {
  const pct = max > 0 ? Math.min((count / max) * 100, 100) : 0
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: BUCKET_COLORS[label] || color, flexShrink: 0 }} />
          <span style={{ color: '#555', fontWeight: 500 }}>{label}</span>
        </span>
        <span style={{ fontWeight: 700, color }}>{count} <span style={{ fontWeight: 400, color: '#aaa', fontSize: 11 }}>· SAR {sarM(sar)}</span></span>
      </div>
      <div style={{ height: 7, background: '#f0f2f7', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

export default function RollForwardPage() {
  const [period, setPeriod]   = useState('month')
  const [report, setReport]   = useState(null)
  const [effic, setEffic]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getRollForward(period), getCollectionEfficiency()])
      .then(([r, e]) => { setReport(r); setEffic(e) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [period])

  // Build matrix lookup: { 'from_b::to_b': { count, sar } }
  const matrixMap = {}
  for (const cell of (report?.matrix || [])) {
    matrixMap[`${cell.from_bucket}::${cell.to_bucket}`] = cell
  }

  // Compute row totals and col totals
  const rowTotals = {}
  const colTotals = {}
  for (const b of API_BUCKETS) { rowTotals[b] = { count: 0, sar: 0 }; colTotals[b] = { count: 0, sar: 0 } }
  for (const cell of (report?.matrix || [])) {
    if (rowTotals[cell.from_bucket]) { rowTotals[cell.from_bucket].count += cell.count; rowTotals[cell.from_bucket].sar += cell.sar }
    if (colTotals[cell.to_bucket])  { colTotals[cell.to_bucket].count  += cell.count;  colTotals[cell.to_bucket].sar  += cell.sar  }
  }

  const net = report?.net_movement_sar ?? 0
  const netColor = net >= 0 ? '#22c55e' : '#ef4444'

  const maxDet = Math.max(...(report?.top_deteriorating_segments || []).map(s => s.count), 1)
  const maxImp = Math.max(...(report?.top_improving_segments     || []).map(s => s.count), 1)

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Portfolio Roll Forward / Roll Back</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Account movement between delinquency buckets over the selected period</div>
        </div>
        <div style={{ display: 'flex', gap: 2, background: '#fff', borderRadius: 9, border: '0.5px solid #e8eaf0', padding: 3 }}>
          {['week','month','quarter'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '7px 18px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: period === p ? '#6c63ff' : 'transparent',
                color: period === p ? '#fff' : '#555' }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#aaa', fontSize: 14 }}>Computing portfolio movement...</div>
      ) : (
        <>
          {/* KPI strip */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
            <KpiCard
              label="Rolled Forward (Worsened)"
              value={fmt(report?.rolled_forward?.count)}
              sub={`SAR ${sarM(report?.rolled_forward?.sar)} at risk`}
              color="#ef4444" bg="#fef2f2"
            />
            <KpiCard
              label="Rolled Back (Improved)"
              value={fmt(report?.rolled_back?.count)}
              sub={`SAR ${sarM(report?.rolled_back?.sar)} recovered`}
              color="#22c55e" bg="#f0fdf4"
            />
            <KpiCard
              label="Stable"
              value={fmt(report?.stable?.count)}
              sub={`SAR ${sarM(report?.stable?.sar)}`}
              color="#6b7280"
            />
            <KpiCard
              label="Net Movement"
              value={`${net >= 0 ? '+' : ''}${sarM(net)}`}
              sub={net >= 0 ? 'Portfolio improving' : 'Portfolio deteriorating'}
              color={netColor}
              bg={net >= 0 ? '#f0fdf4' : '#fef2f2'}
            />
          </div>

          {/* Migration Matrix */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', marginBottom: 24, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0f2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>Bucket Migration Matrix</span>
              <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#fef2f2', border: '1px solid #fca5a5' }} />Rolled Forward</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#f0fdf4', border: '1px solid #86efac' }} />Rolled Back</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#f8f9fc', border: '1px solid #e8eaf0' }} />Stable</span>
              </div>
            </div>
            <div style={{ overflowX: 'auto', padding: '0 4px 4px' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: '#888', fontWeight: 600, whiteSpace: 'nowrap' }}>From ↓ / To →</th>
                    {API_BUCKETS.map(b => (
                      <th key={b} style={{ padding: '8px 10px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: BUCKET_COLORS[b] || '#888', whiteSpace: 'nowrap', minWidth: 90 }}>
                        {BUCKET_LABEL[b] || b}
                      </th>
                    ))}
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#888' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {API_BUCKETS.map((fromB, ri) => (
                    <tr key={fromB}>
                      <td style={{ padding: '8px 14px', fontWeight: 700, fontSize: 11, color: BUCKET_COLORS[fromB] || '#888', whiteSpace: 'nowrap' }}>
                        {BUCKET_LABEL[fromB] || fromB}
                      </td>
                      {API_BUCKETS.map((toB, ci) => {
                        const cell = matrixMap[`${fromB}::${toB}`]
                        // ri < ci = from better to worse = rolled forward = red
                        // ri > ci = from worse to better = rolled back   = green
                        // ri == ci = stable = gray
                        let bg = 'transparent'
                        if (ri === ci)      bg = '#f8f9fc'
                        else if (ri < ci)   bg = '#fef2f250'
                        else                bg = '#f0fdf450'
                        if (cell) {
                          if (ri === ci)    bg = '#f1f5f9'
                          else if (ri < ci) bg = '#fee2e2'
                          else              bg = '#dcfce7'
                        }
                        return (
                          <td key={toB} style={{ padding: '8px 10px', textAlign: 'center', borderRadius: 6, background: bg, transition: 'background 0.2s' }}>
                            {cell ? (
                              <>
                                <div style={{ fontWeight: 700, fontSize: 13, color: ri < ci ? '#ef4444' : ri > ci ? '#16a34a' : '#6b7280' }}>
                                  {cell.count}
                                </div>
                                <div style={{ fontSize: 9, color: '#aaa', marginTop: 1 }}>SAR {sarM(cell.sar)}</div>
                              </>
                            ) : <span style={{ color: '#e5e7eb', fontSize: 16 }}>·</span>}
                          </td>
                        )
                      })}
                      <td style={{ padding: '8px 10px', textAlign: 'center', background: '#fafbfc', borderRadius: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#1a1a2e' }}>{rowTotals[fromB]?.count || 0}</div>
                        <div style={{ fontSize: 9, color: '#aaa' }}>SAR {sarM(rowTotals[fromB]?.sar)}</div>
                      </td>
                    </tr>
                  ))}
                  {/* Column totals row */}
                  <tr style={{ borderTop: '2px solid #f0f2f7' }}>
                    <td style={{ padding: '8px 14px', fontWeight: 700, fontSize: 11, color: '#888' }}>Total</td>
                    {API_BUCKETS.map(b => (
                      <td key={b} style={{ padding: '8px 10px', textAlign: 'center', background: '#fafbfc', borderRadius: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#1a1a2e' }}>{colTotals[b]?.count || 0}</div>
                        <div style={{ fontSize: 9, color: '#aaa' }}>SAR {sarM(colTotals[b]?.sar)}</div>
                      </td>
                    ))}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Movement Summary panels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Top deteriorating */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>Top Deteriorating Segments</div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 14 }}>Buckets receiving the most worsening accounts</div>
              {(report?.top_deteriorating_segments || []).length === 0 ? (
                <div style={{ color: '#aaa', fontSize: 12 }}>No deterioration detected</div>
              ) : (report?.top_deteriorating_segments || []).map(s => (
                <HBar key={s.bucket} label={s.bucket} count={s.count} sar={s.sar} max={maxDet} color="#ef4444" />
              ))}
            </div>

            {/* Top improving */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>Top Improving Segments</div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 14 }}>Buckets gaining the most recovering accounts</div>
              {(report?.top_improving_segments || []).length === 0 ? (
                <div style={{ color: '#aaa', fontSize: 12 }}>No improvement detected</div>
              ) : (report?.top_improving_segments || []).map(s => (
                <HBar key={s.bucket} label={s.bucket} count={s.count} sar={s.sar} max={maxImp} color="#22c55e" />
              ))}
            </div>
          </div>

          {/* Collection Efficiency */}
          {effic && (
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0f2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>Collection Efficiency</span>
                  <span style={{ marginLeft: 12, fontSize: 12, color: '#888' }}>Target vs Actual by bucket</span>
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
                  <span>Portfolio: <strong>SAR {sarM(effic.total_portfolio_sar)}</strong></span>
                  <span>Overall Rate: <strong style={{ color: '#6c63ff' }}>{effic.collection_rate_pct}%</strong></span>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#fafbfc', borderBottom: '0.5px solid #e8eaf0' }}>
                      {['Bucket','Accounts','Portfolio SAR','Target %','Actual %','Gap','Status'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(effic.by_bucket || []).map((b, i) => {
                      const gap    = b.gap
                      const above  = gap >= 0
                      const bc     = BUCKET_COLORS[b.bucket] || '#888'
                      return (
                        <tr key={b.bucket} style={{ borderBottom: '0.5px solid #f5f6fa', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${bc}18`, color: bc }}>{b.bucket}</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#555' }}>{fmt(b.total_accounts)}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1a1a2e' }}>SAR {sarM(b.total_sar)}</td>
                          <td style={{ padding: '12px 16px', color: '#888' }}>{b.target_pct}%</td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: above ? '#16a34a' : '#dc2626' }}>
                            {b.actual_pct}%
                            <div style={{ height: 4, background: '#f0f2f7', borderRadius: 2, marginTop: 4, width: 60 }}>
                              <div style={{ height: '100%', width: `${Math.min(b.actual_pct, 100)}%`, background: above ? '#22c55e' : '#ef4444', borderRadius: 2 }} />
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: above ? '#16a34a' : '#dc2626' }}>
                            {gap >= 0 ? '+' : ''}{gap}%
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                              background: above ? '#dcfce7' : '#fee2e2',
                              color: above ? '#166534' : '#991b1b' }}>
                              {above ? '✓ On Target' : '✗ Below Target'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
