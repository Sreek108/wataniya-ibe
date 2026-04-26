import { useState, useEffect } from 'react'
import { getWaivers, getWaiverStats, createWaiver, approveWaiver, rejectWaiver } from './api'
import { useAuth } from './AuthContext'

const TYPE_META = {
  'Late Fee':      { color: '#f59e0b', bg: '#fef3c7' },
  'Interest':      { color: '#ef4444', bg: '#fee2e2' },
  'Penalty':       { color: '#7c3aed', bg: '#f5f3ff' },
  'Processing Fee':{ color: '#0d9488', bg: '#f0fdfa' },
}
const ST_META = {
  Pending:  { color: '#f59e0b', bg: '#fef3c7' },
  Approved: { color: '#22c55e', bg: '#dcfce7' },
  Rejected: { color: '#ef4444', bg: '#fee2e2' },
}
const BUCKET_COLORS = { '1-30 DPD':'#22c55e','31-60 DPD':'#f59e0b','61-90 DPD':'#f97316','NPA':'#ef4444','Write-off':'#6b7280' }

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)} min ago`
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d !== 1 ? 's' : ''} ago`
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

function WaiverForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ account_id: '', waiver_type: 'Late Fee', amount_sar: '', reason: 'Customer hardship', notes: '' })
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!form.account_id || !form.amount_sar) return
    setBusy(true)
    try {
      await onSubmit(form)
    } finally { setBusy(false) }
  }

  return (
    <div style={{ background: '#fff7ed', borderRadius: 10, border: '0.5px solid #fed7aa', padding: 16, marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#c2410c', marginBottom: 12 }}>New Waiver Request</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Account ID</label>
          <input value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}
            placeholder="e.g. WAT-001234"
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Waiver Type</label>
          <select value={form.waiver_type} onChange={e => setForm({ ...form, waiver_type: e.target.value })}
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff' }}>
            {['Late Fee', 'Interest', 'Penalty', 'Processing Fee'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Amount (SAR)</label>
          <input type="number" min="1" value={form.amount_sar} onChange={e => setForm({ ...form, amount_sar: e.target.value })}
            placeholder="e.g. 1200"
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Reason</label>
          <select value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff' }}>
            {['Customer hardship','Long-term customer','Settlement facilitation','Administrative error','Goodwill gesture'].map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value.slice(0, 200) })}
            placeholder="Additional context for supervisor..."
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={busy || !form.account_id || !form.amount_sar}
          style={{ padding: '8px 20px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (busy || !form.account_id || !form.amount_sar) ? 0.5 : 1, fontFamily: 'inherit' }}>
          {busy ? 'Submitting...' : 'Submit for Review'}
        </button>
        <button onClick={onCancel}
          style={{ padding: '8px 16px', border: '0.5px solid #e0e3eb', borderRadius: 7, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function WaiversPage() {
  const { user } = useAuth()
  const isReviewer = ['admin', 'supervisor'].includes(user?.role)
  const isCollector = user?.role === 'collector'

  const [waivers, setWaivers]           = useState([])
  const [stats, setStats]               = useState(null)
  const [loading, setLoading]           = useState(true)
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter]     = useState('All')
  const [showForm, setShowForm]         = useState(false)
  const [formSuccess, setFormSuccess]   = useState(false)
  const [reviewingId, setReviewingId]   = useState(null)
  const [reviewNote, setReviewNote]     = useState('')
  const [reviewAction, setReviewAction] = useState(null)
  const [reviewBusy, setReviewBusy]     = useState(false)

  function load() {
    setLoading(true)
    Promise.all([getWaivers(), getWaiverStats()])
      .then(([d, s]) => { setWaivers(d.waivers || []); setStats(s) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleNewWaiver(form) {
    await createWaiver(form)
    setShowForm(false)
    setFormSuccess(true)
    load()
  }

  function startReview(id, action) {
    setReviewingId(id)
    setReviewAction(action)
    setReviewNote('')
  }

  async function submitReview() {
    if (!reviewNote && reviewAction === 'reject') return
    setReviewBusy(true)
    try {
      if (reviewAction === 'approve') await approveWaiver(reviewingId, reviewNote)
      else await rejectWaiver(reviewingId, reviewNote)
      setReviewingId(null)
      setReviewNote('')
      setReviewAction(null)
      load()
    } catch (e) { alert(e.message) }
    finally { setReviewBusy(false) }
  }

  const pending  = waivers.filter(w => w.status === 'Pending')
  const filtered = waivers.filter(w => {
    if (statusFilter !== 'All' && w.status !== statusFilter) return false
    if (typeFilter   !== 'All' && w.waiver_type !== typeFilter) return false
    return true
  })

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Waiver Requests</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
            {isReviewer ? 'Review and approve fee/penalty waiver requests from agents' : 'Submit and track your waiver requests'}
          </div>
        </div>
        {!formSuccess ? (
          <button onClick={() => setShowForm(!showForm)}
            style={{ padding: '9px 18px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Request Waiver
          </button>
        ) : (
          <span style={{ padding: '9px 18px', background: '#dcfce7', color: '#166534', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
            ✓ Request Submitted
          </span>
        )}
      </div>

      {/* New waiver form */}
      {showForm && (
        <WaiverForm
          onSubmit={handleNewWaiver}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* KPI strip — supervisor/admin only */}
      {isReviewer && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
          <KpiCard
            label="Pending Review"
            value={stats?.pending_count ?? '—'}
            color={stats?.pending_count > 0 ? '#f59e0b' : '#1a1a2e'}
            sub="Needs attention"
          />
          <KpiCard
            label="Approved This Month"
            value={stats?.approved_this_month_count ?? '—'}
            color="#22c55e"
            sub={stats?.approved_this_month_sar != null ? `SAR ${Number(stats.approved_this_month_sar).toLocaleString()}` : undefined}
          />
          <KpiCard
            label="Total Rejected"
            value={stats?.rejected_count ?? '—'}
            color="#ef4444"
          />
          <KpiCard
            label="Approval Rate"
            value={stats?.approval_rate_pct != null ? `${stats.approval_rate_pct}%` : '—'}
            color="#6c63ff"
            sub={stats?.total_approved_sar != null ? `SAR ${Number(stats.total_approved_sar).toLocaleString()} approved` : undefined}
          />
        </div>
      )}

      {/* Pending waivers queue — supervisor/admin only */}
      {isReviewer && pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>
            Pending Review
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px' }}>{pending.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 14 }}>
            {pending.map(w => {
              const tm = TYPE_META[w.waiver_type] || TYPE_META['Late Fee']
              const bc = BUCKET_COLORS[w.bucket] || '#888'
              const impactPct = w.outstanding_sar > 0 ? ((w.amount_sar / w.outstanding_sar) * 100).toFixed(1) : null
              const isReviewing = reviewingId === w.id
              return (
                <div key={w.id} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px' }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{w.customer_name}</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{w.account_id}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${bc}18`, color: bc, whiteSpace: 'nowrap' }}>
                      {w.bucket}
                    </span>
                  </div>

                  {/* Amount + type */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>SAR {Number(w.amount_sar).toLocaleString()}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: tm.bg, color: tm.color }}>{w.waiver_type}</span>
                  </div>

                  {/* Context row */}
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>
                    <strong>Reason:</strong> {w.reason}
                    {w.notes && <span style={{ color: '#888' }}> · {w.notes}</span>}
                  </div>

                  {/* Outstanding + impact */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 11, color: '#888' }}>
                    <span>Outstanding: <strong style={{ color: '#1a1a2e' }}>SAR {Number(w.outstanding_sar).toLocaleString()}</strong></span>
                    {impactPct && <span>Impact: <strong style={{ color: '#f97316' }}>{impactPct}% of balance</strong></span>}
                  </div>

                  {/* Requested by + time */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aaa', marginBottom: 12 }}>
                    <span>By <strong style={{ color: '#555' }}>{w.requested_by}</strong> ({w.requested_by_role})</span>
                    <span>{timeAgo(w.requested_at)}</span>
                  </div>

                  {/* Review inline */}
                  {isReviewing ? (
                    <div style={{ borderTop: '0.5px solid #f0f2f7', paddingTop: 12 }}>
                      <textarea
                        value={reviewNote}
                        onChange={e => setReviewNote(e.target.value)}
                        placeholder={reviewAction === 'reject' ? 'Rejection reason (required)...' : 'Approval note (optional)...'}
                        rows={2}
                        style={{ width: '100%', padding: '8px 10px', border: `0.5px solid ${reviewAction === 'reject' ? '#fca5a5' : '#e0e3eb'}`, borderRadius: 7, fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: 8 }}
                      />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={submitReview}
                          disabled={reviewBusy || (reviewAction === 'reject' && !reviewNote)}
                          style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: reviewAction === 'approve' ? '#22c55e' : '#ef4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (reviewBusy || (reviewAction === 'reject' && !reviewNote)) ? 0.5 : 1 }}>
                          {reviewBusy ? '...' : reviewAction === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
                        </button>
                        <button onClick={() => { setReviewingId(null); setReviewNote('') }}
                          style={{ padding: '7px 12px', borderRadius: 6, border: '0.5px solid #e0e3eb', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, borderTop: '0.5px solid #f0f2f7', paddingTop: 12 }}>
                      <button onClick={() => startReview(w.id, 'approve')}
                        style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Approve
                      </button>
                      <button onClick={() => startReview(w.id, 'reject')}
                        style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* All requests table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0f2f7', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', flex: 1 }}>
            {isReviewer ? 'All Waiver Requests' : 'My Requests'}
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fafbfc', color: '#444' }}>
            {['All', 'Pending', 'Approved', 'Rejected'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fafbfc', color: '#444' }}>
            <option value="All">All Types</option>
            {['Late Fee', 'Interest', 'Penalty', 'Processing Fee'].map(t => <option key={t}>{t}</option>)}
          </select>
          <span style={{ fontSize: 12, color: '#aaa' }}>{filtered.length} request{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No waiver requests match the current filters</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafbfc', borderBottom: '0.5px solid #e8eaf0' }}>
                  {['ID', 'Customer', 'Type', 'Amount (SAR)', 'Reason', ...(isReviewer ? ['Requested By'] : []), 'Status', 'Requested', 'Reviewed By', 'Review Note'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#888', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((w, i) => {
                  const tm = TYPE_META[w.waiver_type] || TYPE_META['Late Fee']
                  const sm = ST_META[w.status] || ST_META.Pending
                  return (
                    <tr key={w.id} style={{ borderBottom: '0.5px solid #f5f6fa', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#6c63ff', whiteSpace: 'nowrap' }}>{w.waiver_id}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{w.customer_name}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{w.account_id}</div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: tm.bg, color: tm.color, whiteSpace: 'nowrap' }}>{w.waiver_type}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap' }}>
                        {Number(w.amount_sar).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#555', maxWidth: 200 }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.reason}</div>
                        {w.notes && <div style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.notes}</div>}
                      </td>
                      {isReviewer && (
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#555' }}>
                          <div style={{ fontWeight: 500 }}>{w.requested_by}</div>
                          <div style={{ fontSize: 11, color: '#aaa' }}>{w.requested_by_role}</div>
                        </td>
                      )}
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: sm.bg, color: sm.color }}>{w.status}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#888', whiteSpace: 'nowrap', fontSize: 11 }}>
                        {timeAgo(w.requested_at)}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#555', whiteSpace: 'nowrap' }}>
                        {w.reviewed_by || <span style={{ color: '#ddd' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#555', maxWidth: 220 }}>
                        {w.review_note
                          ? <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.review_note}</div>
                          : <span style={{ color: '#ddd' }}>—</span>}
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
