import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import {
  getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser,
  resetAdminUserPassword, getRoles, getAuditLogs, getAuditStats
} from './api'

const ROLE_META = {
  admin:      { color: '#7c3aed', bg: '#f5f3ff', label: 'Admin' },
  supervisor: { color: '#2563eb', bg: '#eff6ff', label: 'Supervisor' },
  collector:  { color: '#0d9488', bg: '#f0fdfa', label: 'Collector' },
  legal:      { color: '#d97706', bg: '#fffbeb', label: 'Legal' },
  support:    { color: '#6b7280', bg: '#f9fafb', label: 'Support' },
}

const ROLE_OPTIONS = ['admin', 'supervisor', 'collector', 'legal', 'support']

// Permissions matrix
const PERM_COLS = ['Accounts', 'ML Scoring', 'Campaigns', 'Legal Cases', 'User Mgmt', 'Reports', 'PTP Capture', 'Waiver Approve']
const MATRIX = {
  admin:      ['full', 'full', 'full', 'full', 'full', 'full', 'full', 'full'],
  supervisor: ['full', 'full', 'full', 'view', 'none', 'full', 'full', 'full'],
  collector:  ['view', 'view', 'none', 'none', 'none', 'view', 'full', 'none'],
  legal:      ['view', 'none', 'none', 'full', 'none', 'view', 'none', 'none'],
  support:    ['view', 'none', 'none', 'none', 'none', 'view', 'none', 'none'],
}

function RoleBadge({ role }) {
  const m = ROLE_META[role] || ROLE_META.support
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 600, background: m.bg, color: m.color,
    }}>
      {m.label}
    </span>
  )
}

function Avatar({ name, role }) {
  const m = ROLE_META[role] || ROLE_META.support
  const initials = (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%', background: m.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, color: m.color, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

function PermCell({ level }) {
  if (level === 'full') return <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 13 }}>✓ Full</span>
  if (level === 'view') return <span style={{ color: '#2563eb', fontSize: 12 }}>👁 View</span>
  return <span style={{ color: '#d1d5db', fontSize: 13 }}>—</span>
}

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
      background: active ? '#6c63ff' : 'transparent',
      color: active ? '#fff' : '#666',
    }}>
      {label}
    </button>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 28, width: 440, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid #e0e3eb', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', color: '#1a1a2e',
}

const btnPrimary = {
  padding: '9px 22px', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: '#6c63ff', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
}
const btnSecondary = {
  padding: '9px 22px', borderRadius: 8, border: '1px solid #e0e3eb', cursor: 'pointer',
  background: '#fff', color: '#555', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
}
const btnDanger = {
  padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
  background: '#fef2f2', color: '#ef4444', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
}

