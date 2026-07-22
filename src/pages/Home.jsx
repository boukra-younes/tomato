import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAppStore } from '../context/useAppStore'
import { useDeficitStore } from '../context/useDeficitStore'
import { supabase } from '../lib/supabaseClient'
import Ring from '../components/Ring'
import Modal from '../components/Modal'
import { format, addDays } from 'date-fns'
import { DRI } from '../lib/dri'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Home() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { foodLogs, waterLogs, exerciseLogs, fetchDayData, selectedDate, setSelectedDate, addWaterLog, addFoodLog } = useAppStore()
  const { planSummary, macros, recompute } = useDeficitStore()
  const [quickCalOpen, setQuickCalOpen] = useState(false)
  const [quickCal, setQuickCal] = useState('')
  const [weightOpen, setWeightOpen] = useState(false)
  const [weightVal, setWeightVal] = useState('')

  useEffect(() => { if (user) fetchDayData(user.id, selectedDate) }, [user, selectedDate])
  useEffect(() => { if (user && profile) recompute(user.id, profile) }, [user, profile])

  const totals = useMemo(() => foodLogs.reduce((acc, f) => ({
    calories: acc.calories + Number(f.calories || 0),
    protein: acc.protein + Number(f.protein || 0),
    carbs: acc.carbs + Number(f.carbs || 0),
    fat: acc.fat + Number(f.fat || 0),
    fiber: acc.fiber + Number(f.fiber || 0),
    sodium: acc.sodium + Number(f.sodium || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 }), [foodLogs])

  const waterTotal = waterLogs.reduce((a, w) => a + Number(w.amount_ml || 0), 0)
  const exerciseCalories = exerciseLogs.reduce((a, e) => a + Number(e.calories_burned || 0), 0)
  const target = planSummary?.todayTarget?.target || 0
  const dri = DRI[profile?.sex] || DRI.male
  const waterTarget = 3360

  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd')

  const quickAddCalories = async () => {
    if (!quickCal) return
    await addFoodLog(user.id, {
      log_date: selectedDate, meal_type: 'snack', food_source: 'quick_add',
      food_name: 'Quick add', amount: 1, unit: 'entry', calories: Number(quickCal), is_quick_add: true
    })
    setQuickCal('')
    setQuickCalOpen(false)
    toast.success('Logged')
  }

  const saveWeight = async () => {
    if (!weightVal) return
    await supabase.from('body_measurements').upsert({
      user_id: user.id, log_date: selectedDate, weight_kg: Number(weightVal)
    }, { onConflict: 'user_id,log_date' })
    await recompute(user.id, profile)
    setWeightVal('')
    setWeightOpen(false)
    toast.success('Weight logged')
  }

  if (!planSummary) {
    return (
      <div className="card">
        <p>Set up your plan to see daily targets.</p>
        <Link to="/onboarding" className="btn btn-primary">Go to setup</Link>
      </div>
    )
  }

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <button className="btn btn-pill" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), -1), 'yyyy-MM-dd'))}>&larr; PREV</button>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600 }}>{isToday ? 'Today' : format(new Date(selectedDate), 'MMM d, yyyy')}</div>
        <button className="btn btn-pill" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>NEXT &rarr;</button>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Daily targets</div>
        <div className="eyebrow" style={{ marginBottom: 20 }}>{target.toLocaleString()} kcal target &middot; Balanced macros</div>
        <div className="grid-5">
          <Ring value={totals.calories} max={target} label="Calories" unit="kcal" color="var(--teal)" dotColor="var(--teal)" />
          <Ring value={totals.protein} max={macros?.protein || 1} label="Protein" unit="g" color="var(--steel)" dotColor="var(--steel)" />
          <Ring value={totals.carbs} max={macros?.carbs || 1} label="Carbs" unit="g" color="var(--sienna)" dotColor="var(--sienna)" />
          <Ring value={totals.fat} max={macros?.fat || 1} label="Fat" unit="g" color="#b18ce0" dotColor="#b18ce0" />
          <Ring value={waterTotal} max={waterTarget} label="Water" unit="ml" color="var(--steel)" dotColor="var(--steel)" />
        </div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Remaining today</div>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Against your recalculated target</div>
        {[
          { label: 'Calories', value: totals.calories, max: target, unit: 'kcal' },
          { label: 'Protein', value: totals.protein, max: macros?.protein, unit: 'g' },
          { label: 'Carbs', value: totals.carbs, max: macros?.carbs, unit: 'g' },
          { label: 'Fat', value: totals.fat, max: macros?.fat, unit: 'g' },
          { label: 'Fiber', value: totals.fiber, max: dri.fiber, unit: 'g' },
          { label: 'Sodium', value: totals.sodium, max: dri.sodium, unit: 'mg' }
        ].map(row => (
          <div key={row.label} className="list-row" style={{ display: 'block', border: 'none', paddingBottom: 14 }}>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <span>{row.label}</span>
              <span className="value">{Math.round(row.value)} / {Math.round(row.max || 0)} {row.unit}</span>
            </div>
            <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
              <div style={{ width: `${Math.min(100, (row.value / (row.max || 1)) * 100)}%`, height: '100%', background: 'var(--teal)', borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Quick actions</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/food')}>+ LOG FOOD</button>
          <button className="btn btn-secondary" onClick={() => setQuickCalOpen(true)}>+ QUICK CALORIES</button>
          <button className="btn btn-secondary" onClick={() => addWaterLog(user.id, 250, selectedDate)}>+ WATER</button>
          <button className="btn btn-secondary" onClick={() => setWeightOpen(true)}>+ WEIGHT</button>
          <button className="btn btn-secondary" onClick={() => navigate('/exercise')}>+ EXERCISE</button>
        </div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Today at a glance</div>
        <div className="list-row"><span className="label">Net calories</span><span className="value">{Math.round(totals.calories - exerciseCalories)} kcal</span></div>
        <div className="list-row"><span className="label">Food logged</span><span className="value">{foodLogs.length} items</span></div>
        <div className="list-row"><span className="label">Exercise</span><span className="value">{exerciseLogs.length} activities &middot; {Math.round(exerciseCalories)} kcal</span></div>
        <div className="list-row"><span className="label">Steps</span><span className="value">&mdash;</span></div>
        <div className="list-row"><span className="label">Water</span><span className="value">{waterTotal} ml</span></div>
        <div className="list-row"><span className="label">Caffeine</span><span className="value">0 mg</span></div>
        <div className="list-row"><span className="label">Weight</span><span className="value">&mdash;</span></div>
        <div className="list-row"><span className="label">Mood</span><span className="value">&mdash;</span></div>
      </div>

      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, margin: '24px 0 12px' }}>Insights</div>
      <div className="card" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
        Log a few days of food and weight and insights will appear here.
      </div>

      <Modal open={quickCalOpen} onClose={() => setQuickCalOpen(false)} title="Quick add calories">
        <label>Calories</label>
        <input type="number" value={quickCal} onChange={e => setQuickCal(e.target.value)} style={{ marginBottom: 16 }} />
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={quickAddCalories}>Add</button>
      </Modal>

      <Modal open={weightOpen} onClose={() => setWeightOpen(false)} title="Log weight">
        <label>Weight (kg)</label>
        <input type="number" step="0.1" value={weightVal} onChange={e => setWeightVal(e.target.value)} style={{ marginBottom: 16 }} />
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveWeight}>Save</button>
      </Modal>
    </div>
  )
}
