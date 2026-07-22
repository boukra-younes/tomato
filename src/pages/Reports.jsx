import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useDeficitStore } from '../context/useDeficitStore'
import Heatmap from '../components/Heatmap'
import { format, subDays } from 'date-fns'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts'

export default function Reports() {
  const { user, profile } = useAuth()
  const { planSummary, dailyLogs, recompute, streaksAndAdherence } = useDeficitStore()
  const [period, setPeriod] = useState('weekly')

  useEffect(() => { if (user && profile) recompute(user.id, profile) }, [user, profile])

  const days = period === 'weekly' ? 7 : period === 'monthly' ? 30 : 1
  const since = format(subDays(new Date(), days), 'yyyy-MM-dd')
  const windowLogs = dailyLogs.filter(l => l.log_date >= since)

  const avgCalories = windowLogs.length ? Math.round(windowLogs.reduce((a, l) => a + Number(l.calories_eaten || 0), 0) / windowLogs.filter(l => l.calories_eaten != null).length || 0) : 0
  const adherence = streaksAndAdherence()

  const heatData = dailyLogs.filter(l => l.calories_eaten != null).map(l => ({ date: l.log_date, value: Number(l.calories_eaten) }))
  const heatColor = (v) => {
    if (!v) return 'var(--border)'
    const target = planSummary?.todayTarget?.target || 1800
    if (Math.abs(v - target) <= target * 0.1) return 'var(--teal)'
    return 'var(--sienna)'
  }

  const targetEvolution = (planSummary?.days || []).slice(0, 60).map(d => ({ date: d.dateLabel, target: d.target, tdee: d.tdee }))

  return (
    <div>
      <div className="eyebrow">Reports</div>
      <h1 className="hero-number" style={{ fontSize: 40 }}>Consistency</h1>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {['daily', 'weekly', 'monthly'].map(p => (
          <button key={p} className={'tab' + (period === p ? ' active' : '')} onClick={() => setPeriod(p)}>{p.toUpperCase()}</button>
        ))}
      </div>

      <div className="grid-4">
        <div className="card"><div className="eyebrow">Avg calories</div><div className="equation-value">{avgCalories || '—'}</div></div>
        <div className="card"><div className="eyebrow">Adherence</div><div className="equation-value text-teal">{adherence.within10 != null ? adherence.within10 + '%' : '—'}</div></div>
        <div className="card"><div className="eyebrow">Current streak</div><div className="equation-value">{adherence.current}d</div></div>
        <div className="card"><div className="eyebrow">Last 7 days</div><div className="equation-value">{adherence.last7}/7</div></div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Calorie target evolution</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={targetEvolution}>
            <CartesianGrid strokeDasharray="2 2" stroke="var(--border)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} minTickGap={40} />
            <YAxis tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }} domain={['auto', 'auto']} />
            <ChartTooltip />
            <Line type="monotone" dataKey="tdee" name="TDEE" stroke="var(--steel)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="target" name="Target" stroke="var(--teal)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Logging heatmap (last year)</div>
        <Heatmap data={heatData} colorFn={heatColor} />
      </div>
    </div>
  )
}
