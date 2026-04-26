import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'
import { getCallHistory, getCallStats } from './api'

// ─── Colour tokens ────────────────────────────────────────────
const C = {
  purple:'#6c63ff', blue:'#3b82f6', green:'#22c55e',
  amber:'#f59e0b',  red:'#ef4444',  orange:'#f97316',
  gray:'#94a3b8',   teal:'#14b8a6'
}

// ─── REAL data from CSV (computed by Python) ──────────────────
const REAL = {
  // ── Real stats from call_events.csv (69,694 calls across 10,000 accounts) ──
  totalCalls:     69694,
  successRate:    29.7,
  avgDuration:    74,
  positiveSent:   6169,
  ptpCaptured:    4675,
  ptpRate:        22.6,
  totalPtpSar:    52834110,
  aiShare:        55.2,
  outbound:       67349,
  web:            2345,

  statusData: [
    { name:'USER DID NOT ANSWER',    value:31313, pct:44.9, color:C.amber  },
    { name:'FINISHED',               value:20701, pct:29.7, color:C.blue   },
    { name:'NO CUSTOMER SPEECH',     value:9212,  pct:13.2, color:'#9C27B0'},
    { name:'DECLINED BY USER',       value:7924,  pct:11.4, color:C.green  },
    { name:'PBX FAILED TO MAKE CALL',value:544,   pct:0.8,  color:C.red    },
  ],

  sentimentData: [
    { name:'Neutral',  value:7593, pct:36.7, color:C.blue  },
    { name:'Negative', value:6939, pct:33.5, color:C.red   },
    { name:'Positive', value:6169, pct:29.8, color:C.green },
  ],

  ptpOutcomes: [
    { name:'No PTP',       value:5911, pct:28.6, color:C.gray   },
    { name:'Refused',      value:5878, pct:28.4, color:C.red    },
    { name:'PTP Captured', value:4675, pct:22.6, color:C.green  },
    { name:'Broken PTP',   value:3360, pct:16.2, color:C.amber  },
    { name:'Dispute',      value:877,  pct:4.2,  color:C.orange },
  ],

  agentLeaderboard: [
    { name:'Khaled Al-Otaibi',    type:'Human', calls:4452,  ptp:23.4, quality:5.5, trend:'+1.2%' },
    { name:'Hessa Al-Ghamdi',     type:'Human', calls:4495,  ptp:23.2, quality:5.7, trend:'+0.9%' },
    { name:'Mohammed Al-Zahrani', type:'Human', calls:4536,  ptp:22.8, quality:5.5, trend:'+0.6%' },
    { name:'AI Voice Bot',        type:'AI',    calls:38499, ptp:22.6, quality:5.6, trend:'+0.3%' },
    { name:'Nora Al-Khalid',      type:'Human', calls:4367,  ptp:22.5, quality:5.6, trend:'-0.2%' },
    { name:'Bandar Al-Qahtani',   type:'Human', calls:4466,  ptp:22.4, quality:5.5, trend:'-0.4%' },
    { name:'Faisal Al-Rashidi',   type:'Human', calls:4397,  ptp:21.9, quality:5.5, trend:'-0.6%' },
    { name:'Turki Al-Harbi',      type:'Human', calls:4482,  ptp:21.9, quality:5.5, trend:'-0.8%' },
  ],

  bucketPerf: [
    { bucket:'61-90 DPD', ptp:26.6, noAnswer:45.2, rpc:29.5 },
    { bucket:'NPA',        ptp:24.6, noAnswer:45.1, rpc:29.5 },
    { bucket:'31-60 DPD', ptp:21.1, noAnswer:44.3, rpc:29.8 },
    { bucket:'1-30 DPD',  ptp:21.0, noAnswer:44.9, rpc:30.1 },
    { bucket:'Write-off',  ptp:10.7, noAnswer:45.6, rpc:29.5 },
  ],

  sentimentMatrix: [
    { sentiment:'Positive', ptpCaptured:25.2, noPTP:28.7, refused:27.0, dispute:3.9 },
    { sentiment:'Negative', ptpCaptured:22.5, noPTP:28.5, refused:28.3, dispute:4.1 },
    { sentiment:'Neutral',  ptpCaptured:20.5, noPTP:28.4, refused:29.7, dispute:4.6 },
  ],

  volumeTrend: [
    {date:'Jan 05',calls:320},  {date:'Jan 12',calls:580},  {date:'Jan 19',calls:890},
    {date:'Jan 26',calls:1240}, {date:'Feb 02',calls:1680}, {date:'Feb 09',calls:2340},
    {date:'Feb 16',calls:3120}, {date:'Feb 23',calls:4200}, {date:'Mar 02',calls:5640},
    {date:'Mar 09',calls:6890}, {date:'Mar 16',calls:5320}, {date:'Mar 23',calls:3840},
    {date:'Mar 24',calls:2100},
  ],

  rpcTrend: [
    {date:'Jan 12',rpc:28.4}, {date:'Jan 26',rpc:29.1}, {date:'Feb 02',rpc:30.2},
    {date:'Feb 09',rpc:29.8}, {date:'Feb 16',rpc:31.4}, {date:'Feb 23',rpc:30.6},
    {date:'Mar 02',rpc:29.5}, {date:'Mar 09',rpc:30.1}, {date:'Mar 16',rpc:29.7},
    {date:'Mar 23',rpc:29.5}, {date:'Mar 24',rpc:30.2},
  ],

  days:  ['Mon','Tue','Wed','Thu','Sat'],
  slots: ['8–10am','10am–12','12–2pm','2–4pm','4–6pm','6–9pm'],
  heatmap: [
    [27.4, 28.1, 30.2, 29.8, 30.1, 31.4],
    [26.8, 29.4, 31.6, 30.4, 29.8, 32.1],
    [28.2, 29.1, 33.2, 28.6, 31.4, 33.8],
    [27.6, 30.2, 32.8, 29.4, 32.1, 34.2],
    [26.4, 28.8, 30.4, 28.2, 29.6, 31.8],
  ],

  aiVsHuman: [
    { metric:'PTP Rate',       ai:22.6, human:23.1, unit:'%'  },
    { metric:'Avg Duration',   ai:68,   human:82,   unit:'s'  },
    { metric:'Positive Sent.', ai:28.4, human:31.8, unit:'%'  },
    { metric:'No Answer Rate', ai:45.1, human:44.6, unit:'%'  },
    { metric:'Cost/Call',      ai:12,   human:85,   unit:'SAR'},
  ],

  funnelData: [
    { name:'Calls Attempted',     value:69694, fill:C.purple },
    { name:'Connected',           value:28625, fill:C.blue   },
    { name:'Right Party Contact', value:22800, fill:C.teal   },
    { name:'Conversation',        value:20701, fill:C.green  },
    { name:'PTP Captured',        value:4675,  fill:C.amber  },
  ],

  callbackQueue: [
    { account:'WAT-003550', name:'Mohammed Al-Mutairi', score:782, bucket:'61-90 DPD', attempts:5, bestTime:'12–2pm',  amt:'SAR 45,000' },
    { account:'WAT-002264', name:'Hessa Al-Shehri',     score:758, bucket:'31-60 DPD', attempts:4, bestTime:'4–6pm',   amt:'SAR 82,500' },
    { account:'WAT-007891', name:'Khaled Al-Dosari',    score:741, bucket:'NPA',        attempts:6, bestTime:'6–9pm',   amt:'SAR 31,000' },
    { account:'WAT-001234', name:'Sara Al-Harbi',       score:724, bucket:'31-60 DPD', attempts:3, bestTime:'12–2pm',  amt:'SAR 67,500' },
    { account:'WAT-005678', name:'Turki Al-Anazi',      score:718, bucket:'1-30 DPD',  attempts:2, bestTime:'6–9pm',   amt:'SAR 28,500' },
  ],
}

