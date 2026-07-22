import { addDays, differenceInCalendarDays, format } from 'date-fns'
import { ageFromBirthDate, bmrMifflinStJeor, bmrHarrisBenedict, bmrKatchMcArdle, ACTIVITY_MULTIPLIERS } from './calculations'

const KCAL_PER_KG = 7700
const MIN_SAFE_MALE = 1500
const MIN_SAFE_FEMALE = 1200

export function bmrFor(weightKg, heightCm, age, sex, bodyFatPct) {
  if (bodyFatPct) return bmrKatchMcArdle({ weightKg, bodyFatPct })
  return bmrMifflinStJeor({ weightKg, heightCm, age, sex })
}

export function activityMultiplier(level) {
  return ACTIVITY_MULTIPLIERS[level] || 1.2
}

// Determine the fixed daily deficit (or surplus) from the plan's starting point.
// If the user set an explicit weekly rate, derive deficit from that.
// Otherwise derive a default deficit from goal direction (~25% of TDEE, clamped to safe floor).
export function computeFixedDailyDeficit({ startWeightKg, goalWeightKg, heightCm, age, sex, activityLevel, bodyFatPct, weeklyRateKg }) {
  const bmr0 = bmrFor(startWeightKg, heightCm, age, sex, bodyFatPct)
  const tdee0 = bmr0 * activityMultiplier(activityLevel)
  const direction = goalWeightKg < startWeightKg ? -1 : (goalWeightKg > startWeightKg ? 1 : 0)

  let rate = weeklyRateKg
  if (rate == null) {
    // default: 20% of TDEE as a daily deficit/surplus, translated to a weekly rate
    const defaultDaily = tdee0 * 0.2 * (direction === 0 ? 0 : 1)
    rate = direction * (defaultDaily * 7) / KCAL_PER_KG
  }

  const dailyAdjustment = (Math.abs(rate) * KCAL_PER_KG) / 7
  return { bmr0, tdee0, dailyAdjustment, direction: rate < 0 ? -1 : (rate > 0 ? 1 : 0), weeklyRate: rate }
}

export function minSafeCalories(sex) {
  return sex === 'male' ? MIN_SAFE_MALE : MIN_SAFE_FEMALE
}

// Generates the full day-by-day plan from start to goal (or a max horizon) using
// a fixed daily deficit and a linear planned-weight curve, recalculating
// BMR/TDEE/target from that day's projected weight — exactly mirroring the
// "deficit stays fixed while target eases down" behavior in the reference app.
export function generatePlan({
  startWeightKg, goalWeightKg, heightCm, age, sex, activityLevel, bodyFatPct,
  weeklyRateKg, startDate = new Date(), maxDays = 400
}) {
  const { bmr0, tdee0, dailyAdjustment, direction, weeklyRate } = computeFixedDailyDeficit({
    startWeightKg, goalWeightKg, heightCm, age, sex, activityLevel, bodyFatPct, weeklyRateKg
  })

  const totalDeltaKg = Math.abs(goalWeightKg - startWeightKg)
  // days needed to reach goal at this fixed daily adjustment
  const durationDays = direction === 0 || dailyAdjustment === 0
    ? 1
    : Math.max(1, Math.round((totalDeltaKg * KCAL_PER_KG) / dailyAdjustment))

  const days = []
  const floor = minSafeCalories(sex)
  let clampedAny = false

  const n = Math.min(durationDays, maxDays)
  for (let i = 0; i < n; i++) {
    const date = addDays(startDate, i)
    const projectedWeight = direction === 0
      ? startWeightKg
      : startWeightKg + direction * (totalDeltaKg * (i / (n - 1 || 1)))
    const bmr = bmrFor(projectedWeight, heightCm, age, sex, bodyFatPct)
    const tdee = bmr * activityMultiplier(activityLevel)
    let target = direction < 0 ? tdee - dailyAdjustment : (direction > 0 ? tdee + dailyAdjustment : tdee)
    let clamped = false
    if (direction < 0 && target < floor) {
      target = floor
      clamped = true
      clampedAny = true
    }
    days.push({
      dayNumber: i + 1,
      date: format(date, 'yyyy-MM-dd'),
      dateLabel: format(date, 'MMM d'),
      weightKg: Math.round(projectedWeight * 10) / 10,
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      target: Math.round(target),
      clamped
    })
  }

  const groupedWeeks = groupByWeek(days)

  return {
    bmr0: Math.round(bmr0),
    tdee0: Math.round(tdee0),
    dailyAdjustment: Math.round(dailyAdjustment),
    weeklyRate: Math.round(weeklyRate * 100) / 100,
    direction,
    totalDeltaKg: Math.round(totalDeltaKg * 10) / 10,
    durationDays: n,
    durationLabel: `${n} days (${(n / 30.44).toFixed(1)} mo)`,
    targetDate: days.length ? days[days.length - 1].date : null,
    days,
    weeks: groupedWeeks,
    clampedAny,
    minSafeCalories: floor,
    todayTarget: days[0] || null
  }
}

function groupByWeek(days) {
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7)
    const avgKcal = Math.round(chunk.reduce((a, d) => a + d.target, 0) / chunk.length)
    weeks.push({
      weekNumber: Math.floor(i / 7) + 1,
      startDate: chunk[0].dateLabel,
      endDate: chunk[chunk.length - 1].dateLabel,
      startWeight: chunk[0].weightKg,
      endWeight: chunk[chunk.length - 1].weightKg,
      avgKcal,
      days: chunk
    })
  }
  return weeks
}

export function macroSplitFor(dailyCalories, preset = 'balanced') {
  const presets = {
    balanced: { protein: 0.3, carbs: 0.4, fat: 0.3 },
    high_protein: { protein: 0.4, carbs: 0.3, fat: 0.3 },
    low_carb: { protein: 0.35, carbs: 0.2, fat: 0.45 },
    keto: { protein: 0.25, carbs: 0.05, fat: 0.7 }
  }
  const p = presets[preset] || presets.balanced
  return {
    protein: Math.round((dailyCalories * p.protein) / 4),
    carbs: Math.round((dailyCalories * p.carbs) / 4),
    fat: Math.round((dailyCalories * p.fat) / 9),
    proteinPct: Math.round(p.protein * 100),
    carbsPct: Math.round(p.carbs * 100),
    fatPct: Math.round(p.fat * 100)
  }
}
