import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

const DEMO_USERS = [
  { label: 'Admin',      email: 'admin@wataniya.sa',      password: 'Admin@2026',    role: 'admin' },
  { label: 'Supervisor', email: 'supervisor@wataniya.sa', password: 'Super@2026',    role: 'supervisor' },
  { label: 'Collector',  email: 'collector@wataniya.sa',  password: 'Collect@2026',  role: 'collector' },
  { label: 'Legal',      email: 'legal@wataniya.sa',      password: 'Legal@2026',    role: 'legal' },
  { label: 'Support',    email: 'support@wataniya.sa',    password: 'Support@2026',  role: 'support' },
]

const ROLE_COLORS = {
  admin: '#6c63ff', supervisor: '#0f9d74', collector: '#3b82f6',
  legal: '#d97706', support: '#ef4444'
}

export default function LoginPage() {
  const { login }    = useAuth()
  const navigate     = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      navigate(data.role === 'collector' ? '/agent' : '/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(u) {
    setEmail(u.email)
    setPassword(u.password)
    setError('')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f5f6fa', padding: '20px'
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            marginBottom: 8
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #6c63ff, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 18
            }}>N</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>NSP IBE</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Intelligent Business Engine</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>Wataniya Finance Company · Riyadh</div>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: '32px',
          border: '0.5px solid #e8eaf0',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 6px', color: '#1a1a2e' }}>
            Sign in
          </h2>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 24px' }}>
            Enter your credentials to access the platform
          </p>

          {error && (
            <div style={{
              background: '#fef2f2', border: '0.5px solid #fca5a5',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: 13, color: '#dc2626'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@wataniya.sa"
                required
                style={{
                  width: '100%', padding: '10px 14px',
                  border: '1px solid #e0e3eb', borderRadius: 8,
                  fontSize: 14, outline: 'none', background: '#fafbfc',
                  transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = '#6c63ff'}
                onBlur={e => e.target.style.borderColor = '#e0e3eb'}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '10px 14px',
                  border: '1px solid #e0e3eb', borderRadius: 8,
                  fontSize: 14, outline: 'none', background: '#fafbfc',
                  transition: 'border-color 0.15s'
                }}
                onFocus={e => e.target.style.borderColor = '#6c63ff'}
                onBlur={e => e.target.style.borderColor = '#e0e3eb'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px',
                background: loading ? '#9ca3af' : '#6c63ff',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s'
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{ marginTop: 28, borderTop: '0.5px solid #f0f2f7', paddingTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Demo accounts — click to fill
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DEMO_USERS.map(u => (
                <button
                  key={u.role}
                  onClick={() => fillDemo(u)}
                  style={{
                    padding: '5px 12px',
                    border: `1px solid ${ROLE_COLORS[u.role]}22`,
                    borderRadius: 20,
                    background: `${ROLE_COLORS[u.role]}11`,
                    color: ROLE_COLORS[u.role],
                    fontSize: 12, fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#bbb' }}>
          NSP IBE v1.0.0 · Confidential · Wataniya Finance 2026
        </div>
      </div>
    </div>
  )
}
