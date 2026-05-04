import { useState, useEffect } from 'react'
import { getAccounts, getAccountScore, scoreAccount, getModelMetadata } from './api'

const RISK_COLORS = {
  'Low Risk':      '#22c55e',
  'Medium Risk':   '#f59e0b',
  'High Risk':     '#f97316',
  'Very High Risk':'#ef4444',
}

const CHANNEL_ICONS = {
  'SMS':           '💬',
  'WhatsApp':      '📱',
  'AI Voice':      '🤖',
  'Human Agent':   '👤',
  'Outbound Call': '📞',
}

const sarFmt = v =>
  v == null || isNaN(v) ? 'N/A' : `SAR ${Number(v).toLocaleString('en-SA', { maximumFractionDigits: 0 })}`

const pctFmt = v =>
  v == null || isNaN(v) ? 'N/A' : `${Math.round(v * 100)}%`

// ── Score Gauge ──────────────────────────────────────────────
function ScoreGauge({ score, prev }) {
  const pct   = ((score - 300) / 550) * 100
  const color = score >= 700 ? '#22c55e' : score >= 550 ? '#f59e0b' : score >= 400 ? '#f97316' : '#ef4444'
  const tier  = score >= 700 ? 'Low Risk' : score >= 550 ? 'Medium Risk' : score >= 400 ? 'High Risk' : 'Very High Risk'
  const diff  = prev !== null ? score - prev : 0

  return (
    <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <div style={{ fontSize: 64, fontWeight: 800, color, lineHeight: 1, letterSpacing: -2 }}>{score}</div>
        {diff !== 0 && (
          <div style={{ position: 'absolute', top: 4, right: -40, fontSize: 13, fontWeight: 700, color: diff > 0 ? '#22c55e' : '#ef4444' }}>
            {diff > 0 ? '↑' : '↓'}{Math.abs(diff)}
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, color: '#aaa', margin: '4px 0 6px' }}>PTP Score (300–850)</div>
      <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: `${color}18`, color, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
        {tier}
      </div>
      <div style={{ position: 'relative', margin: '0 16px' }}>
        <div style={{ height: 10, background: '#f0f2f7', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 5, background: 'linear-gradient(90deg,#ef4444 0%,#f97316 30%,#f59e0b 55%,#22c55e 80%)', transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ position: 'absolute', top: -1, left: `calc(${pct}% - 6px)`, width: 12, height: 12, borderRadius: '50%', background: color, border: '2px solid #fff', boxShadow: `0 0 0 2px ${color}`, transition: 'left 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bbb', margin: '5px 16px 0' }}>
        <span>300 Very High</span><span>550 High</span><span>700 Low</span><span>850</span>
      </div>
    </div>
  )
}

// ── Slider Input ─────────────────────────────────────────────
function SliderField({ label, value, min, max, step = 1, onChange, format, color = '#6c63ff', tooltip }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#444' }}>{label}</span>
          {tooltip && <span style={{ fontSize: 10, color: '#bbb', marginLeft: 5 }}>{tooltip}</span>}
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: color, cursor: 'pointer' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#ccc', marginTop: 2 }}>
        <span>{format ? format(min) : min}</span><span>{format ? format(max) : max}</span>
      </div>
    </div>
  )
}

