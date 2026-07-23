import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './components/Header'
import TabNav from './components/TabNav'
import MobileNav from './components/MobileNav'
import ProtectedRoute from './components/ProtectedRoute'
import Auth from './pages/Auth'
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
      <MobileNav />
    </div>
  )
}

export default function App() {
  const { profile } = useAuth()

  useEffect(() => {
    const theme = profile?.theme || 'dark'
    document.documentElement.setAttribute('data-theme', theme)
  }, [profile])

  return (
    <>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Shell><Home /></Shell></ProtectedRoute>} />
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
