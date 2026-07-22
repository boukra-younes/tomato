import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAppStore } from '../context/useAppStore'
import { useDeficitStore } from '../context/useDeficitStore'
import { supabase } from '../lib/supabaseClient'
import { MET_ACTIVITIES } from '../lib/metDatabase'
import { metCaloriesBurned } from '../lib/calculations'
import toast from 'react-hot-toast'

export default function Exercise() {
  const { user, profile } = useAuth()
  const { currentTrendWeight } = useDeficitStore()
  const { exerciseLogs, fetchDayData, addExerciseLog, selectedDate } = useAppStore()
  const [activityName, setActivityName] = useState(MET_ACTIVITIES[0].name)
  const [duration, setDuration] = useState(30)
  const [distance, setDistance] = useState('')
  const [steps, setSteps] = useState('')

  useEffect(() => {
    if (user) fetchDayData(user.id, selectedDate)
  }, [user, selectedDate])

  const activity = MET_ACTIVITIES.find(a => a.name === activityName)
  const weightForCalc = currentTrendWeight || profile?.starting_weight_kg || 75
  const estimatedCalories = activity ? Math.round(metCaloriesBurned(activity.met, weightForCalc, Number(duration))) : 0

  const logExercise = async () => {
    await addExerciseLog(user.id, {
      log_date: selectedDate,
      activity_name: activityName,
      met_value: activity.met,
      duration_minutes: Number(duration),
      distance_km: distance ? Number(distance) : null,
      calories_burned: estimatedCalories
    })
    toast.success('Logged')
  }

  const logSteps = async () => {
    await supabase.from('step_logs').upsert({ user_id: user.id, log_date: selectedDate, steps: Number(steps), source: 'manual' })
    toast.success('Steps saved')
  }

  const totalBurned = exerciseLogs.reduce((a, e) => a + Number(e.calories_burned || 0), 0)

  return (
    <div>
      <div className="eyebrow">Exercise</div>
      <h1 className="hero-number">{Math.round(totalBurned)} <span style={{ fontSize: 24 }}>kcal burned</span></h1>

      <div className="card">
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div>
            <label>Activity</label>
            <select value={activityName} onChange={e => setActivityName(e.target.value)}>
              {MET_ACTIVITIES.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label>Duration (min)</label>
            <input type="number" value={duration} onChange={e => setDuration(e.target.value)} />
          </div>
          <div>
            <label>Distance (km, optional)</label>
            <input type="number" value={distance} onChange={e => setDistance(e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 16, fontFamily: 'IBM Plex Mono, monospace' }}>Estimated burn: {estimatedCalories} kcal</div>
        <button className="btn btn-primary" onClick={logExercise}>Log activity</button>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Steps</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="number" placeholder="Steps today" value={steps} onChange={e => setSteps(e.target.value)} />
          <button className="btn btn-secondary" onClick={logSteps}>Save</button>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Today's activities</div>
        {exerciseLogs.map(e => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
            <span>{e.activity_name} — {e.duration_minutes} min</span>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{Math.round(e.calories_burned)} kcal</span>
          </div>
        ))}
      </div>
    </div>
  )
}
