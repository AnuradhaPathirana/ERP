import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
  const navigate = useNavigate()
  const tenantId = localStorage.getItem('tenant_id')

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('tenant_id')
    navigate('/login')
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Dashboard</h1>
      <p>Logged in as tenant: <strong>{tenantId}</strong></p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}
