import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { getLegalCases, getLegalCase, createLegalCase, updateLegalCaseStatus, getLegalStats } from './api'

// ── Colour tokens ──────────────────────────────────────────────
const C = {
  purple: '#6c63ff', blue: '#3b82f6', green: '#22c55e',
  amber: '#f59e0b',  red: '#ef4444',  teal: '#14b8a6',
  gray: '#94a3b8',   orange: '#f97316',
}

const BUCKET_META = {
  '1-30 DPD':  { color: '#16a34a', bg: '#dcfce7' },
  '31-60 DPD': { color: '#d97706', bg: '#fef3c7' },
  '61-90 DPD': { color: '#ea580c', bg: '#ffedd5' },
  'NPA':        { color: '#dc2626', bg: '#fee2e2' },
  'Write-off':  { color: '#4b5563', bg: '#f1f5f9' },
}

const STATUS_META = {
  'Initiated':    { color: '#6b7280', bg: '#f3f4f6' },
  'Under Review': { color: C.blue,   bg: '#dbeafe' },
  'Filed':        { color: C.amber,  bg: '#fef3c7' },
  'Active':       { color: C.purple, bg: '#ede9fe' },
  'Judgment':     { color: C.orange, bg: '#ffedd5' },
  'Suspended':    { color: C.red,    bg: '#fee2e2' },
  'Closed':       { color: C.green,  bg: '#dcfce7' },
}

const TYPE_META = {
  'Civil':       { color: C.blue,   bg: '#dbeafe' },
  'Criminal':    { color: C.red,    bg: '#fee2e2' },
  'Enforcement': { color: C.purple, bg: '#ede9fe' },
}

const STATUSES   = ['Initiated', 'Under Review', 'Filed', 'Active', 'Judgment', 'Suspended', 'Closed']
const BUCKETS    = ['1-30 DPD', '31-60 DPD', '61-90 DPD', 'NPA', 'Write-off']
const CASE_TYPES = ['Civil', 'Criminal', 'Enforcement']
const LAWYERS    = ['Khaled Al-Harbi', 'Nora Al-Khalid']
const COLLATERALS = ['None', 'Vehicle', 'Property', 'Guarantor']

