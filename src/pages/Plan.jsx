import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDeficitStore } from '../context/useDeficitStore'
import { supabase } from '../lib/supabaseClient'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend, ReferenceDot } from 'recharts'
import { movingAverageTrend } from '../lib/adaptiveEngine'
import { format, differenceInCalendarDays } from 'date-fns'
import toast from 'react-hot-toast'

export default function Plan() {
  const [tab, setTab] = useState('plan')
  return (
    <div>
      <div className="subtabs">
        <button className={'tab' + (tab === 'plan' ? ' active' : '')} onClick={() => setTab('plan')}>PLAN</button>
        <button className={'tab' + (tab === 'track' ? ' active' : '')} onClick={() => setTab('track')}>TRACK PROGRESS</button>
      </div>
      {tab === 'plan' ? <PlanTab /> : <TrackProgressTab />}
    </div>
  )
}

function PlanTab() {
  const { user, profile } = useAuth()
  const { planSummary, macros, recompute } = useDeficitStore()
  const [expandedWeeks, setExpandedWeeks] = useState({ 1: true })

  useEffect(() => { if (user && profile) recompute(user.id, profile) }, [user, profile])

  if (!planSummary) return <div className="card">Set up your plan under "edit plan" to see your target.</div>

  const p = planSummary
  const firstTarget = p.days[0]?.target
  const lastTarget = p.days[p.days.length - 1]?.target
  const dayNum = profile?.plan_started_at
    ? Math.max(1, differenceInCalendarDays(new Date(), new Date(profile.plan_started_at)) + 1)
    : 1

  const trajectoryData = p.days.map(d => ({ date: d.dateLabel, weight: d.weightKg, rawDate: d.date }))
  const targetEvolutionData = p.days.map(d => ({ date: d.dateLabel, target: d.target }))
  const proteinPerKg = (macros.protein / (profile.starting_weight_kg || 1)).toFixed(1)

  const startPoint = trajectoryData[0]
  const endPoint = trajectoryData[trajectoryData.length - 1]
  const midPoint = trajectoryData[Math.floor(trajectoryData.length * 0.55)]
  const nearEndPoint = trajectoryData[Math.floor(trajectoryData.length * 0.9)]

  return (
    <div>
      <div className="eyebrow">Daily intake target &mdash; Day {dayNum}</div>
      <h1 className="hero-number">{firstTarget?.toLocaleString()} <span style={{ fontSize: 22, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text-secondary)' }}>kcal / day</span></h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: 640, marginBottom: 20 }}>
        Starts at {firstTarget?.toLocaleString()} kcal/day and eases down to ~{lastTarget?.toLocaleString()} kcal/day by goal,
        recalculated every day from your projected weight &mdash; that keeps the deficit fixed at exactly {p.dailyAdjustment} kcal even as your TDEE falls.
      </p>

      <div className="grid-4" style={{ marginBottom: 0 }}>
        <div className="card"><div className="eyebrow">BMR (Day 1)</div><div className="equation-value">{p.bmr0.toLocaleString()}</div></div>
        <div className="card"><div className="eyebrow">TDEE (Day 1)</div><div className="equation-value">{p.tdee0.toLocaleString()}</div></div>
        <div className="card"><div className="eyebrow">Deficit</div><div className="equation-value">{p.direction < 0 ? '−' : '+'}{p.dailyAdjustment.toLocaleString()}</div></div>
        <div className="card"><div className="eyebrow">Target intake</div><div className="equation-value text-teal">{firstTarget?.toLocaleString()}</div></div>
      </div>

      {p.clampedAny && (
        <div className="warn-box">
          <b>Heads up</b> &mdash; This plan dips as low as {Math.min(...p.days.map(d => d.target)).toLocaleString()} kcal/day,
          below the {p.minSafeCalories} kcal/day floor generally recommended without medical supervision. Consider a longer timeframe.
          This tool is a calculator, not medical advice &mdash; check with a doctor or dietitian before following an aggressive plan.
        </div>
      )}

      <div className="grid-3" style={{ marginTop: 16 }}>
        <div className="card"><div className="eyebrow">Protein</div><div className="equation-value">{macros.protein} g</div><div className="eyebrow">{macros.proteinPct}% &middot; {macros.protein * 4} kcal</div></div>
        <div className="card"><div className="eyebrow">Carbs</div><div className="equation-value">{macros.carbs} g</div><div className="eyebrow">{macros.carbsPct}% &middot; {macros.carbs * 4} kcal</div></div>
        <div className="card"><div className="eyebrow">Fat</div><div className="equation-value">{macros.fat} g</div><div className="eyebrow">{macros.fatPct}% &middot; {macros.fat * 9} kcal</div></div>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 28 }}>
        Balanced split at {firstTarget?.toLocaleString()} kcal &mdash; about {proteinPerKg} g protein per kg of bodyweight. Macros are a starting point; hitting the calorie total matters most.
      </p>

      <div className="row-between" style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600 }}>
          Projected trajectory &mdash; {profile.starting_weight_kg} kg &rarr; {profile.goal_weight_kg} kg
        </div>
        <div className="eyebrow">{p.durationDays} days at a flat {p.dailyAdjustment} kcal/day deficit</div>
      </div>
      <div className="card">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trajectoryData}>
            <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} domain={['auto', 'auto']} />
            <ChartTooltip />
            <Line type="monotone" dataKey="weight" stroke="var(--teal)" strokeWidth={2} dot={false} />
            {startPoint && <ReferenceDot x={startPoint.date} y={startPoint.weight} r={4} fill="var(--teal)" label={{ value: `start · ${startPoint.weight} kg`, position: 'top', fontSize: 10, fill: 'var(--text-secondary)' }} />}
            {midPoint && <ReferenceDot x={midPoint.date} y={midPoint.weight} r={3} fill="var(--teal)" />}
            {nearEndPoint && <ReferenceDot x={nearEndPoint.date} y={nearEndPoint.weight} r={3} fill="var(--teal)" />}
            {endPoint && <ReferenceDot x={endPoint.date} y={endPoint.weight} r={4} fill="var(--sienna)" label={{ value: `goal · ${endPoint.weight} kg`, position: 'bottom', fontSize: 10, fill: 'var(--sienna)' }} />}
          </LineChart>
        </ResponsiveContainer>
        <div className="grid-4" style={{ marginTop: 16 }}>
          <div><div className="eyebrow">Total loss required</div><div className="equation-value" style={{ fontSize: 20 }}>{p.totalDeltaKg} kg</div></div>
          <div><div className="eyebrow">Weekly rate</div><div className="equation-value" style={{ fontSize: 20 }}>{p.weeklyRate} kg/wk</div></div>
          <div><div className="eyebrow">Duration</div><div className="equation-value" style={{ fontSize: 20 }}>{p.durationLabel}</div></div>
          <div><div className="eyebrow">Target date</div><div className="equation-value" style={{ fontSize: 20 }}>{format(new Date(p.targetDate), 'MMM d, yyyy')}</div></div>
        </div>
      </div>

      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Daily calorie target &mdash; recalculated every day</div>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{firstTarget} &rarr; {lastTarget} kcal/day, adjusted every day</div>
      <div className="card">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={targetEvolutionData}>
            <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} domain={['auto', 'auto']} />
            <ChartTooltip />
            <Line type="monotone" dataKey="target" stroke="var(--steel)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="row-between" style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600 }}>Day-by-day targets</div>
        <div className="eyebrow">click a week to expand it</div>
      </div>
      <div className="card table-scroll" style={{ padding: 0, maxHeight: 480, overflowY: 'auto' }}>
        <table style={{ minWidth: 520 }}>
          <thead>
            <tr><th>Day</th><th>Date</th><th>Weight</th><th>BMR</th><th>TDEE</th><th style={{ textAlign: 'right' }}>Eat today</th></tr>
          </thead>
          <tbody>
            {p.weeks.map(week => (
              <FragmentWeek key={week.weekNumber} week={week} expanded={!!expandedWeeks[week.weekNumber]}
                onToggle={() => setExpandedWeeks({ ...expandedWeeks, [week.weekNumber]: !expandedWeeks[week.weekNumber] })} />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, marginTop: 16, lineHeight: 1.6 }}>
        <p>Both curves assume a fixed 7,700 kcal &asymp; 1 kg of fat and a perfectly steady rate &mdash; real progress isn't linear.
        Water retention, training load, and hormones will make individual days noisy; judge the trend over 2&ndash;3 weeks, not day to day.</p>
        <p>The calorie target above is recalculated for every single day from your projected weight, so it drifts down gradually as your
        weight changes &mdash; that's what holds the deficit fixed at exactly {p.dailyAdjustment} kcal throughout, instead of a flat number
        that quietly shrinks as your TDEE falls. Re-weigh weekly and swap in your actual number if it diverges from the projection.</p>
      </div>
    </div>
  )
}

