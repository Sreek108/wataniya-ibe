import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import Sidebar from './Sidebar'
import LoginPage from './LoginPage'
import DashboardPage from './DashboardPage'
import AgentWorkspace from './AgentWorkspace'
import MLScoringPanel from './MLScoringPanel'
import CallHistoryPage from './CallHistoryPage'
import CampaignsPage from './CampaignsPage'
import AdminPage from './AdminPage'
import LegalPage from './LegalPage'
import PTPWorkflowPage from './PTPWorkflowPage'
import EscalationPage from './EscalationPage'
import SettlementsPage from './SettlementsPage'
import WaiversPage from './WaiversPage'
import FraudReportPage from './FraudReportPage'
import RollForwardPage from './RollForwardPage'
import AIvsHumanPage from './AIvsHumanPage'
import CollectionPortfolioPage from './CollectionPortfolioPage'
import AgentPerformancePage from './AgentPerformancePage'

function ProtectedLayout({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f6fa' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#6c63ff,#3b82f6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:18,margin:'0 auto 12px' }}>N</div>
        <div style={{ color:'#888',fontSize:14 }}>Loading IBE...</div>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return (
    <div style={{ display:'flex',minHeight:'100vh' }}>
      <Sidebar />
      <div style={{ flex:1,overflow:'auto',minWidth:0 }}>{children}</div>
    </div>
  )
}

function PlaceholderPage({ title, description }) {
  return (
    <div style={{ padding:32 }}>
      <h1 style={{ fontSize:22,fontWeight:700,color:'#1a1a2e',margin:'0 0 8px' }}>{title}</h1>
      <p style={{ fontSize:14,color:'#888' }}>{description}</p>
      <div style={{ marginTop:24,padding:24,background:'#fff',borderRadius:12,border:'0.5px solid #e8eaf0',textAlign:'center',color:'#aaa' }}>
        <div style={{ fontSize:32,marginBottom:12 }}>🚧</div>
        <div style={{ fontSize:14 }}>Coming in next sprint</div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/collection-portfolio" element={<ProtectedLayout><CollectionPortfolioPage /></ProtectedLayout>} />
          <Route path="/agent-performance" element={<ProtectedLayout><AgentPerformancePage /></ProtectedLayout>} />
          <Route path="/dashboard" element={<ProtectedLayout><DashboardPage /></ProtectedLayout>} />
          <Route path="/agent" element={<ProtectedLayout><AgentWorkspace /></ProtectedLayout>} />
          <Route path="/scoring" element={<ProtectedLayout><MLScoringPanel /></ProtectedLayout>} />
          <Route path="/calls" element={<ProtectedLayout><CallHistoryPage /></ProtectedLayout>} />
          <Route path="/legal" element={<ProtectedLayout><LegalPage /></ProtectedLayout>} />
          <Route path="/ptp-workflow" element={<ProtectedLayout><PTPWorkflowPage /></ProtectedLayout>} />
          <Route path="/escalations" element={<ProtectedLayout><EscalationPage /></ProtectedLayout>} />
          <Route path="/settlements" element={<ProtectedLayout><SettlementsPage /></ProtectedLayout>} />
          <Route path="/waivers" element={<ProtectedLayout><WaiversPage /></ProtectedLayout>} />
          <Route path="/fraud-report" element={<ProtectedLayout><FraudReportPage /></ProtectedLayout>} />
          <Route path="/roll-forward" element={<ProtectedLayout><RollForwardPage /></ProtectedLayout>} />
          <Route path="/ai-vs-human" element={<ProtectedLayout><AIvsHumanPage /></ProtectedLayout>} />
          <Route path="/campaigns" element={<ProtectedLayout><CampaignsPage /></ProtectedLayout>} />
          <Route path="/admin" element={<ProtectedLayout><AdminPage /></ProtectedLayout>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
