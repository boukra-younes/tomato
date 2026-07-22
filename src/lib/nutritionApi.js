const USDA_KEY = import.meta.env.VITE_USDA_FDC_API_KEY || 'DEMO_KEY'
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'
const OFF_BASE = 'https://world.openfoodfacts.org'

const NUTRIENT_MAP = {
  1008: 'calories', 1003: 'protein', 1005: 'carbs', 1079: 'fiber',
  2000: 'sugar', 1004: 'fat', 1258: 'saturated_fat', 1257: 'trans_fat',
  1253: 'cholesterol', 1093: 'sodium', 1092: 'potassium', 1087: 'calcium',
  1089: 'iron', 1090: 'magnesium', 1091: 'phosphorus', 1095: 'zinc',
  1098: 'copper', 1103: 'selenium', 1106: 'vitamin_a', 1162: 'vitamin_c',
  1114: 'vitamin_d', 1109: 'vitamin_e', 1185: 'vitamin_k', 1165: 'vitamin_b1',
  1166: 'vitamin_b2', 1167: 'vitamin_b3', 1170: 'vitamin_b5', 1175: 'vitamin_b6',
  1178: 'vitamin_b12', 1177: 'folate'
}

function extractUsdaNutrients(foodNutrients = []) {
  const out = {}
  for (const n of foodNutrients) {
    const id = n.nutrientId || n.nutrient?.id
    const key = NUTRIENT_MAP[id]
    if (key) out[key] = n.value ?? n.amount ?? 0
  }
  return out
}

export async function searchUsdaFoods(query, pageSize = 20) {
  const url = `${USDA_BASE}/foods/search?api_key=${USDA_KEY}&query=${encodeURIComponent(query)}&pageSize=${pageSize}&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)`
  const res = await fetch(url)
  if (!res.ok) throw new Error('USDA search failed')
  const data = await res.json()
  return (data.foods || []).map(f => ({
    source: 'usda',
    ref: String(f.fdcId),
    name: f.description,
    brand: f.brandOwner || null,
    category: f.foodCategory || null,
    serving_size: 100,
    serving_unit: 'g',
    ...extractUsdaNutrients(f.foodNutrients)
  }))
}

export async function getUsdaFoodDetail(fdcId) {
  const url = `${USDA_BASE}/food/${fdcId}?api_key=${USDA_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('USDA detail failed')
  const f = await res.json()
  return {
    source: 'usda',
    ref: String(f.fdcId),
    name: f.description,
    brand: f.brandOwner || null,
    ingredients: f.ingredients || null,
    serving_size: f.servingSize || 100,
    serving_unit: f.servingSizeUnit || 'g',
    ...extractUsdaNutrients(f.foodNutrients)
  }
}

function extractOffNutrients(n = {}) {
  return {
    calories: n['energy-kcal_100g'] ?? 0,
    protein: n['proteins_100g'] ?? 0,
    carbs: n['carbohydrates_100g'] ?? 0,
    fiber: n['fiber_100g'] ?? 0,
    sugar: n['sugars_100g'] ?? 0,
    fat: n['fat_100g'] ?? 0,
    saturated_fat: n['saturated-fat_100g'] ?? 0,
    trans_fat: n['trans-fat_100g'] ?? 0,
    cholesterol: n['cholesterol_100g'] ?? 0,
    sodium: (n['sodium_100g'] ?? 0) * 1000,
    potassium: n['potassium_100g'] ?? 0,
    calcium: n['calcium_100g'] ?? 0,
    iron: n['iron_100g'] ?? 0
  }
}

export async function searchOpenFoodFacts(query, pageSize = 20) {
  const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${pageSize}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Open Food Facts search failed')
  const data = await res.json()
  return (data.products || []).filter(p => p.product_name).map(p => ({
    source: 'off',
    ref: p.code,
    name: p.product_name,
    brand: p.brands || null,
    category: p.categories || null,
    image: p.image_front_small_url || null,
    ingredients: p.ingredients_text || null,
    serving_size: 100,
    serving_unit: 'g',
    ...extractOffNutrients(p.nutriments)
  }))
}

export async function lookupBarcode(barcode) {
  const url = `${OFF_BASE}/api/v2/product/${barcode}.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Barcode lookup failed')
  const data = await res.json()
  if (data.status !== 1) return null
  const p = data.product
  return {
    source: 'off',
    ref: p.code,
    name: p.product_name,
    brand: p.brands || null,
    category: p.categories || null,
    image: p.image_front_small_url || null,
    ingredients: p.ingredients_text || null,
    serving_size: 100,
    serving_unit: 'g',
    ...extractOffNutrients(p.nutriments)
  }
}

export async function unifiedFoodSearch(query) {
  const [usda, off, local] = await Promise.allSettled([
    searchUsdaFoods(query),
    searchOpenFoodFacts(query),
    searchAlgerianLibrary(query)
  ])
  const results = []
  if (usda.status === 'fulfilled') results.push(...usda.value)
  if (off.status === 'fulfilled') results.push(...off.value)
  if (local.status === 'fulfilled') results.push(...local.value)
  return results
}

export function scaleNutrients(food, amount, unit) {
  const gramsPerUnit = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592, ml: 1, l: 1000 }
  const baseGrams = food.serving_size || 100
  let targetGrams = amount
  if (gramsPerUnit[unit]) targetGrams = amount * gramsPerUnit[unit]
  const factor = targetGrams / baseGrams
  const scaled = {}
  for (const key of Object.keys(food)) {
    if (typeof food[key] === 'number' && key !== 'serving_size') {
      scaled[key] = Math.round(food[key] * factor * 100) / 100
    }
  }
  return scaled
}

export async function searchAlgerianLibrary(query) {
  const { ALGERIAN_FOODS } = await import('./algerianFoods.js')
  const q = query.toLowerCase()
  return ALGERIAN_FOODS.filter(f => f.name.toLowerCase().includes(q))
}
