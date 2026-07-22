import { bmrMifflinStJeor, bmrKatchMcArdle, tdee as calcTdee } from './calculations'

const KCAL_PER_KG = 7700

// ---------- Section 3: Body Composition Engine ----------

export function computeBmr({ weightKg, heightCm, age, sex, bodyFatPct }) {
  if (bodyFatPct != null && bodyFatPct > 0) {
    return { value: bmrKatchMcArdle({ weightKg, bodyFatPct }), formula: 'katch_mcardle' }
  }
  return { value: bmrMifflinStJeor({ weightKg, heightCm, age, sex }), formula: 'mifflin_st_jeor' }
}

export function computeTdee(bmr, activityLevel) {
  return calcTdee(bmr, activityLevel)
}

// Seven-day moving average trend weight — gap tolerant (section 3.4.1)
export function movingAverageTrend(entries, windowDays = 7) {
  // entries: [{date: 'yyyy-MM-dd', weight: number}] sorted ascending by date
  const byDate = new Map(entries.map(e => [e.date, e.weight]))
  const dates = entries.map(e => e.date)
  const result = []
  for (let i = 0; i < dates.length; i++) {
    const windowStart = Math.max(0, i - windowDays + 1)
    const windowEntries = entries.slice(windowStart, i + 1)
    if (windowEntries.length < 2) {
      result.push({ date: dates[i], trend: null })
      continue
    }
    const avg = windowEntries.reduce((a, e) => a + e.weight, 0) / windowEntries.length
    result.push({ date: dates[i], trend: avg })
  }
  return result
}

// Exponential smoothing — current single trend-weight figure (section 3.4.2)
export function exponentialTrend(entries, alpha = 0.15) {
  if (!entries.length) return null
  let trend = entries[0].weight
  for (let i = 1; i < entries.length; i++) {
    trend = alpha * entries[i].weight + (1 - alpha) * trend
  }
  return trend
}

// Outlier flag (section 3.4.3)
export function flagOutliers(entries) {
  if (entries.length < 3) return entries.map(e => ({ ...e, isOutlier: false }))
  const recent = entries.slice(-14).map(e => e.weight)
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length
  const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length
  const stdDev = Math.sqrt(variance)
  return entries.map((e, i) => {
    if (i === 0 || stdDev === 0) return { ...e, isOutlier: false }
    const prevTrend = entries[i - 1].weight
    const isOutlier = Math.abs(e.weight - prevTrend) > 3 * stdDev
    return { ...e, isOutlier }
  })
}

// Linear regression slope over trend points (used for plateau + actual rate)
export function linearRegressionSlope(points) {
  // points: [{x: dayIndex, y: value}]
  const n = points.length
  if (n < 2) return 0
  const sumX = points.reduce((a, p) => a + p.x, 0)
  const sumY = points.reduce((a, p) => a + p.y, 0)
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0)
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return 0
  return (n * sumXY - sumX * sumY) / denom
}

// Plateau detection (section 3.6): |slope over trailing 14d trend| < 0.1% bodyweight/week
export function detectPlateau(trendPoints, currentWeightKg, goalType) {
  if (goalType === 'maintain' || trendPoints.length < 14) return false
  const last14 = trendPoints.slice(-14).filter(p => p.trend != null)
  if (last14.length < 14) return false
  const points = last14.map((p, i) => ({ x: i, y: p.trend }))
  const slopePerDay = linearRegressionSlope(points)
  const slopePerWeek = slopePerDay * 7
  const thresholdPerWeek = currentWeightKg * 0.001
  return Math.abs(slopePerWeek) < thresholdPerWeek
}

// ---------- Section 3.3: Adaptive TDEE ----------

export function adaptiveTdeePreconditionsMet(weightLogDays, foodLogDays) {
  return weightLogDays >= 14 && foodLogDays >= 10
}

export function computeAdaptiveTdee({ trendWeightStart, trendWeightEnd, windowDays, avgDailyCaloriesLogged }) {
  const weightChangeKg = trendWeightEnd - trendWeightStart
  const observedDailyBalance = (weightChangeKg * KCAL_PER_KG) / windowDays
  return avgDailyCaloriesLogged - observedDailyBalance
}

export function blendTdee(calculatedTdee, adaptiveTdee, qualifyingDataDays) {
  const confidence = Math.min(1, qualifyingDataDays / 28)
  const blended = calculatedTdee * (1 - confidence) + adaptiveTdee * confidence
  return { blended, confidence }
}

// ---------- Section 4: Calorie Planning Engine ----------

export function minimumSafeCalories(bmr, sex) {
  return sex === 'male' ? Math.max(1500, bmr) : Math.max(1200, bmr)
}

