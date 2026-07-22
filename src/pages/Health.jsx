import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAppStore } from '../context/useAppStore'
import { useDeficitStore } from '../context/useDeficitStore'
import { supabase } from '../lib/supabaseClient'
import { waterTargetMl } from '../lib/calculations'
import toast from 'react-hot-toast'

const SLIDERS = [
  { key: 'mood', label: 'Mood' },
  { key: 'stress', label: 'Stress' },
  { key: 'energy', label: 'Energy' },
  { key: 'hunger', label: 'Hunger' },
  { key: 'recovery', label: 'Recovery' },
  { key: 'digestion', label: 'Digestion' }
]
const QUICK_AMOUNTS = [250, 330, 500, 750]

export default function Health() {
  const { user, profile } = useAuth()
  const { healthLogs, waterLogs, caffeineLogs, alcoholLogs, fetchDayData, addHealthLog, addWaterLog, selectedDate } = useAppStore()
  const { currentTrendWeight } = useDeficitStore()
  const [form, setForm] = useState({ sleep_hours: 7, mood: 3, stress: 3, energy: 3, hunger: 3, recovery: 3, digestion: 3, notes: '' })
  const [caffeineAmount, setCaffeineAmount] = useState('')
  const [caffeineSource, setCaffeineSource] = useState('Coffee')
  const [drinks, setDrinks] = useState('')

  useEffect(() => {
    if (user) fetchDayData(user.id, selectedDate)
  }, [user, selectedDate])

  useEffect(() => {
    const existing = healthLogs.find(h => h.log_date === selectedDate)
    if (existing) setForm(existing)
  }, [healthLogs, selectedDate])

  const save = async () => {
    await addHealthLog(user.id, form, selectedDate)
    toast.success('Saved')
  }

  const waterTarget = waterTargetMl(currentTrendWeight || profile?.starting_weight_kg || 75)
  const waterTotal = waterLogs.reduce((a, w) => a + Number(w.amount_ml || 0), 0)
  const caffeineTotal = caffeineLogs.reduce((a, c) => a + Number(c.amount_mg || 0), 0)
  const alcoholTotal = alcoholLogs.reduce((a, d) => a + Number(d.standard_drinks || 0), 0)

  const logCaffeine = async () => {
    await supabase.from('caffeine_logs').insert({ user_id: user.id, log_date: selectedDate, source: caffeineSource, amount_mg: Number(caffeineAmount) })
    await fetchDayData(user.id, selectedDate)
    setCaffeineAmount('')
    toast.success('Logged')
  }

  const logAlcohol = async () => {
    await supabase.from('alcohol_logs').insert({ user_id: user.id, log_date: selectedDate, standard_drinks: Number(drinks), calories: Number(drinks) * 100 })
    await fetchDayData(user.id, selectedDate)
    setDrinks('')
    toast.success('Logged')
  }

  return (
    <div>
      <div className="eyebrow">Health</div>
      <h1 className="hero-number" style={{ fontSize: 40 }}>How today felt</h1>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Hydration</div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>{waterTotal} / {Math.round(waterTarget)} ml today</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {QUICK_AMOUNTS.map(a => (
            <button key={a} className="btn btn-pill" onClick={() => addWaterLog(user.id, a, selectedDate)}>+{a} ml</button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Caffeine</div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{caffeineTotal} mg today</div>
          <select value={caffeineSource} onChange={e => setCaffeineSource(e.target.value)} style={{ marginBottom: 10 }}>
            <option>Coffee</option><option>Tea</option><option>Energy drink</option><option>Supplement</option>
          </select>
          <input type="number" placeholder="mg" value={caffeineAmount} onChange={e => setCaffeineAmount(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={logCaffeine}>Log caffeine</button>
        </div>
        <div className="card">
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Alcohol</div>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{alcoholTotal} standard drinks today</div>
          <input type="number" placeholder="Standard drinks" value={drinks} onChange={e => setDrinks(e.target.value)} style={{ marginBottom: 10 }} />
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={logAlcohol}>Log alcohol</button>
        </div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Sleep &amp; wellbeing</div>
        <label>Sleep hours</label>
        <input type="number" step="0.5" value={form.sleep_hours} onChange={e => setForm({ ...form, sleep_hours: Number(e.target.value) })} style={{ marginBottom: 20 }} />

        {SLIDERS.map(s => (
          <div key={s.key} style={{ marginBottom: 20 }}>
            <label>{s.label} — {form[s.key]}/5</label>
            <input type="range" min="1" max="5" value={form[s.key]} onChange={e => setForm({ ...form, [s.key]: Number(e.target.value) })} />
          </div>
        ))}

        <label>Notes</label>
        <textarea rows={3} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ marginBottom: 20 }} />

        <button className="btn btn-primary" onClick={save}>Save</button>
      </div>
    </div>
  )
}
