import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Home as HomeIcon, UtensilsCrossed, Target, Activity, Menu, X,
  Dumbbell, HeartPulse, TrendingUp, BarChart3, Wrench
} from 'lucide-react'

const PRIMARY = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/food', label: 'Food', icon: UtensilsCrossed },
  { to: '/plan', label: 'Plan', icon: Target },
  { to: '/body', label: 'Body', icon: Activity }
]

const MORE = [
  { to: '/exercise', label: 'Exercise', icon: Dumbbell },
  { to: '/health', label: 'Health', icon: HeartPulse },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/tools', label: 'Tools', icon: Wrench }
]

export default function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const isMoreActive = MORE.some(m => m.to === location.pathname)

  const go = (to) => {
    setMoreOpen(false)
    navigate(to)
  }

  return (
    <>
      <div className="mobile-nav-spacer" />
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {PRIMARY.map(item => {
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}
              className={({ isActive }) => 'mobile-nav-item' + (isActive ? ' active' : '')}>
              <Icon size={19} strokeWidth={1.75} />
              {item.label.toUpperCase()}
            </NavLink>
          )
        })}
        <button className={'mobile-nav-item' + (isMoreActive ? ' active' : '')} onClick={() => setMoreOpen(true)}>
          <Menu size={19} strokeWidth={1.75} />
          MORE
        </button>
      </nav>

      {moreOpen && (
        <div className="mobile-menu-sheet" onClick={() => setMoreOpen(false)}>
          <div className="mobile-menu-panel" onClick={e => e.stopPropagation()}>
            <div className="row-between" style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600 }}>More</div>
              <button className="btn btn-pill" onClick={() => setMoreOpen(false)}><X size={14} /></button>
            </div>
            {MORE.map(item => {
              const Icon = item.icon
              const active = location.pathname === item.to
              return (
                <button key={item.to} className="tab" style={{ display: 'flex', alignItems: 'center', gap: 12, color: active ? 'var(--teal)' : 'var(--text-primary)' }}
                  onClick={() => go(item.to)}>
                  <Icon size={17} strokeWidth={1.75} />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
