import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

function validatePassword(pw) {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw)
}

export default function Auth() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const { signIn, signUp, resetPassword } = useAuth()
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (!validatePassword(password)) {
          toast.error('Password needs 8+ characters, one uppercase letter, one number')
          setBusy(false)
          return
        }
        if (password !== confirmPassword) {
          toast.error('Passwords do not match')
          setBusy(false)
          return
        }
        await signUp(email, password, fullName)
        toast.success('Account created. Check your email to confirm.')
      } else if (mode === 'signin') {
        await signIn(email, password)
        navigate('/')
      } else if (mode === 'reset') {
        await resetPassword(email)
        toast.success('Password reset email sent')
        setMode('signin')
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="eyebrow">Healthy Tomato</div>
      <h1 className="hero-number" style={{ fontSize: 40 }}>
        {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'}
      </h1>
      <form onSubmit={submit} className="card" style={{ marginTop: 20 }}>
        {mode === 'signup' && (
          <div style={{ marginBottom: 16 }}>
            <label>Full name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        {mode !== 'reset' && (
          <div style={{ marginBottom: 16 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </div>
        )}
        {mode === 'signup' && (
          <div style={{ marginBottom: 16 }}>
            <label>Confirm password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} />
          </div>
        )}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </button>
      </form>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
        {mode !== 'signin' && <button className="btn-secondary" style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--teal)' }} onClick={() => setMode('signin')}>Sign in</button>}
        {mode !== 'signup' && <button className="btn-secondary" style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--teal)' }} onClick={() => setMode('signup')}>Create account</button>}
        {mode !== 'reset' && <button className="btn-secondary" style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--teal)' }} onClick={() => setMode('reset')}>Forgot password</button>}
      </div>
      <div className="eyebrow" style={{ marginTop: 28, display: 'flex', gap: 16 }}>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
      </div>
    </div>
  )
}
