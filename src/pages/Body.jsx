import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDeficitStore } from '../context/useDeficitStore'
import { supabase } from '../lib/supabaseClient'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts'
import {
  bmi, ffmi, bodyFatNavy, relativeFatMass, bodyFatYmca, bodyFatBmiEstimate,
  leanBodyMassBoer, leanBodyMassJames, leanBodyMassHume,
  bmrMifflinStJeor, bmrHarrisBenedict, bmrKatchMcArdle, tdee, ageFromBirthDate
} from '../lib/calculations'
import { actualWeeklyRate, projectedCompletionDate } from '../lib/adaptiveEngine'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const METRIC_TABS = [
  { key: 'weight_kg', label: 'Weight' },
  { key: 'body_fat_pct', label: 'Body fat' },
  { key: 'waist_cm', label: 'Waist' },
  { key: 'hip_cm', label: 'Hip' },
  { key: 'chest_cm', label: 'Chest' },
  { key: 'neck_cm', label: 'Neck' },
  { key: 'shoulders_cm', label: 'Shoulders' },
  { key: 'upper_arm_cm', label: 'Upper arm' },
  { key: 'forearm_cm', label: 'Forearm' },
  { key: 'thigh_cm', label: 'Thigh' },
  { key: 'calf_cm', label: 'Calf' }
]

const FIELDS = [
  ['weight_kg', 'Weight (kg)'], ['body_fat_pct', 'Body fat (%)'], ['waist_cm', 'Waist (cm)'], ['hip_cm', 'Hip (cm)'], ['chest_cm', 'Chest (cm)'],
  ['neck_cm', 'Neck (cm)'], ['shoulders_cm', 'Shoulders (cm)'], ['upper_arm_cm', 'Upper arm (cm)'], ['forearm_cm', 'Forearm (cm)'], ['thigh_cm', 'Thigh (cm)'],
  ['calf_cm', 'Calf (cm)']
]