export function computeDailyDeficitOrSurplus(weeklyWeightChangeKg) {
  return (Math.abs(weeklyWeightChangeKg) * KCAL_PER_KG) / 7
}

export function computeDailyCalorieTarget({ tdeeValue, goalType, weeklyWeightChangeTargetKg, bmr, sex }) {
  let daily
  let adjustment = 0
  if (goalType === 'maintain') {
    daily = tdeeValue
  } else if ((goalType === 'lose' || goalType === 'aggressive_cut' || goalType === 'recomposition') || weeklyWeightChangeTargetKg < 0) {
    adjustment = computeDailyDeficitOrSurplus(weeklyWeightChangeTargetKg)
    daily = tdeeValue - adjustment
  } else {
    adjustment = computeDailyDeficitOrSurplus(weeklyWeightChangeTargetKg)
    daily = tdeeValue + adjustment
  }

  const floor = minimumSafeCalories(bmr, sex)
  let clamped = false
  let effectiveWeeklyRate = weeklyWeightChangeTargetKg
  if (daily < floor) {
    clamped = true
    const clampedAdjustment = tdeeValue - floor
    effectiveWeeklyRate = -(clampedAdjustment * 7) / KCAL_PER_KG
    daily = floor
  }

  const aggressiveThreshold = tdeeValue * 0.35
  const isAggressive = adjustment > aggressiveThreshold
  const isSurplus = daily > tdeeValue

  let colorState = 'green'
  if (clamped) colorState = 'red'
  else if (isSurplus) colorState = 'blue'
  else if (isAggressive) colorState = 'orange'

  return {
    dailyCalories: Math.round(daily),
    adjustment: Math.round(adjustment),
    clamped,
    effectiveWeeklyRate,
    isAggressive,
    isSurplus,
    colorState,
    floor: Math.round(floor)
  }
}

// ---------- Section 5: Macronutrient Engine ----------

export function computeProteinTarget({ referenceWeightKg, goalType, dailyDeficit, tdeeValue }) {
  const multipliers = { lose: 2.0, aggressive_cut: 2.0, maintain: 1.6, gain: 1.8, lean_bulk: 1.8, slow_bulk: 1.8, recomposition: 1.9 }
  let multiplier = multipliers[goalType] ?? 1.8
  if (goalType === 'lose' || goalType === 'aggressive_cut') {
    const scale = Math.min(1, (dailyDeficit || 0) / (tdeeValue * 0.35))
    multiplier = 2.0 + 0.2 * scale
  }
  return Math.round(multiplier * referenceWeightKg)
}

export function computeFatTarget({ weightKg, dailyCalories }) {
  const floor = 0.6 * weightKg
  const percentBased = (dailyCalories * 0.25) / 9
  return Math.round(Math.max(floor, percentBased))
}

export function computeCarbTarget({ dailyCalories, proteinG, fatG }) {
  const proteinCal = proteinG * 4
  const fatCal = fatG * 9
  const remaining = dailyCalories - proteinCal - fatCal
  let carbG = Math.round(remaining / 4)
  let adjustedProtein = proteinG
  let adjustedFat = fatG
  let wasAdjusted = false
  if (carbG < 50) {
    wasAdjusted = true
    carbG = 50
    const carbCal = carbG * 4
    const overBudget = (proteinCal + fatCal + carbCal) - dailyCalories
    const proteinTrim = Math.min(overBudget / 4, proteinG * 0.15)
    adjustedProtein = Math.round(proteinG - proteinTrim)
  }
  return { carbG: Math.max(0, carbG), proteinG: adjustedProtein, fatG: adjustedFat, wasAdjusted }
}

export function computeMacroTargets({ dailyCalories, referenceWeightKg, goalType, dailyDeficit, tdeeValue, weightKg }) {
  const proteinG = computeProteinTarget({ referenceWeightKg, goalType, dailyDeficit, tdeeValue })
  const fatG = computeFatTarget({ weightKg, dailyCalories })
  const { carbG, proteinG: finalProtein, fatG: finalFat, wasAdjusted } = computeCarbTarget({ dailyCalories, proteinG, fatG })
  return { protein: finalProtein, carbs: carbG, fat: finalFat, wasAdjusted }
}

// ---------- Section 4.4-4.5: Rate & projection ----------

export function actualWeeklyRate(trendPoints) {
  const valid = trendPoints.filter(p => p.trend != null)
  if (valid.length < 2) return 0
  const points = valid.map((p, i) => ({ x: i, y: p.trend }))
  return linearRegressionSlope(points) * 7
}

