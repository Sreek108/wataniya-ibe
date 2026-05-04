import { useState, useEffect } from 'react'
import { getAccounts, getAccount, getAccountScore, getCallHistory, capturePTP, getPTPWorkflow, triggerPTPWorkflow, getEscalations, getSettlements, getSettlementOptions, createSettlement, acceptSettlement, rejectSettlement, createWaiver, getFraudReport, getAccountFraudFlag, addFraudFlag, removeFraudFlag } from './api'
import { useAuth } from './AuthContext'

const RISK_COLORS = {
  'Low Risk': '#22c55e', 'Medium Risk': '#f59e0b',
  'High Risk': '#f97316', 'Very High Risk': '#ef4444',
}
// Keys match actual dpd_bucket values in wataniya_accounts.csv
const BUCKET_COLORS = {
  '1-30 Days':  '#22c55e',
  '31-60 Days': '#f59e0b',
  '61-90 Days': '#f97316',
  'NPA':        '#ef4444',
  'Write-off':  '#6b7280',
}

const sarFmt = v =>
  v != null && !isNaN(v) && Number(v) !== 0
    ? `SAR ${Number(v).toLocaleString('en-SA', { maximumFractionDigits: 0 })}`
    : '—'
const pctFmt = v =>
  v != null && !isNaN(v) ? `${Math.round(v * 100)}%` : '—'
const numFmt = v => v != null && !isNaN(v) ? String(v) : '—'

function Badge({ label, color, bg }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg || `${color}18`, color }}>
      {label}
    </span>
  )
}

function ScoreGauge({ score }) {
  const pct   = ((score - 300) / 550) * 100
  const color = score >= 700 ? '#22c55e' : score >= 550 ? '#f59e0b' : score >= 400 ? '#f97316' : '#ef4444'
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 48, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: 12, color: '#aaa', margin: '4px 0 10px' }}>PTP Score (300–850)</div>
      <div style={{ height: 8, background: '#f0f2f7', borderRadius: 4, overflow: 'hidden', margin: '0 20px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bbb', margin: '4px 20px 0' }}>
        <span>300</span><span>850</span>
      </div>
    </div>
  )
}

