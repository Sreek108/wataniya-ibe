import { useState, useEffect } from 'react'
import { getSettlements, getSettlementStats, acceptSettlement, rejectSettlement, expireSettlement } from './api'
import { useAuth } from './AuthContext'

const TYPE_META = {
  OTS:         { label: 'OTS',          color: '#7c3aed', bg: '#f5f3ff' },
  Discount:    { label: 'Discount',     color: '#2563eb', bg: '#eff6ff' },
  PaymentPlan: { label: 'Payment Plan', color: '#0d9488', bg: '#f0fdfa' },
  FeeWaiver:   { label: 'Fee Waiver',   color: '#16a34a', bg: '#f0fdf4' },
} 
const ST_META = {
  Pending:  { color: '#f59e0b', bg: '#fef3c7' },
  Accepted: { color: '#22c55e', bg: '#dcfce7' },
  Rejected: { color: '#ef4444', bg: '#fee2e2' },
  Expired:  { color: '#94a3b8', bg: '#f1f5f9' },
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '18px 22px', flex: 1 }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || '#1a1a2e', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function SettlementsPage() {
  const { user } = useAuth()
  const [settlements, setSettlements] = useState([])
  const [stats, setStats]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter]   = useState('All')
  const [search, setSearch]           = useState('')

  const canManage = ['admin', 'supervisor', 'collector'].includes(user?.role)

  function load() {
    setLoading(true)
    Promise.all([getSettlements(), getSettlementStats()])
      .then(([d, s]) => { setSettlements(d.settlements || []); setStats(s) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleAction(id, action) {
    try {
      if (action === 'accept')  await acceptSettlement(id)
      else if (action === 'reject') await rejectSettlement(id)
      else if (action === 'expire') await expireSettlement(id)
      load()
    } catch (e) { alert(e.message) }
  }

  const filtered = settlements.filter(s => {
    if (statusFilter !== 'All' && s.status !== statusFilter) return false
    if (typeFilter   !== 'All' && s.offer_type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.customer_name.toLowerCase().includes(q) && !s.account_id.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Settlement & Offer Management</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Track all settlement offers — create, accept, reject, and monitor outcomes</div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Total Offers"     value={stats?.total_offers ?? '—'}    color="#1a1a2e" />
        <KpiCard label="Pending"          value={stats?.pending_count ?? '—'}   color="#f59e0b"
          sub={stats?.pending_sar != null ? `SAR ${Number(stats.pending_sar).toLocaleString()}` : undefined} />
        <KpiCard label="Accepted"         value={stats?.accepted_count ?? '—'}  color="#22c55e"
          sub={stats?.accepted_sar != null ? `SAR ${Number(stats.accepted_sar).toLocaleString()} recovered` : undefined} />
        <KpiCard label="Acceptance Rate"  value={stats?.acceptance_rate_pct != null ? `${stats.acceptance_rate_pct}%` : '—'} color="#6c63ff"
          sub={stats?.total_savings_offered_sar != null ? `SAR ${Number(stats.total_savings_offered_sar).toLocaleString()} total savings offered` : undefined} />
      </div>

      {/* Table card */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>

        {/* Filters */}
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0f2f7', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search customer or account ID..."
            style={{ padding: '7px 12px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fafbfc', width: 220 }} />

          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fafbfc', color: '#444' }}>
            {['All', 'Pending', 'Accepted', 'Rejected', 'Expired'].map(s => <option key={s}>{s}</option>)}
          </select>

          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fafbfc', color: '#444' }}>
            <option value="All">All Types</option>
            <option value="OTS">OTS</option>
            <option value="Discount">Discount</option>
            <option value="PaymentPlan">Payment Plan</option>
            <option value="FeeWaiver">Fee Waiver</option>
          </select>

          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#aaa' }}>
            {filtered.length} offer{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Loading settlements...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No offers match the current filters</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafbfc', borderBottom: '0.5px solid #e8eaf0' }}>
                  {['Offer ID', 'Customer', 'Offer Type', 'Original (SAR)', 'Settlement (SAR)', 'Saving', 'Status', 'Expiry', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#888', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const tm = TYPE_META[s.offer_type] || TYPE_META.OTS
                  const sm = ST_META[s.status]       || ST_META.Expired
                  return (
                    <tr key={s.id} style={{ borderBottom: '0.5px solid #f5f6fa', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#6c63ff', whiteSpace: 'nowrap' }}>{s.offer_id}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{s.customer_name}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{s.account_id}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: tm.bg, color: tm.color, whiteSpace: 'nowrap' }}>
                          {tm.label}
                          {s.tenor_months && ` · ${s.tenor_months}mo`}
                          {s.discount_pct && ` · ${s.discount_pct}%`}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: '#1a1a2e', whiteSpace: 'nowrap' }}>
                        {Number(s.original_amount_sar).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap' }}>
                        {Number(s.settlement_amount_sar).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {s.saving_amount_sar > 0 ? (
                          <div>
                            <div style={{ fontWeight: 700, color: '#22c55e' }}>SAR {Number(s.saving_amount_sar).toLocaleString()}</div>
                            <div style={{ fontSize: 11, color: '#22c55e' }}>{s.saving_pct}%</div>
                          </div>
                        ) : <span style={{ color: '#aaa' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: sm.bg, color: sm.color }}>
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#555', whiteSpace: 'nowrap' }}>
                        <span style={{ color: s.status === 'Pending' && new Date(s.expiry_date) < new Date() ? '#ef4444' : '#555' }}>
                          {s.expiry_date}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {canManage && s.status === 'Pending' && (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => handleAction(s.id, 'accept')}
                              style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                              Accept
                            </button>
                            <button onClick={() => handleAction(s.id, 'reject')}
                              style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                              Reject
                            </button>
                            <button onClick={() => handleAction(s.id, 'expire')}
                              style={{ padding: '5px 12px', borderRadius: 6, border: '0.5px solid #e0e3eb', background: '#fff', color: '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                              Expire
                            </button>
                          </div>
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
    </div>
  )
}