export function projectedCompletionDate({ currentWeightKg, goalWeightKg, actualRateKgPerWeek, plannedRateKgPerWeek, hasEnoughTrendData }) {
  const rate = hasEnoughTrendData ? actualRateKgPerWeek : plannedRateKgPerWeek
  if (!rate) return { date: null, weeksRemaining: null, trending: false }
  const remaining = goalWeightKg - currentWeightKg
  const weeksNeeded = remaining / rate
  if (weeksNeeded <= 0) return { date: null, weeksRemaining: null, trending: false }
  const date = new Date()
  date.setDate(date.getDate() + weeksNeeded * 7)
  return { date, weeksRemaining: Math.round(weeksNeeded), trending: true }
}

// ---------- Section 9.1(5): Progress percentage ----------

export function progressPercent({ startingWeightKg, currentWeightKg, goalWeightKg }) {
  if (!startingWeightKg || !goalWeightKg || startingWeightKg === goalWeightKg) return 0
  const pct = (Math.abs(startingWeightKg - currentWeightKg) / Math.abs(startingWeightKg - goalWeightKg)) * 100
  return Math.min(100, Math.max(0, pct))
}

// ---------- Section 11.5: Adherence ----------

export function computeAdherence(dailyLogs) {
  // dailyLogs: [{date, calories, target}]
  const logged = dailyLogs.filter(d => d.calories != null && d.target)
  if (!logged.length) return { daysOnTarget: 0, totalLoggedDays: 0, adherencePct: 0, avgDeviation: 0 }
  let onTarget = 0
  let deviationSum = 0
  logged.forEach(d => {
    const dev = d.calories - d.target
    deviationSum += Math.abs(dev)
    if (Math.abs(dev) <= d.target * 0.1) onTarget++
  })
  return {
    daysOnTarget: onTarget,
    totalLoggedDays: logged.length,
    adherencePct: Math.round((onTarget / logged.length) * 100),
    avgDeviation: Math.round(deviationSum / logged.length)
  }
}

export function computeStreaks(loggedDates) {
  // loggedDates: sorted array of 'yyyy-MM-dd' strings ascending, days that have a food log
  if (!loggedDates.length) return { current: 0, longest: 0 }
  const set = new Set(loggedDates)
  let longest = 0
  let run = 0
  let prev = null
  loggedDates.forEach(d => {
    const day = new Date(d)
    if (prev && (day - prev) / 86400000 === 1) {
      run += 1
    } else {
      run = 1
    }
    longest = Math.max(longest, run)
    prev = day
  })

  let current = 0
  let cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    if (set.has(key)) {
      current++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
  }
  return { current, longest }
}

// ---------- Section 11.6: Goal milestones ----------

export function computeMilestones({ startingWeightKg, currentWeightKg, goalWeightKg, progressPct }) {
  const milestones = []
  const direction = goalWeightKg < startingWeightKg ? -1 : 1
  const totalDelta = Math.abs(goalWeightKg - startingWeightKg)
  const step = 5
  for (let s = step; s < totalDelta; s += step) {
    const thresholdWeight = startingWeightKg + direction * s
    const crossed = direction < 0 ? currentWeightKg <= thresholdWeight : currentWeightKg >= thresholdWeight
    if (crossed) milestones.push({ key: `delta_${s}kg`, label: `${s} kg ${direction < 0 ? 'lost' : 'gained'}` })
  }
  if (progressPct >= 50) milestones.push({ key: 'halfway', label: 'Halfway to goal' })
  if (progressPct >= 100) milestones.push({ key: 'goal_reached', label: 'Goal reached' })
  return milestones
}

// ---------- Section 12: Adaptive Intelligence ----------

export function evaluateRecalibration({ startingWeightKg, goalWeightKg, currentWeightKg, weeksElapsed, plannedRateKgPerWeek, goalType }) {
  const expectedWeight = startingWeightKg + plannedRateKgPerWeek * weeksElapsed
  const deviation = currentWeightKg - expectedWeight
  const totalPlannedChange = Math.abs(goalWeightKg - startingWeightKg) || 1

  if (goalType === 'maintain') {
    const pctBodyWeight = Math.abs(deviation) / currentWeightKg
    return { shouldRecalibrate: pctBodyWeight > 0.02, deviation, reason: 'maintenance_drift' }
  }

  const pctOfPlan = Math.abs(deviation) / totalPlannedChange
  return { shouldRecalibrate: pctOfPlan > 0.05, deviation, reason: 'off_plan' }
}

export function plateauRecoverySuggestion({ adaptiveTdeeValue, plannedRateKgPerWeek, weeksInDeficit }) {
  const calorieAdjustTarget = Math.round(adaptiveTdeeValue - (plannedRateKgPerWeek * KCAL_PER_KG) / 7)
  const suggestDietBreak = weeksInDeficit >= 8
  return { calorieAdjustTarget, suggestDietBreak }
}

export const ADAPTIVE = { KCAL_PER_KG }
