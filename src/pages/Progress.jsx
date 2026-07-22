import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDeficitStore } from '../context/useDeficitStore'
import { progressPercent, computeMilestones } from '../lib/adaptiveEngine'
import { format } from 'date-fns'

export default function Progress() {
  const { user, profile } = useAuth()
  const { planSummary, currentTrendWeight, recompute, streaksAndAdherence } = useDeficitStore()

  useEffect(() => { if (user && profile) recompute(user.id, profile) }, [user, profile])

  if (!planSummary || !profile?.starting_weight_kg) return <div className="card">Set up your plan to see progress.</div>

  const pct = progressPercent({
    startingWeightKg: profile.starting_weight_kg, currentWeightKg: currentTrendWeight || profile.starting_weight_kg, goalWeightKg: profile.goal_weight_kg
  })
  const milestones = computeMilestones({
    startingWeightKg: profile.starting_weight_kg, currentWeightKg: currentTrendWeight || profile.starting_weight_kg,
    goalWeightKg: profile.goal_weight_kg, progressPct: pct
  })
  const adherence = streaksAndAdherence()
  const remaining = Math.abs((profile.goal_weight_kg || 0) - (currentTrendWeight || profile.starting_weight_kg))

  return (
    <div>
      <div className="eyebrow">Goal progress</div>
      <h1 className="hero-number">{Math.round(pct)}<span style={{ fontSize: 28 }}>%</span></h1>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, marginBottom: 24 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--teal)', borderRadius: 3 }} />
      </div>

      <div className="grid-4">
        <div className="card"><div className="eyebrow">Start</div><div className="equation-value">{profile.starting_weight_kg} kg</div></div>
        <div className="card"><div className="eyebrow">Current</div><div className="equation-value text-teal">{currentTrendWeight ? currentTrendWeight.toFixed(1) : '—'} kg</div></div>
        <div className="card"><div className="eyebrow">Goal</div><div className="equation-value">{profile.goal_weight_kg} kg</div></div>
        <div className="card"><div className="eyebrow">Remaining</div><div className="equation-value text-sienna">{remaining.toFixed(1)} kg</div></div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 14 }}>Milestones</div>
        {milestones.length === 0 && <div className="eyebrow">No milestones reached yet — keep logging.</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {milestones.map(m => <span key={m.key} className="btn btn-pill bg-teal-soft text-teal">{m.label}</span>)}
        </div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Consistency</div>
        <div className="list-row"><span className="label">Current streak</span><span className="value">{adherence.current} days</span></div>
        <div className="list-row"><span className="label">Last 7 days logged</span><span className="value">{adherence.last7} of 7</span></div>
        <div className="list-row"><span className="label">Within 10% of target</span><span className="value">{adherence.within10 != null ? adherence.within10 + '%' : '—'}</span></div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Target date</div>
        <div className="equation-value">{planSummary.targetDate ? format(new Date(planSummary.targetDate), 'MMM d, yyyy') : '—'}</div>
      </div>
    </div>
  )
}
