import { useState, useEffect, useMemo } from 'react'
import {
  getAccounts, getAccount, getAccountScore, getCallHistory, capturePTP,
  getPTPWorkflow, triggerPTPWorkflow, getEscalations, getSettlements,
  getSettlementOptions, createSettlement, acceptSettlement, rejectSettlement,
  createWaiver, getFraudReport, getAccountFraudFlag, addFraudFlag, removeFraudFlag,
} from './api'
import { useAuth } from './AuthContext'

// ── Bucket colors match actual dpd_bucket values in wataniya_accounts.csv ──
const BUCKET_COLORS = {
  '0 Days':      '#6b7280',
  '1-30 Days':   '#22c55e',
  '31-60 Days':  '#f59e0b',
  '61-90 Days':  '#f97316',
  'NPA 91-180':  '#ef4444',
  'NPA 181-360': '#dc2626',
  'NPA 361-450': '#b91c1c',
  'Write-Off':   '#64748b',
}

const ALL_BUCKETS = ['0 Days', '1-30 Days', '31-60 Days', '61-90 Days', 'NPA 91-180', 'NPA 181-360', 'NPA 361-450', 'Write-Off']

const RISK_COLORS = {
  'Low Risk': '#22c55e', 'Medium Risk': '#f59e0b',
  'High Risk': '#f97316', 'Very High Risk': '#ef4444',
}

const CHANNEL_ICONS = {
  'Outbound Call': '📞', 'SMS': '💬', 'WhatsApp': '📱',
  'AI Voice': '🤖', 'Human Agent': '👤', 'IVR': '🤖',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const sarFmt = v =>
  v != null && !isNaN(v) && Number(v) !== 0
    ? `SAR ${Number(v).toLocaleString('en-SA', { maximumFractionDigits: 0 })}`
    : '—'

const pct1  = v => v != null && !isNaN(v) ? `${(v * 100).toFixed(1)}%` : '—'
const pct0  = v => v != null && !isNaN(v) ? `${Math.round(v * 100)}%`  : '—'
const numFmt = v => v != null && !isNaN(v) ? String(Math.round(v))      : '—'

const scoreTier = s =>
  s == null ? '—'
  : s >= 700 ? 'Low Risk'
  : s >= 550 ? 'Medium Risk'
  : s >= 400 ? 'High Risk'
  : 'Very High Risk'

// Default PTP date = 7 days from today
const defaultPTPDate = () => {
  const d = new Date(); d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Badge({ label, color, bg }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg || `${color}18`, color }}>
      {label}
    </span>
  )
}

