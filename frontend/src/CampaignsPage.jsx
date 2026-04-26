import { useState, useEffect } from 'react'
import { getCampaigns, createCampaign, launchCampaign, pauseCampaign, getAccounts } from './api'
import { useAuth } from './AuthContext'

// ── Colour tokens ─────────────────────────────────────────────
const C = {
  purple: '#6c63ff', blue: '#3b82f6', green: '#22c55e',
  amber: '#f59e0b',  red: '#ef4444',  teal: '#14b8a6', gray: '#94a3b8'
}

const CHANNEL_META = {
  'SMS':      { color: C.blue,   bg: '#dbeafe', icon: '💬' },
  'Voice':    { color: C.teal,   bg: '#ccfbf1', icon: '📞' },
  'WhatsApp': { color: C.green,  bg: '#dcfce7', icon: '📱' },
  'AI Voice': { color: C.purple, bg: '#ede9fe', icon: '🤖' },
}

const STATUS_META = {
  'Active':    { color: C.green,  bg: '#dcfce7' },
  'Scheduled': { color: C.blue,   bg: '#dbeafe' },
  'Paused':    { color: C.amber,  bg: '#fef3c7' },
  'Completed': { color: C.gray,   bg: '#f1f5f9' },
}

const BUCKET_OPTS = ['1-30 DPD', '31-60 DPD', '61-90 DPD', 'NPA', 'Write-off']
const CHANNELS    = ['SMS', 'Voice', 'WhatsApp', 'AI Voice']
const FILTERS     = ['All', 'High Risk', 'Medium Risk', 'Low Risk']
const AVG_PTP_SAR = 11500

function Badge({ label, color, bg, small }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: small ? '1px 7px' : '3px 10px',
      borderRadius: 20, fontSize: small ? 10 : 11, fontWeight: 700,
      background: bg, color
    }}>{label}</span>
  )
}

function KPICard({ label, value, sub, color = C.purple, icon }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '0.5px solid #e8eaf0', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 18 }}>{icon}</div>
        <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#aaa', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

