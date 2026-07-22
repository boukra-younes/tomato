import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import toast from 'react-hot-toast'

export default function Onboarding() {
  const { updateProfile, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    sex: 'male', birth_date: '', height_cm: '', activity_level: 'moderate',
    goal_type: 'maintain', unit_system: 'metric',
    starting_weight_kg: '', goal_weight_kg: '', weekly_weight_change_target_kg: '-0.5',
    body_fat_pct: ''
  })
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      await updateProfile({
        ...form,
        height_cm: Number(form.height_cm),
        starting_weight_kg: Number(form.starting_weight_kg),
        goal_weight_kg: form.goal_weight_kg ? Number(form.goal_weight_kg) : Number(form.starting_weight_kg),
        weekly_weight_change_target_kg: Number(form.weekly_weight_change_target_kg),
        body_fat_pct: form.body_fat_pct ? Number(form.body_fat_pct) : null
      })
      if (user) {
        await supabase.from('body_measurements').upsert({
          user_id: user.id,
          log_date: new Date().toISOString().slice(0, 10),
          weight_kg: Number(form.starting_weight_kg),
          body_fat_pct: form.body_fat_pct ? Number(form.body_fat_pct) : null
        }, { onConflict: 'user_id,log_date' })
      }
      navigate('/')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell" style={{ maxWidth: 480, paddingTop: 60 }}>
      <div className="eyebrow">Setup</div>
      <h1 className="hero-number" style={{ fontSize: 36 }}>Your profile</h1>
      <form onSubmit={submit} className="card">
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div>
            <label>Sex</label>
            <select value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label>Birth date</label>
            <input type="date" value={form.birth_date} onChange={e => setForm({ ...form, birth_date: e.target.value })} required />
          </div>
        </div>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div>
            <label>Height (cm)</label>
            <input type="number" value={form.height_cm} onChange={e => setForm({ ...form, height_cm: e.target.value })} required />
          </div>
          <div>
            <label>Units</label>
            <select value={form.unit_system} onChange={e => setForm({ ...form, unit_system: e.target.value })}>
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
            </select>
          </div>
        </div>
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div>
            <label>Current weight (kg)</label>
            <input type="number" value={form.starting_weight_kg} onChange={e => setForm({ ...form, starting_weight_kg: e.target.value })} required />
          </div>
          <div>
            <label>Goal weight (kg)</label>
            <input type="number" value={form.goal_weight_kg} onChange={e => setForm({ ...form, goal_weight_kg: e.target.value })} placeholder="optional" />
          </div>
          <div>
            <label>Body fat % (optional)</label>
            <input type="number" value={form.body_fat_pct} onChange={e => setForm({ ...form, body_fat_pct: e.target.value })} />
          </div>
        </div>
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div>
            <label>Activity level</label>
            <select value={form.activity_level} onChange={e => setForm({ ...form, activity_level: e.target.value })}>
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
              <option value="very_active">Very active</option>
            </select>
          </div>
          <div>
            <label>Goal</label>
            <select value={form.goal_type} onChange={e => setForm({ ...form, goal_type: e.target.value })}>
              <option value="lose">Lose weight</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Gain weight</option>
              <option value="lean_bulk">Lean bulk</option>
              <option value="slow_bulk">Slow bulk</option>
              <option value="aggressive_cut">Aggressive cut</option>
              <option value="recomposition">Body recomposition</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label>Weekly weight change target (kg/week, negative = loss)</label>
          <input type="number" step="0.1" value={form.weekly_weight_change_target_kg} onChange={e => setForm({ ...form, weekly_weight_change_target_kg: e.target.value })} />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>Continue</button>
      </form>
    </div>
  )
}
