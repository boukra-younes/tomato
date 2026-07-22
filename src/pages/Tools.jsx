import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
  bmi, bodyFatNavy, relativeFatMass, bodyFatYmca, leanBodyMassBoer, leanBodyMassJames,
  leanBodyMassHume, idealWeightDevine, idealWeightRobinson, idealWeightMiller,
  idealWeightHamwi, waterTargetMl, proteinTargetGrams, oneRepMax
} from '../lib/calculations'
import toast from 'react-hot-toast'

function validatePassword(pw) {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw)
}

export default function Tools() {
  const { user, updatePassword } = useAuth()
  const [sex, setSex] = useState('male')
  const [weight, setWeight] = useState(75)
  const [height, setHeight] = useState(175)
  const [waist, setWaist] = useState(85)
  const [neck, setNeck] = useState(38)
  const [hip, setHip] = useState(95)
  const [age, setAge] = useState(28)
  const [oneRmWeight, setOneRmWeight] = useState(60)
  const [reps, setReps] = useState(8)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const changePassword = async () => {
    if (!validatePassword(newPassword)) { toast.error('8+ chars, one uppercase, one number'); return }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
    try {
      await updatePassword(newPassword)
      toast.success('Password updated')
      setNewPassword(''); setConfirmPassword('')
    } catch (err) { toast.error(err.message) }
  }

  const exportData = async (type) => {
    const tables = ['daily_logs', 'body_measurements', 'food_logs', 'exercise_logs', 'water_logs', 'health_logs']
    const results = {}
    for (const t of tables) {
      const { data } = await supabase.from(t).select('*').eq('user_id', user.id)
      results[t] = data || []
    }
    const content = type === 'json' ? JSON.stringify(results, null, 2) : Object.entries(results).map(([t, rows]) =>
      rows.map(r => `${t},` + Object.values(r).join(',')).join('\n')).join('\n')
    const blob = new Blob([content], { type: type === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `deficit-protocol-backup.${type === 'json' ? 'json' : 'csv'}`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="eyebrow">Tools</div>
      <h1 className="hero-number" style={{ fontSize: 38 }}>Calculators</h1>

      <div className="card">
        <div className="grid-4" style={{ marginBottom: 20 }}>
          <div><label>Sex</label><select value={sex} onChange={e => setSex(e.target.value)}><option value="male">Male</option><option value="female">Female</option></select></div>
          <div><label>Weight (kg)</label><input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} /></div>
          <div><label>Height (cm)</label><input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} /></div>
          <div><label>Age</label><input type="number" value={age} onChange={e => setAge(Number(e.target.value))} /></div>
          <div><label>Waist (cm)</label><input type="number" value={waist} onChange={e => setWaist(Number(e.target.value))} /></div>
          <div><label>Neck (cm)</label><input type="number" value={neck} onChange={e => setNeck(Number(e.target.value))} /></div>
          <div><label>Hip (cm)</label><input type="number" value={hip} onChange={e => setHip(Number(e.target.value))} /></div>
        </div>
        <div className="grid-4">
          <div className="card"><div className="eyebrow">BMI</div><div className="equation-value">{bmi(weight, height).toFixed(1)}</div></div>
          <div className="card"><div className="eyebrow">Body fat (Navy)</div><div className="equation-value">{bodyFatNavy({ sex, heightCm: height, neckCm: neck, waistCm: waist, hipCm: hip }).toFixed(1)}%</div></div>
          <div className="card"><div className="eyebrow">Body fat (RFM)</div><div className="equation-value">{relativeFatMass({ sex, heightCm: height, waistCm: waist }).toFixed(1)}%</div></div>
          <div className="card"><div className="eyebrow">Body fat (YMCA)</div><div className="equation-value">{bodyFatYmca({ sex, weightKg: weight, waistCm: waist }).toFixed(1)}%</div></div>
          <div className="card"><div className="eyebrow">LBM (Boer)</div><div className="equation-value">{leanBodyMassBoer({ sex, weightKg: weight, heightCm: height }).toFixed(1)}</div></div>
          <div className="card"><div className="eyebrow">LBM (James)</div><div className="equation-value">{leanBodyMassJames({ sex, weightKg: weight, heightCm: height }).toFixed(1)}</div></div>
          <div className="card"><div className="eyebrow">LBM (Hume)</div><div className="equation-value">{leanBodyMassHume({ sex, weightKg: weight, heightCm: height }).toFixed(1)}</div></div>
          <div className="card"><div className="eyebrow">Ideal weight (Devine)</div><div className="equation-value">{idealWeightDevine({ sex, heightCm: height }).toFixed(1)}</div></div>
          <div className="card"><div className="eyebrow">Ideal weight (Robinson)</div><div className="equation-value">{idealWeightRobinson({ sex, heightCm: height }).toFixed(1)}</div></div>
          <div className="card"><div className="eyebrow">Ideal weight (Miller)</div><div className="equation-value">{idealWeightMiller({ sex, heightCm: height }).toFixed(1)}</div></div>
          <div className="card"><div className="eyebrow">Ideal weight (Hamwi)</div><div className="equation-value">{idealWeightHamwi({ sex, heightCm: height }).toFixed(1)}</div></div>
          <div className="card"><div className="eyebrow">Water target</div><div className="equation-value">{Math.round(waterTargetMl(weight))} ml</div></div>
          <div className="card"><div className="eyebrow">Protein target</div><div className="equation-value">{Math.round(proteinTargetGrams(weight, 'maintain'))} g</div></div>
        </div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 14 }}>One rep max</div>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div><label>Weight lifted</label><input type="number" value={oneRmWeight} onChange={e => setOneRmWeight(Number(e.target.value))} /></div>
          <div><label>Reps</label><input type="number" value={reps} onChange={e => setReps(Number(e.target.value))} /></div>
        </div>
        <div className="equation-value text-teal">{oneRepMax(oneRmWeight, reps).toFixed(1)} kg</div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Export data</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => exportData('csv')}>Export CSV</button>
          <button className="btn btn-secondary" onClick={() => exportData('json')}>Export JSON backup</button>
        </div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Change password</div>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div><label>New password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></div>
          <div><label>Confirm password</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" onClick={changePassword}>Update password</button>
      </div>
    </div>
  )
}