// ── Feature Importance Bar ───────────────────────────────────
function FeatureBar({ feature, importance, maxImportance }) {
  const pct   = (importance / maxImportance) * 100
  const color = feature === 'DPD' || feature === 'Call Attempts' ? '#ef4444' : '#6c63ff'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: '#555' }}>{feature}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{(importance * 100).toFixed(0)}%</span>
      </div>
      <div style={{ height: 6, background: '#f0f2f7', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ── Broken PTP Risk Meter ────────────────────────────────────
function RiskMeter({ value }) {
  const pct   = Math.min(value * 100, 100)
  const color = value >= 0.7 ? '#ef4444' : value >= 0.4 ? '#f97316' : '#22c55e'
  const label = value >= 0.7 ? 'High Risk' : value >= 0.4 ? 'Medium Risk' : 'Low Risk'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#555' }}>Broken PTP Risk</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{(value * 100).toFixed(0)}% — {label}</span>
      </div>
      <div style={{ height: 8, background: '#f0f2f7', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,#22c55e,#f97316,#ef4444)`, borderRadius: 4, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function MLScoringPanel() {
  const [accounts,    setAccounts]    = useState([])
  const [selectedAcc, setSelectedAcc] = useState(null)
  const [metadata,    setMetadata]    = useState(null)
  const [result,      setResult]      = useState(null)
  const [prevScore,   setPrevScore]   = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [accLoading,  setAccLoading]  = useState(true)
  const [mode,        setMode]        = useState('account') // 'account' | 'manual'
  const [search,      setSearch]      = useState('')

  const [inputs, setInputs] = useState({
    current_dpd:             45,
    max_dpd_ever:            90,
    ontime_payment_ratio:    0.65,
    ptp_reliability_rate:    0.50,
    consecutive_broken_ptps: 1,
    dti_ratio:               0.30,
    days_to_next_salary:     8,
    call_pickup_rate:        0.50,
    whatsapp_response_rate:  0.55,
    monthly_income_sar:      10000,
    other_active_loans:      1,
    job_loss_flag:           false,
    fraud_suspected_flag:    false,
    dispute_flag:            false,
    bucket:                  '31-60 DPD',
    bureau_score_at_origination: 620,
  })

  useEffect(() => {
    setAccLoading(true)
    getAccounts({ limit: 200 })
      .then(d => setAccounts(d.accounts || []))
      .finally(() => setAccLoading(false))
    getModelMetadata().then(setMetadata).catch(() => {})
  }, [])

  // Auto-score manual inputs (debounced)
  useEffect(() => {
    if (mode !== 'manual') return
    const timer = setTimeout(() => computeManual(), 300)
    return () => clearTimeout(timer)
  }, [inputs, mode])

  async function loadAccountScore(acc) {
    setSelectedAcc(acc)
    setLoading(true)
    setPrevScore(result?.ptp_propensity_score ?? null)
    try {
      const s = await getAccountScore(acc.loan_id)
      setResult(s)
    } catch (e) {
      console.error('Score load error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function computeManual() {
    setLoading(true)
    try {
      setPrevScore(result?.ptp_propensity_score ?? null)
      const s = await scoreAccount({ ...inputs })
      // manual endpoint returns ptp_score — normalise to ptp_propensity_score
      setResult({ ...s, ptp_propensity_score: s.ptp_score ?? s.ptp_propensity_score })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const setInput = (key, val) => setInputs(prev => ({ ...prev, [key]: val }))

  // Feature importance — array from account endpoint
  const featImportance  = Array.isArray(result?.feature_importance) ? result.feature_importance : []
  const maxImportance   = featImportance.length > 0 ? Math.max(...featImportance.map(f => f.importance)) : 1

  const filteredAccounts = accounts.filter(a =>
    !search || a.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.loan_id?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#1a1a2e' }}>ML Scoring Panel</h1>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
            PTP Propensity Model v{metadata?.model_version || '2.0.0'} ·
            ROC-AUC {metadata?.model_a_roc_auc || '0.9238'} ·
            {metadata?.training_samples?.toLocaleString() || '10,023'} accounts loaded
          </div>
        </div>
        <div style={{ display: 'flex', background: '#f0f2f7', borderRadius: 10, padding: 3 }}>
          {[['account', '📋 From Account'], ['manual', '🎛️ Manual Input']].map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setResult(null); setPrevScore(null) }} style={{
              padding: '7px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              background: mode === m ? '#fff' : 'transparent',
              color: mode === m ? '#1a1a2e' : '#888',
              boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT PANEL ── */}
        <div>
          {mode === 'account' ? (
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #f0f2f7' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 8 }}>Select Account</div>
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search name or ID…"
                  style={{ width: '100%', padding: '6px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ maxHeight: 560, overflowY: 'auto' }}>
                {accLoading && (
                  <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 12 }}>Loading accounts…</div>
                )}
                {!accLoading && filteredAccounts.length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 12 }}>No accounts found</div>
                )}
                {filteredAccounts.map(acc => {
                  const score = acc.ptp_propensity_score
                  const sc    = score >= 700 ? '#22c55e' : score >= 550 ? '#f59e0b' : score >= 400 ? '#f97316' : '#ef4444'
                  const isSelected = selectedAcc?.loan_id === acc.loan_id
                  return (
                    <div key={acc.loan_id} onClick={() => loadAccountScore(acc)} style={{
                      padding: '10px 14px', cursor: 'pointer',
                      borderBottom: '0.5px solid #f5f6fa',
                      background: isSelected ? '#f8f7ff' : '#fff',
                      borderLeft: isSelected ? '3px solid #6c63ff' : '3px solid transparent',
                      transition: 'all 0.1s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                          {acc.customer_name}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: sc, flexShrink: 0 }}>{score}</div>
                      </div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                        {acc.loan_id} · {acc.dpd_bucket || '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                        {acc.remaining_principal > 0
                          ? `SAR ${(acc.remaining_principal / 1000).toFixed(0)}K outstanding`
                          : acc.outstanding_balance > 0
                            ? `SAR ${(acc.outstanding_balance / 1000).toFixed(0)}K outstanding`
                            : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* Manual sliders */
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 14 }}>Adjust Parameters</div>

              <div style={{ fontSize: 11, fontWeight: 600, color: '#6c63ff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Delinquency</div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#444', display: 'block', marginBottom: 5 }}>Bucket</label>
                <select value={inputs.bucket} onChange={e => setInput('bucket', e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #e0e3eb', borderRadius: 7, fontSize: 12, outline: 'none', marginBottom: 10 }}>
                  {['1-30 DPD','31-60 DPD','61-90 DPD','NPA','Write-off'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <SliderField label="Current DPD"  value={inputs.current_dpd}  min={1}   max={365} onChange={v => setInput('current_dpd', v)}  color="#ef4444" tooltip="Days past due" />
              <SliderField label="Max DPD Ever" value={inputs.max_dpd_ever} min={1}   max={720} onChange={v => setInput('max_dpd_ever', v)} color="#f97316" />

              <div style={{ fontSize: 11, fontWeight: 600, color: '#6c63ff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 8px' }}>Payment History</div>
              <SliderField label="On-time Payment Ratio"    value={inputs.ontime_payment_ratio}    min={0} max={1} step={0.01} onChange={v => setInput('ontime_payment_ratio', v)}    format={v => `${Math.round(v*100)}%`} color="#22c55e" />
              <SliderField label="PTP Reliability Rate"     value={inputs.ptp_reliability_rate}    min={0} max={1} step={0.01} onChange={v => setInput('ptp_reliability_rate', v)}    format={v => `${Math.round(v*100)}%`} color="#22c55e" />
              <SliderField label="Consecutive Broken PTPs"  value={inputs.consecutive_broken_ptps} min={0} max={10}           onChange={v => setInput('consecutive_broken_ptps', v)} color="#ef4444" />

              <div style={{ fontSize: 11, fontWeight: 600, color: '#6c63ff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 8px' }}>Financial Profile</div>
              <SliderField label="DTI Ratio"             value={inputs.dti_ratio}          min={0.05} max={0.90} step={0.01} onChange={v => setInput('dti_ratio', v)}          format={v => `${Math.round(v*100)}%`} color="#f97316" tooltip="Debt-to-income" />
              <SliderField label="Days to Next Salary"   value={inputs.days_to_next_salary} min={0}   max={30}               onChange={v => setInput('days_to_next_salary', v)} color="#3b82f6" />
              <SliderField label="Monthly Income (SAR)"  value={inputs.monthly_income_sar}  min={2000} max={50000} step={500} onChange={v => setInput('monthly_income_sar', v)}  format={v => `${(v/1000).toFixed(1)}K`} color="#22c55e" />
              <SliderField label="Other Active Loans"    value={inputs.other_active_loans}  min={0}   max={5}                onChange={v => setInput('other_active_loans', v)}   color="#f97316" />

              <div style={{ fontSize: 11, fontWeight: 600, color: '#6c63ff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 8px' }}>Channel Response</div>
              <SliderField label="Call Pickup Rate"        value={inputs.call_pickup_rate}       min={0} max={1} step={0.01} onChange={v => setInput('call_pickup_rate', v)}       format={v => `${Math.round(v*100)}%`} color="#3b82f6" />
              <SliderField label="WhatsApp Response Rate"  value={inputs.whatsapp_response_rate} min={0} max={1} step={0.01} onChange={v => setInput('whatsapp_response_rate', v)} format={v => `${Math.round(v*100)}%`} color="#22c55e" />

              <div style={{ fontSize: 11, fontWeight: 600, color: '#6c63ff', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 8px' }}>Risk Flags</div>
              {[['job_loss_flag','Job Loss'],['fraud_suspected_flag','Fraud Suspected'],['dispute_flag','Account Dispute']].map(([key, label]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#444' }}>{label}</span>
                  <div onClick={() => setInput(key, !inputs[key])} style={{ width: 36, height: 20, borderRadius: 10, cursor: 'pointer', background: inputs[key] ? '#ef4444' : '#e0e3eb', position: 'relative', transition: 'background 0.2s' }}>
                    <div style={{ position: 'absolute', top: 2, left: inputs[key] ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Score display */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '0 24px 20px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>⚡</div>
                <div style={{ fontSize: 13 }}>Computing score…</div>
              </div>
            ) : result ? (
              <>
                <ScoreGauge score={result.ptp_propensity_score} prev={prevScore} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 8 }}>
                  {[
                    { label: 'Pay Probability', value: `${Math.round((result.pay_probability ?? 0) * 100)}%`,    color: (result.pay_probability ?? 0) > 0.6 ? '#22c55e' : (result.pay_probability ?? 0) > 0.35 ? '#f59e0b' : '#ef4444' },
                    { label: 'Risk Tier',        value: result.risk_tier ?? '—',                                  color: RISK_COLORS[result.risk_tier] ?? '#6b7280' },
                    { label: 'Rec. Channel',     value: `${CHANNEL_ICONS[result.recommended_channel] ?? ''} ${result.recommended_channel ?? '—'}`, color: '#6c63ff' },
                    { label: 'Handling',         value: result.handling_type ?? '—',                              color: '#3b82f6' },
                  ].map(c => (
                    <div key={c.label} style={{ background: '#f8f9fc', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 48, color: '#aaa' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🎯</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {mode === 'account' ? 'Select an account to compute score' : 'Adjust parameters to see live score'}
                </div>
                <div style={{ fontSize: 12, marginTop: 6 }}>The ML model will score in real time</div>
              </div>
            )}
          </div>

          {result && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* Feature importance */}
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>Feature Importance</div>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 14 }}>Key drivers of this PTP score</div>
                {featImportance.map(f => (
                  <FeatureBar key={f.feature} feature={f.feature} importance={f.importance} maxImportance={maxImportance} />
                ))}
                {featImportance.length === 0 && (
                  <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', padding: 20 }}>No data</div>
                )}
                {result.broken_ptp_risk != null && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid #f0f2f7' }}>
                    <RiskMeter value={result.broken_ptp_risk} />
                  </div>
                )}
              </div>

              {/* Score Breakdown / Model Info */}
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>Score Breakdown</div>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 14 }}>Positive (↑ score) vs negative (↓ score) factors</div>
                {result.score_breakdown ? (
                  Object.entries(result.score_breakdown).map(([key, val]) => {
                    const positive = val >= 0
                    const pct = Math.min((Math.abs(val) / 3.5) * 100, 100)
                    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    return (
                      <div key={key} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: '#555' }}>{label}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: positive ? '#22c55e' : '#ef4444' }}>
                            {positive ? '+' : ''}{val.toFixed(2)}
                          </span>
                        </div>
                        <div style={{ height: 6, background: '#f0f2f7', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: positive ? '#22c55e' : '#ef4444', borderRadius: 3, transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  /* fallback — show feature value context for account mode */
                  featImportance.map(f => {
                    const formatted =
                      f.feature === 'Outstanding' || f.feature === 'Salary' || f.feature === 'Installment'
                        ? sarFmt(f.value)
                        : f.feature === 'PTP History'
                          ? pctFmt(f.value)
                          : String(f.value)
                    return (
                      <div key={f.feature} style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f8f9fc', borderRadius: 6 }}>
                        <span style={{ fontSize: 11, color: '#555' }}>{f.feature}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a2e' }}>{formatted}</span>
                      </div>
                    )
                  })
                )}

                <div style={{ marginTop: 16, padding: '12px 14px', background: '#f8f9fc', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>Model details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      ['Version',   metadata?.model_version   || '2.0.0'],
                      ['ROC-AUC',   metadata?.model_a_roc_auc || '0.9238'],
                      ['F1 Score',  metadata?.model_a_f1      || '0.9012'],
                      ['Features',  metadata?.feature_count   || 40],
                      ['Trained',   metadata?.last_trained     || '2026-04-01'],
                      ['Threshold', metadata?.model_a_threshold|| '0.46'],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 10, color: '#bbb' }}>{k}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Account Context — shown in account mode once result is loaded */}
          {mode === 'account' && result && result.loan_id && (
            <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 12 }}>Account Context</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {[
                  ['Customer',    result.customer_name],
                  ['Account',     result.loan_id],
                  ['Product',     result.product_type],
                  ['Bucket',      result.dpd_bucket],
                  ['Outstanding', sarFmt(result.remaining_principal)],
                  ['Current DPD', `${result.dpd} days`],
                  ['PTPs Made',   result.ptp_count ?? 'N/A'],
                  ['PTP Kept %',  pctFmt(result.ptp_kept_ratio)],
                  ['On-time %',   pctFmt(result.ptp_kept_ratio)],
                  ['Income',      sarFmt(result.salary)],
                  ['Installment', sarFmt(result.installment_amount)],
                  ['DTI Ratio',   pctFmt(result.dti_ratio)],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: '#f8f9fc', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', wordBreak: 'break-word' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