export default function AgentWorkspace() {
  const { user } = useAuth()
  const [accounts, setAccounts]             = useState([])
  const [selected, setSelected]             = useState(null)
  const [accountDetail, setAccountDetail]   = useState(null)
  const [accountCalls, setAccountCalls]     = useState([])
  const [score, setScore]                   = useState(null)
  const [loading, setLoading]               = useState(true)
  const [scoreLoading, setScoreLoading]     = useState(false)
  const [callsLoading, setCallsLoading]     = useState(false)
  const [showPTP, setShowPTP]               = useState(false)
  const [ptpForm, setPtpForm]               = useState({ amount: '', date: '', notes: '' })
  const [ptpSuccess, setPtpSuccess]         = useState(false)
  const [activePTP, setActivePTP]           = useState(null)
  const [ptpAdvancing, setPtpAdvancing]     = useState(false)
  const [escalatedAccounts, setEscalatedAccounts] = useState(new Set())
  const [settlementOpen, setSettlementOpen] = useState(false)
  const [accountSettlements, setAccountSettlements] = useState([])
  const [settlementOptions, setSettlementOptions]   = useState([])
  const [showCreateOffer, setShowCreateOffer] = useState(false)
  const [offerType, setOfferType]           = useState('')
  const [offerDiscount, setOfferDiscount]   = useState(0)
  const [offerTenor, setOfferTenor]         = useState(3)
  const [offerAmount, setOfferAmount]       = useState('')
  const [offerExpiry, setOfferExpiry]       = useState(7)
  const [offerNotes, setOfferNotes]         = useState('')
  const [offerBusy, setOfferBusy]           = useState(false)
  const [settlementLoading, setSettlementLoading] = useState(false)
  const [showWaiver, setShowWaiver]         = useState(false)
  const [waiverSuccess, setWaiverSuccess]   = useState(false)
  const [waiverBusy, setWaiverBusy]         = useState(false)
  const [waiverForm, setWaiverForm]         = useState({ waiver_type: 'Late Fee', amount_sar: '', reason: 'Customer hardship', notes: '' })
  const [flaggedAccountIds, setFlaggedAccountIds] = useState(new Set())
  const [accountFlag, setAccountFlag]       = useState(null)
  const [showFlagForm, setShowFlagForm]     = useState(false)
  const [flagForm, setFlagForm]             = useState({ severity: 'High', reason: 'Suspected Fraud', notes: '', evidence_ref: '' })
  const [flagBusy, setFlagBusy]             = useState(false)
  const [flagRemoving, setFlagRemoving]     = useState(false)
  const [search, setSearch]                 = useState('')
  const [bucket, setBucket]                 = useState('')

  useEffect(() => {
    loadAccounts()
    getEscalations()
      .then(d => {
        const ids = new Set((d?.escalations || []).filter(e => e.escalation_status === 'pending').map(e => e.account_id))
        setEscalatedAccounts(ids)
      })
      .catch(() => {})
    getFraudReport()
      .then(d => setFlaggedAccountIds(new Set((d?.flagged_accounts || []).map(f => f.account_id))))
      .catch(() => {})
  }, [bucket])

  async function loadAccounts() {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (bucket) params.bucket = bucket
      const data = await getAccounts(params)
      setAccounts(data.accounts || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function loadAccountSettlements(loan_id) {
    setSettlementLoading(true)
    Promise.all([getSettlements({ account_id: loan_id }), getSettlementOptions(loan_id)])
      .then(([sd, opts]) => {
        setAccountSettlements(sd.settlements || [])
        setSettlementOptions(opts.offers || [])
        if (opts.offers?.length) setOfferType(opts.offers[0].type)
      })
      .catch(() => {})
      .finally(() => setSettlementLoading(false))
  }

  async function selectAccount(a) {
    setSelected(a)
    setAccountDetail(null)
    setAccountCalls([])
    setScore(null)
    setActivePTP(null)
    setShowPTP(false)
    setPtpSuccess(false)
    setScoreLoading(true)
    setCallsLoading(true)
    setSettlementOpen(false)
    setShowCreateOffer(false)
    setAccountSettlements([])
    setSettlementOptions([])
    setShowWaiver(false)
    setWaiverSuccess(false)
    setWaiverForm({ waiver_type: 'Late Fee', amount_sar: '', reason: 'Customer hardship', notes: '' })
    setAccountFlag(null)
    setShowFlagForm(false)
    setFlagForm({ severity: 'High', reason: 'Suspected Fraud', notes: '', evidence_ref: '' })

    const id = a.loan_id

    getAccountFraudFlag(id).then(f => setAccountFlag(f?.flag_id ? f : null)).catch(() => {})

    getAccountScore(id)
      .then(s => setScore(s))
      .catch(e => console.error(e))
      .finally(() => setScoreLoading(false))

    getAccount(id).then(d => setAccountDetail(d)).catch(() => {})

    getCallHistory({ search: id, limit: 5 })
      .then(d => setAccountCalls((d.calls || []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setCallsLoading(false))

    getPTPWorkflow()
      .then(d => {
        const found = (d.ptps || []).find(p => p.account_id === id && !['PAID', 'ESCALATED'].includes(p.workflow_status))
        setActivePTP(found || null)
      })
      .catch(() => {})

    loadAccountSettlements(id)
  }

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
      setPtpForm({ amount: '', date: '', notes: '' })
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
      setShowCreateOffer(false); setOfferNotes('')
      loadAccountSettlements(selected.loan_id)
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
      setWaiverForm({ waiver_type: 'Late Fee', amount_sar: '', reason: 'Customer hardship', notes: '' })
    } catch (e) { alert('Waiver request failed: ' + e.message) }
    finally { setWaiverBusy(false) }
  }

  async function submitFraudFlag() {
    if (!flagForm.notes) return
    setFlagBusy(true)
    try {
      const flag = await addFraudFlag(selected.loan_id, flagForm)
      setAccountFlag(flag)
      setFlaggedAccountIds(prev => new Set([...prev, selected.loan_id]))
      setShowFlagForm(false)
      setFlagForm({ severity: 'High', reason: 'Suspected Fraud', notes: '', evidence_ref: '' })
    } catch (e) { alert('Failed to add fraud flag: ' + e.message) }
    finally { setFlagBusy(false) }
  }

  async function handleRemoveFraudFlag() {
    if (!window.confirm('Remove fraud flag from this account?')) return
    setFlagRemoving(true)
    try {
      await removeFraudFlag(selected.loan_id)
      setAccountFlag(null)
      setFlaggedAccountIds(prev => { const s = new Set(prev); s.delete(selected.loan_id); return s })
    } catch (e) { alert('Failed to remove flag: ' + e.message) }
    finally { setFlagRemoving(false) }
  }

  async function handleOfferAction(id, action) {
    try {
      if (action === 'accept') await acceptSettlement(id)
      else await rejectSettlement(id)
      loadAccountSettlements(selected.loan_id)
    } catch (e) { alert(e.message) }
  }

  const filtered = accounts.filter(a =>
    !search ||
    (a.loan_id || '').toLowerCase().includes(search.toLowerCase()) ||
    (a.customer_name || '').toLowerCase().includes(search.toLowerCase())
  )

  // feature_importance is now an array from the fixed endpoint
  const topFeatures = Array.isArray(score?.feature_importance) ? score.feature_importance : []

  // Prefer full account detail once loaded; fall back to queue record
  const acc = accountDetail || selected

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── LEFT: Account Queue ── */}
      <div style={{ width: 320, borderRight: '0.5px solid #e8eaf0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '0.5px solid #f0f2f7' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 10 }}>Account Queue</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID..."
            style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fafbfc', marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit' }} />
          <select value={bucket} onChange={e => setBucket(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, background: '#fafbfc', color: '#444', outline: 'none' }}>
            <option value="">All buckets</option>
            {['1-30 Days', '31-60 Days', '61-90 Days', 'NPA', 'Write-off'].map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Loading...</div>
          ) : filtered.map(a => {
            const scoreVal = a.ptp_propensity_score
            const sc = scoreVal >= 700 ? '#22c55e' : scoreVal >= 550 ? '#f59e0b' : scoreVal >= 400 ? '#f97316' : '#ef4444'
            const bucketColor = BUCKET_COLORS[a.dpd_bucket] || '#888'
            return (
              <div key={a.loan_id} onClick={() => selectAccount(a)} style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '0.5px solid #f5f6fa',
                background: selected?.loan_id === a.loan_id ? '#f8f7ff' : '#fff',
                borderLeft: selected?.loan_id === a.loan_id ? '3px solid #6c63ff' : '3px solid transparent',
                transition: 'all 0.1s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {a.customer_name}
                    {escalatedAccounts.has(a.loan_id) && (
                      <span style={{ fontSize: 9, fontWeight: 800, background: '#ef4444', color: '#fff', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>!</span>
                    )}
                    {flaggedAccountIds.has(a.loan_id) && (
                      <span title="Fraud flag active" style={{ width: 7, height: 7, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: sc, flexShrink: 0 }}>{scoreVal}</span>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>{a.loan_id}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600, background: `${bucketColor}18`, color: bucketColor }}>
                    {a.dpd_bucket}
                  </span>
                  <span style={{ fontSize: 10, color: '#aaa' }}>
                    {a.remaining_principal > 0
                      ? `SAR ${(a.remaining_principal / 1000).toFixed(0)}K`
                      : a.outstanding_balance > 0
                        ? `SAR ${(a.outstanding_balance / 1000).toFixed(0)}K`
                        : '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ padding: '10px 16px', borderTop: '0.5px solid #f0f2f7', fontSize: 11, color: '#aaa' }}>
          {filtered.length} accounts · sorted by PTP score
        </div>
      </div>

      {/* ── RIGHT: Account 360 ── */}
      {acc ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f5f6fa' }}>

          {/* Account header */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '18px 22px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>{acc.customer_name}</div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>
                  {acc.loan_id} · {acc.product_type}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge label={acc.dpd_bucket || '—'} color={BUCKET_COLORS[acc.dpd_bucket] || '#888'} />
                  {acc.ml_risk_tier && <Badge label={acc.ml_risk_tier} color={RISK_COLORS[acc.ml_risk_tier] || '#888'} />}
                  <Badge label={`DPD: ${acc.dpd ?? '—'}`} color="#6c63ff" />
                  <Badge label={acc.account_status || '—'} color={acc.account_status === 'Active' ? '#22c55e' : '#f97316'} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!ptpSuccess ? (
                  <button onClick={() => { setShowPTP(!showPTP); setShowWaiver(false); setShowFlagForm(false) }}
                    style={{ padding: '9px 18px', background: '#6c63ff', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    + Capture PTP
                  </button>
                ) : (
                  <span style={{ padding: '9px 18px', background: '#dcfce7', color: '#166534', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✓ PTP Captured</span>
                )}
                {!waiverSuccess ? (
                  <button onClick={() => { setShowWaiver(!showWaiver); setShowPTP(false); setShowFlagForm(false) }}
                    style={{ padding: '9px 18px', background: showWaiver ? '#fff7ed' : '#fff', color: '#f97316', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Request Waiver
                  </button>
                ) : (
                  <span style={{ padding: '9px 18px', background: '#dcfce7', color: '#166534', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✓ Waiver Submitted</span>
                )}
                {!accountFlag && (
                  <button onClick={() => { setShowFlagForm(!showFlagForm); setShowPTP(false); setShowWaiver(false) }}
                    style={{ padding: '9px 18px', background: showFlagForm ? '#fef2f2' : '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Flag Account
                  </button>
                )}
              </div>
            </div>

            {/* Fraud flag banner */}
            {accountFlag && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                      FRAUD FLAG: {accountFlag.severity} — {accountFlag.reason}
                    </div>
                    <div style={{ fontSize: 11, color: '#7f1d1d', marginBottom: 2 }}>
                      Flagged by <strong>{accountFlag.flagged_by}</strong> on {accountFlag.flagged_at?.slice(0, 10)}
                      {accountFlag.evidence_ref && <span> · Ref: {accountFlag.evidence_ref}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#991b1b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{accountFlag.notes}</div>
                  </div>
                  {['admin', 'supervisor'].includes(user?.role) && (
                    <button onClick={handleRemoveFraudFlag} disabled={flagRemoving}
                      style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: flagRemoving ? 0.5 : 1 }}>
                      {flagRemoving ? '...' : 'Remove Flag'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Flag form */}
            {showFlagForm && (
              <div style={{ marginTop: 14, padding: 16, background: '#fef2f2', borderRadius: 10, border: '1px solid #fca5a5' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', marginBottom: 12 }}>Flag This Account</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Severity</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[['High','#dc2626'],['Medium','#f59e0b'],['Low','#6b7280']].map(([sev, col]) => (
                        <button key={sev} onClick={() => setFlagForm({ ...flagForm, severity: sev })}
                          style={{ flex: 1, padding: '7px 4px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                            border: `1px solid ${flagForm.severity === sev ? col : '#e0e3eb'}`,
                            background: flagForm.severity === sev ? col : '#fff',
                            color: flagForm.severity === sev ? '#fff' : '#555' }}>
                          {sev}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Reason</label>
                    <select value={flagForm.reason} onChange={e => setFlagForm({ ...flagForm, reason: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff' }}>
                      {['Dispute','Incorrect Info','Suspected Fraud','Identity Theft','Payment Manipulation'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Notes <span style={{ color: '#ef4444' }}>*</span></label>
                  <textarea value={flagForm.notes} onChange={e => setFlagForm({ ...flagForm, notes: e.target.value })}
                    placeholder="Describe the fraud indicator..." rows={3}
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Evidence Reference (optional)</label>
                  <input value={flagForm.evidence_ref} onChange={e => setFlagForm({ ...flagForm, evidence_ref: e.target.value })}
                    placeholder="e.g. POL-2026-0341"
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={submitFraudFlag} disabled={flagBusy || !flagForm.notes}
                    style={{ padding: '8px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (flagBusy || !flagForm.notes) ? 0.5 : 1, fontFamily: 'inherit' }}>
                    {flagBusy ? 'Submitting...' : 'Submit Flag'}
                  </button>
                  <button onClick={() => setShowFlagForm(false)}
                    style={{ padding: '8px 16px', border: '0.5px solid #e0e3eb', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* PTP form */}
            {showPTP && (
              <div style={{ marginTop: 16, padding: 16, background: '#f8f7ff', borderRadius: 10, border: '0.5px solid #e0deff' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6c63ff', marginBottom: 12 }}>Capture Promise to Pay</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Amount (SAR)</label>
                    <input type="number" value={ptpForm.amount} onChange={e => setPtpForm({ ...ptpForm, amount: e.target.value })}
                      placeholder={acc.installment_amount ? String(Math.round(acc.installment_amount)) : ''}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 13, outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Promise Date</label>
                    <input type="date" value={ptpForm.date} onChange={e => setPtpForm({ ...ptpForm, date: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 13, outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Notes</label>
                    <input value={ptpForm.notes} onChange={e => setPtpForm({ ...ptpForm, notes: e.target.value })}
                      placeholder="Optional notes..."
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 13, outline: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={submitPTP} disabled={!ptpForm.amount || !ptpForm.date}
                    style={{ padding: '8px 20px', background: '#22c55e', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: ptpForm.amount && ptpForm.date ? 'pointer' : 'not-allowed', opacity: ptpForm.amount && ptpForm.date ? 1 : 0.5 }}>
                    Save PTP
                  </button>
                  <button onClick={() => setShowPTP(false)}
                    style={{ padding: '8px 16px', border: '0.5px solid #e0e3eb', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Waiver form */}
            {showWaiver && (() => {
              const outstanding = acc.remaining_principal || acc.outstanding_balance || 0
              const amt = parseFloat(waiverForm.amount_sar) || 0
              const impactPct = outstanding > 0 ? ((amt / outstanding) * 100).toFixed(1) : null
              return (
                <div style={{ marginTop: 16, padding: 16, background: '#fff7ed', borderRadius: 10, border: '0.5px solid #fed7aa' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#c2410c', marginBottom: 12 }}>Request Waiver</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Waiver Type</label>
                      <select value={waiverForm.waiver_type} onChange={e => setWaiverForm({ ...waiverForm, waiver_type: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff' }}>
                        {['Late Fee', 'Interest', 'Penalty', 'Processing Fee'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Amount (SAR)</label>
                      <input type="number" min="1" value={waiverForm.amount_sar}
                        onChange={e => setWaiverForm({ ...waiverForm, amount_sar: e.target.value })}
                        placeholder="e.g. 1200"
                        style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Reason</label>
                    <select value={waiverForm.reason} onChange={e => setWaiverForm({ ...waiverForm, reason: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', background: '#fff' }}>
                      {['Customer hardship','Long-term customer','Settlement facilitation','Administrative error','Goodwill gesture'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Notes (optional)</label>
                    <textarea value={waiverForm.notes} onChange={e => setWaiverForm({ ...waiverForm, notes: e.target.value.slice(0, 200) })}
                      placeholder="Additional context..." rows={2}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
                    <div style={{ fontSize: 10, color: '#aaa', textAlign: 'right' }}>{waiverForm.notes.length}/200</div>
                  </div>
                  {impactPct && amt > 0 && (
                    <div style={{ padding: '8px 12px', background: '#fff', borderRadius: 7, border: '0.5px solid #fed7aa', marginBottom: 10, fontSize: 12 }}>
                      Estimated impact: reduces outstanding by <strong style={{ color: '#c2410c' }}>{impactPct}%</strong>
                      {' '}(SAR {Number(outstanding).toLocaleString()} → SAR {Number(outstanding - amt).toLocaleString()})
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={submitWaiver} disabled={waiverBusy || !waiverForm.amount_sar}
                      style={{ padding: '8px 20px', background: '#f97316', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (waiverBusy || !waiverForm.amount_sar) ? 0.5 : 1, fontFamily: 'inherit' }}>
                      {waiverBusy ? 'Submitting...' : 'Submit for Review'}
                    </button>
                    <button onClick={() => setShowWaiver(false)}
                      style={{ padding: '8px 16px', border: '0.5px solid #e0e3eb', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
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
            const daysText = activePTP.days_until_due < 0
              ? `${Math.abs(activePTP.days_until_due)}d overdue`
              : activePTP.days_until_due === 0 ? 'Due today' : `Due in ${activePTP.days_until_due}d`
            return (
              <div style={{ background: '#fafbff', borderRadius: 12, border: `1px solid ${wfColor}30`, padding: '12px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: wfColor, flexShrink: 0, boxShadow: `0 0 0 3px ${wfColor}25` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Active PTP Workflow</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: wfColor }}>{activePTP.workflow_status.replace('_', ' ')}</span>
                    <span style={{ fontSize: 12, color: activePTP.days_until_due < 0 ? '#ef4444' : '#555', fontWeight: 600 }}>· {daysText}</span>
                    <span style={{ fontSize: 12, color: '#888' }}>· SAR {Number(activePTP.amount_sar).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{activePTP.next_step}</div>
                </div>
                {!['PAID', 'ESCALATED', 'BROKEN'].includes(activePTP.workflow_status) && (
                  <button onClick={async () => {
                    setPtpAdvancing(true)
                    try { const u = await triggerPTPWorkflow(activePTP.ptp_id); setActivePTP(u) } catch (e) {}
                    finally { setPtpAdvancing(false) }}
                  } disabled={ptpAdvancing}
                    style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: wfColor, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: ptpAdvancing ? 0.55 : 1 }}>
                    {ptpAdvancing ? '...' : 'Advance →'}
                  </button>
                )}
              </div>
            )
          })()}

          {/* Contact Information */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>Contact Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { label: 'Phone',             value: acc.mobile_number ? String(acc.mobile_number) : '—',  icon: '📞' },
                { label: 'Preferred Channel', value: acc.recommended_channel || '—',                        icon: '📡' },
                { label: 'Best Time to Call', value: acc.best_contact_time || '—',                          icon: '🕐' },
                { label: 'Call Attempts',     value: acc.days_since_last_contact != null ? `${acc.days_since_last_contact}d ago` : '—', icon: '📅' },
                { label: 'Last Contact',      value: acc.last_contact_date || '—',                          icon: '📅' },
                { label: 'Starter Type',      value: acc.starter_type || '—',                               icon: '👤' },
              ].map(({ label, value, icon }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 16, lineHeight: '18px', flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 10, color: '#aaa', fontWeight: 500, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Loan Details + Payment History */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>Loan Details</div>
              {[
                ['Product',          acc.product_type || '—'],
                ['Loan Amount',      sarFmt(acc.principal_amount)],
                ['Outstanding',      sarFmt(acc.remaining_principal)],
                ['Monthly Install.', sarFmt(acc.installment_amount)],
                ['Profit Rate',      acc.profit_rate_pct != null ? `${acc.profit_rate_pct}%` : '—'],
                ['Tenure',           acc.num_installments != null ? `${acc.num_installments} months` : '—'],
                ['Remaining',        (acc.num_installments != null && acc.num_paid_installments != null)
                                       ? `${acc.num_installments - acc.num_paid_installments} months` : '—'],
                ['On Book Since',    acc.first_installment_date || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f5f6fa', fontSize: 13 }}>
                  <span style={{ color: '#888' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>Payment History</div>
              {[
                ['On-time Ratio',   pctFmt(acc.ptp_kept_ratio)],
                ['PTP Kept Rate',   pctFmt(acc.ptp_kept_ratio)],
                ['Total PTPs Made', numFmt(acc.ptp_count)],
                ['PTPs Kept',       acc.ptp_count != null && acc.ptp_kept_ratio != null
                                      ? String(Math.round(acc.ptp_kept_ratio * acc.ptp_count)) : '—'],
                ['Broken PTPs',     numFmt(acc.broken_ptp_count)],
                ['Last Payment',    acc.last_payment_date || '—'],
                ['Monthly Income',  sarFmt(acc.salary)],
                ['DTI Ratio',       (acc.installment_amount != null && acc.salary > 0)
                                      ? `${((acc.installment_amount / acc.salary) * 100).toFixed(1)}%` : '—'],
                ['Overdue Amount',  sarFmt(acc.overdue_amount)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid #f5f6fa', fontSize: 13 }}>
                  <span style={{ color: '#888' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ML Intelligence */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>ML Intelligence</div>
            {scoreLoading ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#aaa' }}>Computing score...</div>
            ) : score ? (
              <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
                <ScoreGauge score={score.ptp_propensity_score} />
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Pay Probability', value: pctFmt(score.pay_probability),       color: (score.pay_probability || 0) > 0.6 ? '#22c55e' : '#ef4444' },
                      { label: 'Risk Tier',        value: score.risk_tier || '—',              color: RISK_COLORS[score.risk_tier] || '#888' },
                      { label: 'Rec. Channel',     value: score.recommended_channel || '—',   color: '#6c63ff' },
                      { label: 'Handling',         value: score.handling_type || '—',          color: '#3b82f6' },
                      { label: 'Broken PTP Risk',  value: pctFmt(score.broken_ptp_risk),       color: (score.broken_ptp_risk || 0) > 0.5 ? '#ef4444' : '#22c55e' },
                    ].map(m => (
                      <div key={m.label} style={{ background: '#f8f9fc', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>{m.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {topFeatures.length > 0 && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>Top predictive features</div>
                      {topFeatures.map(f => (
                        <div key={f.feature} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <div style={{ fontSize: 11, color: '#666', minWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {f.feature}
                          </div>
                          <div style={{ flex: 1, height: 5, background: '#f0f2f7', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${f.importance * 100}%`, maxWidth: '100%', background: '#6c63ff', borderRadius: 3 }} />
                          </div>
                          <div style={{ fontSize: 11, color: '#888', minWidth: 36, textAlign: 'right' }}>
                            {(f.importance * 100).toFixed(0)}%
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Next Best Action */}
                  <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 8,
                    background: score.ptp_propensity_score >= 550 ? '#f0fdf4' : score.ptp_propensity_score >= 400 ? '#fff7ed' : '#fef2f2',
                    borderLeft: `3px solid ${score.ptp_propensity_score >= 550 ? '#22c55e' : score.ptp_propensity_score >= 400 ? '#f97316' : '#ef4444'}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5,
                      color: score.ptp_propensity_score >= 550 ? '#166534' : score.ptp_propensity_score >= 400 ? '#c2410c' : '#991b1b' }}>
                      Next Best Action
                    </div>
                    <div style={{ fontSize: 12, color: '#1a1a2e', lineHeight: 1.5 }}>
                      {score.ptp_propensity_score >= 700
                        ? `High-propensity account (${pctFmt(score.pay_probability)} pay probability). Call via ${score.recommended_channel} — offer flexible repayment plan.`
                        : score.ptp_propensity_score >= 550
                        ? `Medium-risk account. Use ${score.recommended_channel} with structured payment reminder. Broken PTP risk ${pctFmt(score.broken_ptp_risk)} — monitor closely.`
                        : score.ptp_propensity_score >= 400
                        ? `High-risk account. Escalate to ${score.handling_type}. Broken PTP risk ${pctFmt(score.broken_ptp_risk)} — hardship assessment recommended.`
                        : `Very high risk. Route to ${score.handling_type}. Consider legal referral if no contact within 7 days.`}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#aaa', fontSize: 13 }}>Score unavailable</div>
            )}
          </div>

          {/* Settlement & Offers */}
          {acc && (() => {
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
            const selectedOpt = settlementOptions.find(o => o.type === offerType)
            const maxDiscount  = selectedOpt?.max_discount_pct || 0
            const outstanding  = acc.remaining_principal || acc.outstanding_balance || 0
            return (
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', marginBottom: 16, overflow: 'hidden' }}>
                <div onClick={() => setSettlementOpen(!settlementOpen)}
                  style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Settlement & Offers</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {accountSettlements.filter(s => s.status === 'Pending').length > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 8px' }}>
                        {accountSettlements.filter(s => s.status === 'Pending').length} Pending
                      </span>
                    )}
                    <span style={{ fontSize: 16, color: '#aaa' }}>{settlementOpen ? '▲' : '▼'}</span>
                  </div>
                </div>
                {settlementOpen && (
                  <div style={{ borderTop: '0.5px solid #f0f2f7', padding: '14px 18px' }}>
                    {settlementLoading ? (
                      <div style={{ textAlign: 'center', padding: 16, color: '#aaa', fontSize: 13 }}>Loading offers...</div>
                    ) : (
                      <>
                        {accountSettlements.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '12px 0', color: '#aaa', fontSize: 13 }}>No offers for this account</div>
                        ) : accountSettlements.map(s => {
                          const tm = TYPE_META[s.offer_type] || TYPE_META.OTS
                          const sm = ST_META[s.status] || ST_META.Expired
                          return (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '0.5px solid #f5f6fa' }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: tm.bg, color: tm.color, whiteSpace: 'nowrap' }}>{tm.label}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>
                                  SAR {Number(s.settlement_amount_sar).toLocaleString()}
                                  {s.saving_pct > 0 && <span style={{ color: '#22c55e', marginLeft: 6, fontSize: 11 }}>−{s.saving_pct}%</span>}
                                  {s.tenor_months && <span style={{ color: '#888', marginLeft: 6, fontSize: 11 }}>{s.tenor_months}mo plan</span>}
                                </div>
                                <div style={{ fontSize: 11, color: '#aaa' }}>Expires {s.expiry_date} · {s.offer_id}</div>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: sm.bg, color: sm.color, whiteSpace: 'nowrap' }}>{s.status}</span>
                              {s.status === 'Pending' && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => handleOfferAction(s.id, 'accept')}
                                    style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
                                  <button onClick={() => handleOfferAction(s.id, 'reject')}
                                    style={{ padding: '4px 10px', borderRadius: 5, border: 'none', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                        <div style={{ marginTop: 12 }}>
                          <button onClick={() => setShowCreateOffer(!showCreateOffer)}
                            style={{ padding: '7px 16px', borderRadius: 7, border: '0.5px solid #6c63ff', background: showCreateOffer ? '#f0eeff' : '#fff', color: '#6c63ff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                            {showCreateOffer ? 'Cancel' : '+ Create Offer'}
                          </button>
                        </div>
                        {showCreateOffer && (
                          <div style={{ marginTop: 14, padding: 14, background: '#f8f7ff', borderRadius: 10, border: '0.5px solid #e0deff' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#6c63ff', marginBottom: 12 }}>New Settlement Offer</div>
                            <div style={{ marginBottom: 10 }}>
                              <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Offer Type</label>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {settlementOptions.map(opt => (
                                  <button key={opt.type} onClick={() => { setOfferType(opt.type); setOfferDiscount(0); setOfferAmount('') }}
                                    style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                      border: `1px solid ${offerType === opt.type ? '#6c63ff' : '#e0e3eb'}`,
                                      background: offerType === opt.type ? '#6c63ff' : '#fff',
                                      color: offerType === opt.type ? '#fff' : '#555' }}>
                                    {opt.type === 'PaymentPlan' ? 'Payment Plan' : opt.type}{opt.recommended && ' ⭐'}
                                  </button>
                                ))}
                              </div>
                              {selectedOpt && <div style={{ fontSize: 11, color: '#888', marginTop: 5 }}>{selectedOpt.description}</div>}
                            </div>
                            {offerType === 'Discount' && (
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Discount: {offerDiscount}% (max {maxDiscount}%)</label>
                                <input type="range" min={0} max={maxDiscount} value={offerDiscount}
                                  onChange={e => { const v = Number(e.target.value); setOfferDiscount(v); setOfferAmount(String(Math.round(outstanding * (1 - v / 100)))) }}
                                  style={{ width: '100%' }} />
                                <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, marginTop: 4 }}>
                                  Settlement: SAR {Math.round(outstanding * (1 - offerDiscount / 100)).toLocaleString()} · Save SAR {Math.round(outstanding * offerDiscount / 100).toLocaleString()}
                                </div>
                              </div>
                            )}
                            {offerType === 'PaymentPlan' && (
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Tenor</label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  {(selectedOpt?.available_tenors || [3,4,5]).map(t => (
                                    <button key={t} onClick={() => { setOfferTenor(t); setOfferAmount(String(outstanding)) }}
                                      style={{ padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                        border: `1px solid ${offerTenor === t ? '#0d9488' : '#e0e3eb'}`,
                                        background: offerTenor === t ? '#0d9488' : '#fff',
                                        color: offerTenor === t ? '#fff' : '#555' }}>
                                      {t} months
                                    </button>
                                  ))}
                                </div>
                                <div style={{ fontSize: 12, color: '#0d9488', fontWeight: 600, marginTop: 6 }}>
                                  SAR {Math.round(outstanding / offerTenor).toLocaleString()} / month
                                </div>
                              </div>
                            )}
                            {(offerType === 'OTS' || offerType === 'FeeWaiver') && (
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>
                                  {offerType === 'OTS' ? 'Settlement Amount (SAR)' : 'Waiver Amount (SAR)'}
                                </label>
                                <input type="number" value={offerAmount} onChange={e => setOfferAmount(e.target.value)}
                                  placeholder={offerType === 'OTS' ? String(Math.round(outstanding * 0.75)) : ''}
                                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none' }} />
                                {offerAmount && outstanding > 0 && (
                                  <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, marginTop: 4 }}>
                                    Save SAR {(outstanding - parseFloat(offerAmount)).toLocaleString()} ({((outstanding - parseFloat(offerAmount)) / outstanding * 100).toFixed(1)}%)
                                  </div>
                                )}
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
                              style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: '#6c63ff', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: (offerBusy || !offerType || !offerAmount) ? 0.5 : 1, fontFamily: 'inherit' }}>
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

          {/* Recent Call History */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Recent Call History</div>
              <span style={{ fontSize: 11, color: '#aaa' }}>Last 5 calls for this account</span>
            </div>
            {callsLoading ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 13 }}>Loading call history...</div>
            ) : accountCalls.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#aaa', fontSize: 13 }}>No call records found for this account</div>
            ) : accountCalls.map((call, i) => {
              const ptpColor = call.ptp_outcome === 'PTP Captured' ? { bg: '#dcfce7', c: '#166534' }
                : call.ptp_outcome === 'Broken PTP'               ? { bg: '#fef3c7', c: '#92400e' }
                : call.ptp_outcome === 'Refused'                  ? { bg: '#fee2e2', c: '#991b1b' }
                :                                                    { bg: '#f1f5f9', c: '#475569' }
              return (
                <div key={call.call_id || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < accountCalls.length - 1 ? '0.5px solid #f5f6fa' : 'none' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    background: call.direction === 'Outbound' ? '#dbeafe' : '#f3e8ff',
                    color:      call.direction === 'Outbound' ? '#1e40af' : '#6b21a8' }}>
                    {call.direction === 'Outbound' ? '↗' : '↙'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a2e' }}>{call.call_date} · {call.call_time}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{call.agent_name} · {call.duration_sec != null ? `${call.duration_sec}s` : '—'}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600, background: ptpColor.bg, color: ptpColor.c, whiteSpace: 'nowrap' }}>
                    {call.ptp_outcome || call.status || '—'}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Contact & Account Summary */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>Account Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: 'Call Attempts',      value: numFmt(acc.call_attempts),                          color: '#3b82f6' },
                { label: 'Days Since Contact', value: acc.days_since_last_contact != null ? `${acc.days_since_last_contact}d` : '—', color: '#f59e0b' },
                { label: 'SADAD Status',       value: acc.sadad_payment_status || '—',                    color: '#22c55e' },
                { label: 'Supervisor',         value: acc.assigned_supervisor || '—',                     color: '#6c63ff' },
              ].map(c => (
                <div key={c.label} style={{ textAlign: 'center', background: '#f8f9fc', borderRadius: 10, padding: '12px 8px' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{c.value}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{c.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#888' }}>
              Best contact time: <strong>{acc.best_contact_time || '—'}</strong> ·
              Recommended channel: <strong>{acc.recommended_channel || '—'}</strong> ·
              Last contact: <strong>{acc.last_contact_date || '—'}</strong>
            </div>
          </div>

        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa', flexDirection: 'column', gap: 12, color: '#aaa' }}>
          <div style={{ fontSize: 40 }}>👈</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Select an account to view details</div>
          <div style={{ fontSize: 13 }}>Click any account from the queue on the left</div>
        </div>
      )}
    </div>
  )
}
