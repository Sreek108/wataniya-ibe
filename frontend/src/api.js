const BASE = import.meta.env.VITE_API_URL || '/api'

function getToken() {
  return localStorage.getItem('ibe_token')
}

function headers() {
  const t = getToken()
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {})
  }
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  if (res.status === 401) {
    localStorage.removeItem('ibe_token')
    window.location.href = '/login'
    return
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

// Auth
export async function login(email, password) {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Invalid credentials')
  }
  return res.json()
}

export const getMe = () => request('GET', '/auth/me')

// Dashboard
export const getDashboardOverview = () => request('GET', '/dashboard/overview')
export const getDashboardPerformance = () => request('GET', '/dashboard/performance')

// Accounts
export function getAccounts(params = {}) {
  const q = new URLSearchParams(params).toString()
  return request('GET', `/accounts${q ? '?' + q : ''}`)
}
export const getAccount = (id) => request('GET', `/accounts/${id}`)

// ML
export const getAccountScore = (id) => request('GET', `/ml/account/${id}/score`)
export const scoreAccount = (data) => request('POST', '/ml/score', data)
export const getModelMetadata = () => request('GET', '/ml/metadata')

// PTPs
export const capturePTP = (data) => request('POST', '/ptps/capture', data)
export const getPTPs = () => request('GET', '/ptps')

// Calls
export function getCallHistory(params = {}) {
  const q = new URLSearchParams(params).toString()
  return request('GET', `/calls${q ? '?' + q : ''}`)
}
export const getCallStats = () => request('GET', '/calls/stats')

// Campaigns
export const getCampaigns      = ()     => request('GET',  '/campaigns')
export const createCampaign    = (data) => request('POST', '/campaigns', data)
export const launchCampaign    = (id)   => request('POST', `/campaigns/${id}/launch`)
export const pauseCampaign     = (id)   => request('POST', `/campaigns/${id}/pause`)
export const getCampaignStats  = (id)   => request('GET',  `/campaigns/${id}/stats`)

// PTP Workflow
export const getPTPWorkflow      = ()   => request('GET',  '/ptps/workflow')
export const getBrokenPTPs       = ()   => request('GET',  '/ptps/broken')
export const triggerPTPWorkflow  = (id) => request('POST', `/ptps/${id}/trigger`)
export const markPTPBroken       = (id) => request('POST', `/ptps/${id}/mark-broken`)

// Legal Cases
export function getLegalCases(params = {}) {
  const q = new URLSearchParams(params).toString()
  return request('GET', `/legal/cases${q ? '?' + q : ''}`)
}
export const getLegalCase         = (id)       => request('GET',  `/legal/cases/${id}`)
export const createLegalCase      = (data)     => request('POST', '/legal/cases', data)
export const updateLegalCaseStatus = (id, data) => request('PUT',  `/legal/cases/${id}/status`, data)
export const getLegalStats        = ()         => request('GET',  '/legal/stats')

// Admin — Users
export const getAdminUsers            = ()         => request('GET',    '/admin/users')
export const createAdminUser          = (data)     => request('POST',   '/admin/users', data)
export const updateAdminUser          = (id, data) => request('PUT',    `/admin/users/${id}`, data)
export const deleteAdminUser          = (id)       => request('DELETE', `/admin/users/${id}`)
export const resetAdminUserPassword   = (id, data) => request('POST',   `/admin/users/${id}/reset-password`, data)
export const getRoles                 = ()         => request('GET',    '/admin/roles')

// Audit
export function getAuditLogs(params = {}) {
  const q = new URLSearchParams(params).toString()
  return request('GET', `/audit/logs${q ? '?' + q : ''}`)
}
export const getAuditStats = () => request('GET', '/audit/stats')

// Escalations
export const getEscalations     = ()         => request('GET',  '/escalations')
export const getEscalationStats = ()         => request('GET',  '/escalations/stats')
export const assignEscalation   = (id, data) => request('POST', `/escalations/${id}/assign`, data)
export const resolveEscalation  = (id, data) => request('POST', `/escalations/${id}/resolve`, data)

// Settlements
export const getSettlementOptions = (account_id) => request('GET', `/settlements/options/${account_id}`)
export function getSettlements(params = {}) {
  const q = new URLSearchParams(params).toString()
  return request('GET', `/settlements${q ? '?' + q : ''}`)
}
export const createSettlement   = (data) => request('POST', '/settlements', data)
export const getSettlement      = (id)   => request('GET',  `/settlements/${id}`)
export const acceptSettlement   = (id)   => request('PUT',  `/settlements/${id}/accept`)
export const rejectSettlement   = (id)   => request('PUT',  `/settlements/${id}/reject`)
export const expireSettlement   = (id)   => request('PUT',  `/settlements/${id}/expire`)
export const getSettlementStats = ()     => request('GET',  '/settlements/stats')

// Waivers
export function getWaivers(params = {}) {
  const q = new URLSearchParams(params).toString()
  return request('GET', `/waivers${q ? '?' + q : ''}`)
}
export const createWaiver   = (data)               => request('POST', '/waivers', data)
export const getWaiverStats = ()                   => request('GET',  '/waivers/stats')
export const approveWaiver  = (id, review_note)    => request('PUT',  `/waivers/${id}/approve`, { review_note })
export const rejectWaiver   = (id, review_note)    => request('PUT',  `/waivers/${id}/reject`,  { review_note })

// Fraud Flags
export const getFraudReport      = ()           => request('GET',    '/fraud/report')
export const getAccountFraudFlag = (account_id) => request('GET',    `/accounts/${account_id}/fraud-flag`)
export const addFraudFlag        = (account_id, data) => request('POST', `/accounts/${account_id}/fraud-flag`, data)
export const removeFraudFlag     = (account_id) => request('DELETE', `/accounts/${account_id}/fraud-flag`)

// Portfolio Summary
export function getPortfolioSummary(params = {}) {
  const q = new URLSearchParams(params).toString()
  return request('GET', `/portfolio-summary${q ? '?' + q : ''}`)
}

// Notification Activity
export function getNotificationActivity(params = {}) {
  const q = new URLSearchParams(params).toString()
  return request('GET', `/notification-activity${q ? '?' + q : ''}`)
}

// Agent Targets
export function getAgentTargets(params = {}) {
  const q = new URLSearchParams(params).toString()
  return request('GET', `/agent-targets${q ? '?' + q : ''}`)
}

// Reports
export const getRollForward          = (period = 'month') => request('GET', `/reports/roll-forward?period=${period}`)
export const getCollectionEfficiency = ()                 => request('GET', '/reports/collection-efficiency')
export const getAIVsHuman            = ()                 => request('GET', '/reports/ai-vs-human')