function FragmentWeek({ week, expanded, onToggle }) {
  return (
    <>
      <tr className="week-row" onClick={onToggle}>
        <td colSpan={6}>
          {expanded ? '▾' : '▸'} Week {week.weekNumber} &middot; {week.startDate}&ndash;{week.endDate} &middot; {week.startWeight}&rarr;{week.endWeight} kg &middot; avg {week.avgKcal} kcal/day
        </td>
      </tr>
      {expanded && week.days.map(d => (
        <tr key={d.date}>
          <td>Day {d.dayNumber}</td>
          <td>{d.dateLabel}</td>
          <td>{d.weightKg} kg</td>
          <td>{d.bmr}</td>
          <td>{d.tdee}</td>
          <td style={{ textAlign: 'right', color: 'var(--teal)' }}>{d.target.toLocaleString()} kcal{d.clamped && <span className="chip-est" style={{ background: 'var(--sienna-soft)', color: 'var(--sienna)' }}>MIN</span>}</td>
        </tr>
      ))}
    </>
  )
}

function TrackProgressTab() {
  const { user, profile } = useAuth()
  const { planSummary, dailyLogs, saveDailyLog, streaksAndAdherence, recompute } = useDeficitStore()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [calories, setCalories] = useState('')
  const [weight, setWeight] = useState('')

  useEffect(() => { if (user && profile) recompute(user.id, profile) }, [user, profile])

  const dayNum = profile?.plan_started_at
    ? Math.max(1, differenceInCalendarDays(new Date(), new Date(profile.plan_started_at)) + 1)
    : 1

  const save = async () => {
    if (!calories && !weight) return
    await saveDailyLog(user.id, date, { caloriesEaten: calories, weightKg: weight })
    await recompute(user.id, profile)
    setCalories(''); setWeight('')
    toast.success('Entry saved')
  }

  const adherence = streaksAndAdherence()

  const planByDate = useMemo(() => Object.fromEntries((planSummary?.days || []).map(d => [d.date, d])), [planSummary])
  const chartWeights = dailyLogs.filter(l => l.weight_kg != null).map(l => ({ date: l.log_date, weight: Number(l.weight_kg) }))
  const trend = movingAverageTrend(chartWeights)
  const trendByDate = Object.fromEntries(trend.map(t => [t.date, t.trend]))

  const calorieChartData = (planSummary?.days || []).slice(0, Math.max(dailyLogs.length + 5, 30)).map(d => {
    const log = dailyLogs.find(l => l.log_date === d.date)
    return { date: d.dateLabel, target: d.target, logged: log?.calories_eaten ?? null }
  })

  const weightChartData = (planSummary?.days || []).slice(0, Math.max(dailyLogs.length + 5, 30)).map(d => {
    const log = dailyLogs.find(l => l.log_date === d.date)
    return { date: d.dateLabel, projected: d.weightKg, logged: log?.weight_kg ?? null, trend: trendByDate[d.date] ?? null }
  })

  const exportCsv = () => {
    const rows = ['date,weight,calories,vs_target']
    dailyLogs.forEach(l => {
      const target = planByDate[l.log_date]?.target || ''
      const vs = (l.calories_eaten != null && target) ? l.calories_eaten - target : ''
      rows.push(`${l.log_date},${l.weight_kg ?? ''},${l.calories_eaten ?? ''},${vs}`)
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'entry-log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600 }}>Log today</div>
        <div className="eyebrow">Day {dayNum} of the protocol</div>
      </div>
      <div className="card">
        <div className="grid-4">
          <div><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label>Calories eaten</label><input type="number" placeholder="e.g. 2050" value={calories} onChange={e => setCalories(e.target.value)} /></div>
          <div><label>Weight (kg)</label><input type="number" step="0.1" placeholder="e.g. 96.0" value={weight} onChange={e => setWeight(e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={save}>SAVE ENTRY</button>
          </div>
        </div>
      </div>

      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, margin: '24px 0 12px' }}>Adherence</div>
      <div className="card">
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <div><div className="eyebrow">Current streak</div><div className="equation-value" style={{ fontSize: 22 }}>{adherence.current} days</div></div>
          <div><div className="eyebrow">Last 7 days</div><div className="equation-value" style={{ fontSize: 22 }}>{adherence.last7} of 7</div></div>
          <div><div className="eyebrow">Within 10% of target</div><div className="equation-value" style={{ fontSize: 22 }}>{adherence.within10 != null ? adherence.within10 + '%' : '—'}</div></div>
          <div><div className="eyebrow">Avg vs target</div><div className="equation-value" style={{ fontSize: 22 }}>{adherence.avgVsTarget != null ? (adherence.avgVsTarget > 0 ? '+' : '') + adherence.avgVsTarget : '—'}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {(adherence.weekFlags.length ? adherence.weekFlags : Array(7).fill(false)).map((f, i) => (
            <div key={i} style={{ width: 18, height: 18, borderRadius: 3, background: f ? 'var(--teal)' : 'var(--border)' }} />
          ))}
        </div>
        {adherence.current === 0 && <div className="eyebrow">Log a day to start building a streak.</div>}
      </div>

      <div className="row-between" style={{ marginBottom: 8, marginTop: 24 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600 }}>Calories &mdash; logged vs. target</div>
        <div className="eyebrow">{dailyLogs.length ? `${dailyLogs.length} entries` : 'no entries yet'}</div>
      </div>
      <div className="card">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={calorieChartData}>
            <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} domain={['auto', 'auto']} />
            <ChartTooltip />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
            <Line type="monotone" dataKey="target" name="Target (recalculated daily)" stroke="var(--steel)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="logged" name="Logged intake" stroke="var(--sienna)" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="row-between" style={{ marginBottom: 8, marginTop: 24 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600 }}>Weight &mdash; logged vs. projected</div>
        <div className="eyebrow">{chartWeights.length ? `${chartWeights.length} entries` : 'no entries yet'}</div>
      </div>
      <div className="card">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={weightChartData}>
            <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} domain={['auto', 'auto']} />
            <ChartTooltip />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
            <Line type="monotone" dataKey="projected" name="Projected" stroke="var(--teal)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="logged" name="Logged weight" stroke="var(--sienna)" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
            <Line type="monotone" dataKey="trend" name="7-day average" stroke="var(--steel)" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="row-between" style={{ marginBottom: 8, marginTop: 24 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600 }}>Entry log</div>
        <button className="btn btn-secondary btn-pill" onClick={exportCsv}>EXPORT CSV</button>
      </div>
      <div className="card table-scroll" style={{ padding: 0 }}>
        <table style={{ minWidth: 480 }}>
          <thead><tr><th>Date</th><th>Weight</th><th>Calories</th><th style={{ textAlign: 'right' }}>vs. target</th></tr></thead>
          <tbody>
            {dailyLogs.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>No entries logged yet &mdash; add today's numbers above.</td></tr>}
            {[...dailyLogs].reverse().map(l => {
              const target = planByDate[l.log_date]?.target
              const vs = (l.calories_eaten != null && target) ? l.calories_eaten - target : null
              return (
                <tr key={l.log_date}>
                  <td>{l.log_date}</td>
                  <td>{l.weight_kg ?? '—'}</td>
                  <td>{l.calories_eaten ?? '—'}</td>
                  <td style={{ textAlign: 'right', color: vs == null ? 'var(--text-secondary)' : (vs > 0 ? 'var(--sienna)' : 'var(--teal)') }}>
                    {vs == null ? '—' : (vs > 0 ? '+' : '') + vs}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="eyebrow" style={{ marginTop: 12 }}>* Entries save automatically and sync to every device using the same sync code.</div>
    </div>
  )
}
