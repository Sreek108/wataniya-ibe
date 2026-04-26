import { useState, useEffect } from 'react'
import { getAIVsHuman } from './api'

const AI_COLOR  = '#3b82f6'
const HUM_COLOR = '#6c63ff'
const BUCKETS   = ['1-30 DPD', '31-60 DPD', '61-90 DPD', 'NPA', 'Write-off']

function sarFmt(n) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1e6) return `SAR ${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `SAR ${Math.round(n / 1e3)}K`
  return `SAR ${n}`
}

function KpiCard({ label, value, sub, color, bg }) {
  return (
    <div style={{ background: bg || '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '18px 20px', flex: 1 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || '#1a1a2e', lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function WinBadge({ winner, side }) {
  if (winner !== side) return null
  const isAI = side === 'ai'
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, marginLeft: 5,
      background: isAI ? '#dbeafe' : '#ede9fe', color: isAI ? '#1e40af' : '#5b21b6' }}>
      WIN
    </span>
  )
}

function MiniBar({ value, max, color }) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div style={{ height: 6, background: '#f0f2f7', borderRadius: 3, overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 3 }} />
    </div>
  )
}

function TrendBars({ months, mode }) {
  const key_ai  = mode === 'calls' ? 'ai_calls'  : 'ai_ptps'
  const key_hum = mode === 'calls' ? 'human_calls' : 'human_ptps'
  const maxVal  = Math.max(...months.map(m => m[key_ai] + m[key_hum]), 1)
  const barMax  = 90
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: barMax + 28, padding: '0 4px' }}>
      {months.map((m, i) => {
        const aiH  = Math.round(m[key_ai]  / maxVal * barMax)
        const humH = Math.round(m[key_hum] / maxVal * barMax)
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: barMax }}>
              <div style={{ width: 12, height: Math.max(aiH, 2), background: AI_COLOR, borderRadius: '3px 3px 0 0', opacity: 0.85 }} title={`AI: ${m[key_ai].toLocaleString()}`} />
              <div style={{ width: 12, height: Math.max(humH, 2), background: HUM_COLOR, borderRadius: '3px 3px 0 0', opacity: 0.85 }} title={`Human: ${m[key_hum].toLocaleString()}`} />
            </div>
            <div style={{ fontSize: 9, color: '#aaa', marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap', transform: 'rotate(-30deg)', transformOrigin: 'top left', marginLeft: 8 }}>
              {m.month.split(' ')[0]}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AIvsHumanPage() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    getAIVsHuman()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>Loading AI vs Human analysis...
    </div>
  )
  if (error || !data) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#ef4444', fontSize: 14 }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>{error || 'Failed to load data'}
    </div>
  )

  const { ai, human, comparison, monthly_trend, top_ai_performers, top_human_performers } = data

  const METRICS = [
    { label: 'Total Calls',        aiVal: ai.total_calls.toLocaleString(),        humVal: human.total_calls.toLocaleString(),        winner: ai.total_calls >= human.total_calls ? 'ai' : 'human' },
    { label: 'Connection Rate',    aiVal: `${ai.connection_rate_pct}%`,            humVal: `${human.connection_rate_pct}%`,            winner: ai.connection_rate_pct >= human.connection_rate_pct ? 'ai' : 'human' },
    { label: 'PTP Capture Rate',   aiVal: `${ai.ptp_rate_pct}%`,                  humVal: `${human.ptp_rate_pct}%`,                  winner: ai.ptp_rate_pct >= human.ptp_rate_pct ? 'ai' : 'human' },
    { label: 'Total PTP Value',    aiVal: sarFmt(ai.ptp_value_sar),               humVal: sarFmt(human.ptp_value_sar),               winner: ai.ptp_value_sar >= human.ptp_value_sar ? 'ai' : 'human' },
    { label: 'Avg Duration',       aiVal: `${ai.avg_duration_sec}s`,              humVal: `${human.avg_duration_sec}s`,              winner: ai.avg_duration_sec <= human.avg_duration_sec ? 'ai' : 'human' },
    { label: 'Cost per PTP',       aiVal: `SAR ${ai.cost_per_ptp_sar}`,           humVal: `SAR ${human.cost_per_ptp_sar}`,           winner: ai.cost_per_ptp_sar <= human.cost_per_ptp_sar ? 'ai' : 'human' },
    { label: 'Recovery per Call',  aiVal: `SAR ${ai.recovery_per_call_sar}`,      humVal: `SAR ${human.recovery_per_call_sar}`,      winner: ai.recovery_per_call_sar >= human.recovery_per_call_sar ? 'ai' : 'human' },
    { label: 'Positive Sentiment', aiVal: `${ai.sentiment_positive_pct}%`,        humVal: `${human.sentiment_positive_pct}%`,        winner: ai.sentiment_positive_pct >= human.sentiment_positive_pct ? 'ai' : 'human' },
  ]

  const aiWins   = METRICS.filter(m => m.winner === 'ai').length
  const humWins  = METRICS.filter(m => m.winner === 'human').length

  // Projected annual savings
  const aiTotalCost  = ai.total_calls * 2
  const altCostHuman = ai.total_calls * 35
  const qtrSavings   = altCostHuman - aiTotalCost
  const annualSavings = Math.round(qtrSavings * 4)

  const { recommended_split_pct } = comparison

  return (
    <div style={{ padding: 24, maxWidth: 1400, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Reports › AI vs Human Analysis</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>AI vs Human Recovery Analysis</h1>
        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Comparing AI Voice Bot performance against human agents across {(ai.total_calls + human.total_calls).toLocaleString()} calls</div>
      </div>

      {/* Score banner */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, marginBottom: 20, alignItems: 'center' }}>
        {/* AI card */}
        <div style={{ background: '#eff6ff', border: `2px solid ${AI_COLOR}`, borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: AI_COLOR }}>🤖 AI Voice Bot</div>
            <span style={{ fontSize: 11, fontWeight: 700, background: AI_COLOR, color: '#fff', borderRadius: 20, padding: '3px 10px' }}>
              {aiWins} wins
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              ['Total Calls',      ai.total_calls.toLocaleString()],
              ['PTP Rate',         `${ai.ptp_rate_pct}%`],
              ['PTP Value',        sarFmt(ai.ptp_value_sar)],
              ['Avg Duration',     `${ai.avg_duration_sec}s`],
              ['Cost / PTP',       `SAR ${ai.cost_per_ptp_sar}`],
              ['Recovery / Call',  `SAR ${ai.recovery_per_call_sar}`],
            ].map(([k, v]) => (
              <div key={k} style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '10px 6px' }}>
                <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* VS divider */}
        <div style={{ textAlign: 'center', padding: '0 8px' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#ccc', marginBottom: 8 }}>VS</div>
          <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700, color: AI_COLOR }}>AI wins: Volume, Cost</div>
            <div style={{ fontWeight: 700, color: HUM_COLOR }}>Human wins: Quality</div>
          </div>
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 11, color: '#166534', fontWeight: 600 }}>
            {comparison.roi_multiplier}× cheaper per PTP
          </div>
        </div>

        {/* Human card */}
        <div style={{ background: '#f5f3ff', border: `2px solid ${HUM_COLOR}`, borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: HUM_COLOR }}>👤 Human Agents</div>
            <span style={{ fontSize: 11, fontWeight: 700, background: HUM_COLOR, color: '#fff', borderRadius: 20, padding: '3px 10px' }}>
              {humWins} wins
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              ['Total Calls',      human.total_calls.toLocaleString()],
              ['PTP Rate',         `${human.ptp_rate_pct}%`],
              ['PTP Value',        sarFmt(human.ptp_value_sar)],
              ['Avg Duration',     `${human.avg_duration_sec}s`],
              ['Cost / PTP',       `SAR ${human.cost_per_ptp_sar}`],
              ['Recovery / Call',  `SAR ${human.recovery_per_call_sar}`],
            ].map(([k, v]) => (
              <div key={k} style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '10px 6px' }}>
                <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Head-to-head metrics table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Head-to-Head Metric Comparison</span>
          <span style={{ fontSize: 11, color: '#aaa' }}>{(ai.total_calls + human.total_calls).toLocaleString()} total calls</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px', gap: 0 }}>
          {/* Header */}
          {['Metric', '🤖 AI Voice Bot', '👤 Human Agents'].map((h, i) => (
            <div key={i} style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, color: i === 0 ? '#888' : i === 1 ? AI_COLOR : HUM_COLOR,
              background: '#fafbfc', borderBottom: '1px solid #e8eaf0', textAlign: i === 0 ? 'left' : 'center' }}>{h}</div>
          ))}
          {/* Rows */}
          {METRICS.map((m, i) => (
            <>
              <div key={`l${i}`} style={{ padding: '10px 16px', fontSize: 12, color: '#555', background: i % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '0.5px solid #f5f6fa' }}>{m.label}</div>
              <div key={`a${i}`} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: AI_COLOR, textAlign: 'center', background: i % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '0.5px solid #f5f6fa' }}>
                {m.aiVal}<WinBadge winner={m.winner} side="ai" />
              </div>
              <div key={`h${i}`} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: HUM_COLOR, textAlign: 'center', background: i % 2 === 0 ? '#fff' : '#fafbfc', borderBottom: '0.5px solid #f5f6fa' }}>
                {m.humVal}<WinBadge winner={m.winner} side="human" />
              </div>
            </>
          ))}
        </div>
      </div>

      {/* Performance by bucket */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f2f7' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Performance by Delinquency Bucket</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Bucket', 'AI Calls', 'AI PTP Rate', 'Human Calls', 'Human PTP Rate', 'Recommended Channel'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#fafbfc', borderBottom: '1px solid #e8eaf0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BUCKETS.map((bk, i) => {
                const bAI  = ai.by_bucket?.[bk]    || {}
                const bHum = human.by_bucket?.[bk] || {}
                const aiRate  = bAI.ptp_rate  ?? 0
                const humRate = bHum.ptp_rate ?? 0
                const isComplex = ['NPA', 'Write-off'].includes(bk)
                let rec, recBg, recColor
                if (isComplex) {
                  rec = 'Human Preferred'; recBg = '#f3e8ff'; recColor = '#6b21a8'
                } else if (aiRate >= humRate) {
                  rec = 'AI Preferred';    recBg = '#dbeafe'; recColor = '#1e40af'
                } else if (humRate - aiRate > 5) {
                  rec = 'Human Preferred'; recBg = '#f3e8ff'; recColor = '#6b21a8'
                } else {
                  rec = 'Mixed';           recBg = '#f1f5f9'; recColor = '#475569'
                }
                const maxRate = Math.max(aiRate, humRate, 1)
                return (
                  <tr key={bk} style={{ borderBottom: '0.5px solid #f5f6fa', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1a1a2e' }}>{bk}</td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>
                      <div>{(bAI.calls ?? 0).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: '#aaa' }}>{bAI.ptps ?? 0} PTPs</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 700, color: aiRate >= humRate ? AI_COLOR : '#555' }}>{aiRate}%</div>
                      <MiniBar value={aiRate} max={maxRate} color={AI_COLOR} />
                    </td>
                    <td style={{ padding: '10px 14px', color: '#555' }}>
                      <div>{(bHum.calls ?? 0).toLocaleString()}</div>
                      <div style={{ fontSize: 10, color: '#aaa' }}>{bHum.ptps ?? 0} PTPs</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 700, color: humRate > aiRate ? HUM_COLOR : '#555' }}>{humRate}%</div>
                      <MiniBar value={humRate} max={maxRate} color={HUM_COLOR} />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: recBg, color: recColor }}>{rec}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly trends */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {[
          { title: 'Call Volume Trend', mode: 'calls',  sub: 'Total calls per month' },
          { title: 'PTP Capture Trend', mode: 'ptps',   sub: 'PTPs captured per month' },
        ].map(({ title, mode, sub }) => (
          <div key={mode} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f2f7' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{title}</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>{sub}</div>
            </div>
            <div style={{ padding: '16px 16px 20px' }}>
              <TrendBars months={monthly_trend} mode={mode} />
              <div style={{ display: 'flex', gap: 16, marginTop: 20, justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#555' }}>
                  <div style={{ width: 12, height: 12, background: AI_COLOR, borderRadius: 2 }} />AI Voice Bot
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#555' }}>
                  <div style={{ width: 12, height: 12, background: HUM_COLOR, borderRadius: 2 }} />Human Agents
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Top performers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Top AI campaigns */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f2f7', background: '#eff6ff' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: AI_COLOR }}>🤖 Top AI Campaigns</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {top_ai_performers.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '0.5px solid #f5f6fa' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: AI_COLOR, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{c.calls.toLocaleString()} calls · {c.ptps} PTPs</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{c.ptp_rate}%</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{sarFmt(c.ptp_value_sar)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top human agents */}
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f2f7', background: '#f5f3ff' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: HUM_COLOR }}>👤 Top Human Agents</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {top_human_performers.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '0.5px solid #f5f6fa' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : HUM_COLOR, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{a.calls.toLocaleString()} calls · {a.ptps} PTPs</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{a.ptp_rate}%</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{sarFmt(a.ptp_value_sar)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Strategic recommendation */}
      <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f2f7' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>Strategic Channel Recommendation</span>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {/* Split visualization */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 10 }}>Recommended Channel Split</div>
            <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', gap: 2 }}>
              <div style={{ flex: recommended_split_pct.ai, background: AI_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                🤖 AI {recommended_split_pct.ai}%
              </div>
              <div style={{ flex: recommended_split_pct.human, background: HUM_COLOR, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                👤 Human {recommended_split_pct.human}%
              </div>
            </div>
          </div>

          {/* KPI summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            <KpiCard label="ROI Multiplier" value={`${comparison.roi_multiplier}×`} sub="Human cost vs AI cost per PTP" color="#22c55e" bg="#f0fdf4" />
            <KpiCard label="Projected Annual Savings" value={sarFmt(annualSavings)} sub="If AI handles current AI volume" color="#3b82f6" bg="#eff6ff" />
            <KpiCard label="AI Volume Share" value={`${Math.round(ai.total_calls / (ai.total_calls + human.total_calls) * 100)}%`} sub="of total call volume handled by AI" color="#6c63ff" bg="#f5f3ff" />
          </div>

          {/* Bullets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { color: AI_COLOR,  bg: '#eff6ff',  icon: '🤖', title: 'AI Voice Bot — Best for:', points: ['Early-stage buckets (1-30 DPD, 31-60 DPD)', `High volume — handles ${ai.total_calls.toLocaleString()} calls vs ${human.total_calls.toLocaleString()} human`, `Cost: SAR ${ai.cost_per_ptp_sar} per PTP (${comparison.roi_multiplier}× cheaper)`, 'Standardized reminder and payment messaging'] },
              { color: HUM_COLOR, bg: '#f5f3ff',  icon: '👤', title: 'Human Agents — Best for:', points: ['Complex negotiations: NPA, Write-off accounts', 'Disputes and hardship cases requiring empathy', `Higher sentiment quality: ${human.sentiment_positive_pct}% positive`, 'Legal escalations and restructuring discussions'] },
            ].map(({ color, bg, icon, title, points }) => (
              <div key={title} style={{ background: bg, borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${color}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 10 }}>{icon} {title}</div>
                {points.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: '#444', marginBottom: 6 }}>
                    <span style={{ color, flexShrink: 0, marginTop: 1 }}>•</span>{p}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
