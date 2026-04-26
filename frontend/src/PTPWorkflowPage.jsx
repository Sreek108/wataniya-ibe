import { useState, useEffect } from 'react'
import { getPTPWorkflow, getBrokenPTPs, triggerPTPWorkflow, markPTPBroken } from './api'

const C = {
  purple: '#6c63ff', blue: '#3b82f6', green: '#22c55e',
  amber: '#f59e0b',  red: '#ef4444',  gray: '#94a3b8', orange: '#f97316',
}

const WORKFLOW_META = {
  PENDING:       { color: C.gray,   bg: '#f1f5f9',  label: 'Pending' },
  REMINDED:      { color: C.blue,   bg: '#dbeafe',  label: 'Reminded' },
  VOICE_REMINDED:{ color: C.purple, bg: '#ede9fe',  label: 'Voice Reminded' },
  DUE:           { color: C.orange, bg: '#ffedd5',  label: 'Due' },
  PAID:          { color: C.green,  bg: '#dcfce7',  label: 'Paid' },
  BROKEN:        { color: C.red,    bg: '#fee2e2',  label: 'Broken' },
  ESCALATED:     { color: '#7c2d12', bg: '#fef2f2', label: 'Escalated' },
}

const RISK_META = {
  low:    { color: C.green,  bg: '#dcfce7', label: 'Low Risk' },
  medium: { color: C.amber,  bg: '#fef3c7', label: 'Med Risk' },
  high:   { color: C.red,    bg: '#fee2e2', label: 'High Risk' },
}

const COLUMNS = [
  { key: 'PENDING',        label: 'Pending',          color: C.gray   },
  { key: 'REMINDED',       label: 'Reminded',         color: C.blue,  extra: 'VOICE_REMINDED' },
  { key: 'DUE',            label: 'Due',              color: C.orange },
  { key: 'PAID',           label: 'Paid',             color: C.green  },
  { key: 'BROKEN',         label: 'Broken / Escalated', color: C.red, extra: 'ESCALATED' },
]

function Badge({ label, color, bg, small }) {
  return (
    <span style={{
      display: 'inline-block', padding: small ? '1px 7px' : '3px 10px',
      borderRadius: 20, fontSize: small ? 10 : 11, fontWeight: 700,
      background: bg, color,
    }}>{label}</span>
  )
}

function KPICard({ label, value, sub, color = C.purple, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '0.5px solid #e8eaf0', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 18 }}>{icon}</div>
        <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#aaa', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

function DueBadge({ days }) {
  const overdue = days < 0
  const today   = days === 0
  const color   = overdue ? C.red : today ? C.orange : '#555'
  const text    = overdue ? `${Math.abs(days)}d overdue` : today ? 'Due today' : `Due in ${days}d`
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color }}>{text}</span>
  )
}