function ScoreGauge({ score }) {
  const pct   = Math.min(Math.max(((score - 300) / 550) * 100, 0), 100)
  const color = score >= 700 ? '#22c55e' : score >= 550 ? '#f59e0b' : score >= 400 ? '#f97316' : '#ef4444'
  const tier  = scoreTier(score)
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 48, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: 11, color: '#aaa', margin: '4px 0 6px' }}>PTP Score (300–850)</div>
      <div style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${color}18`, color, marginBottom: 10 }}>{tier}</div>
      <div style={{ height: 8, background: '#f0f2f7', borderRadius: 4, overflow: 'hidden', margin: '0 12px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bbb', margin: '4px 12px 0' }}>
        <span>300 Very High</span><span>550</span><span>700 Low</span><span>850</span>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f5f6fa', fontSize: 13 }}>
      <span style={{ color: '#888', flexShrink: 0, marginRight: 8 }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#1a1a2e', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AgentWorkspace() {
  const { user } = useAuth()

  const [accounts,       setAccounts]       = useState([])
  const [selected,       setSelected]       = useState(null)
  const [accountDetail,  setAccountDetail]  = useState(null)
  const [accountCalls,   setAccountCalls]   = useState([])   // last 5 for display
  const [allCalls,       setAllCalls]       = useState([])   // up to 100 for channel stats
  const [score,          setScore]          = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [detailLoading,  setDetailLoading]  = useState(false)
  const [scoreLoading,   setScoreLoading]   = useState(false)
  const [callsLoading,   setCallsLoading]   = useState(false)
  const [showPTP,        setShowPTP]        = useState(false)
  const [ptpForm,        setPtpForm]        = useState({ amount: '', date: defaultPTPDate(), notes: '' })
  const [ptpSuccess,     setPtpSuccess]     = useState(false)
  const [activePTP,      setActivePTP]      = useState(null)
  const [ptpAdvancing,   setPtpAdvancing]   = useState(false)
  const [escalatedIds,   setEscalatedIds]   = useState(new Set())
  const [flaggedIds,     setFlaggedIds]     = useState(new Set())
  const [accountFlag,    setAccountFlag]    = useState(null)
  const [showFlagForm,   setShowFlagForm]   = useState(false)
  const [flagForm,       setFlagForm]       = useState({ severity: 'High', reason: 'Suspected Fraud', notes: '', evidence_ref: '' })
  const [flagBusy,       setFlagBusy]       = useState(false)
  const [flagRemoving,   setFlagRemoving]   = useState(false)
  const [showWaiver,     setShowWaiver]     = useState(false)
  const [waiverSuccess,  setWaiverSuccess]  = useState(false)
  const [waiverBusy,     setWaiverBusy]     = useState(false)
  const [waiverForm,     setWaiverForm]     = useState({ waiver_type: 'Late Fee', amount_sar: '', reason: 'Customer hardship', notes: '' })
  const [settlementOpen, setSettlementOpen] = useState(false)
  const [settlements,    setSettlements]    = useState([])
  const [settlOpts,      setSettlOpts]      = useState([])
  const [showOffer,      setShowOffer]      = useState(false)
  const [offerType,      setOfferType]      = useState('')
  const [offerDiscount,  setOfferDiscount]  = useState(0)
  const [offerTenor,     setOfferTenor]     = useState(3)
  const [offerAmount,    setOfferAmount]    = useState('')
  const [offerExpiry,    setOfferExpiry]    = useState(7)
  const [offerNotes,     setOfferNotes]     = useState('')
  const [offerBusy,      setOfferBusy]      = useState(false)
  const [settlLoading,   setSettlLoading]   = useState(false)
  const [search,         setSearch]         = useState('')
  const [bucket,         setBucket]         = useState('')

  // ── Initial loads ───────────────────────────────────────────────────────────
  useEffect(() => { loadAccounts() }, [bucket])

  useEffect(() => {
    getEscalations()
      .then(d => setEscalatedIds(new Set((d?.escalations || []).filter(e => e.escalation_status === 'pending').map(e => e.account_id))))
      .catch(() => {})
    getFraudReport()
      .then(d => setFlaggedIds(new Set((d?.flagged_accounts || []).map(f => f.account_id))))
      .catch(() => {})
  }, [])

  async function loadAccounts() {
    setLoading(true)
    try {
      const params = { limit: 100 }
      if (bucket) params.bucket = bucket
      const data = await getAccounts(params)
      setAccounts(data.accounts || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function loadSettlements(lid) {
    setSettlLoading(true)
    Promise.all([getSettlements({ account_id: lid }), getSettlementOptions(lid)])
      .then(([sd, opts]) => {
        setSettlements(sd.settlements || [])
        setSettlOpts(opts.offers || [])
        if (opts.offers?.length) setOfferType(opts.offers[0].type)
      })
      .catch(() => {})
      .finally(() => setSettlLoading(false))
  }

  async function selectAccount(a) {
    setSelected(a)
    setAccountDetail(null)
    setAccountCalls([])
    setAllCalls([])
    setScore(null)
    setActivePTP(null)
    setShowPTP(false)
    setPtpSuccess(false)
    setPtpForm({ amount: a.installment_amount ? String(Math.round(a.installment_amount)) : '', date: defaultPTPDate(), notes: '' })
    setDetailLoading(true)
    setScoreLoading(true)
    setCallsLoading(true)
    setSettlementOpen(false)
    setShowOffer(false)
    setSettlements([])
    setSettlOpts([])
    setShowWaiver(false)
    setWaiverSuccess(false)
    setWaiverForm({ waiver_type: 'Late Fee', amount_sar: '', reason: 'Customer hardship', notes: '' })
    setAccountFlag(null)
    setShowFlagForm(false)

    const id = a.loan_id

    getAccountFraudFlag(id).then(f => setAccountFlag(f?.flag_id ? f : null)).catch(() => {})

    getAccountScore(id)
      .then(s => setScore(s))
      .catch(() => {})
      .finally(() => setScoreLoading(false))

    getAccount(id)
      .then(d => {
        setAccountDetail(d)
        // Update PTP form amount with real installment_amount from full detail
        if (d?.installment_amount)
          setPtpForm(f => ({ ...f, amount: f.amount || String(Math.round(d.installment_amount)) }))
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false))

    // Fetch up to 100 calls for channel stats; display 5
    getCallHistory({ loan_id: id, limit: 100 })
      .then(d => {
        const calls = d.calls || []
        setAllCalls(calls)
        setAccountCalls(calls.slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setCallsLoading(false))

    getPTPWorkflow()
      .then(d => {
        const found = (d.ptps || []).find(p => p.account_id === id && !['PAID', 'ESCALATED'].includes(p.workflow_status))
        setActivePTP(found || null)
      })
      .catch(() => {})

    loadSettlements(id)
  }

  // ── Channel response rates from allCalls ────────────────────────────────────
  const channelStats = useMemo(() => {
    if (!allCalls.length) return null
    const total    = allCalls.length
    const finished = allCalls.filter(c => c.status === 'FINISHED').length
    const smsSent  = allCalls.filter(c => c.sms_triggered).length
    const aiCalls  = allCalls.filter(c => c.agent_type === 'AI').length
    const humCalls = allCalls.filter(c => c.agent_type !== 'AI').length
    return {
      callPickup: finished / Math.max(total, 1),
      smsRate:    smsSent  / Math.max(total, 1),
      aiShare:    aiCalls  / Math.max(total, 1),
      humanShare: humCalls / Math.max(total, 1),
      total, finished, aiCalls, humCalls,
    }
  }, [allCalls])

  // ── Submit handlers ─────────────────────────────────────────────────────────
  async function submitPTP() {
    try {
      await capturePTP({
        account_id:   selected.loan_id,
        agent_id:     user.user_id,
        amount_sar:   parseFloat(ptpForm.amount),
        promise_date: ptpForm.date,
        notes:        ptpForm.notes,
        channel:      'Human Agent',
      })
      setPtpSuccess(true); setShowPTP(false)
    } catch (e) { alert('PTP capture failed: ' + e.message) }
  }

  async function submitOffer() {
    if (!offerType || !offerAmount) return
    setOfferBusy(true)
    try {
      await createSettlement({
        account_id:            selected.loan_id,
        offer_type:            offerType,
        discount_pct:          offerType === 'Discount' ? offerDiscount : null,
        tenor_months:          offerType === 'PaymentPlan' ? offerTenor : null,
        settlement_amount_sar: parseFloat(offerAmount),
        expiry_days:           offerExpiry,
        notes:                 offerNotes,
      })
      setShowOffer(false); setOfferNotes('')
      loadSettlements(selected.loan_id)
    } catch (e) { alert('Failed: ' + e.message) }
    finally { setOfferBusy(false) }
  }

  async function submitWaiver() {
    if (!waiverForm.amount_sar || parseFloat(waiverForm.amount_sar) <= 0) return
    setWaiverBusy(true)
    try {
      await createWaiver({
        account_id:  selected.loan_id,
        waiver_type: waiverForm.waiver_type,
        amount_sar:  parseFloat(waiverForm.amount_sar),
        reason:      waiverForm.reason,
        notes:       waiverForm.notes,
      })
      setShowWaiver(false); setWaiverSuccess(true)
    } catch (e) { alert('Waiver failed: ' + e.message) }
    finally { setWaiverBusy(false) }
  }

  async function submitFraudFlag() {
    if (!flagForm.notes) return
    setFlagBusy(true)
    try {
      const flag = await addFraudFlag(selected.loan_id, flagForm)
      setAccountFlag(flag)
      setFlaggedIds(prev => new Set([...prev, selected.loan_id]))
      setShowFlagForm(false)
    } catch (e) { alert('Flag failed: ' + e.message) }
    finally { setFlagBusy(false) }
  }

  async function handleRemoveFlag() {
    if (!window.confirm('Remove fraud flag?')) return
    setFlagRemoving(true)
    try {
      await removeFraudFlag(selected.loan_id)
      setAccountFlag(null)
      setFlaggedIds(prev => { const s = new Set(prev); s.delete(selected.loan_id); return s })
    } catch (e) { alert('Remove failed: ' + e.message) }
    finally { setFlagRemoving(false) }
  }

  async function handleOfferAction(id, action) {
    try {
      if (action === 'accept') await acceptSettlement(id)
      else await rejectSettlement(id)
      loadSettlements(selected.loan_id)
    } catch (e) { alert(e.message) }
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const filtered = accounts.filter(a =>
    !search ||
    (a.loan_id || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.customer_name || '').toLowerCase().includes(search.toLowerCase())
  )

  const topFeatures = Array.isArray(score?.feature_importance) ? score.feature_importance : []
  const acc = accountDetail || selected   // full detail preferred, queue record as fallback

  const outstanding = acc?.remaining_principal || acc?.outstanding_balance || 0

  // Risk tier: prefer ml_risk_tier from CSV, derive from score as fallback
  const riskTier = acc?.ml_risk_tier || scoreTier(acc?.ptp_propensity_score)

  // DTI ratio
  const dtiRatio = (acc?.installment_amount && acc?.salary > 0)
    ? acc.installment_amount / acc.salary : null

  // Remaining tenure
  const remainingMonths = (acc?.num_installments != null && acc?.num_paid_installments != null)
    ? acc.num_installments - acc.num_paid_installments : null

  // PTPs kept count
  const ptpsKeptCount = (acc?.ptp_count != null && acc?.ptp_kept_ratio != null)
    ? Math.round(acc.ptp_kept_ratio * acc.ptp_count) : null

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ══ LEFT: Account Queue ══════════════════════════════════════════════ */}
      <div style={{ width: 320, borderRight: '0.5px solid #e8eaf0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid #f0f2f7' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 10 }}>Account Queue</div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or loan ID..."
            style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fafbfc', marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit' }} />
          <select value={bucket} onChange={e => setBucket(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, background: '#fafbfc', color: '#444', outline: 'none' }}>
            <option value="">All buckets</option>
            {ALL_BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Loading accounts...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No accounts found</div>
          ) : filtered.map(a => {
            const s  = a.ptp_propensity_score
            const sc = s >= 700 ? '#22c55e' : s >= 550 ? '#f59e0b' : s >= 400 ? '#f97316' : '#ef4444'
            const bc = BUCKET_COLORS[a.dpd_bucket] || '#888'
            const isSelected = selected?.loan_id === a.loan_id
            const rp = a.remaining_principal || a.outstanding_balance
            return (
              <div key={a.loan_id} onClick={() => selectAccount(a)} style={{
                padding: '11px 14px', cursor: 'pointer', borderBottom: '0.5px solid #f5f6fa',
                background: isSelected ? '#f8f7ff' : '#fff',
                borderLeft: isSelected ? '3px solid #6c63ff' : '3px solid transparent',
                transition: 'background 0.1s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {a.customer_name}
                    {escalatedIds.has(a.loan_id) && (
                      <span style={{ fontSize: 9, fontWeight: 800, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>!</span>
                    )}
                    {flaggedIds.has(a.loan_id) && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: sc, flexShrink: 0 }}>{s ?? '—'}</span>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>{a.loan_id}</div>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600, background: `${bc}18`, color: bc }}>
                    {a.dpd_bucket}
                  </span>
                  {rp > 0 && (
                    <span style={{ fontSize: 10, color: '#666' }}>
                      SAR {rp >= 1000 ? `${(rp / 1000).toFixed(0)}K` : Math.round(rp)}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '0.5px solid #f0f2f7', fontSize: 11, color: '#aaa' }}>
          {filtered.length} accounts · sorted by PTP score
        </div>
      </div>

      {/* ══ RIGHT: Account 360 ═══════════════════════════════════════════════ */}
      {acc ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f5f6fa' }}>

          {/* ── Header ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '18px 22px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', marginBottom: 3 }}>{acc.customer_name || '—'}</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                  {acc.loan_id} · {acc.product_type || '—'}
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge label={acc.dpd_bucket || '—'} color={BUCKET_COLORS[acc.dpd_bucket] || '#888'} />
                  <Badge label={riskTier} color={RISK_COLORS[riskTier] || '#888'} />
                  <Badge label={`DPD: ${acc.dpd ?? '—'}`} color="#6c63ff" />
                  <Badge
                    label={acc.account_status || '—'}
                    color={acc.account_status === 'Active' ? '#22c55e' : acc.account_status === 'Delinquent' ? '#f97316' : acc.account_status === 'Write-Off' ? '#6b7280' : '#94a3b8'}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
                {!ptpSuccess ? (
                  <button onClick={() => { setShowPTP(p => !p); setShowWaiver(false); setShowFlagForm(false) }}
                    style={{ padding: '9px 16px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    + Capture PTP
                  </button>
                ) : (
                  <span style={{ padding: '9px 14px', background: '#dcfce7', color: '#166534', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>✓ PTP Captured</span>
                )}
                {!waiverSuccess ? (
                  <button onClick={() => { setShowWaiver(w => !w); setShowPTP(false); setShowFlagForm(false) }}
                    style={{ padding: '9px 16px', background: showWaiver ? '#fff7ed' : '#fff', color: '#f97316', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Request Waiver
                  </button>
                ) : (
                  <span style={{ padding: '9px 14px', background: '#dcfce7', color: '#166534', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>✓ Waiver Submitted</span>
                )}
                {!accountFlag && (
                  <button onClick={() => { setShowFlagForm(f => !f); setShowPTP(false); setShowWaiver(false) }}
                    style={{ padding: '9px 16px', background: showFlagForm ? '#fef2f2' : '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Flag Account
                  </button>
                )}
              </div>
            </div>

            {/* Fraud flag banner */}
            {accountFlag && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', marginBottom: 2 }}>
                    FRAUD FLAG: {accountFlag.severity} — {accountFlag.reason}
                  </div>
                  <div style={{ fontSize: 11, color: '#7f1d1d' }}>
                    By <strong>{accountFlag.flagged_by}</strong> · {accountFlag.flagged_at?.slice(0, 10)}
                    {accountFlag.evidence_ref && ` · Ref: ${accountFlag.evidence_ref}`}
                  </div>
                  <div style={{ fontSize: 11, color: '#991b1b', marginTop: 2 }}>{accountFlag.notes}</div>
                </div>
                {['admin', 'supervisor'].includes(user?.role) && (
                  <button onClick={handleRemoveFlag} disabled={flagRemoving}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: flagRemoving ? 0.5 : 1 }}>
                    {flagRemoving ? '...' : 'Remove'}
                  </button>
                )}
              </div>
            )}

            {/* Flag form */}
            {showFlagForm && (
              <div style={{ marginTop: 14, padding: 16, background: '#fef2f2', borderRadius: 10, border: '1px solid #fca5a5' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 12 }}>Flag This Account</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Severity</label>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {[['High','#dc2626'],['Medium','#f59e0b'],['Low','#6b7280']].map(([s, c]) => (
                        <button key={s} onClick={() => setFlagForm(f => ({ ...f, severity: s }))}
                          style={{ flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                            border: `1px solid ${flagForm.severity === s ? c : '#e0e3eb'}`,
                            background: flagForm.severity === s ? c : '#fff',
                            color: flagForm.severity === s ? '#fff' : '#555' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Reason</label>
                    <select value={flagForm.reason} onChange={e => setFlagForm(f => ({ ...f, reason: e.target.value }))}
                      style={{ width: '100%', padding: '7px 8px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff' }}>
                      {['Dispute','Incorrect Info','Suspected Fraud','Identity Theft','Payment Manipulation'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <textarea value={flagForm.notes} onChange={e => setFlagForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Describe the fraud indicator or evidence... *"
                  rows={2} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: 8 }} />
                <input value={flagForm.evidence_ref} onChange={e => setFlagForm(f => ({ ...f, evidence_ref: e.target.value }))}
                  placeholder="Evidence reference (optional)"
                  style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={submitFraudFlag} disabled={flagBusy || !flagForm.notes}
                    style={{ padding: '8px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (flagBusy || !flagForm.notes) ? 0.5 : 1, fontFamily: 'inherit' }}>
                    {flagBusy ? 'Submitting...' : 'Submit Flag'}
                  </button>
                  <button onClick={() => setShowFlagForm(false)}
                    style={{ padding: '8px 14px', border: '0.5px solid #e0e3eb', borderRadius: 7, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* PTP capture form */}
            {showPTP && (
              <div style={{ marginTop: 16, padding: 16, background: '#f8f7ff', borderRadius: 10, border: '0.5px solid #e0deff' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6c63ff', marginBottom: 12 }}>Capture Promise to Pay</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Amount (SAR) *</label>
                    <input type="number" value={ptpForm.amount} onChange={e => setPtpForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder={acc.installment_amount ? String(Math.round(acc.installment_amount)) : 'e.g. 5000'}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Promise Date *</label>
                    <input type="date" value={ptpForm.date} onChange={e => setPtpForm(f => ({ ...f, date: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Notes</label>
                    <input value={ptpForm.notes} onChange={e => setPtpForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Optional..."
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={submitPTP} disabled={!ptpForm.amount || !ptpForm.date}
                    style={{ padding: '8px 20px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: (!ptpForm.amount || !ptpForm.date) ? 'not-allowed' : 'pointer', opacity: (!ptpForm.amount || !ptpForm.date) ? 0.5 : 1, fontFamily: 'inherit' }}>
                    Save PTP
                  </button>
                  <button onClick={() => setShowPTP(false)}
                    style={{ padding: '8px 14px', border: '0.5px solid #e0e3eb', borderRadius: 7, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Waiver form */}
            {showWaiver && (() => {
              const amt = parseFloat(waiverForm.amount_sar) || 0
              const impactPct = outstanding > 0 ? ((amt / outstanding) * 100).toFixed(1) : null
              return (
                <div style={{ marginTop: 16, padding: 16, background: '#fff7ed', borderRadius: 10, border: '0.5px solid #fed7aa' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#c2410c', marginBottom: 12 }}>Request Waiver</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Waiver Type</label>
                      <select value={waiverForm.waiver_type} onChange={e => setWaiverForm(f => ({ ...f, waiver_type: e.target.value }))}
                        style={{ width: '100%', padding: '7px 8px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff' }}>
                        {['Late Fee','Interest','Penalty','Processing Fee'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Amount (SAR)</label>
                      <input type="number" min="1" value={waiverForm.amount_sar}
                        onChange={e => setWaiverForm(f => ({ ...f, amount_sar: e.target.value }))}
                        placeholder="e.g. 1200"
                        style={{ width: '100%', padding: '7px 8px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none' }} />
                    </div>
                  </div>
                  <select value={waiverForm.reason} onChange={e => setWaiverForm(f => ({ ...f, reason: e.target.value }))}
                    style={{ width: '100%', padding: '7px 8px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff', marginBottom: 8 }}>
                    {['Customer hardship','Long-term customer','Settlement facilitation','Administrative error','Goodwill gesture'].map(r => <option key={r}>{r}</option>)}
                  </select>
                  {impactPct && amt > 0 && (
                    <div style={{ padding: '7px 10px', background: '#fff', borderRadius: 6, border: '0.5px solid #fed7aa', marginBottom: 8, fontSize: 12 }}>
                      Impact: reduces outstanding by <strong style={{ color: '#c2410c' }}>{impactPct}%</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={submitWaiver} disabled={waiverBusy || !waiverForm.amount_sar}
                      style={{ padding: '8px 18px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (waiverBusy || !waiverForm.amount_sar) ? 0.5 : 1, fontFamily: 'inherit' }}>
                      {waiverBusy ? 'Submitting...' : 'Submit for Review'}
                    </button>
                    <button onClick={() => setShowWaiver(false)}
                      style={{ padding: '8px 14px', border: '0.5px solid #e0e3eb', borderRadius: 7, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Active PTP Workflow */}
          {activePTP && (() => {
            const WF_COLOR = { PENDING:'#94a3b8', REMINDED:'#3b82f6', VOICE_REMINDED:'#6c63ff', DUE:'#f97316', BROKEN:'#ef4444' }
            const wfColor = WF_COLOR[activePTP.workflow_status] || '#888'
            const daysText = activePTP.days_until_due < 0 ? `${Math.abs(activePTP.days_until_due)}d overdue`
              : activePTP.days_until_due === 0 ? 'Due today' : `Due in ${activePTP.days_until_due}d`
            return (
              <div style={{ background: '#fafbff', borderRadius: 12, border: `1px solid ${wfColor}30`, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: wfColor, flexShrink: 0, boxShadow: `0 0 0 3px ${wfColor}25` }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Active PTP Workflow</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: wfColor }}>{activePTP.workflow_status.replace('_', ' ')}</span>
                    <span style={{ fontSize: 12, color: activePTP.days_until_due < 0 ? '#ef4444' : '#555', fontWeight: 600 }}>· {daysText}</span>
                    <span style={{ fontSize: 12, color: '#888' }}>· SAR {Number(activePTP.amount_sar).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{activePTP.next_step}</div>
                </div>
                {!['PAID','ESCALATED','BROKEN'].includes(activePTP.workflow_status) && (
                  <button onClick={async () => {
                    setPtpAdvancing(true)
                    try { setActivePTP(await triggerPTPWorkflow(activePTP.ptp_id)) } catch {}
                    finally { setPtpAdvancing(false) }}
                  } disabled={ptpAdvancing}
                    style={{ padding: '6px 13px', borderRadius: 7, border: 'none', background: wfColor, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: ptpAdvancing ? 0.5 : 1 }}>
                    {ptpAdvancing ? '...' : 'Advance →'}
                  </button>
                )}
              </div>
            )
          })()}

          {/* ── Contact Information ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>Contact Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { label: 'Phone',             value: acc.mobile_number ? String(acc.mobile_number) : '—', icon: '📞' },
                { label: 'Preferred Channel', value: `${CHANNEL_ICONS[acc.recommended_channel] || ''} ${acc.recommended_channel || '—'}`.trim(), icon: '📡' },
                { label: 'Best Time to Call', value: acc.best_contact_time || '—',  icon: '🕐' },
                { label: 'Days Since Contact',value: acc.days_since_last_contact != null ? `${acc.days_since_last_contact}d ago` : '—', icon: '📅' },
                { label: 'Last Contact',      value: acc.last_contact_date || '—',  icon: '📅' },
                { label: 'Starter Type',      value: acc.starter_type || '—',       icon: '👤' },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 15, lineHeight: '18px', flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 10, color: '#aaa', fontWeight: 500, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Loan Details + Payment History ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>Loan Details</div>
              <InfoRow label="Product"          value={acc.product_type} />
              <InfoRow label="Loan Amount"      value={sarFmt(acc.principal_amount)} />
              <InfoRow label="Outstanding"      value={sarFmt(acc.remaining_principal)} />
              <InfoRow label="Monthly Install." value={sarFmt(acc.installment_amount)} />
              <InfoRow label="Profit Rate"      value={acc.profit_rate_pct != null ? `${acc.profit_rate_pct.toFixed(2)}%` : '—'} />
              <InfoRow label="Tenure"           value={acc.num_installments != null ? `${acc.num_installments} months` : '—'} />
              <InfoRow label="Remaining"        value={remainingMonths != null ? `${remainingMonths} months` : '—'} />
              <InfoRow label="On Book Since"    value={acc.first_installment_date || '—'} />
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>Payment History</div>
              <InfoRow label="On-time Ratio"   value={acc.ptp_kept_ratio != null ? `${(acc.ptp_kept_ratio * 100).toFixed(1)}%` : '—'} />
              <InfoRow label="PTP Kept Rate"   value={acc.ptp_kept_ratio != null ? `${(acc.ptp_kept_ratio * 100).toFixed(1)}%` : '—'} />
              <InfoRow label="Total PTPs Made" value={numFmt(acc.ptp_count)} />
              <InfoRow label="PTPs Kept"       value={ptpsKeptCount != null ? String(ptpsKeptCount) : '—'} />
              <InfoRow label="Broken PTPs"     value={numFmt(acc.broken_ptp_count)} />
              <InfoRow label="Last Payment"    value={acc.last_payment_date || '—'} />
              <InfoRow label="Monthly Income"  value={sarFmt(acc.salary)} />
              <InfoRow label="DTI Ratio"       value={dtiRatio != null ? `${(dtiRatio * 100).toFixed(1)}%` : '—'} />
              <InfoRow label="Overdue Amount"  value={sarFmt(acc.overdue_amount)} />
            </div>
          </div>

          {/* ── ML Intelligence ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>ML Intelligence</div>
            {scoreLoading ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#aaa', fontSize: 13 }}>Computing score...</div>
            ) : score ? (
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
                <ScoreGauge score={score.ptp_propensity_score} />
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Pay Probability', value: score.pay_probability != null ? `${Math.round(score.pay_probability * 100)}%` : '—', color: (score.pay_probability || 0) > 0.6 ? '#22c55e' : '#ef4444' },
                      { label: 'Risk Tier',        value: score.risk_tier || riskTier,    color: RISK_COLORS[score.risk_tier || riskTier] || '#888' },
                      { label: 'Rec. Channel',     value: `${CHANNEL_ICONS[score.recommended_channel] || ''} ${score.recommended_channel || '—'}`.trim(), color: '#6c63ff' },
                      { label: 'Handling',         value: score.handling_type || '—',     color: '#3b82f6' },
                      { label: 'Broken PTP Risk',  value: score.broken_ptp_risk != null ? `${(score.broken_ptp_risk * 100).toFixed(0)}%` : '—', color: (score.broken_ptp_risk || 0) > 0.5 ? '#ef4444' : '#22c55e' },
                    ].map(m => (
                      <div key={m.label} style={{ background: '#f8f9fc', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>{m.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {topFeatures.length > 0 && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>Top predictive features</div>
                      {topFeatures.map(f => (
                        <div key={f.feature} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <div style={{ fontSize: 11, color: '#666', minWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.feature}</div>
                          <div style={{ flex: 1, height: 5, background: '#f0f2f7', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${f.importance * 100}%`, background: '#6c63ff', borderRadius: 3 }} />
                          </div>
                          <div style={{ fontSize: 11, color: '#888', minWidth: 32, textAlign: 'right' }}>{(f.importance * 100).toFixed(0)}%</div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Next Best Action */}
                  {(() => {
                    const s = score.ptp_propensity_score
                    const bg = s >= 550 ? '#f0fdf4' : s >= 400 ? '#fff7ed' : '#fef2f2'
                    const bdr = s >= 550 ? '#22c55e' : s >= 400 ? '#f97316' : '#ef4444'
                    const tc = s >= 550 ? '#166534' : s >= 400 ? '#c2410c' : '#991b1b'
                    const msg = s >= 700
                      ? `High-propensity (${Math.round((score.pay_probability || 0) * 100)}% pay probability). Call via ${score.recommended_channel} — offer flexible repayment.`
                      : s >= 550 ? `Medium risk. Use ${score.recommended_channel} with payment reminder. Broken PTP risk ${(score.broken_ptp_risk * 100).toFixed(0)}%.`
                      : s >= 400 ? `High risk. Route to ${score.handling_type}. Assess hardship before committing to arrangement.`
                      : `Very high risk. Direct to ${score.handling_type}. Consider legal referral if no contact in 7 days.`
                    return (
                      <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: bg, borderLeft: `3px solid ${bdr}` }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, color: tc }}>Next Best Action</div>
                        <div style={{ fontSize: 12, color: '#1a1a2e', lineHeight: 1.5 }}>{msg}</div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 13 }}>Score unavailable</div>
            )}
          </div>

          {/* ── Settlement & Offers ── */}
          {acc && (() => {
            const TYPE_META = {
              OTS: { label: 'OTS', color: '#7c3aed', bg: '#f5f3ff' },
              Discount: { label: 'Discount', color: '#2563eb', bg: '#eff6ff' },
              PaymentPlan: { label: 'Payment Plan', color: '#0d9488', bg: '#f0fdfa' },
              FeeWaiver: { label: 'Fee Waiver', color: '#16a34a', bg: '#f0fdf4' },
            }
            const ST_META = {
              Pending: { color: '#f59e0b', bg: '#fef3c7' }, Accepted: { color: '#22c55e', bg: '#dcfce7' },
              Rejected: { color: '#ef4444', bg: '#fee2e2' }, Expired: { color: '#94a3b8', bg: '#f1f5f9' },
            }
            const selectedOpt = settlOpts.find(o => o.type === offerType)
            const maxDiscount  = selectedOpt?.max_discount_pct || 0
            return (
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', marginBottom: 16, overflow: 'hidden' }}>
                <div onClick={() => setSettlementOpen(o => !o)}
                  style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Settlement & Offers</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {settlements.filter(s => s.status === 'Pending').length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px' }}>
                        {settlements.filter(s => s.status === 'Pending').length} Pending
                      </span>
                    )}
                    <span style={{ fontSize: 14, color: '#aaa' }}>{settlementOpen ? '▲' : '▼'}</span>
                  </div>
                </div>
                {settlementOpen && (
                  <div style={{ borderTop: '0.5px solid #f0f2f7', padding: '14px 18px' }}>
                    {settlLoading ? (
                      <div style={{ textAlign: 'center', padding: 16, color: '#aaa', fontSize: 13 }}>Loading...</div>
                    ) : (
                      <>
                        {settlements.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '12px 0', color: '#aaa', fontSize: 13 }}>No offers for this account</div>
                        ) : settlements.map(s => {
                          const tm = TYPE_META[s.offer_type] || TYPE_META.OTS
                          const sm = ST_META[s.status] || ST_META.Expired
                          return (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f5f6fa' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: tm.bg, color: tm.color, whiteSpace: 'nowrap' }}>{tm.label}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>SAR {Number(s.settlement_amount_sar).toLocaleString()}</div>
                                <div style={{ fontSize: 11, color: '#aaa' }}>Expires {s.expiry_date}</div>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: sm.bg, color: sm.color }}>{s.status}</span>
                              {s.status === 'Pending' && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => handleOfferAction(s.id, 'accept')} style={{ padding: '4px 9px', borderRadius: 5, border: 'none', background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
                                  <button onClick={() => handleOfferAction(s.id, 'reject')} style={{ padding: '4px 9px', borderRadius: 5, border: 'none', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                        <div style={{ marginTop: 12 }}>
                          <button onClick={() => setShowOffer(o => !o)}
                            style={{ padding: '7px 14px', borderRadius: 7, border: '0.5px solid #6c63ff', background: showOffer ? '#f0eeff' : '#fff', color: '#6c63ff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {showOffer ? 'Cancel' : '+ Create Offer'}
                          </button>
                        </div>
                        {showOffer && (
                          <div style={{ marginTop: 14, padding: 14, background: '#f8f7ff', borderRadius: 10, border: '0.5px solid #e0deff' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#6c63ff', marginBottom: 10 }}>New Settlement Offer</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                              {settlOpts.map(opt => (
                                <button key={opt.type} onClick={() => { setOfferType(opt.type); setOfferDiscount(0); setOfferAmount('') }}
                                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                    border: `1px solid ${offerType === opt.type ? '#6c63ff' : '#e0e3eb'}`,
                                    background: offerType === opt.type ? '#6c63ff' : '#fff',
                                    color: offerType === opt.type ? '#fff' : '#555' }}>
                                  {opt.type === 'PaymentPlan' ? 'Payment Plan' : opt.type}{opt.recommended && ' ⭐'}
                                </button>
                              ))}
                            </div>
                            {offerType === 'Discount' && (
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Discount: {offerDiscount}% (max {maxDiscount}%)</label>
                                <input type="range" min={0} max={maxDiscount} value={offerDiscount}
                                  onChange={e => { const v = Number(e.target.value); setOfferDiscount(v); setOfferAmount(String(Math.round(outstanding * (1 - v / 100)))) }}
                                  style={{ width: '100%' }} />
                                <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, marginTop: 3 }}>
                                  Settlement: SAR {Math.round(outstanding * (1 - offerDiscount / 100)).toLocaleString()}
                                </div>
                              </div>
                            )}
                            {offerType === 'PaymentPlan' && (
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Tenor</label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {(selectedOpt?.available_tenors || [3,4,5]).map(t => (
                                    <button key={t} onClick={() => { setOfferTenor(t); setOfferAmount(String(outstanding)) }}
                                      style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                        border: `1px solid ${offerTenor === t ? '#0d9488' : '#e0e3eb'}`,
                                        background: offerTenor === t ? '#0d9488' : '#fff',
                                        color: offerTenor === t ? '#fff' : '#555' }}>
                                      {t}mo
                                    </button>
                                  ))}
                                </div>
                                <div style={{ fontSize: 12, color: '#0d9488', fontWeight: 600, marginTop: 5 }}>SAR {Math.round(outstanding / offerTenor).toLocaleString()} / month</div>
                              </div>
                            )}
                            {['OTS','FeeWaiver'].includes(offerType) && (
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Amount (SAR)</label>
                                <input type="number" value={offerAmount} onChange={e => setOfferAmount(e.target.value)}
                                  placeholder={offerType === 'OTS' ? String(Math.round(outstanding * 0.75)) : ''}
                                  style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none' }} />
                              </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 10 }}>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Expiry</label>
                                <select value={offerExpiry} onChange={e => setOfferExpiry(Number(e.target.value))}
                                  style={{ width: '100%', padding: '7px 8px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff' }}>
                                  {[3,7,14,30].map(d => <option key={d} value={d}>{d} days</option>)}
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Notes</label>
                                <input value={offerNotes} onChange={e => setOfferNotes(e.target.value)} placeholder="Optional..."
                                  style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none' }} />
                              </div>
                            </div>
                            <button onClick={submitOffer} disabled={offerBusy || !offerType || !offerAmount}
                              style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#6c63ff', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (offerBusy || !offerType || !offerAmount) ? 0.5 : 1, fontFamily: 'inherit' }}>
                              {offerBusy ? 'Creating...' : 'Create Offer'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Recent Call History ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Recent Call History</span>
              <span style={{ fontSize: 11, color: '#aaa' }}>Last 5 calls for this account</span>
            </div>
            {callsLoading ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 13 }}>Loading call history...</div>
            ) : accountCalls.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 13 }}>No call records found for this account</div>
            ) : accountCalls.map((call, i) => {
              const ptpColor = call.ptp_outcome === 'PTP Captured' ? { bg: '#dcfce7', c: '#166534' }
                : call.ptp_outcome === 'Refused'  ? { bg: '#fee2e2', c: '#991b1b' }
                :                                   { bg: '#f1f5f9', c: '#475569' }
              return (
                <div key={call.call_id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: i < accountCalls.length - 1 ? '0.5px solid #f5f6fa' : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                    background: call.agent_type === 'AI' ? '#dbeafe' : '#f3e8ff',
                    color:      call.agent_type === 'AI' ? '#1e40af' : '#6b21a8' }}>
                    {call.agent_type === 'AI' ? '🤖' : '👤'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a2e' }}>
                      {call.call_date} {call.call_time ? `· ${call.call_time.slice(0, 5)}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {call.agent_name} · {call.call_channel} · {call.duration_sec != null ? `${call.duration_sec}s` : '—'}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600, background: ptpColor.bg, color: ptpColor.c, whiteSpace: 'nowrap' }}>
                    {call.call_result || call.ptp_outcome || '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* ── Channel Response Rates ── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Channel Response Rates</span>
              {channelStats && <span style={{ fontSize: 11, color: '#aaa' }}>Based on {channelStats.total} calls for this account</span>}
            </div>
            {!channelStats ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 13 }}>
                {callsLoading ? 'Loading...' : 'No call data available'}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
                  {[
                    { label: 'Call Pickup',  value: channelStats.callPickup, color: '#3b82f6' },
                    { label: 'SMS Triggered',value: channelStats.smsRate,    color: '#f59e0b' },
                    { label: 'AI Calls',     value: channelStats.aiShare,    color: '#6c63ff' },
                    { label: 'Human Calls',  value: channelStats.humanShare, color: '#22c55e' },
                  ].map(c => (
                    <div key={c.label} style={{ textAlign: 'center', background: '#f8f9fc', borderRadius: 10, padding: '12px 8px' }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{Math.round(c.value * 100)}%</div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{c.label}</div>
                      <div style={{ height: 4, background: '#e8eaf0', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
                        <div style={{ height: '100%', width: `${c.value * 100}%`, background: c.color, borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {channelStats.finished} of {channelStats.total} calls connected ·
                  Best time: <strong>{acc.best_contact_time || '—'}</strong> ·
                  Last contact: <strong>{acc.last_contact_date || '—'}</strong>
                </div>
              </>
            )}
          </div>

        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa', flexDirection: 'column', gap: 12, color: '#aaa' }}>
          <div style={{ fontSize: 40 }}>👈</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Select an account to view details</div>
          <div style={{ fontSize: 12 }}>Click any account from the queue on the left</div>
        </div>
      )}
    </div>
  )
}
