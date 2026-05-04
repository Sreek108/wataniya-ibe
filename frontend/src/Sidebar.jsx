import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { getEscalationStats, getWaiverStats } from './api'

const ROLE_COLORS = { admin:'#6c63ff', supervisor:'#0f9d74', collector:'#3b82f6', legal:'#d97706', support:'#ef4444' }
const ROLE_LABELS = { admin:'Administrator', supervisor:'Supervisor', collector:'Collector', legal:'Legal Officer', support:'Support' }

function Icon({ d, size=18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const NAV = [
  { label:'Collection Portfolio', path:'/collection-portfolio', icon:'M18 20V10M12 20V4M6 20V14', roles:['admin','supervisor','collector','legal','support'] },
  { label:'Agent Performance', path:'/agent-performance', icon:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', roles:['admin','supervisor'] },
  { label:'Dashboard',      path:'/dashboard', icon:'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z', roles:['admin','supervisor','collector','legal','support'] },
  { label:'Agent Workspace',path:'/agent',     icon:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7 0l2 2 4-4', roles:['admin','supervisor','collector'] },
  { label:'Settlements',    path:'/settlements', icon:'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', roles:['admin','supervisor','collector'] },
  { label:'PTP Workflow',   path:'/ptp-workflow', icon:'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4', roles:['admin','supervisor','collector'] },
  { label:'ML Scoring',     path:'/scoring',   icon:'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z', roles:['admin','supervisor','collector'] },
  { label:'Call History',   path:'/calls',     icon:'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', roles:['admin','supervisor','collector','legal','support'] },
  { label:'Legal Cases',    path:'/legal',     icon:'M3 6l3 1m0 0l-3 9a5.002 5.002 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 0 0 6.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3', roles:['admin','supervisor','legal'] },
  { label:'Fraud Report',   path:'/fraud-report', icon:'M20.618 5.984A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01', roles:['admin','supervisor','legal'] },
  { label:'Escalations',    path:'/escalations', icon:'M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', roles:['admin','supervisor','collector'], badge: 'escalation' },
  { label:'Waivers',        path:'/waivers',     icon:'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', roles:['admin','supervisor','collector','legal','support'], badge: 'waiver' },
  { label:'Campaigns',      path:'/campaigns', icon:'M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-7-1a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', roles:['admin','supervisor'] },
  { label:'User Management',path:'/admin',     icon:'M12 4.354a4 4 0 1 1 0 5.292M15 21H3v-1a6 6 0 0 1 12 0v1zm0 0h6v-1a6 6 0 0 0-9-5.197M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z', roles:['admin'] },
]

const REPORTS_NAV = [
  { label:'Roll Forward',  path:'/roll-forward', icon:'M9 17V7m0 10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10V7m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2', roles:['admin','supervisor'] },
  { label:'AI vs Human',   path:'/ai-vs-human',  icon:'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', roles:['admin','supervisor'] },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const roleColor = ROLE_COLORS[user?.role] || '#6c63ff'
  const visibleNav = NAV.filter(n => n.roles.includes(user?.role))
  const visibleReports = REPORTS_NAV.filter(n => n.roles.includes(user?.role))
  const [pendingEscalations, setPendingEscalations] = useState(0)
  const [pendingWaivers, setPendingWaivers]         = useState(0)

  useEffect(() => {
    if (!['admin', 'supervisor', 'collector'].includes(user?.role)) return
    getEscalationStats()
      .then(s => setPendingEscalations(s?.pending_count?.total ?? 0))
      .catch(() => {})
    if (['admin', 'supervisor'].includes(user?.role)) {
      getWaiverStats()
        .then(s => setPendingWaivers(s?.pending_count ?? 0))
        .catch(() => {})
    }
  }, [user?.role])

  return (
    <div style={{ width:220,minHeight:'100vh',background:'#fff',borderRight:'0.5px solid #e8eaf0',display:'flex',flexDirection:'column',flexShrink:0 }}>
      <div style={{ padding:'20px 20px 16px',borderBottom:'0.5px solid #f0f2f7' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:34,height:34,borderRadius:8,background:'linear-gradient(135deg,#6c63ff,#3b82f6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:16,flexShrink:0 }}>N</div>
          <div>
            <div style={{ fontSize:15,fontWeight:700,color:'#1a1a2e',lineHeight:1.1 }}>NSP IBE</div>
            <div style={{ fontSize:10,color:'#aaa',marginTop:1 }}>Wataniya Finance</div>
          </div>
        </div>
      </div>
      <nav style={{ flex:1,padding:'12px 10px',overflowY:'auto' }}>
        {visibleNav.map(item => (
          <NavLink key={item.path} to={item.path} style={({ isActive }) => ({
            display:'flex',alignItems:'center',gap:10,
            padding:'9px 12px',borderRadius:8,marginBottom:2,
            textDecoration:'none',fontSize:13,fontWeight:500,transition:'all 0.15s',
            background: isActive ? `${roleColor}12` : 'transparent',
            color: isActive ? roleColor : '#555',
          })}>
            <Icon d={item.icon} size={17} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.badge === 'escalation' && pendingEscalations > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, background: '#ef4444', color: '#fff', borderRadius: 20, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                {pendingEscalations}
              </span>
            )}
            {item.badge === 'waiver' && pendingWaivers > 0 && ['admin','supervisor'].includes(user?.role) && (
              <span style={{ fontSize: 10, fontWeight: 700, background: '#f97316', color: '#fff', borderRadius: 20, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                {pendingWaivers}
              </span>
            )}
          </NavLink>
        ))}
        {visibleReports.length > 0 && (
          <>
            <div style={{ fontSize:10,fontWeight:700,color:'#bbb',letterSpacing:'0.08em',textTransform:'uppercase',padding:'12px 12px 4px',marginTop:4 }}>Reports</div>
            {visibleReports.map(item => (
              <NavLink key={item.path} to={item.path} style={({ isActive }) => ({
                display:'flex',alignItems:'center',gap:10,
                padding:'9px 12px',borderRadius:8,marginBottom:2,
                textDecoration:'none',fontSize:13,fontWeight:500,transition:'all 0.15s',
                background: isActive ? `${roleColor}12` : 'transparent',
                color: isActive ? roleColor : '#555',
              })}>
                <Icon d={item.icon} size={17} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>
      <div style={{ padding:'14px 16px',borderTop:'0.5px solid #f0f2f7' }}>
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
          <div style={{ width:34,height:34,borderRadius:'50%',background:`${roleColor}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:roleColor,flexShrink:0 }}>
            {user?.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div style={{ overflow:'hidden' }}>
            <div style={{ fontSize:12,fontWeight:600,color:'#1a1a2e',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{user?.name}</div>
            <div style={{ fontSize:11,color:roleColor,fontWeight:600 }}>{ROLE_LABELS[user?.role]}</div>
          </div>
        </div>
        <button onClick={()=>{logout();navigate('/login')}}
          style={{ width:'100%',padding:'7px',border:'0.5px solid #e0e3eb',borderRadius:7,background:'#fff',fontSize:12,color:'#666',cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s' }}
          onMouseEnter={e=>{e.target.style.background='#fef2f2';e.target.style.color='#ef4444';e.target.style.borderColor='#fca5a5'}}
          onMouseLeave={e=>{e.target.style.background='#fff';e.target.style.color='#666';e.target.style.borderColor='#e0e3eb'}}>
          Sign out
        </button>
      </div>
    </div>
  )
}
