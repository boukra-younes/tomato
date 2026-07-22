import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDeficitStore } from '../context/useDeficitStore'
import toast from 'react-hot-toast'

export default function PlanEditor({ onDone }) {
  const { profile, updateProfile, user } = useAuth()
  const { recompute } = useDeficitStore()
  const [form, setForm] = useState({
    sex: profile?.sex || 'male',
    birth_date: profile?.birth_date || '',
    height_cm: profile?.height_cm || '',
    activity_level: profile?.activity_level || 'sedentary',
    goal_type: profile?.goal_type || 'lose',
    starting_weight_kg: profile?.starting_weight_kg || '',
    goal_weight_kg: profile?.goal_weight_kg || '',
    weekly_weight_change_target_kg: profile?.weekly_weight_change_target_kg ?? -0.5,
    body_fat_pct: profile?.body_fat_pct || ''
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
        goal_weight_kg: Number(form.goal_weight_kg),
        weekly_weight_change_target_kg: Number(form.weekly_weight_change_target_kg),
        body_fat_pct: form.body_fat_pct ? Number(form.body_fat_pct) : null
      })
      if (user) await recompute(user.id, { ...profile, ...form })
      toast.success('Plan updated')
      onDone && onDone()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="grid-2" style={{ marginBottom: 14 }}>
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
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div>
          <label>Height (cm)</label>
          <input type="number" value={form.height_cm} onChange={e => setForm({ ...form, height_cm: e.target.value })} required />
        </div>
        <div>
          <label>Body fat % (optional)</label>
          <input type="number" value={form.body_fat_pct} onChange={e => setForm({ ...form, body_fat_pct: e.target.value })} />
        </div>
      </div>
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div>
          <label>Start weight (kg)</label>
          <input type="number" step="0.1" value={form.starting_weight_kg} onChange={e => setForm({ ...form, starting_weight_kg: e.target.value })} required />
        </div>
        <div>
          <label>Goal weight (kg)</label>
          <input type="number" step="0.1" value={form.goal_weight_kg} onChange={e => setForm({ ...form, goal_weight_kg: e.target.value })} required />
        </div>
      </div>
      <div className="grid-2" style={{ marginBottom: 14 }}>
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
          <label>Weekly rate (kg/week, negative = loss)</label>
          <input type="number" step="0.05" value={form.weekly_weight_change_target_kg} onChange={e => setForm({ ...form, weekly_weight_change_target_kg: e.target.value })} />
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label>Goal type</label>
        <select value={form.goal_type} onChange={e => setForm({ ...form, goal_type: e.target.value })}>
          <option value="lose">Lose weight</option>
          <option value="maintain">Maintain</option>
          <option value="gain">Gain weight</option>
          <option value="lean_bulk">Lean bulk</option>
        </select>
      </div>
      <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>Save plan</button>
    </form>
  )
}