export default function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('users')

  // Users state
  const [users, setUsers]             = useState([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modal, setModal]             = useState(null) // null | 'add' | user-object
  const [confirmId, setConfirmId]     = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [newPwd, setNewPwd]           = useState('')
  const [formData, setFormData]       = useState({ name: '', email: '', password: '', role: 'collector', status: 'Active' })
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')

  // Audit state
  const [auditLogs, setAuditLogs]             = useState([])
  const [auditTotal, setAuditTotal]           = useState(0)
  const [auditPage, setAuditPage]             = useState(1)
  const [auditLoading, setAuditLoading]       = useState(false)
  const [auditLastUpdated, setAuditLastUpdated] = useState(null)
  const [auditSearch, setAuditSearch]         = useState('')
  const [auditAction, setAuditAction]         = useState('')
  const [auditEntityType, setAuditEntityType] = useState('')
  const [auditDateFrom, setAuditDateFrom]     = useState('')
  const [auditDateTo, setAuditDateTo]         = useState('')
  const [auditStats, setAuditStats]           = useState(null)

  useEffect(() => { loadUsers() }, [])

  useEffect(() => {
    if (tab === 'audit') { loadAudit(1); loadStats() }
  }, [tab])

  function loadUsers() {
    setUsersLoading(true)
    getAdminUsers()
      .then(d => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setUsersLoading(false))
  }

  function loadStats() {
    getAuditStats().then(setAuditStats).catch(() => {})
  }

  function loadAudit(page) {
    setAuditLoading(true)
    const params = { page, limit: 20 }
    if (auditAction)     params.action      = auditAction
    if (auditEntityType) params.entity_type = auditEntityType
    if (auditDateFrom)   params.date_from   = auditDateFrom
    if (auditDateTo)     params.date_to     = auditDateTo
    getAuditLogs(params)
      .then(d => { setAuditLogs(d.logs || []); setAuditTotal(d.total || 0); setAuditLastUpdated(new Date()) })
      .catch(() => {})
      .finally(() => setAuditLoading(false))
  }

  function exportCSV() {
    const all = auditLogs
    const headers = ['ID', 'Timestamp', 'User', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Description']
    const rows = all.map(l => [l.id, l.timestamp, l.user_name, l.user_role, l.action, l.entity_type, l.entity_id, l.description])
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function actionColor(action) {
    const a = (action || '').toLowerCase()
    if (a.includes('login') || a.includes('logout'))                                           return '#6b7280'
    if (a.includes('approved') || a.includes('accepted') || a.includes('resolved'))           return '#16a34a'
    if (a.includes('rejected') || a.includes('removed') || a.includes('broken'))              return '#ef4444'
    if (a.includes('launched') || a.includes('assigned'))                                      return '#7c3aed'
    if (a.includes('paused') || a.includes('resumed') || a.includes('updated') || a.includes('advanced')) return '#d97706'
    if (a.includes('created') || a.includes('initiated') || a.includes('opened') || a.includes('requested') || a.includes('captured') || a.includes('added')) return '#2563eb'
    return '#4b5563'
  }

  const ENTITY_LINKS = { 'Account': '/agent', 'Campaign': '/campaigns', 'LegalCase': '/legal', 'PTP': '/ptp-workflow' }

  function openAdd() {
    setFormData({ name: '', email: '', password: '', role: 'collector', status: 'Active' })
    setFormError('')
    setModal('add')
  }

  function openEdit(u) {
    setFormData({ name: u.name, email: u.email, password: '', role: u.role, status: u.status })
    setFormError('')
    setModal(u)
  }

  async function handleSave() {
    setSaving(true)
    setFormError('')
    try {
      if (modal === 'add') {
        await createAdminUser(formData)
      } else {
        await updateAdminUser(modal.user_id, { name: formData.name, role: formData.role, status: formData.status })
      }
      setModal(null)
      loadUsers()
    } catch (e) {
      setFormError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(userId) {
    try {
      await deleteAdminUser(userId)
      setConfirmId(null)
      loadUsers()
    } catch (e) {}
  }

  async function handleResetPwd() {
    if (!newPwd) return
    try {
      await resetAdminUserPassword(resetTarget.user_id, { new_password: newPwd })
      setResetTarget(null)
      setNewPwd('')
    } catch (e) {}
  }

  function setField(k, v) {
    setFormData(prev => ({ ...prev, [k]: v }))
  }

  // Filtered users
  const filteredUsers = users.filter(u => {
    const s = search.toLowerCase()
    const matchSearch = !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
    const matchRole   = roleFilter === 'All' || u.role === roleFilter.toLowerCase()
    const matchStatus = statusFilter === 'All' || u.status === statusFilter
    return matchSearch && matchRole && matchStatus
  })

  // Filtered audit (client-side name search)
  const filteredAudit = auditSearch
    ? auditLogs.filter(l => l.user_name.toLowerCase().includes(auditSearch.toLowerCase()) || l.description.toLowerCase().includes(auditSearch.toLowerCase()))
    : auditLogs

  const AUDIT_PAGE_COUNT = Math.ceil(auditTotal / 20)

  return (
    <div style={{ padding: 28, minHeight: '100vh', background: '#f5f6fa' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>User Management</h1>
          <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>Manage users, roles, and audit trail</div>
        </div>
        <div style={{
          display: 'flex', gap: 4, background: '#fff', padding: 4,
          borderRadius: 10, border: '0.5px solid #e8eaf0',
        }}>
          <TabBtn label="Users"             active={tab === 'users'}  onClick={() => setTab('users')} />
          <TabBtn label="Roles & Permissions" active={tab === 'roles'}  onClick={() => setTab('roles')} />
          <TabBtn label="Audit Log"         active={tab === 'audit'}  onClick={() => setTab('audit')} />
        </div>
      </div>

      {/* ── TAB 1: USERS ── */}
      {tab === 'users' && (
        <div>
          {/* Filter bar */}
          <div style={{
            background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0',
            padding: '14px 18px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, width: 240, flex: 'none' }}
            />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{ ...inputStyle, width: 150, flex: 'none' }}
            >
              <option>All Roles</option>
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{ROLE_META[r].label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ ...inputStyle, width: 130, flex: 'none' }}
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <div style={{ flex: 1 }} />
            <button onClick={openAdd} style={btnPrimary}>+ Add User</button>
          </div>

          {/* Users table */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fc' }}>
                  {['User', 'Role', 'Status', 'Last Login', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 12, borderBottom: '0.5px solid #e8eaf0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Loading users...</td></tr>
                ) : filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>No users found</td></tr>
                ) : filteredUsers.map(u => (
                  <tr key={u.user_id} style={{ borderBottom: '0.5px solid #f0f2f7' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={u.name} role={u.role} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: '#888' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: u.status === 'Active' ? '#f0fdf4' : '#fef2f2',
                        color: u.status === 'Active' ? '#16a34a' : '#ef4444',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#666' }}>
                      {u.last_login ? new Date(u.last_login).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          onClick={() => openEdit(u)}
                          style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #e0e3eb', background: '#fff', fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                        >Edit</button>
                        <button
                          onClick={() => { setResetTarget(u); setNewPwd('') }}
                          style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #e0e3eb', background: '#fff', fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
                        >Reset Pwd</button>
                        {confirmId === u.user_id ? (
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>Sure?</span>
                            <button onClick={() => handleDeactivate(u.user_id)} style={{ ...btnDanger, padding: '4px 10px' }}>Yes</button>
                            <button onClick={() => setConfirmId(null)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 12 }}>No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(u.user_id)}
                            disabled={u.user_id === user?.user_id}
                            style={{ ...btnDanger, opacity: u.user_id === user?.user_id ? 0.4 : 1, cursor: u.user_id === user?.user_id ? 'not-allowed' : 'pointer' }}
                          >Deactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: ROLES & PERMISSIONS ── */}
      {tab === 'roles' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0f2f7' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>Role Permissions Matrix</span>
            <span style={{ marginLeft: 12, fontSize: 12, color: '#888' }}>What each role can access across the system</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fc' }}>
                  <th style={{ padding: '11px 20px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 12, borderBottom: '0.5px solid #e8eaf0', minWidth: 130 }}>Role</th>
                  {PERM_COLS.map(c => (
                    <th key={c} style={{ padding: '11px 16px', textAlign: 'center', fontWeight: 600, color: '#555', fontSize: 11, borderBottom: '0.5px solid #e8eaf0', whiteSpace: 'nowrap' }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_OPTIONS.map(role => (
                  <tr key={role} style={{ borderBottom: '0.5px solid #f0f2f7' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <RoleBadge role={role} />
                    </td>
                    {MATRIX[role].map((level, i) => (
                      <td key={i} style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <PermCell level={level} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '14px 20px', borderTop: '0.5px solid #f0f2f7', display: 'flex', gap: 24 }}>
            <span style={{ fontSize: 12, color: '#555' }}><span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Full</span> — Create, read, update, delete</span>
            <span style={{ fontSize: 12, color: '#555' }}><span style={{ color: '#2563eb' }}>👁 View</span> — Read-only access</span>
            <span style={{ fontSize: 12, color: '#aaa' }}>— No access</span>
          </div>
        </div>
      )}

      {/* ── TAB 3: AUDIT LOG ── */}
      {tab === 'audit' && (
        <div>
          {/* Stats summary */}
          {auditStats && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 12 }}>
                {[
                  { label: 'Total Log Entries',  value: auditStats.total_logs.toLocaleString(),     color: '#6c63ff', bg: '#f5f3ff' },
                  { label: 'Logged Today',        value: auditStats.logs_today.toLocaleString(),     color: '#2563eb', bg: '#eff6ff' },
                  { label: 'Last 7 Days',         value: auditStats.logs_this_week.toLocaleString(), color: '#0d9488', bg: '#f0fdfa' },
                  { label: 'Most Active User',    value: auditStats.most_active_user || '—',         color: '#d97706', bg: '#fffbeb', small: true },
                ].map(c => (
                  <div key={c.label} style={{ background: c.bg, borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '14px 18px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{c.label}</div>
                    <div style={{ fontSize: c.small ? 14 : 24, fontWeight: 700, color: c.color, lineHeight: 1.2 }}>{c.value}</div>
                  </div>
                ))}
              </div>
              {auditStats.recent_critical?.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', marginBottom: 16, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f2f7', fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
                    Recent Critical Actions
                  </div>
                  <div style={{ padding: '4px 0' }}>
                    {auditStats.recent_critical.map(log => (
                      <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '0.5px solid #f5f6fa', borderLeft: `3px solid ${actionColor(log.action)}` }}>
                        <div style={{ flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: `${actionColor(log.action)}18`, color: actionColor(log.action) }}>{log.action}</span>
                        </div>
                        <div style={{ flex: 1, fontSize: 12, color: '#555' }}>{log.description}</div>
                        <div style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>
                          {new Date(log.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>{log.user_name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Filter bar */}
          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input
              placeholder="Search user or description..."
              value={auditSearch}
              onChange={e => setAuditSearch(e.target.value)}
              style={{ ...inputStyle, width: 220, flex: 'none' }}
            />
            <input
              placeholder="Action keyword..."
              value={auditAction}
              onChange={e => setAuditAction(e.target.value)}
              style={{ ...inputStyle, width: 160, flex: 'none' }}
            />
            <select
              value={auditEntityType}
              onChange={e => setAuditEntityType(e.target.value)}
              style={{ ...inputStyle, width: 140, flex: 'none' }}
            >
              <option value="">All Types</option>
              {['Auth','Campaign','LegalCase','Settlement','Waiver','Account','PTP','User','System'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              type="date" value={auditDateFrom}
              onChange={e => setAuditDateFrom(e.target.value)}
              style={{ ...inputStyle, width: 140, flex: 'none', fontSize: 12 }}
            />
            <span style={{ fontSize: 12, color: '#aaa' }}>to</span>
            <input
              type="date" value={auditDateTo}
              onChange={e => setAuditDateTo(e.target.value)}
              style={{ ...inputStyle, width: 140, flex: 'none', fontSize: 12 }}
            />
            <button onClick={() => { setAuditPage(1); loadAudit(1) }} style={btnPrimary}>Apply</button>
            <button onClick={() => { setAuditSearch(''); setAuditAction(''); setAuditEntityType(''); setAuditDateFrom(''); setAuditDateTo(''); setAuditPage(1); loadAudit(1) }}
              style={{ ...btnSecondary, fontSize: 12 }}>Reset</button>
            <div style={{ flex: 1 }} />
            <button onClick={exportCSV} style={{ ...btnSecondary, fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              ⬇ Export CSV
            </button>
            {auditLastUpdated && <span style={{ fontSize: 11, color: '#aaa' }}>Updated {auditLastUpdated.toLocaleTimeString()}</span>}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e8eaf0', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '0.5px solid #f0f2f7', fontSize: 12, color: '#888' }}>
              Showing {auditTotal === 0 ? 0 : ((auditPage - 1) * 20) + 1}–{Math.min(auditPage * 20, auditTotal)} of {auditTotal} entries
              {(auditAction || auditEntityType || auditDateFrom || auditDateTo) ? ' (filtered)' : ''}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fc' }}>
                  {['Timestamp', 'User', 'Role', 'Action', 'Entity', 'Description'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 12, borderBottom: '0.5px solid #e8eaf0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLoading ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Loading audit log...</td></tr>
                ) : filteredAudit.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>No entries found</td></tr>
                ) : filteredAudit.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: '0.5px solid #f0f2f7', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={{ padding: '10px 16px', color: '#666', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {new Date(log.timestamp).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1a1a2e', fontSize: 12 }}>{log.user_name}</td>
                    <td style={{ padding: '10px 16px' }}><RoleBadge role={log.user_role} /></td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 8, background: `${actionColor(log.action)}15`, color: actionColor(log.action) }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 12 }}>
                      {ENTITY_LINKS[log.entity_type] ? (
                        <a href={ENTITY_LINKS[log.entity_type]} style={{ color: '#6c63ff', fontWeight: 600, textDecoration: 'none', fontSize: 12 }}>
                          {log.entity_type}
                        </a>
                      ) : (
                        <div style={{ color: '#555', fontWeight: 500 }}>{log.entity_type}</div>
                      )}
                      <div style={{ color: '#aaa', fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>{log.entity_id}</div>
                    </td>
                    <td style={{ padding: '10px 16px', color: '#555', fontSize: 12, maxWidth: 300 }}>{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div style={{ padding: '12px 18px', borderTop: '0.5px solid #f0f2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#888' }}>Page {auditPage} of {AUDIT_PAGE_COUNT || 1}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button disabled={auditPage <= 1} onClick={() => { const p = auditPage - 1; setAuditPage(p); loadAudit(p) }}
                  style={{ ...btnSecondary, padding: '5px 12px', fontSize: 12, opacity: auditPage <= 1 ? 0.4 : 1, cursor: auditPage <= 1 ? 'not-allowed' : 'pointer' }}>← Prev</button>
                {Array.from({ length: Math.min(5, AUDIT_PAGE_COUNT || 1) }, (_, i) => {
                  const p = auditPage <= 3 ? i + 1 : auditPage + i - 2
                  if (p < 1 || p > (AUDIT_PAGE_COUNT || 1)) return null
                  return (
                    <button key={p} onClick={() => { setAuditPage(p); loadAudit(p) }}
                      style={{ width: 32, height: 32, borderRadius: 7, border: '1px solid #e0e3eb', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', background: p === auditPage ? '#6c63ff' : '#fff', color: p === auditPage ? '#fff' : '#444', fontWeight: p === auditPage ? 700 : 400 }}>
                      {p}
                    </button>
                  )
                })}
                <button disabled={auditPage >= (AUDIT_PAGE_COUNT || 1)} onClick={() => { const p = auditPage + 1; setAuditPage(p); loadAudit(p) }}
                  style={{ ...btnSecondary, padding: '5px 12px', fontSize: 12, opacity: auditPage >= (AUDIT_PAGE_COUNT || 1) ? 0.4 : 1, cursor: auditPage >= (AUDIT_PAGE_COUNT || 1) ? 'not-allowed' : 'pointer' }}>Next →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT USER MODAL ── */}
      {modal && (
        <Modal title={modal === 'add' ? 'Add New User' : `Edit — ${modal.name}`} onClose={() => setModal(null)}>
          <Field label="Full Name">
            <input
              value={formData.name}
              onChange={e => setField('name', e.target.value)}
              placeholder="e.g. Mohammed Al-Zahrani"
              style={inputStyle}
            />
          </Field>
          <Field label="Email Address">
            <input
              value={formData.email}
              onChange={e => setField('email', e.target.value)}
              placeholder="user@wataniya.sa"
              disabled={modal !== 'add'}
              style={{ ...inputStyle, background: modal !== 'add' ? '#f8f9fc' : '#fff', color: modal !== 'add' ? '#aaa' : '#1a1a2e' }}
            />
          </Field>
          {modal === 'add' && (
            <Field label="Password">
              <input
                type="password"
                value={formData.password}
                onChange={e => setField('password', e.target.value)}
                placeholder="Min 8 characters"
                style={inputStyle}
              />
            </Field>
          )}
          <Field label="Role">
            <select value={formData.role} onChange={e => setField('role', e.target.value)} style={inputStyle}>
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>{ROLE_META[r].label}</option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <div style={{ display: 'flex', gap: 10 }}>
              {['Active', 'Inactive'].map(s => (
                <button
                  key={s}
                  onClick={() => setField('status', s)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
                    border: formData.status === s ? '2px solid #6c63ff' : '1px solid #e0e3eb',
                    background: formData.status === s ? '#f5f3ff' : '#fff',
                    color: formData.status === s ? '#6c63ff' : '#555',
                  }}
                >{s}</button>
              ))}
            </div>
          </Field>
          {formError && <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 14, padding: '8px 12px', background: '#fef2f2', borderRadius: 7 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={() => setModal(null)} style={btnSecondary}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Save User'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── RESET PASSWORD MODAL ── */}
      {resetTarget && (
        <Modal title={`Reset Password — ${resetTarget.name}`} onClose={() => setResetTarget(null)}>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
            Enter a new password for <strong>{resetTarget.name}</strong>. They will need to use this on next login.
          </div>
          <Field label="New Password">
            <input
              type="password"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="Min 8 characters"
              style={inputStyle}
            />
          </Field>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button onClick={() => setResetTarget(null)} style={btnSecondary}>Cancel</button>
            <button onClick={handleResetPwd} disabled={!newPwd} style={{ ...btnPrimary, opacity: !newPwd ? 0.5 : 1 }}>Reset Password</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
