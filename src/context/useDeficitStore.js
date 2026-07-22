import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
import { format } from 'date-fns'
import { generatePlan, macroSplitFor } from '../lib/planEngine'
import { ageFromBirthDate } from '../lib/calculations'
import { movingAverageTrend, exponentialTrend, flagOutliers, detectPlateau, linearRegressionSlope } from '../lib/adaptiveEngine'

export const useDeficitStore = create((set, get) => ({
  planSummary: null,   // full generatePlan() output
  macros: null,
  dailyLogs: [],        // [{log_date, calories_eaten, weight_kg}]
  weightEntries: [],     // from dailyLogs where weight present
  trendPoints: [],
  currentTrendWeight: null,
  plateau: false,
  loading: false,

  recompute: async (userId, profile) => {
    if (!profile?.birth_date || !profile?.height_cm || !profile?.starting_weight_kg || !profile?.goal_weight_kg) {
      set({ planSummary: null })
      return
    }
    set({ loading: true })
    const age = ageFromBirthDate(profile.birth_date)

    const { data: logs } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: true })

    const dailyLogs = logs || []
    const weightEntries = dailyLogs.filter(l => l.weight_kg != null).map(l => ({ date: l.log_date, weight: Number(l.weight_kg) }))
    const flagged = flagOutliers(weightEntries)
    const clean = flagged.filter(e => !e.isOutlier)
    const trendPoints = movingAverageTrend(clean.length ? clean : weightEntries)
    const currentTrendWeight = exponentialTrend(clean.length ? clean : weightEntries) || profile.starting_weight_kg

    const plan = generatePlan({
      startWeightKg: currentTrendWeight || profile.starting_weight_kg,
      goalWeightKg: profile.goal_weight_kg,
      heightCm: profile.height_cm,
      age,
      sex: profile.sex,
      activityLevel: profile.activity_level,
      bodyFatPct: profile.body_fat_pct,
      weeklyRateKg: profile.weekly_weight_change_target_kg,
      startDate: new Date()
    })

    const macros = macroSplitFor(plan.todayTarget?.target || plan.tdee0, profile.macro_preset)
    const plateau = detectPlateau(trendPoints, currentTrendWeight, profile.goal_type)

    set({
      planSummary: plan, macros, dailyLogs, weightEntries, trendPoints,
      currentTrendWeight, plateau, loading: false
    })
  },

  saveDailyLog: async (userId, dateStr, { caloriesEaten, weightKg }) => {
    const patch = { user_id: userId, log_date: dateStr }
    if (caloriesEaten != null && caloriesEaten !== '') patch.calories_eaten = Number(caloriesEaten)
    if (weightKg != null && weightKg !== '') patch.weight_kg = Number(weightKg)
    const { data, error } = await supabase.from('daily_logs').upsert(patch, { onConflict: 'user_id,log_date' }).select().single()
    if (error) throw error
    const others = get().dailyLogs.filter(l => l.log_date !== dateStr)
    set({ dailyLogs: [...others, data].sort((a, b) => a.log_date.localeCompare(b.log_date)) })
    return data
  },

  streaksAndAdherence: () => {
    const { dailyLogs, planSummary } = get()
    if (!planSummary) return { current: 0, last7: 0, within10: null, avgVsTarget: null, weekFlags: [] }
    const byDate = Object.fromEntries(dailyLogs.map(l => [l.log_date, l]))
    const planByDate = Object.fromEntries(planSummary.days.map(d => [d.date, d]))

    let current = 0
    let cursor = new Date()
    while (true) {
      const key = format(cursor, 'yyyy-MM-dd')
      if (byDate[key]?.calories_eaten != null) {
        current++
        cursor.setDate(cursor.getDate() - 1)
      } else break
    }

    const last7Dates = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return format(d, 'yyyy-MM-dd')
    }).reverse()
    const weekFlags = last7Dates.map(d => !!byDate[d]?.calories_eaten)
    const last7 = weekFlags.filter(Boolean).length

    const loggedWithTarget = dailyLogs
      .filter(l => l.calories_eaten != null && planByDate[l.log_date])
      .map(l => ({ diff: l.calories_eaten - planByDate[l.log_date].target, target: planByDate[l.log_date].target }))

    const within10 = loggedWithTarget.length
      ? Math.round((loggedWithTarget.filter(l => Math.abs(l.diff) <= l.target * 0.1).length / loggedWithTarget.length) * 100)
      : null
    const avgVsTarget = loggedWithTarget.length
      ? Math.round(loggedWithTarget.reduce((a, l) => a + l.diff, 0) / loggedWithTarget.length)
      : null

    return { current, last7, within10, avgVsTarget, weekFlags }
  }
}))