function fmt(n) {
  if (n == null) return '—'
  return 'SAR ' + Number(n).toLocaleString()
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

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

function SectionCard({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
      <div style={{ padding: '13px 18px', borderBottom: '0.5px solid #f0f2f7' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{title}</span>
      </div>
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e0e3eb',
  fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#1a1a2e',
}
const btnPrimary   = { padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', background: C.purple, color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }
const btnSecondary = { padding: '9px 20px', borderRadius: 8, border: '1px solid #e0e3eb', cursor: 'pointer', background: '#fff', color: '#555', fontSize: 13, fontWeight: 500, fontFamily: 'inherit' }

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
export default function LegalPage() {
  const { user } = useAuth()
  const canManage = ['admin', 'supervisor', 'legal'].includes(user?.role)

  // List state
  const [cases, setCases]         = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [stats, setStats]         = useState(null)

  // Filters
  const [search, setSearch]           = useState('')
  const [statusF, setStatusF]         = useState('All')
  const [bucketF, setBucketF]         = useState('All')
  const [typeF, setTypeF]             = useState('All')

  // Detail drawer
  const [drawer, setDrawer]           = useState(null) // full case object
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [statusForm, setStatusForm]   = useState({ status: '', note: '', next_action_date: '', next_action_type: '' })
  const [updating, setUpdating]       = useState(false)

  // Create modal
  const [showModal, setShowModal]     = useState(false)
  const [form, setForm]               = useState({ account_id: '', case_type: 'Civil', assigned_lawyer: LAWYERS[0], collateral_type: 'None', notes: '' })
  const [submitting, setSubmitting]   = useState(false)
  const [formError, setFormError]     = useState('')

  const PAGE_SIZE = 20

  useEffect(() => {
    loadStats()
    loadCases(1)
  }, [])

  function loadStats() {
    getLegalStats().then(d => setStats(d)).catch(() => {})
  }

  function loadCases(p, overrides = {}) {
    setLoading(true)
    const params = { page: p, limit: PAGE_SIZE }
    const sf = overrides.statusF  !== undefined ? overrides.statusF  : statusF
    const bf = overrides.bucketF  !== undefined ? overrides.bucketF  : bucketF
    const s  = overrides.search   !== undefined ? overrides.search   : search
    if (sf !== 'All') params.status = sf
    if (bf !== 'All') params.bucket = bf
    if (s)            params.search = s
    getLegalCases(params)
      .then(d => { setCases(d.cases || []); setTotal(d.total || 0); setPage(p) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  function applyFilters() { loadCases(1) }

  function openDrawer(c) {
    setDrawer(c)
    setStatusForm({ status: c.status, note: '', next_action_date: c.next_action_date || '', next_action_type: c.next_action_type || '' })
    setDrawerLoading(true)
    getLegalCase(c.id)
      .then(full => { setDrawer(full); setStatusForm(prev => ({ ...prev, status: full.status })) })
      .catch(() => {})
      .finally(() => setDrawerLoading(false))
  }

  async function handleUpdateStatus() {
    if (!statusForm.status || !statusForm.note) return
    setUpdating(true)
    try {
      const updated = await updateLegalCaseStatus(drawer.id, {
        status:           statusForm.status,
        note:             statusForm.note,
        next_action_date: statusForm.next_action_date || null,
        next_action_type: statusForm.next_action_type || null,
      })
      setDrawer(updated)
      setCases(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))
      loadStats()
    } catch (e) {}
    finally { setUpdating(false) }
  }

  async function handleSubmit() {
    if (!form.account_id) { setFormError('Account ID is required'); return }
    setSubmitting(true)
    setFormError('')
    try {
      await createLegalCase(form)
      setShowModal(false)
      setForm({ account_id: '', case_type: 'Civil', assigned_lawyer: LAWYERS[0], collateral_type: 'None', notes: '' })
      loadCases(1)
      loadStats()
    } catch (e) {
      setFormError(e.message || 'Failed to create case')
    } finally {
      setSubmitting(false)
    }
  }

  // Filtered client-side by type (type filter not sent to backend)
  const visibleCases = typeF === 'All' ? cases : cases.filter(c => c.case_type === typeF)

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const totalOut   = stats?.total_outstanding_sar ?? 0
  const totalRec   = stats?.total_recovered_sar   ?? 0

  return (
    <div style={{ padding: 28, minHeight: '100vh', background: '#f5f6fa' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Legal Case Management</h1>
          <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>Court cases, enforcement actions, and legal escalations</div>
        </div>
        {canManage && (
          <button onClick={() => { setShowModal(true); setFormError('') }} style={btnPrimary}>
            + Initiate Case
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
        <KPICard label="Total Cases"       value={stats?.total_cases ?? '—'}    icon="⚖️" color={C.purple} />
        <KPICard label="Active / Filed"    value={stats?.active_cases ?? '—'}   icon="📋" color={C.blue}   sub={`${stats?.filed_cases ?? 0} filed`} />
        <KPICard label="Under Judgment"    value={stats?.judgment_cases ?? '—'} icon="🔨" color={C.orange} />
        <KPICard label="Total Outstanding" value={totalOut ? 'SAR ' + (totalOut / 1e6).toFixed(1) + 'M' : '—'} icon="💰" color={C.red} />
        <KPICard label="Recovery Rate"     value={stats ? stats.recovery_rate_pct + '%' : '—'} icon="📈" color={C.green} sub={`SAR ${(totalRec / 1e6).toFixed(1)}M recovered`} />
      </div>

      {/* Middle panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <SectionCard title="Cases by Status">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats && Object.entries(stats.cases_by_status || {}).sort((a, b) => b[1] - a[1]).map(([s, cnt]) => {
              const m = STATUS_META[s] || { color: '#888', bg: '#f1f5f9' }
              const pct = stats.total_cases > 0 ? (cnt / stats.total_cases * 100) : 0
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 100, fontSize: 12, fontWeight: 500, color: '#444', flexShrink: 0 }}>{s}</div>
                  <div style={{ flex: 1, height: 7, background: '#f0f2f7', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: m.color, borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 700, color: m.color }}>{cnt}</div>
                </div>
              )
            })}
          </div>
        </SectionCard>
        <SectionCard title="Cases by Bucket">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats && BUCKETS.map(b => {
              const cnt = (stats.cases_by_bucket || {})[b] || 0
              if (!cnt) return null
              const m   = BUCKET_META[b] || { color: '#888' }
              const pct = stats.total_cases > 0 ? (cnt / stats.total_cases * 100) : 0
              return (
                <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 100, fontSize: 12, fontWeight: 500, color: '#444', flexShrink: 0 }}>{b}</div>
                  <div style={{ flex: 1, height: 7, background: '#f0f2f7', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: m.color, borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 700, color: m.color }}>{cnt}</div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>

      {/* Filter bar */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0',
        padding: '13px 18px', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <input
          placeholder="Search case # or customer..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyFilters()}
          style={{ ...inputStyle, width: 230, flex: 'none' }}
        />
        <select value={statusF} onChange={e => { setStatusF(e.target.value); loadCases(1, { statusF: e.target.value }) }} style={{ ...inputStyle, width: 150, flex: 'none' }}>
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={bucketF} onChange={e => { setBucketF(e.target.value); loadCases(1, { bucketF: e.target.value }) }} style={{ ...inputStyle, width: 140, flex: 'none' }}>
          <option value="All">All Buckets</option>
          {BUCKETS.map(b => <option key={b}>{b}</option>)}
        </select>
        <select value={typeF} onChange={e => setTypeF(e.target.value)} style={{ ...inputStyle, width: 140, flex: 'none' }}>
          <option value="All">All Types</option>
          {CASE_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <button onClick={applyFilters} style={{ ...btnSecondary, padding: '8px 16px', fontSize: 12 }}>Search</button>
      </div>

      {/* Cases table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden', marginBottom: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8f9fc' }}>
              {['Case #', 'Customer', 'Bucket', 'Outstanding', 'Type', 'Lawyer', 'Status', 'Next Action', ''].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 12, borderBottom: '0.5px solid #e8eaf0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Loading cases...</td></tr>
            ) : visibleCases.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>No cases found</td></tr>
            ) : visibleCases.map(c => {
              const sm = STATUS_META[c.status]   || { color: '#888', bg: '#f1f5f9' }
              const bm = BUCKET_META[c.delinquency_bucket] || { color: '#888', bg: '#f1f5f9' }
              const tm = TYPE_META[c.case_type]  || { color: '#888', bg: '#f1f5f9' }
              return (
                <tr key={c.id} style={{ borderBottom: '0.5px solid #f0f2f7' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: C.purple }}>{c.case_number}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{c.customer_name}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{c.account_id}</div>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <Badge label={c.delinquency_bucket} color={bm.color} bg={bm.bg} small />
                  </td>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1a1a2e' }}>
                    {fmt(c.outstanding_sar)}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <Badge label={c.case_type} color={tm.color} bg={tm.bg} small />
                  </td>
                  <td style={{ padding: '11px 14px', color: '#555' }}>{c.assigned_lawyer}</td>
                  <td style={{ padding: '11px 14px' }}>
                    <Badge label={c.status} color={sm.color} bg={sm.bg} small />
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {c.next_action_date ? (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#444' }}>{fmtDate(c.next_action_date)}</div>
                        <div style={{ fontSize: 11, color: '#aaa' }}>{c.next_action_type || ''}</div>
                      </div>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <button
                      onClick={() => openDrawer(c)}
                      style={{ padding: '5px 14px', borderRadius: 7, border: `1px solid ${C.purple}40`, background: `${C.purple}08`, color: C.purple, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >View</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 18px', borderTop: '0.5px solid #f0f2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#888' }}>
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={page <= 1} onClick={() => loadCases(page - 1)} style={{ ...btnSecondary, padding: '6px 14px', fontSize: 12, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>← Prev</button>
              <button disabled={page >= totalPages} onClick={() => loadCases(page + 1)} style={{ ...btnSecondary, padding: '6px 14px', fontSize: 12, opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* ── CASE DETAIL DRAWER ── */}
      {drawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900 }}>
          <div onClick={() => setDrawer(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 520,
            background: '#fff', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Drawer header */}
            <div style={{ padding: '18px 22px', borderBottom: '0.5px solid #f0f2f7', flexShrink: 0, background: '#fafbff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontWeight: 700, color: C.purple, fontSize: 15 }}>{drawer.case_number}</div>
                <button onClick={() => setDrawer(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#1a1a2e', marginBottom: 6 }}>{drawer.customer_name}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Badge label={drawer.status} color={(STATUS_META[drawer.status] || {}).color || '#888'} bg={(STATUS_META[drawer.status] || {}).bg || '#f1f5f9'} />
                <Badge label={drawer.case_type} color={(TYPE_META[drawer.case_type] || {}).color || '#888'} bg={(TYPE_META[drawer.case_type] || {}).bg || '#f1f5f9'} />
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
              {drawerLoading ? (
                <div style={{ color: '#aaa', textAlign: 'center', paddingTop: 40 }}>Loading...</div>
              ) : (
                <>
                  {/* Case info grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px', marginBottom: 20 }}>
                    {[
                      ['Account ID',      drawer.account_id],
                      ['Bucket',          drawer.delinquency_bucket],
                      ['Outstanding',     fmt(drawer.outstanding_sar)],
                      ['Recovery',        fmt(drawer.recovery_amount_sar)],
                      ['Collateral',      drawer.collateral_type],
                      ['Lawyer',          drawer.assigned_lawyer],
                      ['Initiated',       fmtDate(drawer.initiated_date)],
                      ['Court Date',      fmtDate(drawer.court_date)],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{val || '—'}</div>
                      </div>
                    ))}
                  </div>

                  {drawer.notes && (
                    <div style={{ background: '#f8f9fc', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#555' }}>
                      {drawer.notes}
                    </div>
                  )}

                  {/* Status update */}
                  {canManage && (
                    <div style={{ background: '#fafbff', border: '0.5px solid #e8eaf0', borderRadius: 10, padding: '14px 16px', marginBottom: 18 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Update Status</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>New Status</div>
                          <select value={statusForm.status} onChange={e => setStatusForm(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                            {STATUSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Next Action Type</div>
                          <input value={statusForm.next_action_type} onChange={e => setStatusForm(p => ({ ...p, next_action_type: e.target.value }))} placeholder="e.g. Court Hearing" style={inputStyle} />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Next Action Date</div>
                          <input type="date" value={statusForm.next_action_date} onChange={e => setStatusForm(p => ({ ...p, next_action_date: e.target.value }))} style={inputStyle} />
                        </div>
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Note (required)</div>
                        <textarea value={statusForm.note} onChange={e => setStatusForm(p => ({ ...p, note: e.target.value }))} rows={2} placeholder="Describe what happened..." style={{ ...inputStyle, resize: 'none' }} />
                      </div>
                      <button
                        onClick={handleUpdateStatus}
                        disabled={updating || !statusForm.note}
                        style={{ ...btnPrimary, opacity: updating || !statusForm.note ? 0.55 : 1, width: '100%' }}
                      >{updating ? 'Updating...' : 'Update Status'}</button>
                    </div>
                  )}

                  {/* Timeline */}
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>Timeline</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {(drawer.timeline || []).slice().reverse().map((ev, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.purple, marginTop: 3, flexShrink: 0 }} />
                          {i < (drawer.timeline || []).length - 1 && (
                            <div style={{ width: 1, flex: 1, background: '#e8eaf0', marginTop: 4 }} />
                          )}
                        </div>
                        <div style={{ paddingBottom: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{ev.event}</span>
                            <span style={{ fontSize: 11, color: '#aaa' }}>{fmtDateTime(ev.date)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#666', marginBottom: 1 }}>by {ev.user}</div>
                          {ev.notes && <div style={{ fontSize: 12, color: '#555', background: '#f8f9fc', padding: '5px 9px', borderRadius: 6, marginTop: 4 }}>{ev.notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── INITIATE CASE MODAL ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 460, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Initiate Legal Case</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
            </div>

            <Field label="Account ID">
              <input value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))} placeholder="e.g. WAT-012345" style={inputStyle} />
            </Field>
            <Field label="Case Type">
              <div style={{ display: 'flex', gap: 8 }}>
                {CASE_TYPES.map(t => {
                  const m = TYPE_META[t]
                  return (
                    <button key={t} onClick={() => setForm(p => ({ ...p, case_type: t }))} style={{
                      flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 12,
                      border: form.case_type === t ? `2px solid ${m.color}` : '1px solid #e0e3eb',
                      background: form.case_type === t ? m.bg : '#fff', color: form.case_type === t ? m.color : '#555',
                    }}>{t}</button>
                  )
                })}
              </div>
            </Field>
            <Field label="Assigned Lawyer">
              <select value={form.assigned_lawyer} onChange={e => setForm(p => ({ ...p, assigned_lawyer: e.target.value }))} style={inputStyle}>
                {LAWYERS.map(l => <option key={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Collateral Type">
              <select value={form.collateral_type} onChange={e => setForm(p => ({ ...p, collateral_type: e.target.value }))} style={inputStyle}>
                {COLLATERALS.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Notes">
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Case background and context..." style={{ ...inputStyle, resize: 'none' }} />
            </Field>

            {formError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 7 }}>{formError}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={btnSecondary}>Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Initiating...' : 'Initiate Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
