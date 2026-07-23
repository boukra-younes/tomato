import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Home' },
  { to: '/food', label: 'Food' },
  { to: '/plan', label: 'Plan' },
  { to: '/body', label: 'Body' },
  { to: '/exercise', label: 'Exercise' },
  { to: '/health', label: 'Health' },
  { to: '/progress', label: 'Progress' },
  { to: '/reports', label: 'Reports' },
  { to: '/tools', label: 'Tools' }
]

export default function TabNav() {
  return (
    <div className="tabs desktop-tabs" style={{ marginBottom: 24 }}>
      {TABS.map(t => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}
          className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
          {t.label.toUpperCase()}
        </NavLink>
      ))}
    </div>
  )
}