function PTPCard({ ptp, onAdvance, onMarkBroken, advancing }) {
  const wm   = WORKFLOW_META[ptp.workflow_status] || WORKFLOW_META.PENDING
  const rm   = RISK_META[ptp.risk_level]          || RISK_META.medium
  const canAdvance = !['PAID', 'ESCALATED'].includes(ptp.workflow_status)
  const isBroken   = ptp.workflow_status === 'BROKEN'

  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: '0.5px solid #e8eaf0',
      padding: '12px 14px', marginBottom: 8,
    }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 1 }}>
          {ptp.customer_name || ptp.account_id}
        </div>
        <div style={{ fontSize: 11, color: '#aaa' }}>{ptp.account_id} · {ptp.ptp_id}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
        <DueBadge days={ptp.days_until_due} />
        <span style={{ fontSize: 11, color: '#888' }}>·</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a2e' }}>
          SAR {Number(ptp.amount_sar).toLocaleString()}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
        <Badge label={rm.label} color={rm.color} bg={rm.bg} small />
        {ptp.workflow_status === 'VOICE_REMINDED' && (
          <Badge label="Voice ✓" color={C.purple} bg="#ede9fe" small />
        )}
      </div>

      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, lineHeight: 1.4 }}>
        {ptp.next_step}
      </div>

      {isBroken && ptp.escalation_rec && (
        <div style={{ fontSize: 11, background: '#fef2f2', color: C.red, padding: '4px 8px', borderRadius: 6, marginBottom: 8, fontWeight: 600 }}>
          ⚠ {ptp.escalation_rec || ''}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        {canAdvance && (
          <button
            onClick={() => onAdvance(ptp.ptp_id)}
            disabled={advancing === ptp.ptp_id}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: C.purple, color: '#fff', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
              opacity: advancing === ptp.ptp_id ? 0.55 : 1,
            }}
          >{advancing === ptp.ptp_id ? '...' : 'Advance →'}</button>
        )}
        {ptp.workflow_status === 'DUE' && (
          <button
            onClick={() => onMarkBroken(ptp.ptp_id)}
            disabled={advancing === ptp.ptp_id}
            style={{
              padding: '6px 10px', borderRadius: 7, border: '1px solid #fca5a5',
              background: '#fef2f2', color: C.red, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Broken</button>
        )}
        {['PAID', 'ESCALATED'].includes(ptp.workflow_status) && (
          <div style={{ fontSize: 11, color: ptp.workflow_status === 'PAID' ? C.green : C.red, fontWeight: 600, padding: '6px 0' }}>
            {ptp.workflow_status === 'PAID' ? '✓ Resolved' : '⚠ Escalated'}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
export default function PTPWorkflowPage() {
  const [ptps, setPtps]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [advancing, setAdvancing] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    getPTPWorkflow()
      .then(d => { setPtps(d.ptps || []); setLastUpdated(new Date()) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  async function handleAdvance(ptpId) {
    setAdvancing(ptpId)
    try {
      const updated = await triggerPTPWorkflow(ptpId)
      setPtps(prev => prev.map(p => p.ptp_id === ptpId ? updated : p))
    } catch (e) {}
    finally { setAdvancing(null) }
  }

  async function handleMarkBroken(ptpId) {
    setAdvancing(ptpId)
    try {
      const updated = await markPTPBroken(ptpId)
      setPtps(prev => prev.map(p => p.ptp_id === ptpId ? { ...updated, next_step: 'Escalate to supervisor', days_until_due: p.days_until_due } : p))
    } catch (e) {}
    finally { setAdvancing(null) }
  }

  // KPIs
  const active    = ptps.filter(p => ['PENDING', 'REMINDED', 'VOICE_REMINDED', 'DUE'].includes(p.workflow_status))
  const dueToday  = ptps.filter(p => p.days_until_due === 0 && p.workflow_status !== 'PAID')
  const broken    = ptps.filter(p => p.workflow_status === 'BROKEN' || p.workflow_status === 'ESCALATED')
  const now       = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7)
  const paidWeek  = ptps.filter(p => p.outcome === 'PAID' && new Date(p.workflow_updated_at) >= weekStart)

  // Group by column
  function colPtps(col) {
    const keys = [col.key, col.extra].filter(Boolean)
    return ptps.filter(p => keys.includes(p.workflow_status))
  }

  // Broken PTPs for table (workflow_status BROKEN or ESCALATED)
  const brokenPtps = ptps.filter(p => ['BROKEN', 'ESCALATED'].includes(p.workflow_status))

  return (
    <div style={{ padding: 28, minHeight: '100vh', background: '#f5f6fa' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>PTP Workflow Tracker</h1>
          <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>
            Automated Day -7 → Day +3 promise-to-pay pipeline
            {lastUpdated && <span style={{ marginLeft: 10 }}>· Updated {lastUpdated.toLocaleTimeString()}</span>}
          </div>
        </div>
        <button onClick={load} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e0e3eb', background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          ↻ Refresh
        </button>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
        <KPICard label="Active PTPs"    value={active.length}   icon="📋" color={C.purple} sub="Pending → Due" />
        <KPICard label="Due Today"      value={dueToday.length} icon="⏰" color={C.orange} sub="Needs action now" />
        <KPICard label="Broken PTPs"    value={broken.length}   icon="⚠️" color={C.red}    sub="Requires escalation" />
        <KPICard label="Paid This Week" value={paidWeek.length} icon="✅" color={C.green}  sub={`SAR ${paidWeek.reduce((s, p) => s + p.amount_sar, 0).toLocaleString()}`} />
      </div>

      {/* Pipeline */}
      {loading ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: 40, textAlign: 'center', color: '#aaa', marginBottom: 22 }}>
          Loading workflow data...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 22 }}>
          {COLUMNS.map(col => {
            const items = colPtps(col)
            return (
              <div key={col.key}>
                {/* Column header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 10,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: '50%',
                    background: `${col.color}18`, color: col.color, fontSize: 11, fontWeight: 700,
                  }}>{items.length}</span>
                </div>
                {/* Cards */}
                <div style={{ minHeight: 80 }}>
                  {items.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#d1d5db', fontSize: 12, paddingTop: 24 }}>—</div>
                  ) : items.map(ptp => (
                    <PTPCard
                      key={ptp.ptp_id}
                      ptp={ptp}
                      onAdvance={handleAdvance}
                      onMarkBroken={handleMarkBroken}
                      advancing={advancing}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Broken PTPs Table */}
      {brokenPtps.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
          <div style={{ padding: '13px 18px', borderBottom: '0.5px solid #f0f2f7', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>⚠</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Broken PTPs — Action Required</span>
            <span style={{ fontSize: 12, color: '#aaa' }}>{brokenPtps.length} case{brokenPtps.length !== 1 ? 's' : ''}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#fef2f2' }}>
                {['Customer', 'Account', 'PTP Date', 'Broken Date', 'SAR Amount', 'Broken Count', 'Escalation Rec', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 12, borderBottom: '0.5px solid #fca5a5' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {brokenPtps.map((p, i) => {
                const bc = p.broken_count || 1
                const rec = bc >= 3 ? 'Supervisor escalation required'
                          : bc === 2 ? 'Human agent review'
                          : 'AI retry recommended'
                const recColor = bc >= 3 ? C.red : bc === 2 ? C.orange : C.amber
                return (
                  <tr key={p.ptp_id} style={{ borderBottom: '0.5px solid #fff1f2' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1a2e' }}>{p.customer_name || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#555', fontSize: 12 }}>{p.account_id}</td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>{p.promise_date || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>
                      {p.broken_date ? new Date(p.broken_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1a2e' }}>
                      SAR {Number(p.amount_sar).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: bc >= 3 ? C.red : bc === 2 ? C.orange : C.amber, fontSize: 15 }}>{bc}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: recColor }}>{rec}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {p.workflow_status === 'BROKEN' && (
                        <button
                          onClick={() => handleAdvance(p.ptp_id)}
                          disabled={advancing === p.ptp_id}
                          style={{
                            padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                            background: '#7f1d1d', color: '#fff', fontSize: 11, fontWeight: 600,
                            fontFamily: 'inherit', opacity: advancing === p.ptp_id ? 0.55 : 1,
                          }}
                        >{advancing === p.ptp_id ? '...' : 'Mark Escalated'}</button>
                      )}
                      {p.workflow_status === 'ESCALATED' && (
                        <span style={{ fontSize: 11, color: '#7c2d12', fontWeight: 600 }}>Escalated ✓</span>
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
  )
}
