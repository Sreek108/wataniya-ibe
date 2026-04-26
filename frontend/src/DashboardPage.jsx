import { useState, useEffect } from 'react'
import { getDashboardOverview, getDashboardPerformance } from './api'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'

const BUCKET_COLORS = {
  '1-30 DPD': '#22c55e', '31-60 DPD': '#f59e0b',
  '61-90 DPD': '#f97316', 'NPA': '#ef4444', 'Write-off': '#6b7280'
}
const RISK_COLORS = {
  'Low Risk': '#22c55e', 'Medium Risk': '#f59e0b',
  'High Risk': '#f97316', 'Very High Risk': '#ef4444'
}

function KPICard({ label, value, sub, color = '#6c63ff', icon }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '18px 20px',
      border: '0.5px solid #e8eaf0', flex: 1, minWidth: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, fontSize: 18
        }}>{icon}</div>
        <span style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#aaa', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

function SectionCard({ title, children, action }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden'
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '0.5px solid #f0f2f7',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

const CUSTOM_TOOLTIP = ({ active, payload }) => {
  if (active && payload?.length) {
    return (
      <div style={{
        background: '#1a1a2e', color: '#fff', padding: '8px 12px',
        borderRadius: 8, fontSize: 12
      }}>
        <div style={{ fontWeight: 600 }}>{payload[0].name}</div>
        <div>{payload[0].value?.toLocaleString()}</div>
      </div>
    )
  }
  return null
}

export default function DashboardPage() {
  const [overview, setOverview] = useState(null)
  const [perf, setPerf]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [lastUpdated, setLastUpdated] = useState(new Date())

  async function load() {
    try {
      const [ov, pf] = await Promise.all([getDashboardOverview(), getDashboardPerformance()])
      setOverview(ov)
      setPerf(pf)
      setLastUpdated(new Date())
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000) // poll every 30s
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⏳</div>
        <div style={{ color: '#888', fontSize: 14 }}>Loading dashboard...</div>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ padding: 24 }}>
      <div style={{
        background: '#fef2f2', border: '0.5px solid #fca5a5',
        borderRadius: 10, padding: 20, color: '#dc2626'
      }}>
        Error loading dashboard: {error}
      </div>
    </div>
  )

  // Prepare chart data
  const bucketData = Object.entries(overview?.bucket_distribution || {}).map(([name, value]) => ({
    name, value
  }))

  const riskData = Object.entries(overview?.risk_distribution || {}).map(([name, value]) => ({
    name, value, color: RISK_COLORS[name]
  }))

  const channelData = Object.entries(overview?.channel_distribution || {}).map(([name, value]) => ({
    name, value
  }))

  const bucketPerfData = Object.entries(perf?.by_bucket || {}).map(([bucket, d]) => ({
    bucket: bucket.replace(' DPD', ''),
    total: d.total,
    paid: d.paid,
    payRate: Math.round(d.pay_rate * 100)
  }))

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#1a1a2e' }}>
            Collection Dashboard
          </h1>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
            Wataniya Finance — Live Portfolio Intelligence
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#22c55e', animation: 'pulse 2s infinite'
          }} />
          <span style={{ fontSize: 12, color: '#666' }}>
            Live · Updated {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            onClick={load}
            style={{
              padding: '6px 14px', border: '0.5px solid #e0e3eb',
              borderRadius: 7, background: '#fff', fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit', color: '#555'
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <KPICard
          label="Total Accounts"
          value={overview?.total_accounts?.toLocaleString()}
          sub={`${overview?.active_accounts?.toLocaleString()} active`}
          color="#6c63ff" icon="📋"
        />
        <KPICard
          label="Total Outstanding"
          value={`SAR ${(overview?.total_outstanding_sar / 1e6)?.toFixed(1)}M`}
          sub={`Avg SAR ${overview?.avg_outstanding_sar?.toLocaleString()}`}
          color="#3b82f6" icon="💰"
        />
        <KPICard
          label="Active PTPs"
          value={overview?.total_ptps_active?.toLocaleString()}
          sub="Promises to pay"
          color="#22c55e" icon="✅"
        />
        <KPICard
          label="Collection Rate"
          value={`${Math.round((overview?.paid_rate || 0) * 100)}%`}
          sub="Of labelled accounts"
          color="#0f9d74" icon="📈"
        />
        <KPICard
          label="Avg PTP Score"
          value={overview?.avg_ptp_score}
          sub="ML propensity score"
          color="#f59e0b" icon="🎯"
        />
        <KPICard
          label="Broken PTPs"
          value={overview?.broken_ptps_today?.toLocaleString()}
          sub="Flagged today"
          color="#ef4444" icon="⚠️"
        />
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Bucket distribution */}
        <SectionCard title="Delinquency Buckets">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={bucketData}
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {bucketData.map((entry) => (
                  <Cell key={entry.name} fill={BUCKET_COLORS[entry.name] || '#aaa'} />
                ))}
              </Pie>
              <Tooltip content={<CUSTOM_TOOLTIP />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
            {bucketData.map(b => (
              <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: BUCKET_COLORS[b.name], flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#555' }}>{b.name}</span>
                <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{b.value?.toLocaleString()}</span>
                <span style={{ color: '#aaa' }}>
                  ({Math.round(b.value / overview?.total_accounts * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Risk tier distribution */}
        <SectionCard title="ML Risk Tiers">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={riskData}
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {riskData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CUSTOM_TOOLTIP />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
            {riskData.map(r => (
              <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: '#555' }}>{r.name}</span>
                <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{r.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Channel recommendation */}
        <SectionCard title="Recommended Channels">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={channelData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Bar dataKey="value" fill="#6c63ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 4 }}>
            AI-assigned contact channel per account
          </div>
        </SectionCard>
      </div>

      {/* Charts Row 2 — Bucket Performance */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>

        <SectionCard title="Bucket Performance — Pay Rate vs Volume">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bucketPerfData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip content={<CUSTOM_TOOLTIP />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="total" name="Total accounts" fill="#e8eaf0" radius={[3, 3, 0, 0]} />
              <Bar yAxisId="left" dataKey="paid" name="Paid" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>

        {/* Model performance */}
        <SectionCard title="ML Model Performance">
          {perf && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Model A — PTP Propensity', value: perf.model_auc, color: '#6c63ff', suffix: ' AUC' },
                { label: 'F1 Score', value: perf.model_f1, color: '#22c55e', suffix: '' },
                { label: 'Accuracy', value: perf.model_accuracy, color: '#3b82f6', suffix: '' },
              ].map(m => (
                <div key={m.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: '#555' }}>{m.label}</span>
                    <span style={{ fontWeight: 700, color: m.color }}>{(m.value * 100).toFixed(1)}%{m.suffix}</span>
                  </div>
                  <div style={{ height: 6, background: '#f0f2f7', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${m.value * 100}%`,
                      background: m.color, borderRadius: 3,
                      transition: 'width 0.8s ease'
                    }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 6, padding: '10px 12px', background: '#f8f9fc', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Model version</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{perf.model_version}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Last trained: {perf.last_trained}</div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Pay rate by bucket table */}
      <SectionCard title="Collection Performance by Bucket">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Bucket', 'Total Accounts', 'Paid', 'Not Paid', 'Pay Rate', 'Avg PTP Score', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600, color: '#888',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    background: '#fafbfc', borderBottom: '0.5px solid #e8eaf0'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(perf?.by_bucket || {}).map(([bucket, d]) => {
                const rate = Math.round(d.pay_rate * 100)
                const color = rate >= 70 ? '#22c55e' : rate >= 40 ? '#f59e0b' : '#ef4444'
                return (
                  <tr key={bucket} style={{ borderBottom: '0.5px solid #f0f2f7' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                        background: `${BUCKET_COLORS[bucket]}18`,
                        color: BUCKET_COLORS[bucket]
                      }}>{bucket}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.total?.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 600 }}>{d.paid?.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px', color: '#ef4444' }}>{(d.total - d.paid)?.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: '#f0f2f7', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                          <div style={{ height: '100%', width: `${rate}%`, background: color, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontWeight: 700, color, minWidth: 36 }}>{rate}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#6c63ff' }}>{d.avg_score}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: rate >= 50 ? '#dcfce7' : '#fef2f2',
                        color: rate >= 50 ? '#166534' : '#991b1b'
                      }}>
                        {rate >= 70 ? 'On Track' : rate >= 40 ? 'At Risk' : 'Critical'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

    </div>
  )
}
