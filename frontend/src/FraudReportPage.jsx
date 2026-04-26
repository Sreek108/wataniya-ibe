import { useState, useEffect } from 'react'
import { getFraudReport, removeFraudFlag } from './api'
import { useAuth } from './AuthContext'

const SEV_META = {
  High:   { color: '#dc2626', bg: '#fef2f2' },
  Medium: { color: '#f59e0b', bg: '#fef3c7' },
  Low:    { color: '#6b7280', bg: '#f1f5f9' },
}
const BUCKET_COLORS = { '1-30 DPD':'#22c55e','31-60 DPD':'#f59e0b','61-90 DPD':'#f97316','NPA':'#ef4444','Write-off':'#6b7280' }
const REASON_COLORS = {
  'Dispute':              { color: '#3b82f6', bg: '#eff6ff' },
  'Incorrect Info':       { color: '#8b5cf6', bg: '#f5f3ff' },
  'Suspected Fraud':      { color: '#ef4444', bg: '#fee2e2' },
  'Identity Theft':       { color: '#dc2626', bg: '#fef2f2' },
  'Payment Manipulation': { color: '#f97316', bg: '#fff7ed' },
}

function KpiCard({ label, value, sub, color, bg }) {
  return (
    <div style={{ background: bg || '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '18px 22px', flex: 1 }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || '#1a1a2e', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function HBar({ label, count, max, color }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: '#555', fontWeight: 500 }}>{label}</span>
        <span style={{ fontWeight: 700, color: color || '#1a1a2e' }}>{count}</span>
      </div>
      <div style={{ height: 7, background: '#f0f2f7', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color || '#6c63ff', borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

export default function FraudReportPage() {
  const { user } = useAuth()
  const canRemove = ['admin', 'supervisor'].includes(user?.role)

  const [report, setReport]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [sevFilter, setSevFilter]   = useState('All')
  const [reasonFilter, setReasonFilter] = useState('All')
  const [bucketFilter, setBucketFilter] = useState('All')
  const [removing, setRemoving]     = useState(null)

  function load() {
    setLoading(true)
    getFraudReport()
      .then(d => setReport(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleRemove(account_id) {
    if (!window.confirm('Remove fraud flag from this account?')) return
    setRemoving(account_id)
    try {
      await removeFraudFlag(account_id)
      load()
    } catch (e) { alert(e.message) }
    finally { setRemoving(null) }
  }

  const accounts   = report?.flagged_accounts || []
  const byReason   = report?.by_reason  || {}
  const byBucket   = report?.by_bucket  || {}
  const maxReason  = Math.max(...Object.values(byReason), 1)
  const maxBucket  = Math.max(...Object.values(byBucket), 1)

  const filtered = accounts.filter(f => {
    if (sevFilter    !== 'All' && f.severity    !== sevFilter)    return false
    if (reasonFilter !== 'All' && f.reason      !== reasonFilter) return false
    if (bucketFilter !== 'All' && f.bucket      !== bucketFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!f.account_id.toLowerCase().includes(q) && !f.customer_name.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Fraud & Dispute Flags</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Accounts flagged for fraud, dispute, or data integrity issues</div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa', fontSize: 14 }}>Loading fraud report...</div>
      ) : (
        <>
          {/* KPI strip */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
            <KpiCard
              label="Total Flagged"
              value={report?.total_flagged ?? 0}
              color="#dc2626" bg="#fef2f2"
              sub={report?.total_outstanding_sar != null ? `SAR ${Number(report.total_outstanding_sar).toLocaleString()} at risk` : undefined}
            />
            <KpiCard
              label="High Severity"
              value={report?.by_severity?.High ?? 0}
              color="#dc2626"
              sub="Requires immediate action"
            />
            <KpiCard
              label="Medium Severity"
              value={report?.by_severity?.Medium ?? 0}
              color="#f59e0b"
              sub="Under investigation"
            />
            <KpiCard
              label="Low Severity"
              value={report?.by_severity?.Low ?? 0}
              color="#6b7280"
              sub="Monitoring"
            />
          </div>

          {/* Summary panels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* By reason */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 14 }}>By Reason</div>
              {Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                <HBar key={reason} label={reason} count={count} max={maxReason} color={REASON_COLORS[reason]?.color || '#6c63ff'} />
              ))}
              {Object.keys(byReason).length === 0 && <div style={{ color: '#aaa', fontSize: 12 }}>No data</div>}
            </div>

            {/* By bucket */}
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 14 }}>By Delinquency Bucket</div>
              {Object.entries(byBucket).sort((a, b) => b[1] - a[1]).map(([bucket, count]) => (
                <HBar key={bucket} label={bucket} count={count} max={maxBucket} color={BUCKET_COLORS[bucket] || '#888'} />
              ))}
              {Object.keys(byBucket).length === 0 && <div style={{ color: '#aaa', fontSize: 12 }}>No data</div>}
            </div>
          </div>

          {/* Flagged accounts table */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
            {/* Filter bar */}
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0f2f7', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search account ID or customer..."
                style={{ padding: '7px 12px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fafbfc', width: 220 }} />
              <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
                style={{ padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fafbfc', color: '#444' }}>
                {['All','High','Medium','Low'].map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value)}
                style={{ padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fafbfc', color: '#444' }}>
                <option value="All">All Reasons</option>
                {['Dispute','Incorrect Info','Suspected Fraud','Identity Theft','Payment Manipulation'].map(r => <option key={r}>{r}</option>)}
              </select>
              <select value={bucketFilter} onChange={e => setBucketFilter(e.target.value)}
                style={{ padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fafbfc', color: '#444' }}>
                <option value="All">All Buckets</option>
                {['1-30 DPD','31-60 DPD','61-90 DPD','NPA','Write-off'].map(b => <option key={b}>{b}</option>)}
              </select>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#aaa' }}>{filtered.length} flagged account{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No accounts match the current filters</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#fafbfc', borderBottom: '0.5px solid #e8eaf0' }}>
                      {['Account ID','Customer','Bucket','Outstanding (SAR)','Severity','Reason','Flagged By','Date','Notes','Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#888', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f, i) => {
                      const sm = SEV_META[f.severity] || SEV_META.Low
                      const rm = REASON_COLORS[f.reason] || { color: '#888', bg: '#f1f5f9' }
                      const bc = BUCKET_COLORS[f.bucket] || '#888'
                      return (
                        <tr key={f.id} style={{ borderBottom: '0.5px solid #f5f6fa', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#6c63ff', whiteSpace: 'nowrap' }}>
                            {f.flag_id}
                            <div style={{ fontSize: 10, color: '#888', fontWeight: 400, marginTop: 1 }}>{f.account_id}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{f.customer_name}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${bc}18`, color: bc, whiteSpace: 'nowrap' }}>{f.bucket}</span>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1a2e', whiteSpace: 'nowrap' }}>
                            {Number(f.outstanding_sar).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: sm.bg, color: sm.color }}>{f.severity}</span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: rm.bg, color: rm.color, whiteSpace: 'nowrap' }}>{f.reason}</span>
                          </td>
                          <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 500, color: '#1a1a2e' }}>{f.flagged_by}</div>
                            <div style={{ fontSize: 10, color: '#aaa' }}>{f.flagged_by_role}</div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#888', whiteSpace: 'nowrap', fontSize: 11 }}>
                            {f.flagged_at?.slice(0, 10)}
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: 240 }}>
                            <div title={f.notes} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#555', cursor: 'default' }}>
                              {f.notes}
                            </div>
                            {f.evidence_ref && (
                              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Ref: {f.evidence_ref}</div>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {canRemove && (
                              <button
                                onClick={() => handleRemove(f.account_id)}
                                disabled={removing === f.account_id}
                                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: removing === f.account_id ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                                {removing === f.account_id ? '...' : 'Remove Flag'}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