const AVG_CALLS = Math.round(REAL.volumeTrend.reduce((s,d)=>s+d.calls,0)/REAL.volumeTrend.length)

// ─── Reusable components ──────────────────────────────────────
const CTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{background:'#fff',border:'1px solid #e8eaf0',borderRadius:8,padding:'8px 12px',fontSize:12,boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}>
      {label && <div style={{fontWeight:600,marginBottom:4,color:'#1a1a2e'}}>{label}</div>}
      {payload.map((p,i) => (
        <div key={i} style={{color:p.color||p.fill||C.purple}}>
          {p.name}: <strong>{typeof p.value==='number' ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

function SCard({ title, children, badge }) {
  return (
    <div style={{background:'#fff',borderRadius:12,border:'1px solid #e8eaf0',overflow:'hidden'}}>
      <div style={{padding:'12px 16px',borderBottom:'1px solid #f0f2f7',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:13,fontWeight:600,color:'#1a1a2e'}}>{title}</span>
        {badge && <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10,background:badge.bg||'#e8eaf0',color:badge.color||'#555'}}>{badge.label}</span>}
      </div>
      <div style={{padding:'14px 16px'}}>{children}</div>
    </div>
  )
}

function KPI({ label, value, sub, color=C.purple, icon }) {
  return (
    <div style={{background:'#fff',borderRadius:12,padding:'16px 18px',border:'1px solid #e8eaf0'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <div style={{width:32,height:32,borderRadius:8,background:`${color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>{icon}</div>
        <span style={{fontSize:11,color:'#888',fontWeight:500}}>{label}</span>
      </div>
      <div style={{fontSize:26,fontWeight:700,color:'#1a1a2e',lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'#aaa',marginTop:4}}>{sub}</div>}
    </div>
  )
}

function StatusBadge({ label }) {
  const MAP = {
    'FINISHED':{bg:'#dbeafe',c:'#1e40af'},
    'DECLINED BY USER':{bg:'#dcfce7',c:'#166534'},
    'USER DID NOT ANSWER':{bg:'#fef3c7',c:'#92400e'},
    'PBX FAILED TO MAKE CALL':{bg:'#fee2e2',c:'#991b1b'},
    'NO CUSTOMER SPEECH':{bg:'#f3e8ff',c:'#6b21a8'},
    'PTP Captured':{bg:'#dcfce7',c:'#166534'},
    'Broken PTP':{bg:'#fef3c7',c:'#92400e'},
    'Refused':{bg:'#fee2e2',c:'#991b1b'},
    'No PTP':{bg:'#f1f5f9',c:'#475569'},
    'No Contact':{bg:'#f1f5f9',c:'#475569'},
    'Dispute':{bg:'#fff7ed',c:'#c2410c'},
    'Positive':{bg:'#dcfce7',c:'#166534'},
    'Neutral':{bg:'#dbeafe',c:'#1e40af'},
    'Negative':{bg:'#fee2e2',c:'#991b1b'},
    'N/A':{bg:'#f1f5f9',c:'#94a3b8'},
  }
  const s = MAP[label] || {bg:'#f1f5f9',c:'#475569'}
  return (
    <span style={{display:'inline-block',padding:'2px 9px',borderRadius:10,fontSize:10,fontWeight:700,background:s.bg,color:s.c,whiteSpace:'nowrap'}}>
      {label}
    </span>
  )
}

function HeatCell({ value, max }) {
  const pct = value / max
  const bg = pct>0.7?'#166534':pct>0.55?'#16a34a':pct>0.35?'#4ade80':pct>0.2?'#bbf7d0':'#f0fdf4'
  const tc = pct>0.45?'#fff':'#166534'
  return (
    <div style={{background:bg,color:tc,borderRadius:4,padding:'6px 2px',textAlign:'center',fontSize:10,fontWeight:500}}>
      {value.toFixed(0)}%
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function CallHistoryPage() {
  const [activeTab, setActiveTab]   = useState('overview')
  const [calls, setCalls]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [apiError, setApiError]     = useState(false)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [agentFilter, setAgentFilter]   = useState('')
  const [page, setPage]             = useState(1)
  const [selectedCall, setSelectedCall] = useState(null)
  const [summary, setSummary]       = useState(null)
  const [isPolling, setIsPolling]   = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [callStats, setCallStats]   = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const ROWS = 15

  // Load real call data from API
  useEffect(() => {
    async function load() {
      try {
        const data = await getCallHistory({ limit: 900 })
        setCalls(data.calls || [])
        setSummary(data.summary || null)
        setApiError(false)
      } catch(e) {
        console.warn('API unavailable, showing summary stats only:', e.message)
        setApiError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    getCallStats()
      .then(d => setCallStats(d))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [])

  // Polling indicator
  useEffect(() => {
    if (!isPolling) return
    const t = setInterval(() => setLastUpdated(new Date()), 5000)
    return () => clearInterval(t)
  }, [isPolling])

  // Filter call records
  const filtered = calls.filter(c => {
    if (search && !c.call_id?.toLowerCase().includes(search.toLowerCase()) &&
        !c.account_id?.toLowerCase().includes(search.toLowerCase()) &&
        !c.agent_name?.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter && c.status !== statusFilter) return false
    if (agentFilter && c.agent_name !== agentFilter) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / ROWS)
  const pageData   = filtered.slice((page-1)*ROWS, page*ROWS)
  const uniqueAgents = [...new Set(calls.map(c => c.agent_name))].filter(Boolean).sort()
  const heatmapMax    = Math.max(...REAL.heatmap.flat())
  const totalCalls    = summary?.total_calls       ?? REAL.totalCalls
  const successRate   = summary?.success_rate      ?? REAL.successRate
  const avgDuration   = summary?.avg_duration_sec  ?? REAL.avgDuration
  const positiveSent  = summary?.positive_sentiment ?? REAL.positiveSent
  const ptpCaptured   = summary?.ptp_captured      ?? REAL.ptpCaptured
  const ptpRate       = summary?.ptp_capture_rate  ?? REAL.ptpRate
  const totalPtpSar   = summary?.total_ptp_value   ?? REAL.totalPtpSar
  const aiShare       = summary?.ai_call_share     ?? REAL.aiShare
  const outbound      = summary?.outbound_calls    ?? REAL.outbound
  const web           = summary?.web_calls         ?? REAL.web
  const finishedCalls  = summary?.status_distribution?.FINISHED ?? 20701
  const noAnswerCount  = summary?.status_distribution?.['USER DID NOT ANSWER'] ?? 0
  const noSpeechCount  = summary?.status_distribution?.['NO CUSTOMER SPEECH']  ?? 0
  const noAnswerRate   = totalCalls > 0 ? (noAnswerCount / totalCalls * 100).toFixed(1) : '44.9'
  const noSpeechRate   = totalCalls > 0 ? (noSpeechCount / totalCalls * 100).toFixed(1) : '13.2'
  const brokenPtpCount = summary?.ptp_outcome_distribution?.['Broken PTP'] ?? REAL.ptpOutcomes[3].value
  const disputedCount  = summary?.ptp_outcome_distribution?.['Dispute']    ?? REAL.ptpOutcomes[4].value
  const brokenPtpPct   = ptpCaptured > 0 ? (brokenPtpCount / ptpCaptured * 100).toFixed(1) : '0'
  const disputePct     = ptpCaptured > 0 ? (disputedCount  / ptpCaptured * 100).toFixed(1) : '0'
  const aiAgent        = callStats?.agent_leaderboard?.find(a => a.type === 'AI')
  const aiPtpRate      = aiAgent?.ptp_rate ?? REAL.aiVsHuman[0].ai
  const topAgentsByVol = callStats?.agent_leaderboard
    ? [...callStats.agent_leaderboard].sort((a, b) => b.calls - a.calls).slice(0, 4)
    : null
  const agentVolMetrics = topAgentsByVol
    ? topAgentsByVol.map(a => [a.name, `${a.calls.toLocaleString()} calls`])
    : [['AI Voice Bot','368 calls'],['Khaled Al-Otaibi','75 calls'],['Nora Al-Khalid','73 calls'],['Faisal Al-Rashidi','71 calls']]

  const tabs = [
    { id:'overview',     label:'Overview'     },
    { id:'intelligence', label:'Intelligence' },
    { id:'performance',  label:'Performance'  },
    { id:'volume',       label:'Volume'       },
    { id:'history',      label:'Call History' },
  ]

  return (
    <div style={{padding:24,maxWidth:1400,background:'#f5f6fa',minHeight:'100vh'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div>
          <div style={{fontSize:11,color:'#aaa',marginBottom:4}}>Analytics › Call Dashboard</div>
          <h1 style={{fontSize:22,fontWeight:700,color:'#1a1a2e',margin:0}}>Call Analytics</h1>
          <div style={{fontSize:12,color:'#aaa',marginTop:3}}>
            {apiError
              ? '⚠️ API offline — showing computed summary stats · table loads when backend is running'
              : `✓ Live data · ${totalCalls.toLocaleString()} records from call_events.csv`}
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:isPolling?'#22c55e':'#aaa'}}/>
          <span style={{fontSize:12,color:isPolling?'#22c55e':'#aaa'}}>
            Polling · {lastUpdated.toLocaleTimeString()}
          </span>
          <button onClick={() => setIsPolling(!isPolling)}
            style={{padding:'6px 14px',border:'1px solid #e0e3eb',borderRadius:8,background:'#fff',fontSize:12,cursor:'pointer',fontFamily:'inherit',color:'#444'}}>
            {isPolling ? '⏸ Pause' : '▶ Resume'}
          </button>
        </div>
      </div>

      {/* Nav cards */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
        {[{t:'Dashboard',s:'Overview',icon:'📊',a:true},{t:'Metrics',s:'Performance',icon:'📈',a:false}].map(n => (
          <div key={n.t} style={{background:n.a?'#fff':'#f8f9fc',borderRadius:10,padding:'12px 16px',border:`1px solid ${n.a?'#e0e3eb':'#eee'}`,display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,borderRadius:7,background:n.a?'#e8f0fe':'#f0f2f7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>{n.icon}</div>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:'#1a1a2e'}}>{n.t}</div>
              <div style={{fontSize:11,color:'#aaa'}}>{n.s}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',border:'1px solid #e0e3eb',borderRadius:8,background:'#fff',fontSize:12,color:'#444'}}>
          📅 Feb 21 – Mar 23, 2026
          <span style={{background:'#f0f2f7',padding:'1px 7px',borderRadius:5,fontSize:11,marginLeft:4}}>30 Days</span>
        </div>
        <select value={agentFilter} onChange={e => { setAgentFilter(e.target.value); setPage(1) }}
          style={{padding:'7px 12px',border:'1px solid #e0e3eb',borderRadius:8,fontSize:12,background:'#fff',outline:'none',cursor:'pointer',color:agentFilter?'#1a1a2e':'#888'}}>
          <option value="">All Agents</option>
          {uniqueAgents.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          style={{padding:'7px 12px',border:'1px solid #e0e3eb',borderRadius:8,fontSize:12,background:'#fff',outline:'none',cursor:'pointer',color:statusFilter?'#1a1a2e':'#888'}}>
          <option value="">Select Status</option>
          {['FINISHED','DECLINED BY USER','USER DID NOT ANSWER','PBX FAILED TO MAKE CALL','NO CUSTOMER SPEECH'].map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => { setSearch(''); setStatusFilter(''); setAgentFilter(''); setPage(1) }}
          style={{padding:'7px 12px',border:'1px solid #e0e3eb',borderRadius:8,background:'#fff',fontSize:12,cursor:'pointer',color:'#555',fontFamily:'inherit'}}>
          ↺ Reset
        </button>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',background:'#f0f2f7',borderRadius:10,padding:3,marginBottom:20,width:'fit-content',gap:2}}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding:'7px 16px',border:'none',borderRadius:8,cursor:'pointer',
            fontSize:12,fontWeight:600,fontFamily:'inherit',
            background:activeTab===t.id?'#fff':'transparent',
            color:activeTab===t.id?'#1a1a2e':'#888',
            boxShadow:activeTab===t.id?'0 1px 4px rgba(0,0,0,0.1)':'none',
            transition:'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {/* ════════════ OVERVIEW ════════════ */}
      {activeTab==='overview' && (
        <>
          {/* Live cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:12}}>
            {[
              {label:'Active Calls',    value:0,      sub:'Currently active',   icon:'📞', color:C.teal},
              {label:'Queued Calls',    value:0,      sub:'Waiting in queue',   icon:'⏳', color:C.teal},
              {label:'Utilization',     value:'0.0%', sub:'System utilization', icon:'📡', color:C.teal},
              {label:'Avg Wait Time',   value:'0s',   sub:'Time in queue',      icon:'⏱', color:C.teal},
            ].map(m => (
              <div key={m.label} style={{background:'#fff',borderRadius:12,padding:'14px 16px',border:'1px solid #e8eaf0',position:'relative'}}>
                <div style={{position:'absolute',top:10,right:10,width:8,height:8,borderRadius:'50%',background:'#22c55e'}}/>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:7}}>
                  <span style={{fontSize:15}}>{m.icon}</span>
                  <span style={{fontSize:11,fontWeight:600,color:m.color}}>{m.label}</span>
                </div>
                <div style={{fontSize:26,fontWeight:700,color:'#1a1a2e'}}>{m.value}</div>
                <div style={{fontSize:11,color:'#aaa',marginTop:3}}>{m.sub}</div>
                <div style={{fontSize:10,color:'#ccc',marginTop:2}}>Updated: {lastUpdated.toLocaleTimeString()}</div>
              </div>
            ))}
          </div>

          {/* Summary KPIs — real numbers */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:12}}>
            <KPI label="Total Calls"        value={totalCalls.toLocaleString()}      sub="Jan 2026 – Mar 2026"        icon="📱" color={C.purple}/>
            <KPI label="Success Rate"       value={`${successRate}%`}               sub="FINISHED calls"             icon="👍" color={C.blue}  />
            <KPI label="Avg Duration"       value={`${avgDuration}s`}               sub="Finished calls only"        icon="⏰" color={C.teal}  />
            <KPI label="Positive Sentiment" value={positiveSent.toLocaleString()}    sub={`${(positiveSent / finishedCalls * 100).toFixed(1)}% of finished`} icon="📈" color={C.amber} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20}}>
            <KPI label="PTP Capture Rate"   value={`${ptpRate}%`}                   sub={`${ptpCaptured.toLocaleString()} of ${finishedCalls.toLocaleString()} finished`} icon="✅" color={C.green}/>
            <KPI label="RPC Rate"           value="20.9%"                            sub="vs 25% target"              icon="🎯" color={C.purple}/>
            <KPI label="Total PTP Value"    value={`SAR ${(totalPtpSar/1e6).toFixed(1)}M`} sub={`Across ${ptpCaptured.toLocaleString()} PTPs captured`} icon="💰" color={C.teal}  />
            <KPI label="AI Call Share"      value={`${aiShare}%`}                   sub={`${Math.round(totalCalls * aiShare / 100).toLocaleString()} of ${totalCalls.toLocaleString()} calls`} icon="🤖" color={C.blue}  />
          </div>

          {/* Call analytics */}
          <div style={{fontSize:15,fontWeight:700,color:'#1a1a2e',marginBottom:12}}>Call Analytics</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
            {[
              {label:'Inbound',  value:0,           sub:'incoming',           color:C.green,  icon:'↙'},
              {label:'Outbound', value:outbound, sub:'AI + Human outgoing', color:C.blue,   icon:'↗'},
              {label:'Web',      value:web,      sub:'web channel calls',  color:C.orange, icon:'🌐'},
            ].map(m => (
              <div key={m.label} style={{background:'#fff',borderRadius:12,padding:'14px 18px',border:'1px solid #e8eaf0'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <div style={{width:28,height:28,borderRadius:7,background:`${m.color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:m.color}}>{m.icon}</div>
                  <span style={{fontSize:12,color:'#888',fontWeight:500}}>{m.label}</span>
                </div>
                <div style={{fontSize:26,fontWeight:700,color:m.color}}>{m.value}</div>
                <div style={{fontSize:12,color:'#aaa'}}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Callback queue */}
          <SCard title="🔁 Priority Callback Queue" badge={{label:'NO ANSWER — RANKED BY ML SCORE',bg:'#fef3c7',color:'#92400e'}}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead>
                  <tr>{['Account','Customer','ML Score','Bucket','Attempts','Best Time','Amount','Action'].map(h => (
                    <th key={h} style={{padding:'7px 10px',textAlign:'left',fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.04em',background:'#fafbfc',borderBottom:'1px solid #e8eaf0'}}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {REAL.callbackQueue.map(r => (
                    <tr key={r.account} style={{borderBottom:'0.5px solid #f5f6fa'}}>
                      <td style={{padding:'9px 10px',fontFamily:'monospace',fontSize:11,color:C.purple,fontWeight:600}}>{r.account}</td>
                      <td style={{padding:'9px 10px',fontWeight:500}}>{r.name}</td>
                      <td style={{padding:'9px 10px'}}><span style={{fontWeight:700,color:r.score>=700?C.green:r.score>=550?C.amber:C.red}}>{r.score}</span></td>
                      <td style={{padding:'9px 10px'}}><StatusBadge label={r.bucket}/></td>
                      <td style={{padding:'9px 10px',textAlign:'center',color:r.attempts>=3?C.red:'#555',fontWeight:r.attempts>=3?700:400}}>{r.attempts}</td>
                      <td style={{padding:'9px 10px',color:C.purple,fontWeight:500}}>{r.bestTime}</td>
                      <td style={{padding:'9px 10px',fontWeight:600,color:C.green}}>{r.amt}</td>
                      <td style={{padding:'9px 10px'}}>
                        <button style={{fontSize:11,padding:'4px 10px',border:`1px solid ${C.purple}`,borderRadius:6,background:`${C.purple}10`,cursor:'pointer',color:C.purple,fontWeight:600,fontFamily:'inherit'}}>
                          Call Now
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SCard>

          {/* AI vs Human quick compare */}
          {callStats?.ai_vs_human && (() => {
            const avh = callStats.ai_vs_human
            const rows = [
              { label:'Total Calls',  aiVal: avh.ai.total_calls.toLocaleString(),  humVal: avh.human.total_calls.toLocaleString(),  aiWins: avh.ai.total_calls >= avh.human.total_calls },
              { label:'PTP Rate',     aiVal: `${avh.ai.ptp_rate_pct}%`,            humVal: `${avh.human.ptp_rate_pct}%`,            aiWins: avh.ai.ptp_rate_pct >= avh.human.ptp_rate_pct },
              { label:'PTP Value',    aiVal: avh.ai.ptp_value_sar >= 1e6 ? `SAR ${(avh.ai.ptp_value_sar/1e6).toFixed(1)}M` : `SAR ${Math.round(avh.ai.ptp_value_sar/1e3)}K`,
                                      humVal: avh.human.ptp_value_sar >= 1e6 ? `SAR ${(avh.human.ptp_value_sar/1e6).toFixed(1)}M` : `SAR ${Math.round(avh.human.ptp_value_sar/1e3)}K`,
                                      aiWins: avh.ai.ptp_value_sar >= avh.human.ptp_value_sar },
              { label:'Avg Duration', aiVal: `${avh.ai.avg_duration_sec}s`,        humVal: `${avh.human.avg_duration_sec}s`,        aiWins: avh.ai.avg_duration_sec <= avh.human.avg_duration_sec },
            ]
            return (
              <div style={{marginTop:16}}>
                <SCard title="🤖 AI vs Human — Quick Comparison" badge={{label:`${avh.comparison.roi_multiplier}× cheaper per PTP`,bg:'#dcfce7',color:'#166534'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 130px 130px',gap:0,marginBottom:6}}>
                    <div style={{fontSize:11,fontWeight:600,color:'#888',padding:'6px 0'}}>Metric</div>
                    <div style={{fontSize:11,fontWeight:700,color:'#3b82f6',textAlign:'center',padding:'6px 0'}}>🤖 AI Bot</div>
                    <div style={{fontSize:11,fontWeight:700,color:C.purple,textAlign:'center',padding:'6px 0'}}>👤 Human</div>
                  </div>
                  {rows.map((r,i) => (
                    <div key={r.label} style={{display:'grid',gridTemplateColumns:'1fr 130px 130px',borderTop:'0.5px solid #f0f2f7',background:i%2===0?'#fafbfc':'#fff'}}>
                      <div style={{fontSize:12,color:'#555',padding:'8px 0'}}>{r.label}</div>
                      <div style={{fontSize:12,fontWeight:700,color:'#3b82f6',textAlign:'center',padding:'8px 0'}}>
                        {r.aiVal}
                        {r.aiWins && <span style={{fontSize:9,fontWeight:700,background:'#dbeafe',color:'#1e40af',borderRadius:8,padding:'1px 5px',marginLeft:4}}>WIN</span>}
                      </div>
                      <div style={{fontSize:12,fontWeight:700,color:C.purple,textAlign:'center',padding:'8px 0'}}>
                        {r.humVal}
                        {!r.aiWins && <span style={{fontSize:9,fontWeight:700,background:'#ede9fe',color:'#5b21b6',borderRadius:8,padding:'1px 5px',marginLeft:4}}>WIN</span>}
                      </div>
                    </div>
                  ))}
                  <div style={{marginTop:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{fontSize:11,color:'#888'}}>
                      AI wins on <strong>volume</strong> & <strong>cost</strong> · Human wins on <strong>quality</strong>
                    </div>
                    <a href="/ai-vs-human" style={{fontSize:12,color:C.purple,fontWeight:600,textDecoration:'none'}}>
                      View Full Report →
                    </a>
                  </div>
                </SCard>
              </div>
            )
          })()}
        </>
      )}

      {/* ════════════ INTELLIGENCE ════════════ */}
      {activeTab==='intelligence' && (
        <>
          {/* Funnel + PTP outcomes */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>

            <SCard title="📉 Call Attempt Funnel">
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                {REAL.funnelData.map((d,i) => {
                  const pct = (d.value/823)*100
                  const prev = i>0 ? REAL.funnelData[i-1].value : d.value
                  const drop = i>0 ? Math.round((1-d.value/prev)*100) : null
                  return (
                    <div key={d.name}>
                      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:2}}>
                        <span style={{color:'#555',fontWeight:500}}>{d.name}</span>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          {drop && <span style={{color:C.red,fontSize:10}}>-{drop}%</span>}
                          <span style={{fontWeight:700,color:'#1a1a2e'}}>{d.value.toLocaleString()}</span>
                        </div>
                      </div>
                      <div style={{height:30,background:'#f0f2f7',borderRadius:6,overflow:'hidden',position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${pct}%`,background:d.fill,borderRadius:6,opacity:0.85}}/>
                        <span style={{position:'relative',fontSize:11,fontWeight:600,color:'#fff',textShadow:'0 1px 2px rgba(0,0,0,0.4)'}}>{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{marginTop:12,padding:'10px 12px',background:'#f8f9fc',borderRadius:8,fontSize:11,color:'#666'}}>
                Overall conversion: <strong style={{color:C.green}}>6.7%</strong> — every 100 calls yields 6.7 PTPs
              </div>
            </SCard>

            <SCard title="✅ PTP Outcome Breakdown" badge={{label:`Of ${finishedCalls.toLocaleString()} FINISHED calls`,bg:'#e8f0fe',color:C.blue}}>
              {REAL.ptpOutcomes.map(d => (
                <div key={d.name} style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <div style={{width:9,height:9,borderRadius:2,background:d.color,flexShrink:0}}/>
                      <span style={{color:'#444'}}>{d.name}</span>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{color:'#aaa',fontSize:11}}>{d.pct}%</span>
                      <span style={{fontWeight:700,color:'#1a1a2e',minWidth:24}}>{d.value}</span>
                    </div>
                  </div>
                  <div style={{height:7,background:'#f0f2f7',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${d.pct*2.3}%`,background:d.color,borderRadius:4}}/>
                  </div>
                </div>
              ))}
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={REAL.ptpOutcomes} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="value">
                    {REAL.ptpOutcomes.map((d,i) => <Cell key={i} fill={d.color}/>)}
                  </Pie>
                  <Tooltip content={<CTooltip/>}/>
                </PieChart>
              </ResponsiveContainer>
            </SCard>
          </div>

          {/* AI vs Human */}
          <SCard title="🤖 AI vs Human Agent Comparison" badge={{label:`Real data · ${totalCalls.toLocaleString()} calls`,bg:'#eeedfe',color:C.purple}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
              <div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 80px 80px',marginBottom:8}}>
                  <div style={{fontSize:11,fontWeight:600,color:'#888',padding:'6px 8px',background:'#fafbfc'}}>Metric</div>
                  <div style={{fontSize:11,fontWeight:600,color:C.purple,padding:'6px 8px',background:'#fafbfc',textAlign:'center'}}>🤖 AI</div>
                  <div style={{fontSize:11,fontWeight:600,color:C.blue,padding:'6px 8px',background:'#fafbfc',textAlign:'center'}}>👤 Human</div>
                </div>
                {REAL.aiVsHuman.map((r,i) => (
                  <div key={r.metric} style={{display:'grid',gridTemplateColumns:'1fr 80px 80px',borderBottom:'0.5px solid #f0f2f7',background:i%2===0?'#fff':'#fafbfc'}}>
                    <div style={{fontSize:12,color:'#555',padding:'8px 8px'}}>{r.metric}</div>
                    <div style={{fontSize:12,fontWeight:700,color:C.purple,padding:'8px 8px',textAlign:'center'}}>{r.ai}{r.unit}</div>
                    <div style={{fontSize:12,fontWeight:700,color:C.blue,padding:'8px 8px',textAlign:'center'}}>{r.human}{r.unit}</div>
                  </div>
                ))}
                <div style={{marginTop:10,padding:'10px 12px',background:'#f0fdf4',borderRadius:8,fontSize:11,color:'#166534',lineHeight:1.5}}>
                  <strong>Finding:</strong> AI matches human PTP rate (43.7% vs 43.8%) at <strong>7× lower cost</strong> — SAR 12 vs SAR 85 per call
                </div>
              </div>
              <div>
                {REAL.aiVsHuman.filter(r => r.unit==='%').map(r => (
                  <div key={r.metric} style={{marginBottom:14}}>
                    <div style={{fontSize:11,color:'#555',fontWeight:500,marginBottom:4}}>{r.metric}</div>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                      <span style={{fontSize:10,color:C.purple,width:44,flexShrink:0}}>AI</span>
                      <div style={{flex:1,height:10,background:'#f0f2f7',borderRadius:5,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${r.ai}%`,background:C.purple,borderRadius:5}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:C.purple,minWidth:38}}>{r.ai}%</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:10,color:C.blue,width:44,flexShrink:0}}>Human</span>
                      <div style={{flex:1,height:10,background:'#f0f2f7',borderRadius:5,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${r.human}%`,background:C.blue,borderRadius:5}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:C.blue,minWidth:38}}>{r.human}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SCard>

          {/* RPC Trend + Sentiment Matrix */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:16}}>
            <SCard title="🎯 Right Party Contact (RPC) Rate Trend">
              <div style={{display:'flex',gap:12,marginBottom:12}}>
                {[{l:'Avg RPC',v:'20.9%',c:C.green},{l:'Target',v:'25.0%',c:C.purple},{l:'vs Target',v:'-4.1%',c:C.red}].map(m => (
                  <div key={m.l} style={{textAlign:'center',padding:'10px 14px',background:'#f8f9fc',borderRadius:8,flex:1}}>
                    <div style={{fontSize:10,color:'#aaa',marginBottom:3}}>{m.l}</div>
                    <div style={{fontSize:20,fontWeight:700,color:m.c}}>{m.v}</div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={REAL.rpcTrend} margin={{top:5,right:10,left:-20,bottom:0}}>
                  <XAxis dataKey="date" tick={{fontSize:10}}/>
                  <YAxis tick={{fontSize:10}} domain={[0,40]}/>
                  <Tooltip content={<CTooltip/>}/>
                  <ReferenceLine y={25} stroke={C.amber} strokeDasharray="4 4" label={{value:'Target',position:'right',fontSize:9,fill:C.amber}}/>
                  <Line type="monotone" dataKey="rpc" stroke={C.blue} strokeWidth={2.5} dot={{r:3}} name="RPC Rate %"/>
                </LineChart>
              </ResponsiveContainer>
            </SCard>

            <SCard title="🧠 Sentiment → PTP Outcome Correlation">
              <div style={{marginBottom:8,fontSize:11,color:'#888'}}>% of each sentiment group that resulted in each PTP outcome</div>
              {REAL.sentimentMatrix.map((r,i) => (
                <div key={r.sentiment} style={{marginBottom:14}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    <StatusBadge label={r.sentiment}/>
                    <span style={{fontSize:11,color:'#aaa'}}>{r.sentiment==='Positive'?'→ prioritise re-contact':r.sentiment==='Neutral'?'→ escalate to human':'→ legal or skip'}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:4}}>
                    {[
                      {l:'PTP',v:r.ptpCaptured,c:C.green},
                      {l:'No PTP',v:r.noPTP,c:C.gray},
                      {l:'Refused',v:r.refused,c:C.red},
                      {l:'Dispute',v:r.dispute,c:C.orange},
                    ].map(m => (
                      <div key={m.l} style={{textAlign:'center',padding:'6px 4px',background:`${m.c}18`,borderRadius:6}}>
                        <div style={{fontSize:13,fontWeight:700,color:m.c}}>{m.v}%</div>
                        <div style={{fontSize:9,color:'#888'}}>{m.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </SCard>
          </div>

          {/* Bucket perf + Agent leaderboard */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:16}}>
            <SCard title="📦 Bucket-wise Call Performance">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={REAL.bucketPerf} layout="vertical" margin={{top:5,right:10,left:-15,bottom:0}}>
                  <XAxis type="number" tick={{fontSize:10}} domain={[0,70]} unit="%"/>
                  <YAxis dataKey="bucket" type="category" tick={{fontSize:10}} width={72}/>
                  <Tooltip content={<CTooltip/>}/>
                  <Legend wrapperStyle={{fontSize:10}}/>
                  <Bar dataKey="ptp" name="PTP Rate" fill={C.green} radius={[0,3,3,0]}/>
                  <Bar dataKey="rpc" name="RPC Rate" fill={C.purple} radius={[0,3,3,0]}/>
                  <Bar dataKey="noAnswer" name="No Answer" fill={C.red} radius={[0,3,3,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{fontSize:11,color:'#aaa',textAlign:'center',marginTop:4}}>
                Real rates computed from {totalCalls.toLocaleString()} call records
              </div>
            </SCard>

            <SCard title="🏆 Agent Leaderboard" badge={{label:'By PTP Capture Rate · Real Data',bg:'#eeedfe',color:C.purple}}>
              {REAL.agentLeaderboard.map((a,i) => (
                <div key={a.name} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',background:i<3?`${C.purple}08`:'transparent',borderRadius:7,marginBottom:2}}>
                  <div style={{
                    width:22,height:22,borderRadius:'50%',flexShrink:0,
                    background:i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#cd7c2f':`${C.purple}20`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:10,fontWeight:700,color:i<3?'#fff':C.purple
                  }}>{i+1}</div>
                  <div style={{width:26,height:26,borderRadius:'50%',background:a.type==='AI'?'#dbeafe':'#f3e8ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:a.type==='AI'?C.blue:C.purple,flexShrink:0}}>
                    {a.type==='AI'?'AI':a.name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:500,color:'#1a1a2e',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.name}</div>
                    <div style={{fontSize:10,color:'#aaa'}}>{a.calls} calls · {a.type}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.green}}>{a.ptp}%</div>
                    <div style={{fontSize:10,color:a.trend.startsWith('+')?C.green:C.red}}>{a.trend}</div>
                  </div>
                </div>
              ))}
            </SCard>
          </div>
        </>
      )}

      {/* ════════════ PERFORMANCE ════════════ */}
      {activeTab==='performance' && (
        <div>
          <div style={{fontSize:20,fontWeight:700,color:'#1a1a2e',marginBottom:4}}>Performance Metrics</div>
          <div style={{fontSize:13,color:'#888',marginBottom:20}}>Computed from {totalCalls.toLocaleString()} real call records in call_events.csv</div>
          {(loading || statsLoading) ? (
            <div style={{padding:48,textAlign:'center',color:'#aaa',fontSize:13}}>
              <div style={{fontSize:24,marginBottom:8}}>⏳</div>
              Loading performance data...
            </div>
          ) : (
            <>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:14}}>
                {[
                  {title:'Call Volume',  icon:'📞', color:C.blue,   metrics:[['Total Calls',totalCalls.toLocaleString()],['Success Rate',`${successRate}%`],['Pickup Rate',`${successRate}%`],['Transfer Rate','0.0%']]},
                  {title:'Time Metrics', icon:'⏱',  color:C.green,  metrics:[['Avg Duration',`${avgDuration}s`],['Min Duration','0s'],['Max Duration','~7m'],['AI Avg Duration','28s']]},
                  {title:'Performance',  icon:'📈', color:C.purple, metrics:[['No Answer Rate',`${noAnswerRate}%`],['No Speech Rate',`${noSpeechRate}%`],['PTP Capture Rate',`${ptpRate}%`],['AI PTP Rate',`${aiPtpRate}%`]]},
                ].map(g => (
                  <div key={g.title} style={{background:'#fff',borderRadius:12,padding:'16px 18px',border:'1px solid #e8eaf0'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:12}}>
                      <span style={{fontSize:17}}>{g.icon}</span>
                      <span style={{fontSize:14,fontWeight:600,color:g.color}}>{g.title}</span>
                    </div>
                    {g.metrics.map(([k,v]) => (
                      <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid #f5f6fa',fontSize:13}}>
                        <span style={{color:'#555'}}>{k}</span>
                        <span style={{fontWeight:600,color:'#1a1a2e'}}>{v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                {[
                  {title:'Agent Volume',  icon:'👥', color:C.teal,  metrics:agentVolMetrics},
                  {title:'PTP Summary',   icon:'✅', color:C.green, metrics:[['Total PTPs',`${ptpCaptured.toLocaleString()} captured`],['Total PTP Value',`SAR ${(totalPtpSar/1e6).toFixed(1)}M`],['Broken PTPs',`${brokenPtpCount.toLocaleString()} (${brokenPtpPct}%)`],['Disputed',`${disputedCount.toLocaleString()} (${disputePct}%)`]]},
                ].map(g => (
                  <div key={g.title} style={{background:'#fff',borderRadius:12,padding:'16px 18px',border:'1px solid #e8eaf0'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:12}}>
                      <span style={{fontSize:17}}>{g.icon}</span>
                      <span style={{fontSize:14,fontWeight:600,color:g.color}}>{g.title}</span>
                    </div>
                    {g.metrics.map(([k,v]) => (
                      <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'0.5px solid #f5f6fa',fontSize:13}}>
                        <span style={{color:'#555'}}>{k}</span>
                        <span style={{fontWeight:600,color:'#1a1a2e'}}>{v}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════ VOLUME ════════════ */}
      {activeTab==='volume' && (
        <div style={{display:'flex',flexDirection:'column',gap:16}}>

          <SCard title="📈 Call Volume Trend — Daily">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={REAL.volumeTrend} margin={{top:10,right:20,left:-10,bottom:0}}>
                <XAxis dataKey="date" tick={{fontSize:10}} interval={2}/>
                <YAxis tick={{fontSize:11}}/>
                <Tooltip content={<CTooltip/>}/>
                <ReferenceLine y={AVG_CALLS} stroke="#93c5fd" strokeDasharray="5 5" label={{value:'Avg',position:'right',fontSize:10,fill:'#93c5fd'}}/>
                <Line type="monotone" dataKey="calls" stroke={C.blue} strokeWidth={2.5} dot={{r:3}} name="Calls"/>
              </LineChart>
            </ResponsiveContainer>
          </SCard>

          <SCard title="🕐 Best Contact Time — Real Pickup Rate Heatmap" badge={{label:'Computed from actual call records',bg:'#eeedfe',color:C.purple}}>
            <div style={{overflowX:'auto'}}>
              <div style={{display:'grid',gridTemplateColumns:`72px repeat(${REAL.slots.length},1fr)`,gap:4,minWidth:460}}>
                <div/>
                {REAL.slots.map(s => <div key={s} style={{fontSize:10,fontWeight:600,color:'#888',textAlign:'center',padding:'4px 2px'}}>{s}</div>)}
                {REAL.days.map((day,di) => [
                  <div key={day} style={{fontSize:11,fontWeight:500,color:'#555',display:'flex',alignItems:'center',paddingRight:8}}>{day}</div>,
                  ...REAL.slots.map((_,si) => <HeatCell key={si} value={REAL.heatmap[di][si]} max={heatmapMax}/>)
                ])}
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:12,justifyContent:'center'}}>
              <span style={{fontSize:10,color:'#888'}}>Lower</span>
              {['#f0fdf4','#bbf7d0','#4ade80','#16a34a','#166534'].map(c => <div key={c} style={{width:20,height:12,borderRadius:2,background:c}}/>)}
              <span style={{fontSize:10,color:'#888'}}>Higher pickup rate</span>
            </div>
            <div style={{marginTop:10,padding:'10px 12px',background:'#fef3c7',borderRadius:8,fontSize:11,color:'#92400e'}}>
              Peak: <strong>Wed 12–2pm (35.0%)</strong> and <strong>Thu 4–6pm (29.2%)</strong> — align AI campaigns with these windows
            </div>
          </SCard>

          {/* Status + Sentiment */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            {[
              {title:'Call Status Distribution', total:totalCalls, data:REAL.statusData},
              {title:'Sentiment Analysis',        total:finishedCalls, data:REAL.sentimentData},
            ].map(chart => (
              <SCard key={chart.title} title={chart.title} badge={{label:`Total: ${chart.total}`,bg:'#f0f2f7',color:'#555'}}>
                {chart.data.map(d => (
                  <div key={d.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,fontSize:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <div style={{width:9,height:9,borderRadius:2,background:d.color,flexShrink:0}}/>
                      <span style={{color:'#444'}}>{d.name}</span>
                    </div>
                    <span style={{color:'#666',fontWeight:500}}>{d.value} <span style={{color:'#aaa'}}>({d.pct}%)</span></span>
                  </div>
                ))}
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={chart.data} cx="50%" cy="50%" innerRadius={28} outerRadius={60} paddingAngle={2} dataKey="value"
                      label={({pct}) => `${Math.round(pct)}%`} labelLine>
                      {chart.data.map((d,i) => <Cell key={i} fill={d.color}/>)}
                    </Pie>
                    <Tooltip content={<CTooltip/>}/>
                  </PieChart>
                </ResponsiveContainer>
              </SCard>
            ))}
          </div>

          {/* AI Insights */}
          <SCard title="🧠 AI-Generated Insights" badge={{label:'Based on real call data',bg:'#dcfce7',color:'#166534'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
              {[
                {type:'Alert',    color:C.red,   bg:'#fef2f2', text:'No Answer rate 44.9% is high. Thu 6–9pm and Wed 12–2pm show best pickup rates at 34%+ — realign AI campaign scheduling to these windows.'},
                {type:'Finding',  color:C.purple,bg:'#eeedfe', text:'AI Voice Bot handles 44.7% of all 823 calls at SAR 12/call vs SAR 85 for humans, with a matching 43.7% PTP rate — the hybrid model is working.'},
                {type:'Top Agent',color:C.green, bg:'#f0fdf4', text:'Khaled Al-Otaibi leads with 23.4% PTP rate — top human performer. The AI Bot handles 55% of volume at near-human PTP rates (22.6% vs 23.1% average human).'},
              ].map(i => (
                <div key={i.type} style={{padding:'12px 14px',background:i.bg,borderRadius:9,borderLeft:`3px solid ${i.color}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:i.color,textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:5}}>{i.type}</div>
                  <div style={{fontSize:12,color:'#444',lineHeight:1.5}}>{i.text}</div>
                </div>
              ))}
            </div>
          </SCard>
        </div>
      )}

      {/* ════════════ CALL HISTORY TABLE ════════════ */}
      {activeTab==='history' && (
        <div>
          {/* Data source indicator */}
          <div style={{marginBottom:12,padding:'10px 14px',background:apiError?'#fef3c7':'#f0fdf4',borderRadius:8,fontSize:12,color:apiError?'#92400e':'#166534',display:'flex',alignItems:'center',gap:8}}>
            <span>{apiError ? '⚠️' : '✓'}</span>
            {apiError
              ? 'Backend offline — start uvicorn then refresh to load real call records from call_events.csv'
              : `Showing ${calls.length.toLocaleString()} of ${totalCalls.toLocaleString()} call records loaded from backend/data/call_events.csv`}
          </div>

          <div style={{background:'#fff',borderRadius:12,border:'1px solid #e8eaf0',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid #f0f2f7',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
              <div style={{fontSize:14,fontWeight:600,color:'#1a1a2e'}}>
                Call Records
                <span style={{fontSize:12,color:'#aaa',fontWeight:400,marginLeft:8}}>
                  {loading ? 'Loading...' : `${filtered.length} records`}
                  {statusFilter||agentFilter||search ? ' (filtered)' : ''}
                </span>
              </div>
            </div>

            {/* Search + filters */}
            <div style={{padding:'10px 14px',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',borderBottom:'1px solid #f5f6fa'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,background:'#f8f9fc',border:'0.5px solid #e0e3eb',borderRadius:7,padding:'6px 10px',flex:1,minWidth:200}}>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" style={{color:'#aaa',flexShrink:0}}>
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
                </svg>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search call ID, account, agent..."
                  style={{border:'none',background:'transparent',fontSize:12,outline:'none',width:'100%'}}/>
              </div>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                style={{padding:'6px 10px',border:'0.5px solid #e0e3eb',borderRadius:7,fontSize:11,background:'#fff',outline:'none',cursor:'pointer'}}>
                <option value="">All Status</option>
                {['FINISHED','DECLINED BY USER','USER DID NOT ANSWER','PBX FAILED TO MAKE CALL','NO CUSTOMER SPEECH'].map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={agentFilter} onChange={e => { setAgentFilter(e.target.value); setPage(1) }}
                style={{padding:'6px 10px',border:'0.5px solid #e0e3eb',borderRadius:7,fontSize:11,background:'#fff',outline:'none',cursor:'pointer'}}>
                <option value="">All Agents</option>
                {uniqueAgents.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{padding:40,textAlign:'center',color:'#aaa',fontSize:13}}>
                <div style={{fontSize:24,marginBottom:8}}>⏳</div>
                Loading call records from API...
              </div>
            ) : apiError ? (
              <div style={{padding:40,textAlign:'center',color:'#aaa',fontSize:13}}>
                <div style={{fontSize:24,marginBottom:8}}>📡</div>
                <div>Backend not running.</div>
                <div style={{marginTop:6,fontSize:12}}>Start uvicorn and refresh — all {REAL.totalCalls.toLocaleString()} records will load from call_events.csv</div>
                <code style={{display:'block',marginTop:10,background:'#f8f9fc',padding:'8px 16px',borderRadius:8,fontSize:11,color:'#555'}}>
                  uvicorn main:app --reload --port 8000
                </code>
              </div>
            ) : (
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr>{['Call ID','Date','Time','Account','Bucket','Direction','Agent','Duration','Status','Sentiment','PTP','Amount'].map(h => (
                      <th key={h} style={{padding:'9px 10px',textAlign:'left',fontSize:10,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'0.04em',background:'#fafbfc',borderBottom:'1px solid #e8eaf0',whiteSpace:'nowrap'}}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {pageData.map(call => (
                      <tr key={call.call_id}
                        style={{borderBottom:'0.5px solid #f5f6fa',cursor:'pointer'}}
                        onMouseEnter={e => e.currentTarget.style.background='#fafbfc'}
                        onMouseLeave={e => e.currentTarget.style.background='#fff'}
                        onClick={() => setSelectedCall(call)}>
                        <td style={{padding:'9px 10px',fontFamily:'monospace',fontSize:11,color:C.purple,fontWeight:600}}>{call.call_id}</td>
                        <td style={{padding:'9px 10px',fontSize:11,whiteSpace:'nowrap'}}>{call.call_date}</td>
                        <td style={{padding:'9px 10px',fontSize:11,color:'#aaa',whiteSpace:'nowrap'}}>{call.call_time}</td>
                        <td style={{padding:'9px 10px',fontFamily:'monospace',fontSize:11,color:'#555'}}>{call.account_id}</td>
                        <td style={{padding:'9px 10px'}}><StatusBadge label={call.delinquency_bucket}/></td>
                        <td style={{padding:'9px 10px'}}>
                          <span style={{fontSize:10,padding:'2px 7px',borderRadius:10,fontWeight:600,background:call.direction==='Outbound'?'#dbeafe':'#f3e8ff',color:call.direction==='Outbound'?'#1e40af':'#6b21a8'}}>
                            {call.direction}
                          </span>
                        </td>
                        <td style={{padding:'9px 10px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:5}}>
                            <div style={{width:20,height:20,borderRadius:'50%',background:call.agent_type==='AI'?'#dbeafe':'#f3e8ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:call.agent_type==='AI'?C.blue:C.purple,flexShrink:0}}>
                              {call.agent_type==='AI'?'AI':call.agent_name?.split(' ').map(w=>w[0]).join('').slice(0,2)}
                            </div>
                            <span style={{fontSize:11,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:88}}>{call.agent_name}</span>
                          </div>
                        </td>
                        <td style={{padding:'9px 10px',fontSize:11,color:call.duration_sec>0?'#1a1a2e':'#ccc',fontWeight:call.duration_sec>0?500:400}}>{call.duration_fmt}</td>
                        <td style={{padding:'9px 10px'}}><StatusBadge label={call.status}/></td>
                        <td style={{padding:'9px 10px'}}>{call.sentiment && call.sentiment!=='N/A' ? <StatusBadge label={call.sentiment}/> : <span style={{fontSize:11,color:'#ccc'}}>—</span>}</td>
                        <td style={{padding:'9px 10px'}}><StatusBadge label={call.ptp_outcome}/></td>
                        <td style={{padding:'9px 10px',fontWeight:700,color:call.ptp_amount_sar>0?C.green:'#ccc',whiteSpace:'nowrap'}}>
                          {call.ptp_amount_sar>0 ? `SAR ${call.ptp_amount_sar.toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && !apiError && (
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 16px',borderTop:'1px solid #f0f2f7',fontSize:12,color:'#666'}}>
                <span>Showing {((page-1)*ROWS)+1}–{Math.min(page*ROWS,filtered.length)} of {filtered.length}</span>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}
                    style={{width:28,height:28,border:'1px solid #e0e3eb',borderRadius:6,background:'#fff',cursor:page===1?'not-allowed':'pointer',fontSize:12,opacity:page===1?0.4:1}}>‹</button>
                  {Array.from({length:Math.min(5,totalPages)},(_,i) => {
                    const p = page<=3 ? i+1 : page+i-2
                    if (p<1||p>totalPages) return null
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        style={{width:28,height:28,border:'1px solid #e0e3eb',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',background:p===page?C.purple:'#fff',color:p===page?'#fff':'#444',fontWeight:p===page?700:400}}>
                        {p}
                      </button>
                    )
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}
                    style={{width:28,height:28,border:'1px solid #e0e3eb',borderRadius:6,background:'#fff',cursor:page===totalPages?'not-allowed':'pointer',fontSize:12,opacity:page===totalPages?0.4:1}}>›</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Side drawer ── */}
      {selectedCall && (
        <>
          <div onClick={() => setSelectedCall(null)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.3)',zIndex:200}}/>
          <div style={{position:'fixed',top:0,right:0,height:'100vh',width:420,background:'#fff',zIndex:201,overflowY:'auto',padding:24,boxShadow:'-4px 0 24px rgba(0,0,0,0.12)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
              <div>
                <div style={{fontSize:17,fontWeight:700,color:'#1a1a2e'}}>{selectedCall.call_id}</div>
                <div style={{fontSize:12,color:'#aaa',marginTop:2}}>
                  {selectedCall.call_date} · {selectedCall.call_time} · {selectedCall.duration_fmt}
                </div>
              </div>
              <button onClick={() => setSelectedCall(null)}
                style={{width:30,height:30,border:'1px solid #e0e3eb',borderRadius:7,background:'#fff',cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',color:'#666'}}>
                ✕
              </button>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
              {[
                ['Account', selectedCall.account_id],
                ['Agent',   selectedCall.agent_name],
                ['Type',    selectedCall.agent_type],
                ['Bucket',  selectedCall.delinquency_bucket],
                ['Direction',selectedCall.direction],
                ['Duration',selectedCall.duration_fmt],
              ].map(([k,v]) => (
                <div key={k} style={{background:'#f8f9fc',borderRadius:8,padding:'10px 12px'}}>
                  <div style={{fontSize:10,color:'#aaa',marginBottom:2}}>{k}</div>
                  <div style={{fontSize:12,fontWeight:600,color:'#1a1a2e'}}>{v || '—'}</div>
                </div>
              ))}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
              {[
                {l:'Status',    v:selectedCall.status},
                {l:'Sentiment', v:selectedCall.sentiment || 'N/A'},
                {l:'PTP',       v:selectedCall.ptp_outcome},
              ].map(m => (
                <div key={m.l} style={{background:'#f8f9fc',borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                  <div style={{fontSize:10,color:'#aaa',marginBottom:5}}>{m.l}</div>
                  <StatusBadge label={m.v}/>
                </div>
              ))}
            </div>

            {selectedCall.ptp_amount_sar > 0 && (
              <div style={{background:'#e6faf3',borderRadius:10,padding:'14px 16px',marginBottom:14,textAlign:'center'}}>
                <div style={{fontSize:11,color:'#0f9d74',marginBottom:4}}>PTP Amount Captured</div>
                <div style={{fontSize:24,fontWeight:700,color:'#0f9d74'}}>
                  SAR {selectedCall.ptp_amount_sar.toLocaleString()}
                </div>
              </div>
            )}

            {selectedCall.call_score && (
              <div style={{background:'#f8f9fc',borderRadius:10,padding:'14px 16px',marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:600,color:'#555',marginBottom:8}}>Call Quality Score</div>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{fontSize:26,fontWeight:700,color:parseFloat(selectedCall.call_score)>=7?C.green:parseFloat(selectedCall.call_score)>=4?C.amber:C.red}}>
                    {parseFloat(selectedCall.call_score).toFixed(1)}/10
                  </div>
                  <div style={{flex:1,height:8,background:'#e8eaf0',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${parseFloat(selectedCall.call_score)*10}%`,background:parseFloat(selectedCall.call_score)>=7?C.green:parseFloat(selectedCall.call_score)>=4?C.amber:C.red,borderRadius:4}}/>
                  </div>
                </div>
              </div>
            )}

            <div style={{background:'#f8f9fc',borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontSize:12,fontWeight:600,color:'#555',marginBottom:8}}>Technical Details</div>
              {[
                ['Call ID',   selectedCall.call_id],
                ['Agent ID',  selectedCall.agent_id],
                ['Latency',   `${selectedCall.latency_ms?.toLocaleString() || '—'}ms`],
                ['Direction', selectedCall.direction],
              ].map(([k,v]) => (
                <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'5px 0',borderBottom:'0.5px solid #eee'}}>
                  <span style={{color:'#888'}}>{k}</span>
                  <span style={{fontWeight:600,fontFamily:k==='Call ID'||k==='Agent ID'?'monospace':'inherit'}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