export default function Body() {
  const { user, profile } = useAuth()
  const { trendPoints, currentTrendWeight, plateau, recompute } = useDeficitStore()
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState({})
  const [metricTab, setMetricTab] = useState('weight_kg')

  const load = async () => {
    const { data } = await supabase.from('body_measurements').select('*').eq('user_id', user.id).order('log_date')
    setEntries(data || [])
  }

  useEffect(() => { if (user) load() }, [user])
  useEffect(() => { if (user && profile) recompute(user.id, profile) }, [user, profile])

  const save = async () => {
    await supabase.from('body_measurements').upsert({
      user_id: user.id, log_date: format(new Date(), 'yyyy-MM-dd'), ...form
    }, { onConflict: 'user_id,log_date' })
    setForm({})
    await load()
    await recompute(user.id, profile)
    toast.success('Saved')
  }

  const latest = entries[entries.length - 1] || {}
  const heightCm = profile?.height_cm || 170
  const age = profile?.birth_date ? ageFromBirthDate(profile.birth_date) : 30
  const sex = profile?.sex || 'male'
  const weightForCalc = latest.weight_kg || currentTrendWeight || profile?.starting_weight_kg || 70
  const bodyFatLogged = latest.body_fat_pct

  const currentBmi = bmi(weightForCalc, heightCm)
  const bmiCategory = currentBmi < 18.5 ? 'underweight' : currentBmi < 25 ? 'normal' : currentBmi < 30 ? 'overweight' : 'obese'
  const navyBf = (latest.neck_cm && latest.waist_cm) ? bodyFatNavy({ sex, heightCm, neckCm: latest.neck_cm, waistCm: latest.waist_cm, hipCm: latest.hip_cm }) : null
  const rfmBf = latest.waist_cm ? relativeFatMass({ sex, heightCm, waistCm: latest.waist_cm }) : null
  const ymcaBf = latest.waist_cm ? bodyFatYmca({ sex, weightKg: weightForCalc, waistCm: latest.waist_cm }) : null
  const bmiBf = bodyFatBmiEstimate({ bmi: currentBmi, age, sex })

  const effectiveBf = bodyFatLogged || navyBf || bmiBf
  const leanMass = weightForCalc * (1 - effectiveBf / 100)
  const fatMass = weightForCalc - leanMass

  const lbmBoer = leanBodyMassBoer({ sex, weightKg: weightForCalc, heightCm })
  const lbmJames = leanBodyMassJames({ sex, weightKg: weightForCalc, heightCm })
  const lbmHume = leanBodyMassHume({ sex, weightKg: weightForCalc, heightCm })
  const currentFfmi = ffmi(weightForCalc, heightCm, effectiveBf)

  const bmrMsj = bmrMifflinStJeor({ weightKg: weightForCalc, heightCm, age, sex })
  const bmrHb = bmrHarrisBenedict({ weightKg: weightForCalc, heightCm, age, sex })
  const bmrKm = bodyFatLogged ? bmrKatchMcArdle({ weightKg: weightForCalc, bodyFatPct: bodyFatLogged }) : null
  const maintenance = tdee(bmrMsj, profile?.activity_level)

  const weights = entries.filter(e => e.weight_kg).map(e => Number(e.weight_kg))
  const lowest = weights.length ? Math.min(...weights) : null
  const highest = weights.length ? Math.max(...weights) : null
  const average = weights.length ? Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10 : null
  const weeklyRate = actualWeeklyRate(trendPoints)
  const projection = profile?.goal_weight_kg ? projectedCompletionDate({
    currentWeightKg: currentTrendWeight || weightForCalc, goalWeightKg: profile.goal_weight_kg,
    actualRateKgPerWeek: weeklyRate, plannedRateKgPerWeek: profile.weekly_weight_change_target_kg,
    hasEnoughTrendData: trendPoints.filter(p => p.trend != null).length >= 14
  }) : { trending: false }

  const chartData = useMemo(() => entries.filter(e => e[metricTab] != null).map(e => ({ date: e.log_date, value: Number(e[metricTab]) })), [entries, metricTab])

  return (
    <div>
      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Log measurements</div>
        <div className="eyebrow" style={{ marginBottom: 16 }}>Logging for Today</div>
        <div className="grid-5" style={{ marginBottom: 16 }}>
          {FIELDS.map(([key, label]) => (
            <div key={key}>
              <label>{label}</label>
              <input type="number" value={form[key] || ''} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={save}>SAVE MEASUREMENTS</button>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Body composition</div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Calculated from your latest measurements</div>
        <div className="list-row"><span className="label">BMI</span><span className="value">{currentBmi.toFixed(1)} &middot; {bmiCategory}</span></div>
        <div className="list-row"><span className="label">Body fat (logged)</span><span className="value">{bodyFatLogged ? bodyFatLogged + '%' : '—'}</span></div>
        <div className="list-row"><span className="label">Body fat &mdash; US Navy</span><span className="value">{navyBf ? navyBf.toFixed(1) + '%' : 'needs waist and neck'}</span></div>
        <div className="list-row"><span className="label">Body fat &mdash; RFM</span><span className="value">{rfmBf ? rfmBf.toFixed(1) + '%' : 'needs waist'}</span></div>
        <div className="list-row"><span className="label">Body fat &mdash; YMCA</span><span className="value">{ymcaBf ? ymcaBf.toFixed(1) + '%' : 'needs waist'}</span></div>
        <div className="list-row"><span className="label">Body fat &mdash; BMI estimate</span><span className="value">{bmiBf.toFixed(1)}%</span></div>
        <div className="list-row"><span className="label">Lean body mass</span><span className="value">{leanMass.toFixed(1)} kg</span></div>
        <div className="list-row"><span className="label">Fat mass</span><span className="value">{fatMass.toFixed(1)} kg</span></div>
        <div className="list-row"><span className="label">Fat free mass</span><span className="value">{leanMass.toFixed(1)} kg</span></div>
        <div className="list-row"><span className="label">LBM &mdash; Boer</span><span className="value">{lbmBoer.toFixed(1)} kg</span></div>
        <div className="list-row"><span className="label">LBM &mdash; James</span><span className="value">{lbmJames.toFixed(1)} kg</span></div>
        <div className="list-row"><span className="label">LBM &mdash; Hume</span><span className="value">{lbmHume.toFixed(1)} kg</span></div>
        <div className="list-row"><span className="label">FFMI</span><span className="value">{currentFfmi.toFixed(1)}</span></div>
        <div className="list-row"><span className="label">BMR &mdash; Mifflin-St Jeor</span><span className="value">{Math.round(bmrMsj)} kcal</span></div>
        <div className="list-row"><span className="label">BMR &mdash; Harris-Benedict</span><span className="value">{Math.round(bmrHb)} kcal</span></div>
        <div className="list-row"><span className="label">BMR &mdash; Katch-McArdle</span><span className="value">{bmrKm ? Math.round(bmrKm) + ' kcal' : '—'}</span></div>
        <div className="list-row"><span className="label">Estimated maintenance</span><span className="value">{Math.round(maintenance)} kcal</span></div>
      </div>

      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, margin: '24px 0 12px' }}>Measurement history</div>
      <div className="card">
        <div className="pill-group" style={{ marginBottom: 20 }}>
          {METRIC_TABS.map(t => (
            <button key={t.key} className={'filter-pill' + (metricTab === t.key ? ' active' : '')} onClick={() => setMetricTab(t.key)}>{t.label}</button>
          ))}
        </div>
        {chartData.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '60px 0' }}>No {METRIC_TABS.find(t => t.key === metricTab)?.label.toLowerCase()} logged yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} />
              <YAxis tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} domain={['auto', 'auto']} />
              <ChartTooltip />
              <Line type="monotone" dataKey="value" stroke="var(--teal)" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, margin: '24px 0 12px' }}>Weight analytics</div>
      <div className="card">
        <div className="list-row"><span className="label">Trend weight (7-day)</span><span className="value">{currentTrendWeight ? currentTrendWeight.toFixed(1) + ' kg' : '—'}</span></div>
        <div className="list-row"><span className="label">Weekly rate</span><span className="value">{weeklyRate ? weeklyRate.toFixed(2) + ' kg/wk' : '—'}</span></div>
        <div className="list-row"><span className="label">Lowest</span><span className="value">{lowest ?? '—'}</span></div>
        <div className="list-row"><span className="label">Highest</span><span className="value">{highest ?? '—'}</span></div>
        <div className="list-row"><span className="label">Average</span><span className="value">{average ?? '—'}</span></div>
        <div className="list-row"><span className="label">Plateau</span><span className="value" style={{ color: plateau ? 'var(--sienna)' : 'var(--text-primary)' }}>{plateau ? 'yes' : 'no'}</span></div>
        <div className="list-row"><span className="label">Time to goal</span><span className="value">{projection.trending && projection.weeksRemaining ? `${projection.weeksRemaining} weeks` : '—'}</span></div>
        <div className="list-row"><span className="label">Projected goal date</span><span className="value">{projection.trending && projection.date ? format(projection.date, 'MMM d, yyyy') : '—'}</span></div>
        <div className="list-row"><span className="label">Goal confidence</span><span className="value">{trendPoints.filter(p => p.trend != null).length >= 14 ? 'high' : trendPoints.length >= 4 ? 'medium' : '—'}</span></div>
      </div>
    </div>
  )
}
