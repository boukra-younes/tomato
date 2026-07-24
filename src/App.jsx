import { Routes, Route, Link } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './components/Header'
import TabNav from './components/TabNav'
import MobileNav from './components/MobileNav'
import ProtectedRoute from './components/ProtectedRoute'
import Auth from './pages/Auth'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfService from './pages/TermsOfService'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Food from './pages/Food'
import Plan from './pages/Plan'
import Body from './pages/Body'
import Exercise from './pages/Exercise'
import Health from './pages/Health'
import Progress from './pages/Progress'
import Reports from './pages/Reports'
import Tools from './pages/Tools'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'
import { useAuth } from './context/AuthContext'

function Shell({ children }) {
  return (
    <div className="app-shell">
      <Header />
      <TabNav />
      {children}
      <div className="eyebrow" style={{ display: 'flex', gap: 16, justifyContent: 'center', margin: '32px 0 8px' }}>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
      </div>
      <MobileNav />
    </div>
  )
}

function RootRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="app-shell">Loading...</div>
  if (!user) return <Landing />
  return <ProtectedRoute><Shell><Home /></Shell></ProtectedRoute>
}

export default function App() {
  const { profile } = useAuth()

  useEffect(() => {
    const theme = profile?.theme || 'dark'
    document.documentElement.setAttribute('data-theme', theme)
  }, [profile])

  useEffect(() => {
    const blockBackspaceNavigation = (e) => {
      if (e.key !== 'Backspace') return
      const el = e.target
      const isEditable = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
      if (!isEditable) e.preventDefault()
    }
    document.addEventListener('keydown', blockBackspaceNavigation)
    return () => document.removeEventListener('keydown', blockBackspaceNavigation)
  }, [])

  return (
    <>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/" element={<RootRoute />} />
        <Route path="/food" element={<ProtectedRoute><Shell><Food /></Shell></ProtectedRoute>} />
        <Route path="/plan" element={<ProtectedRoute><Shell><Plan /></Shell></ProtectedRoute>} />
        <Route path="/body" element={<ProtectedRoute><Shell><Body /></Shell></ProtectedRoute>} />
        <Route path="/exercise" element={<ProtectedRoute><Shell><Exercise /></Shell></ProtectedRoute>} />
        <Route path="/health" element={<ProtectedRoute><Shell><Health /></Shell></ProtectedRoute>} />
        <Route path="/progress" element={<ProtectedRoute><Shell><Progress /></Shell></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Shell><Reports /></Shell></ProtectedRoute>} />
        <Route path="/tools" element={<ProtectedRoute><Shell><Tools /></Shell></ProtectedRoute>} />
      </Routes>
      <PwaUpdatePrompt />
    </>
  )
}
