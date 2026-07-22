export function ageFromBirthDate(birthDate) {
  const b = new Date(birthDate)
  const diff = Date.now() - b.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
}

export function bmrMifflinStJeor({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function bmrHarrisBenedict({ weightKg, heightCm, age, sex }) {
  return sex === 'male'
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age
}

export function bmrKatchMcArdle({ weightKg, bodyFatPct }) {
  const leanMass = weightKg * (1 - bodyFatPct / 100)
  return 370 + 21.6 * leanMass
}

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9
}

export function tdee(bmr, activityLevel) {
  return bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.55)
}

export function bodyFatNavy({ sex, heightCm, neckCm, waistCm, hipCm }) {
  if (sex === 'male') {
    return 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450
  }
  return 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.22100 * Math.log10(heightCm)) - 450
}

export function relativeFatMass({ sex, heightCm, waistCm }) {
  const ratio = heightCm / waistCm
  return sex === 'male' ? 64 - 20 * ratio : 76 - 20 * ratio
}

export function bodyFatYmca({ sex, weightKg, waistCm }) {
  const weightLb = weightKg * 2.20462
  const waistIn = waistCm / 2.54
  if (sex === 'male') {
    return ((-98.42 + 4.15 * waistIn - 0.082 * weightLb) / weightLb) * 100
  }
  return ((-76.76 + 4.15 * waistIn - 0.082 * weightLb) / weightLb) * 100
}

export function bodyFatBmiEstimate({ bmi, age, sex }) {
  const sexFactor = sex === 'male' ? 1 : 0
  return (1.20 * bmi) + (0.23 * age) - (10.8 * sexFactor) - 5.4
}

export function leanBodyMassBoer({ sex, weightKg, heightCm }) {
  return sex === 'male'
    ? 0.407 * weightKg + 0.267 * heightCm - 19.2
    : 0.252 * weightKg + 0.473 * heightCm - 48.3
}

export function leanBodyMassJames({ sex, weightKg, heightCm }) {
  return sex === 'male'
    ? (1.10 * weightKg) - 128 * Math.pow(weightKg / heightCm, 2)
    : (1.07 * weightKg) - 148 * Math.pow(weightKg / heightCm, 2)
}

export function leanBodyMassHume({ sex, weightKg, heightCm }) {
  return sex === 'male'
    ? 0.32810 * weightKg + 0.33929 * heightCm - 29.5336
    : 0.29569 * weightKg + 0.41813 * heightCm - 43.2933
}

export function idealWeightDevine({ sex, heightCm }) {
  const heightIn = heightCm / 2.54
  const base = sex === 'male' ? 50 : 45.5
  return base + 2.3 * (heightIn - 60)
}

export function idealWeightRobinson({ sex, heightCm }) {
  const heightIn = heightCm / 2.54
  const base = sex === 'male' ? 52 : 49
  return base + 1.9 * (heightIn - 60)
}

export function idealWeightMiller({ sex, heightCm }) {
  const heightIn = heightCm / 2.54
  const base = sex === 'male' ? 56.2 : 53.1
  return base + 1.41 * (heightIn - 60)
}

export function idealWeightHamwi({ sex, heightCm }) {
  const heightIn = heightCm / 2.54
  const base = sex === 'male' ? 48 : 45.5
  return base + 2.7 * (heightIn - 60)
}

export function bmi(weightKg, heightCm) {
  const heightM = heightCm / 100
  return weightKg / (heightM * heightM)
}

export function ffmi(weightKg, heightCm, bodyFatPct) {
  const leanMass = weightKg * (1 - bodyFatPct / 100)
  const heightM = heightCm / 100
  const raw = leanMass / (heightM * heightM)
  return raw + 6.1 * (1.8 - heightM)
}

export function proteinTargetGrams(weightKg, goalType) {
  const perKg = {
    maintain: 1.6, lose: 2.0, gain: 1.8, lean_bulk: 1.8,
    slow_bulk: 1.8, aggressive_cut: 2.2, recomposition: 2.0
  }
  return weightKg * (perKg[goalType] || 1.8)
}

export function waterTargetMl(weightKg, activityMinutes = 0) {
  return weightKg * 35 + activityMinutes * 12
}

export function macroGramsFromPercent(calories, proteinPct, carbPct, fatPct) {
  return {
    protein: Math.round((calories * (proteinPct / 100)) / 4),
    carbs: Math.round((calories * (carbPct / 100)) / 4),
    fat: Math.round((calories * (fatPct / 100)) / 9)
  }
}

export const MACRO_PRESETS = {
  balanced: { protein: 30, carbs: 40, fat: 30 },
  high_protein: { protein: 40, carbs: 30, fat: 30 },
  low_carb: { protein: 35, carbs: 20, fat: 45 },
  high_carb: { protein: 25, carbs: 55, fat: 20 },
  keto: { protein: 25, carbs: 5, fat: 70 }
}

export function calorieDeficitForGoal(tdeeVal, goalType) {
  const map = {
    lose: -500, maintain: 0, gain: 300, lean_bulk: 250,
    slow_bulk: 200, aggressive_cut: -750, recomposition: -100
  }
  return tdeeVal + (map[goalType] ?? 0)
}

export function oneRepMax(weight, reps) {
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export function movingAverage(values, windowSize = 7) {
  return values.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1)
    const slice = values.slice(start, i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

export function linearTrend(points) {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0 }
  const sumX = points.reduce((a, p) => a + p.x, 0)
  const sumY = points.reduce((a, p) => a + p.y, 0)
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0)
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1)
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

export function predictGoalDate(currentWeight, targetWeight, weeklyRateKg) {
  if (!weeklyRateKg) return null
  const weeksNeeded = (targetWeight - currentWeight) / weeklyRateKg
  if (weeksNeeded <= 0) return null
  const date = new Date()
  date.setDate(date.getDate() + weeksNeeded * 7)
  return date
}

export function metCaloriesBurned(metValue, weightKg, durationMinutes) {
  return (metValue * 3.5 * weightKg / 200) * durationMinutes
}
