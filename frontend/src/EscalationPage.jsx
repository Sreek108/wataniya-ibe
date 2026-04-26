import { useState, useEffect } from 'react'
import { getEscalations, getEscalationStats, assignEscalation, resolveEscalation } from './api'
import { useAuth } from './AuthContext'

const LEVEL_META = {
  supervisor:   { label: 'Supervisor Queue',  color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  human_agent:  { label: 'Human Agent Queue', color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  ai_retry:     { label: 'AI Retry Queue',    color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
}

const RISK_COLORS = { high: '#ef4444', medium: '#f97316', low: '#22c55e' }
const STATUS_META = {
  pending:     { label: 'Pending',     color: '#f59e0b', bg: '#fef3c7' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#dbeafe' },
  resolved:    { label: 'Resolved',    color: '#22c55e', bg: '#dcfce7' },
}

function KpiCard({ label, value, color, sub }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '18px 22px', flex: 1 }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: color || '#1a1a2e', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function EscCard({ esc, canManage, onAssigned, onResolved }) {
  const [assigning, setAssigning]   = useState(false)
  const [resolving, setResolving]   = useState(false)
  const [assignTo, setAssignTo]     = useState('')
  const [assignNote, setAssignNote] = useState('')
  const [resolution, setResolution] = useState('')
  const [recovery, setRecovery]     = useState('')
  const [resolveNote, setResolveNote] = useState('')
  const [busy, setBusy]             = useState(false)

  const meta = LEVEL_META[esc.escalation_level] || LEVEL_META.ai_retry
  const daysBroken = esc.broken_date
    ? Math.floor((Date.now() - new Date(esc.broken_date)) / 86400000)
    : '?'

  async function doAssign() {
    if (!assignTo.trim()) return
    setBusy(true)
    try {
      await assignEscalation(esc.ptp_id, { assigned_to: assignTo, note: assignNote })
      onAssigned()
    } catch (e) { alert(e.message) }
    finally { setBusy(false) }
  }

  async function doResolve() {
    if (!resolution.trim()) return
    setBusy(true)
    try {
      await resolveEscalation(esc.ptp_id, {
        resolution,
        recovery_amount_sar: parseFloat(recovery) || 0,
        note: resolveNote
      })
      onResolved()
    } catch (e) { alert(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: `0.5px solid ${meta.border}`,
      padding: '14px 16px', marginBottom: 10
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{esc.customer_name}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{esc.account_id} · {esc.ptp_id}</div>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#991b1b' }}>
            Broken ×{esc.broken_count}
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: `${RISK_COLORS[esc.risk_level]}18`, color: RISK_COLORS[esc.risk_level] }}>
            {esc.risk_level} risk
          </span>
        </div>
      </div>

      {/* Data rows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 8 }}>
        {[
          ['Outstanding', `SAR ${Number(esc.outstanding_sar || 0).toLocaleString()}`],
          ['Due Date',    esc.promise_date || '—'],
          ['Channel',     esc.auto_channel || '—'],
          ['Sentiment',   esc.last_call_sentiment || '—'],
          ['Days Broken', `${daysBroken}d`],
          ['Agent',       esc.escalation_assigned_to || 'Unassigned'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: '#aaa' }}>{k}</span>
            <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Recommended action */}
      <div style={{ fontSize: 11, color: '#555', background: `${meta.color}0d`, borderRadius: 6, padding: '7px 10px', marginBottom: 10 }}>
        <strong style={{ color: meta.color }}>Rec:</strong> {esc.recommended_action}
      </div>

      {/* Action buttons */}
      {canManage && esc.escalation_status === 'pending' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setAssigning(!assigning); setResolving(false) }}
            style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: `0.5px solid ${meta.color}`, background: assigning ? meta.bg : '#fff', color: meta.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {assigning ? 'Cancel' : 'Assign'}
          </button>
          <button onClick={() => { setResolving(!resolving); setAssigning(false) }}
            style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '0.5px solid #22c55e', background: resolving ? '#f0fdf4' : '#fff', color: '#22c55e', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {resolving ? 'Cancel' : 'Resolve'}
          </button>
        </div>
      )}

      {/* Assign inline form */}
      {assigning && (
        <div style={{ marginTop: 10, padding: 10, background: meta.bg, borderRadius: 8, border: `0.5px solid ${meta.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: meta.color, marginBottom: 8 }}>Assign Escalation</div>
          <input value={assignTo} onChange={e => setAssignTo(e.target.value)} placeholder="Agent / team name"
            style={{ width: '100%', padding: '6px 10px', border: '0.5px solid #e0e3eb', borderRadius: 6, fontSize: 12, marginBottom: 6, outline: 'none', boxSizing: 'border-box' }} />
          <input value={assignNote} onChange={e => setAssignNote(e.target.value)} placeholder="Note (optional)"
            style={{ width: '100%', padding: '6px 10px', border: '0.5px solid #e0e3eb', borderRadius: 6, fontSize: 12, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={doAssign} disabled={busy || !assignTo.trim()}
            style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: meta.color, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: busy || !assignTo.trim() ? 0.5 : 1, fontFamily: 'inherit' }}>
            {busy ? 'Saving...' : 'Confirm Assign'}
          </button>
        </div>
      )}

      {/* Resolve inline form */}
      {resolving && (
        <div style={{ marginTop: 10, padding: 10, background: '#f0fdf4', borderRadius: 8, border: '0.5px solid #bbf7d0' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#166534', marginBottom: 8 }}>Resolve Escalation</div>
          <input value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Resolution summary *"
            style={{ width: '100%', padding: '6px 10px', border: '0.5px solid #e0e3eb', borderRadius: 6, fontSize: 12, marginBottom: 6, outline: 'none', boxSizing: 'border-box' }} />
          <input type="number" value={recovery} onChange={e => setRecovery(e.target.value)} placeholder="Recovery amount (SAR)"
            style={{ width: '100%', padding: '6px 10px', border: '0.5px solid #e0e3eb', borderRadius: 6, fontSize: 12, marginBottom: 6, outline: 'none', boxSizing: 'border-box' }} />
          <input value={resolveNote} onChange={e => setResolveNote(e.target.value)} placeholder="Internal note (optional)"
            style={{ width: '100%', padding: '6px 10px', border: '0.5px solid #e0e3eb', borderRadius: 6, fontSize: 12, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={doResolve} disabled={busy || !resolution.trim()}
            style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: busy || !resolution.trim() ? 0.5 : 1, fontFamily: 'inherit' }}>
            {busy ? 'Saving...' : 'Mark Resolved'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function EscalationPage() {
  const { user } = useAuth()
  const [data, setData]   = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState(null)
  const [resolution, setResolution]   = useState('')
  const [recovery, setRecovery]       = useState('')
  const [resolveNote, setResolveNote] = useState('')
  const [busy, setBusy] = useState(false)

  const canManage = ['admin', 'supervisor', 'collector'].includes(user?.role)

  function load() {
    setLoading(true)
    Promise.all([getEscalations(), getEscalationStats()])
      .then(([d, s]) => { setData(d); setStats(s) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function doResolveInProgress(ptp_id) {
    if (!resolution.trim()) return
    setBusy(true)
    try {
      await resolveEscalation(ptp_id, {
        resolution,
        recovery_amount_sar: parseFloat(recovery) || 0,
        note: resolveNote
      })
      setResolvingId(null); setResolution(''); setRecovery(''); setResolveNote('')
      load()
    } catch (e) { alert(e.message) }
    finally { setBusy(false) }
  }

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 14 }}>Loading escalations...</div>
  )

  const byLevel   = data?.by_level || {}
  const inProgress = (data?.escalations || []).filter(e => e.escalation_status === 'in_progress')
  const pc = stats?.pending_count || {}

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>Broken PTP Escalations</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Auto-escalation queue for broken promises — assign, track, and resolve</div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Supervisor Queue"  value={pc.supervisor   ?? 0} color="#ef4444" sub="Pending assignments" />
        <KpiCard label="Human Agent Queue" value={pc.human_agent  ?? 0} color="#f97316" sub="Pending assignments" />
        <KpiCard label="AI Retry Queue"    value={pc.ai_retry     ?? 0} color="#3b82f6" sub="Pending assignments" />
        <KpiCard label="Total at Risk" value={stats?.total_at_risk_sar != null ? `SAR ${Number(stats.total_at_risk_sar).toLocaleString()}` : '—'} color="#6c63ff" sub={`${stats?.in_progress_count ?? 0} in progress`} />
      </div>

      {/* 3 escalation lanes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {['supervisor', 'human_agent', 'ai_retry'].map(level => {
          const meta  = LEVEL_META[level]
          const items = (byLevel[level] || []).filter(e => e.escalation_status === 'pending')
          return (
            <div key={level} style={{ background: meta.bg, borderRadius: 12, border: `0.5px solid ${meta.border}`, overflow: 'hidden' }}>
              {/* Lane header */}
              <div style={{ padding: '12px 16px', background: meta.color, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{meta.label}</div>
                <span style={{ fontSize: 12, fontWeight: 800, background: 'rgba(255,255,255,0.25)', color: '#fff', borderRadius: 20, padding: '2px 10px' }}>
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{ padding: '12px 12px 4px', maxHeight: 520, overflowY: 'auto' }}>
                {items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: meta.color, fontSize: 12, opacity: 0.6 }}>No pending cases</div>
                ) : items.map(esc => (
                  <EscCard
                    key={esc.ptp_id}
                    esc={esc}
                    canManage={canManage}
                    onAssigned={load}
                    onResolved={load}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* In-progress table */}
      {inProgress.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0f2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>In Progress</div>
            <span style={{ fontSize: 12, color: '#888' }}>{inProgress.length} case{inProgress.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#fafbfc', borderBottom: '0.5px solid #e8eaf0' }}>
                  {['Customer', 'Account', 'Level', 'Assigned To', 'Auto Channel', 'Outstanding', 'Broken ×', 'Action'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#888', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inProgress.map((esc, i) => {
                  const meta = LEVEL_META[esc.escalation_level] || LEVEL_META.ai_retry
                  const isResolving = resolvingId === esc.ptp_id
                  return (
                    <>
                      <tr key={esc.ptp_id} style={{ borderBottom: isResolving ? 'none' : '0.5px solid #f5f6fa', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1a2e' }}>{esc.customer_name}</td>
                        <td style={{ padding: '10px 14px', color: '#888' }}>{esc.account_id}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: meta.bg, color: meta.color, fontWeight: 700, border: `0.5px solid ${meta.border}` }}>
                            {meta.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#555' }}>{esc.escalation_assigned_to || '—'}</td>
                        <td style={{ padding: '10px 14px', color: '#555' }}>{esc.auto_channel || '—'}</td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1a2e' }}>SAR {Number(esc.outstanding_sar || 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 20 }}>
                            ×{esc.broken_count}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {canManage && (
                            <button
                              onClick={() => { setResolvingId(isResolving ? null : esc.ptp_id); setResolution(''); setRecovery(''); setResolveNote('') }}
                              style={{ padding: '5px 12px', borderRadius: 6, border: '0.5px solid #22c55e', background: isResolving ? '#f0fdf4' : '#fff', color: '#22c55e', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {isResolving ? 'Cancel' : 'Resolve'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isResolving && (
                        <tr key={`${esc.ptp_id}-resolve`} style={{ borderBottom: '0.5px solid #f5f6fa' }}>
                          <td colSpan={8} style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: '#f0fdf4', borderRadius: 8, padding: '10px 12px', border: '0.5px solid #bbf7d0' }}>
                              <input value={resolution} onChange={e => setResolution(e.target.value)} placeholder="Resolution *"
                                style={{ padding: '6px 10px', border: '0.5px solid #e0e3eb', borderRadius: 6, fontSize: 12, outline: 'none', flex: 2, minWidth: 160 }} />
                              <input type="number" value={recovery} onChange={e => setRecovery(e.target.value)} placeholder="Recovery SAR"
                                style={{ padding: '6px 10px', border: '0.5px solid #e0e3eb', borderRadius: 6, fontSize: 12, outline: 'none', width: 130 }} />
                              <input value={resolveNote} onChange={e => setResolveNote(e.target.value)} placeholder="Note (optional)"
                                style={{ padding: '6px 10px', border: '0.5px solid #e0e3eb', borderRadius: 6, fontSize: 12, outline: 'none', flex: 1, minWidth: 120 }} />
                              <button onClick={() => doResolveInProgress(esc.ptp_id)} disabled={busy || !resolution.trim()}
                                style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: busy || !resolution.trim() ? 0.5 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                {busy ? 'Saving...' : 'Confirm'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