function ProgressBar({ value, max, color = C.purple }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ height: 6, background: '#f0f2f7', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
export default function CampaignsPage() {
  const { user } = useAuth()
  const canManage = ['admin', 'supervisor'].includes(user?.role)

  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading]     = useState(true)
  const [actionId, setActionId]   = useState(null)    // id of campaign being actioned
  const [showForm, setShowForm]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [targetPreview, setTargetPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Create form state
  const [form, setForm] = useState({
    name: '', channel: 'SMS', buckets: [],
    schedule_date: '', schedule_time: '09:00', target_filter: 'All'
  })

  useEffect(() => { load() }, [])

  // Update target preview when buckets or filter change
  useEffect(() => {
    if (form.buckets.length === 0) { setTargetPreview(null); return }
    setPreviewLoading(true)
    const params = {}
    if (form.buckets.length === 1) params.bucket = form.buckets[0]
    getAccounts({ ...params, limit: 1 })
      .then(d => setTargetPreview(d.total ?? d.accounts?.length ?? 0))
      .catch(() => setTargetPreview(null))
      .finally(() => setPreviewLoading(false))
  }, [form.buckets, form.target_filter])

  async function load() {
    setLoading(true)
    try {
      const d = await getCampaigns()
      setCampaigns(d.campaigns || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleLaunch(id) {
    setActionId(id)
    try {
      const updated = await launchCampaign(id)
      setCampaigns(prev => prev.map(c => c.id === id ? updated : c))
    } catch (e) {
      alert('Launch failed: ' + e.message)
    } finally {
      setActionId(null)
    }
  }

  async function handlePause(id) {
    setActionId(id)
    try {
      const updated = await pauseCampaign(id)
      setCampaigns(prev => prev.map(c => c.id === id ? updated : c))
    } catch (e) {
      alert('Action failed: ' + e.message)
    } finally {
      setActionId(null)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim() || form.buckets.length === 0 || !form.schedule_date) {
      alert('Please fill in name, at least one bucket, and a schedule date.')
      return
    }
    setSubmitting(true)
    try {
      const created = await createCampaign(form)
      setCampaigns(prev => [created, ...prev])
      setForm({ name: '', channel: 'SMS', buckets: [], schedule_date: '', schedule_time: '09:00', target_filter: 'All' })
      setShowForm(false)
      setTargetPreview(null)
    } catch (e) {
      alert('Failed to create campaign: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  function toggleBucket(b) {
    setForm(f => ({
      ...f,
      buckets: f.buckets.includes(b) ? f.buckets.filter(x => x !== b) : [...f.buckets, b]
    }))
  }

  const active    = campaigns.filter(c => c.status === 'Active' || c.status === 'Paused')
  const scheduled = campaigns.filter(c => c.status === 'Scheduled')
  const completed = campaigns.filter(c => c.status === 'Completed')

  const totalReached = campaigns.reduce((s, c) => s + (c.reached_count || 0), 0)
  const totalPTPs    = campaigns.reduce((s, c) => s + (c.ptp_count || 0), 0)

  return (
    <div style={{ padding: 24, maxWidth: 1400, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Operations › Campaign Manager</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Campaign Manager</h1>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 3 }}>
            {campaigns.length} campaigns · {active.length} active now
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              padding: '9px 18px', background: showForm ? '#f0f2f7' : C.purple,
              color: showForm ? '#555' : '#fff', border: 'none', borderRadius: 9,
              fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            {showForm ? '✕ Cancel' : '+ New Campaign'}
          </button>
        )}
      </div>

      {/* ── Section A — KPI Strip ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <KPICard label="Total Campaigns"       value={campaigns.length}               sub="all time"                    icon="📋" color={C.purple} />
        <KPICard label="Active Now"            value={active.length}                  sub={`${scheduled.length} scheduled`} icon="▶️" color={C.green}  />
        <KPICard label="Total Reached"         value={totalReached.toLocaleString()}  sub="across all campaigns"        icon="📡" color={C.blue}   />
        <KPICard label="PTPs via Campaign"     value={totalPTPs.toLocaleString()}     sub={`≈ SAR ${(totalPTPs * AVG_PTP_SAR / 1e6).toFixed(1)}M captured`} icon="✅" color={C.teal}   />
      </div>

      {/* ── Section C — Create Campaign form ── */}
      {showForm && canManage && (
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.purple}40`, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 16 }}>Create New Campaign</div>
          <form onSubmit={handleCreate}>

            {/* Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Campaign Name</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Salary Week — WhatsApp Reminder"
                style={{ width: '100%', padding: '9px 12px', border: '0.5px solid #e0e3eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
              {/* Channel */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>Channel</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CHANNELS.map(ch => {
                    const m = CHANNEL_META[ch]
                    const sel = form.channel === ch
                    return (
                      <button key={ch} type="button" onClick={() => setForm(f => ({ ...f, channel: ch }))} style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${sel ? m.color : '#e0e3eb'}`,
                        background: sel ? m.bg : '#fff',
                        color: sel ? m.color : '#888'
                      }}>
                        {m.icon} {ch}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Risk filter */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>Risk Filter</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {FILTERS.map(f => {
                    const sel = form.target_filter === f
                    return (
                      <button key={f} type="button" onClick={() => setForm(p => ({ ...p, target_filter: f }))} style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${sel ? C.purple : '#e0e3eb'}`,
                        background: sel ? '#ede9fe' : '#fff',
                        color: sel ? C.purple : '#888'
                      }}>
                        {f}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* DPD Bucket multi-select */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>
                Target Buckets <span style={{ fontWeight: 400, color: '#aaa' }}>(select one or more)</span>
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {BUCKET_OPTS.map(b => {
                  const sel = form.buckets.includes(b)
                  const bColor = { '1-30 DPD': C.green, '31-60 DPD': C.amber, '61-90 DPD': C.red, 'NPA': '#ef4444', 'Write-off': C.gray }[b] || C.gray
                  return (
                    <button key={b} type="button" onClick={() => toggleBucket(b)} style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${sel ? bColor : '#e0e3eb'}`,
                      background: sel ? `${bColor}18` : '#fff',
                      color: sel ? bColor : '#888'
                    }}>
                      {b}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Schedule date */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Schedule Date</label>
                <input
                  type="date"
                  value={form.schedule_date}
                  onChange={e => setForm(f => ({ ...f, schedule_date: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {/* Schedule time */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Schedule Time</label>
                <input
                  type="time"
                  value={form.schedule_time}
                  onChange={e => setForm(f => ({ ...f, schedule_time: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {/* Target count preview */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>Target Count Preview</label>
                <div style={{
                  padding: '8px 12px', background: '#f8f9fc', borderRadius: 8,
                  border: '0.5px solid #e0e3eb', fontSize: 13, fontWeight: 700,
                  color: targetPreview != null ? C.purple : '#bbb', minHeight: 38,
                  display: 'flex', alignItems: 'center'
                }}>
                  {previewLoading ? 'Estimating...' : targetPreview != null ? `≈ ${targetPreview.toLocaleString()} accounts` : 'Select buckets above'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={submitting} style={{
                padding: '9px 24px', background: C.purple, color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1
              }}>
                {submitting ? 'Creating...' : 'Create Campaign'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{
                padding: '9px 18px', border: '0.5px solid #e0e3eb', background: '#fff',
                borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#555'
              }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Section B — Active & Scheduled Campaigns ── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #f0f2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>Active & Scheduled</span>
          <span style={{ fontSize: 11, color: '#aaa' }}>{active.length + scheduled.length} campaigns</span>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>Loading campaigns...
          </div>
        ) : [...active, ...scheduled].length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
            No active or scheduled campaigns. Create one above.
          </div>
        ) : (
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...active, ...scheduled].map(camp => {
              const ch = CHANNEL_META[camp.channel] || CHANNEL_META['SMS']
              const st = STATUS_META[camp.status] || STATUS_META['Scheduled']
              const reachPct = camp.target_count > 0 ? Math.round((camp.reached_count / camp.target_count) * 100) : 0
              const responseRate = camp.reached_count > 0 ? (camp.response_count / camp.reached_count * 100).toFixed(1) : '—'
              const isActioning = actionId === camp.id

              return (
                <div key={camp.id} style={{
                  border: '0.5px solid #e8eaf0', borderRadius: 10,
                  padding: '14px 16px', background: '#fafbfc'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{camp.name}</span>
                        <Badge label={camp.status} color={st.color} bg={st.bg} small />
                        <Badge label={`${ch.icon} ${camp.channel}`} color={ch.color} bg={ch.bg} small />
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {camp.buckets.join(' · ')} · {camp.target_filter} ·{' '}
                        <span style={{ color: '#555' }}>{camp.schedule_date} {camp.schedule_time}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {camp.status === 'Scheduled' && canManage && (
                        <button
                          onClick={() => handleLaunch(camp.id)}
                          disabled={isActioning}
                          style={{
                            padding: '7px 16px', background: C.green, color: '#fff',
                            border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600,
                            cursor: isActioning ? 'not-allowed' : 'pointer', opacity: isActioning ? 0.5 : 1
                          }}
                        >
                          {isActioning ? '...' : '▶ Launch'}
                        </button>
                      )}
                      {(camp.status === 'Active' || camp.status === 'Paused') && (
                        <button
                          onClick={() => handlePause(camp.id)}
                          disabled={isActioning}
                          style={{
                            padding: '7px 16px',
                            background: camp.status === 'Active' ? C.amber : C.green,
                            color: '#fff', border: 'none', borderRadius: 7,
                            fontSize: 12, fontWeight: 600,
                            cursor: isActioning ? 'not-allowed' : 'pointer', opacity: isActioning ? 0.5 : 1
                          }}
                        >
                          {isActioning ? '...' : camp.status === 'Active' ? '⏸ Pause' : '▶ Resume'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
                    {[
                      { label: 'Targeted',      value: camp.target_count.toLocaleString(),   color: '#1a1a2e' },
                      { label: 'Reached',        value: camp.reached_count.toLocaleString(),   color: ch.color  },
                      { label: 'Response Rate',  value: `${responseRate}%`,                    color: C.blue    },
                      { label: 'PTPs Captured',  value: camp.ptp_count.toLocaleString(),        color: C.green   },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: 'center', background: '#fff', borderRadius: 7, padding: '8px 4px' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginBottom: 3 }}>
                      <span>Reach progress</span>
                      <span style={{ fontWeight: 600, color: ch.color }}>{reachPct}%</span>
                    </div>
                    <ProgressBar value={camp.reached_count} max={camp.target_count} color={ch.color} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Section D — Completed Campaigns Table ── */}
      {completed.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '0.5px solid #f0f2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>Completed Campaigns</span>
            <span style={{ fontSize: 11, color: '#aaa' }}>{completed.length} campaigns</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Campaign', 'Channel', 'Date', 'Targeted', 'Reached', 'Response Rate', 'PTPs', 'SAR Recovered'].map(h => (
                    <th key={h} style={{
                      padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                      color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em',
                      background: '#fafbfc', borderBottom: '0.5px solid #e8eaf0', whiteSpace: 'nowrap'
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {completed.map((camp, i) => {
                  const ch = CHANNEL_META[camp.channel] || CHANNEL_META['SMS']
                  const responseRate = camp.reached_count > 0
                    ? (camp.response_count / camp.reached_count * 100).toFixed(1) : '0'
                  const sarRecovered = (camp.ptp_count * AVG_PTP_SAR / 1e6).toFixed(2)
                  return (
                    <tr key={camp.id} style={{ borderBottom: i < completed.length - 1 ? '0.5px solid #f5f6fa' : 'none' }}>
                      <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1a1a2e' }}>{camp.name}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <Badge label={`${ch.icon} ${camp.channel}`} color={ch.color} bg={ch.bg} small />
                      </td>
                      <td style={{ padding: '11px 14px', color: '#555' }}>{camp.schedule_date}</td>
                      <td style={{ padding: '11px 14px', color: '#555' }}>{camp.target_count.toLocaleString()}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 600, color: C.blue }}>{camp.reached_count.toLocaleString()}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontWeight: 700, color: parseFloat(responseRate) >= 25 ? C.green : C.amber }}>
                          {responseRate}%
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: C.green }}>{camp.ptp_count.toLocaleString()}</td>
                      <td style={{ padding: '11px 14px', fontWeight: 700, color: C.teal }}>SAR {sarRecovered}M</td>
                    </tr>
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
