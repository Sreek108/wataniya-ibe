import { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin, getMe } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('ibe_token')
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => localStorage.removeItem('ibe_token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(email, password) {
    const data = await apiLogin(email, password)
    localStorage.setItem('ibe_token', data.access_token)
    setUser({
      user_id:     data.user_id,
      name:        data.name,
      email:       data.email,
      role:        data.role,
      permissions: data.permissions
    })
    return data
  }

  function logout() {
    localStorage.removeItem('ibe_token')
    setUser(null)
  }

  function can(permission) {
    return user?.permissions?.includes(permission) ?? false
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
