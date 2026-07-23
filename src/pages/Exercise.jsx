import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAppStore } from '../context/useAppStore'
import { useDeficitStore } from '../context/useDeficitStore'
import { supabase } from '../lib/supabaseClient'
import {
  EXERCISE_DATABASE, getCategories, getMuscles, getEquipment, DIFFICULTIES,
  calculateCalories
} from '../lib/exerciseDatabase'
import {
  isGoogleFitConfigured, isGoogleFitConnected, connectGoogleFit,
  disconnectGoogleFit, fetchStepsForDate
} from '../lib/googleFit'
import Modal from '../components/Modal'
import { format, addDays } from 'date-fns'
import toast from 'react-hot-toast'

const CARDIO_TYPES = ['Cardio', 'Sport', 'Stretching']

function isCardioLike(exercise) {
  return CARDIO_TYPES.includes(exercise.exerciseType)
}

export default function Exercise() {
  const { user, profile } = useAuth()
  const { currentTrendWeight } = useDeficitStore()
  const { exerciseLogs, fetchDayData, selectedDate, setSelectedDate } = useAppStore()

  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [detailExercise, setDetailExercise] = useState(null)

  const [sessionItems, setSessionItems] = useState([])
  const [todaysWorkouts, setTodaysWorkouts] = useState([])
  const [steps, setSteps] = useState('')
  const [gitFitBusy, setGitFitBusy] = useState(false)
  const [fitConnected, setFitConnected] = useState(isGoogleFitConnected())

  const weightForCalc = currentTrendWeight || profile?.starting_weight_kg || 75

  useEffect(() => { if (user) fetchDayData(user.id, selectedDate) }, [user, selectedDate])

  useEffect(() => {
    if (!user) return
    loadTodaysWorkouts()
  }, [user, selectedDate])

  const loadTodaysWorkouts = async () => {
    const { data: sessions } = await supabase
      .from('workout_sessions').select('*').eq('user_id', user.id).eq('log_date', selectedDate).order('started_at')
    if (!sessions?.length) { setTodaysWorkouts([]); return }
    const { data: sets } = await supabase
      .from('workout_sets').select('*').in('session_id', sessions.map(s => s.id)).order('set_number')
    setTodaysWorkouts(sessions.map(s => ({ ...s, sets: (sets || []).filter(st => st.session_id === s.id) })))
  }

  const pool = useMemo(() => {
    let p = EXERCISE_DATABASE
    if (category) p = p.filter(e => e.category === category)
    if (muscle) p = p.filter(e => e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle))
    if (equipment) p = p.filter(e => e.equipment === equipment)
    if (difficulty) p = p.filter(e => e.difficulty === difficulty)
    if (query.trim()) {
      const q = query.toLowerCase()
      p = p.filter(e => e.name.toLowerCase().includes(q) || e.aliases.some(a => a.toLowerCase().includes(q)))
    }
    const hasFilter = query.trim() || category || muscle || equipment || difficulty
    return hasFilter ? p.slice(0, 60) : []
  }, [query, category, muscle, equipment, difficulty])

  const addToSession = (exercise) => {
    const cardio = isCardioLike(exercise)
    setSessionItems(items => [...items, {
      tempId: `${exercise.id}-${Date.now()}`,
      exercise,
      isCardio: cardio,
      sets: cardio ? [] : [{ reps: 10, weightKg: 20 }],
      cardio: cardio ? { durationMinutes: 20, distanceKm: '', intensity: 'moderate' } : null
    }])
    setDetailExercise(null)
    toast.success(`Added ${exercise.name} to workout`)
  }

  const removeItem = (tempId) => setSessionItems(items => items.filter(i => i.tempId !== tempId))

  const addSet = (tempId) => setSessionItems(items => items.map(i => {
    if (i.tempId !== tempId) return i
    const last = i.sets[i.sets.length - 1] || { reps: 10, weightKg: 20 }
    return { ...i, sets: [...i.sets, { ...last }] }
  }))

  const removeSet = (tempId, idx) => setSessionItems(items => items.map(i => {
    if (i.tempId !== tempId) return i
    return { ...i, sets: i.sets.filter((_, si) => si !== idx) }
  }))

  const updateSet = (tempId, idx, field, value) => setSessionItems(items => items.map(i => {
    if (i.tempId !== tempId) return i
    const sets = i.sets.map((s, si) => si === idx ? { ...s, [field]: value } : s)
    return { ...i, sets }
  }))

  const updateCardio = (tempId, field, value) => setSessionItems(items => items.map(i => {
    if (i.tempId !== tempId) return i
    return { ...i, cardio: { ...i.cardio, [field]: value } }
  }))

  const itemCalories = (item) => {
    if (item.isCardio) {
      const met = item.cardio.intensity === 'light' ? item.exercise.lightMET
        : item.cardio.intensity === 'vigorous' ? item.exercise.vigorousMET : item.exercise.moderateMET
      return calculateCalories({ met, weightKg: weightForCalc, durationMinutes: Number(item.cardio.durationMinutes) || 0 })
    }
    const durationMinutes = item.sets.length * 1
    return calculateCalories({ met: item.exercise.moderateMET, weightKg: weightForCalc, durationMinutes })
  }

  const sessionTotalCalories = sessionItems.reduce((a, i) => a + itemCalories(i), 0)

  const finishWorkout = async () => {
    if (!sessionItems.length) return
    try {
      const { data: session, error: sessErr } = await supabase.from('workout_sessions').insert({
        user_id: user.id, log_date: selectedDate, name: 'Workout',
        ended_at: new Date().toISOString(), total_calories: Math.round(sessionTotalCalories)
      }).select().single()
      if (sessErr) throw sessErr

      const setRows = []
      let totalDuration = 0
      for (const item of sessionItems) {
        if (item.isCardio) {
          totalDuration += Number(item.cardio.durationMinutes) || 0
          setRows.push({
            session_id: session.id, user_id: user.id,
            exercise_id: item.exercise.id, exercise_name: item.exercise.name,
            exercise_category: item.exercise.category, primary_muscles: item.exercise.primaryMuscles,
            equipment: item.exercise.equipment, set_number: 1,
            duration_seconds: (Number(item.cardio.durationMinutes) || 0) * 60,
            distance_km: item.cardio.distanceKm ? Number(item.cardio.distanceKm) : null,
            intensity: item.cardio.intensity, calories: Math.round(itemCalories(item))
          })
        } else {
          totalDuration += item.sets.length
          item.sets.forEach((s, idx) => {
            setRows.push({
              session_id: session.id, user_id: user.id,
              exercise_id: item.exercise.id, exercise_name: item.exercise.name,
              exercise_category: item.exercise.category, primary_muscles: item.exercise.primaryMuscles,
              equipment: item.exercise.equipment, set_number: idx + 1,
              reps: s.reps ? Number(s.reps) : null, weight_kg: s.weightKg ? Number(s.weightKg) : null,
              calories: Math.round(itemCalories(item) / item.sets.length)
            })
          })
        }
      }
      const { error: setsErr } = await supabase.from('workout_sets').insert(setRows)
      if (setsErr) throw setsErr

      await supabase.from('exercise_logs').insert({
        user_id: user.id, log_date: selectedDate, activity_name: 'Workout',
        met_value: sessionItems[0]?.exercise.moderateMET || 5,
        duration_minutes: totalDuration, calories_burned: Math.round(sessionTotalCalories)
      })

      setSessionItems([])
      await fetchDayData(user.id, selectedDate)
      await loadTodaysWorkouts()
      toast.success('Workout saved')
    } catch (err) {
      toast.error(err.message || 'Failed to save workout')
    }
  }

  const logSteps = async () => {
    if (!steps) return
    await supabase.from('step_logs').upsert({ user_id: user.id, log_date: selectedDate, steps: Number(steps), source: 'manual' }, { onConflict: 'user_id,log_date' })
    toast.success('Steps saved')
  }

  const handleConnectGoogleFit = async () => {
    if (!isGoogleFitConfigured()) {
      toast.error('Google Fit needs VITE_GOOGLE_CLIENT_ID configured — see .env.example')
      return
    }
    setGitFitBusy(true)
    try {
      await connectGoogleFit()
      setFitConnected(true)
      toast.success('Google Fit connected')
    } catch (err) {
      toast.error(err.message || 'Could not connect Google Fit')
    } finally {
      setGitFitBusy(false)
    }
  }

  const syncStepsFromFit = async () => {
    setGitFitBusy(true)
    try {
      const count = await fetchStepsForDate(selectedDate)
      await supabase.from('step_logs').upsert({ user_id: user.id, log_date: selectedDate, steps: count, source: 'google_fit' }, { onConflict: 'user_id,log_date' })
      setSteps(String(count))
      toast.success(`Synced ${count.toLocaleString()} steps from Google Fit`)
    } catch (err) {
      toast.error(err.message || 'Sync failed')
    } finally {
      setGitFitBusy(false)
    }
  }

  const totalBurned = exerciseLogs.reduce((a, e) => a + Number(e.calories_burned || 0), 0)
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd')

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <button className="btn btn-pill" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), -1), 'yyyy-MM-dd'))}>&larr; PREV</button>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600 }}>{isToday ? 'Today' : format(new Date(selectedDate), 'MMM d, yyyy')}</div>
        <button className="btn btn-pill" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>NEXT &rarr;</button>
      </div>

      <div className="eyebrow">Exercise</div>
      <h1 className="hero-number">{Math.round(totalBurned)} <span style={{ fontSize: 22, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-secondary)' }}>kcal burned</span></h1>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Find an exercise</div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>{EXERCISE_DATABASE.length.toLocaleString()} exercises &middot; search or filter</div>
        <input placeholder="Search exercises (e.g. bench press, squat, running)" value={query} onChange={e => setQuery(e.target.value)} style={{ marginBottom: 14 }} />
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <div><label>Category</label><select value={category} onChange={e => setCategory(e.target.value)}><option value="">Any</option>{getCategories().map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label>Muscle</label><select value={muscle} onChange={e => setMuscle(e.target.value)}><option value="">Any</option>{getMuscles().map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          <div><label>Equipment</label><select value={equipment} onChange={e => setEquipment(e.target.value)}><option value="">Any</option>{getEquipment().map(eq => <option key={eq} value={eq}>{eq}</option>)}</select></div>
          <div><label>Difficulty</label><select value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="">Any</option>{DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
        </div>

        {pool.length === 0 && (query || category || muscle || equipment || difficulty) && (
          <div className="eyebrow" style={{ textAlign: 'center', padding: '16px 0' }}>No exercises matched.</div>
        )}
        {pool.map(ex => (
          <div key={ex.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => setDetailExercise(ex)}>
            <div>
              <div>{ex.name}</div>
              <div className="eyebrow">{ex.category} &middot; {ex.equipment} &middot; {ex.primaryMuscles.join(', ')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="value">{ex.difficulty}</span>
              <button className="btn btn-pill" onClick={(e) => { e.stopPropagation(); addToSession(ex) }}>+ Add</button>
            </div>
          </div>
        ))}
      </div>

      {sessionItems.length > 0 && (
        <div className="card" style={{ borderColor: 'var(--teal)' }}>
          <div className="row-between" style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600 }}>Current workout</div>
            <div className="value text-teal">{Math.round(sessionTotalCalories)} kcal est.</div>
          </div>

          {sessionItems.map(item => (
            <div key={item.tempId} style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.exercise.name}</div>
                  <div className="eyebrow">{item.exercise.primaryMuscles.join(', ')}</div>
                </div>
                <button className="btn btn-pill" onClick={() => removeItem(item.tempId)}>Remove</button>
              </div>

              {item.isCardio ? (
                <div className="grid-3">
                  <div><label>Duration (min)</label><input type="number" value={item.cardio.durationMinutes} onChange={e => updateCardio(item.tempId, 'durationMinutes', e.target.value)} /></div>
                  <div><label>Distance (km)</label><input type="number" value={item.cardio.distanceKm} onChange={e => updateCardio(item.tempId, 'distanceKm', e.target.value)} /></div>
                  <div>
                    <label>Intensity</label>
                    <select value={item.cardio.intensity} onChange={e => updateCardio(item.tempId, 'intensity', e.target.value)}>
                      <option value="light">Light</option><option value="moderate">Moderate</option><option value="vigorous">Vigorous</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  {item.sets.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 8 }}>
                      <div style={{ width: 50, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>Set {idx + 1}</div>
                      <div style={{ flex: 1 }}><label>Reps</label><input type="number" value={s.reps} onChange={e => updateSet(item.tempId, idx, 'reps', e.target.value)} /></div>
                      <div style={{ flex: 1 }}><label>Weight (kg)</label><input type="number" value={s.weightKg} onChange={e => updateSet(item.tempId, idx, 'weightKg', e.target.value)} /></div>
                      <button className="btn btn-pill" onClick={() => removeSet(item.tempId, idx)}>&times;</button>
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-pill" onClick={() => addSet(item.tempId)}>+ Add set</button>
                </div>
              )}
            </div>
          ))}

          <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} onClick={finishWorkout}>FINISH WORKOUT</button>
        </div>
      )}

      <div className="card">
        <div className="row-between" style={{ marginBottom: 4 }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600 }}>Steps</div>
          {isGoogleFitConfigured() && (
            <span className="eyebrow" style={{ color: fitConnected ? 'var(--teal)' : 'var(--text-secondary)' }}>
              {fitConnected ? 'Google Fit connected' : 'Google Fit not connected'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <input type="number" placeholder="Steps today" value={steps} onChange={e => setSteps(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="btn btn-secondary" onClick={logSteps}>Save</button>
          {isGoogleFitConfigured() && !fitConnected && (
            <button className="btn btn-secondary" disabled={gitFitBusy} onClick={handleConnectGoogleFit}>Connect Google Fit</button>
          )}
          {isGoogleFitConfigured() && fitConnected && (
            <>
              <button className="btn btn-secondary" disabled={gitFitBusy} onClick={syncStepsFromFit}>Sync from Google Fit</button>
              <button className="btn btn-pill" onClick={() => { disconnectGoogleFit(); setFitConnected(false) }}>Disconnect</button>
            </>
          )}
        </div>
        {!isGoogleFitConfigured() && (
          <div className="eyebrow" style={{ marginTop: 10 }}>Set VITE_GOOGLE_CLIENT_ID in .env to enable Google Fit step sync.</div>
        )}
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Logged workouts</div>
        {todaysWorkouts.length === 0 && <div className="eyebrow">No workouts logged for this day.</div>}
        {todaysWorkouts.map(w => (
          <div key={w.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
            <div className="row-between">
              <span>{w.name} &middot; {format(new Date(w.started_at), 'h:mm a')}</span>
              <span className="value text-teal">{Math.round(w.total_calories)} kcal</span>
            </div>
            {Object.entries(
              w.sets.reduce((acc, s) => { (acc[s.exercise_name] = acc[s.exercise_name] || []).push(s); return acc }, {})
            ).map(([name, sets]) => (
              <div key={name} style={{ marginTop: 8, paddingLeft: 12, fontSize: 13 }}>
                <div style={{ color: 'var(--text-secondary)' }}>{name}</div>
                {sets.map((s, i) => (
                  <div key={i} className="eyebrow" style={{ marginLeft: 8 }}>
                    {s.reps ? `${s.reps} reps x ${s.weight_kg || 0} kg` : `${Math.round((s.duration_seconds || 0) / 60)} min${s.distance_km ? ` · ${s.distance_km} km` : ''}`}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <Modal open={!!detailExercise} onClose={() => setDetailExercise(null)} title={detailExercise?.name}>
        {detailExercise && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              {detailExercise.category} &middot; {detailExercise.equipment} &middot; {detailExercise.difficulty}
            </div>
            <div className="list-row"><span className="label">Primary muscles</span><span className="value">{detailExercise.primaryMuscles.join(', ')}</span></div>
            {detailExercise.secondaryMuscles.length > 0 && <div className="list-row"><span className="label">Secondary</span><span className="value">{detailExercise.secondaryMuscles.join(', ')}</span></div>}
            <div className="list-row"><span className="label">Mechanics</span><span className="value">{detailExercise.mechanics}</span></div>
            {detailExercise.recommendedRepRange && <div className="list-row"><span className="label">Rep range</span><span className="value">{detailExercise.recommendedRepRange}</span></div>}
            {detailExercise.recommendedSets && <div className="list-row"><span className="label">Sets</span><span className="value">{detailExercise.recommendedSets}</span></div>}
            {detailExercise.averageRest && <div className="list-row"><span className="label">Rest</span><span className="value">{detailExercise.averageRest}</span></div>}
            <div className="list-row"><span className="label">MET (moderate)</span><span className="value">{detailExercise.moderateMET}</span></div>

            <div style={{ marginTop: 16 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Instructions</div>
              <ol style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                {detailExercise.instructions.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>

            <div style={{ marginTop: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Tips</div>
              <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                {detailExercise.tips.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: 18 }} onClick={() => addToSession(detailExercise)}>Add to workout</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
