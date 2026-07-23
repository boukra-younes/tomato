// =========================================================================
// nutritionApi.js
// Browser-only, multi-source nutrition data engine.
// No Node, no server, no TypeScript — fetch() + Supabase only.
// =========================================================================
//
// BACKWARD-COMPATIBLE EXPORTS (unchanged signatures/return shapes):
//   searchUsdaFoods, getUsdaFoodDetail, searchOpenFoodFacts, lookupBarcode,
//   unifiedFoodSearch, scaleNutrients, searchAlgerianLibrary
//
// NEW EXPORTS:
//   searchFood, normalizeFood, normalizeName, mergeFoods, sortFoods,
//   searchLocalFoods, , searchNutritionix, searchEdamam,
//   searchSpoonacular, extractUsdaNutrients, extractOpenFoodFactsNutrients,
//   , extractNutritionixNutrients,
//   extractEdamamNutrients, extractSpoonacularNutrients
// =========================================================================

import { supabase } from "./supabaseClient";
import { ALGERIAN_FOODS as ALGERIAN_FOODS_STATIC } from "./algerianFoods.js";

// -------------------------------------------------------------------------
// SECTION: API keys (optional — missing keys silently disable that source)
// -------------------------------------------------------------------------

const USDA_KEY = import.meta.env.VITE_USDA_FDC_API_KEY || "DEMO_KEY";
const EDAMAM_APP_ID = import.meta.env.VITE_EDAMAM_APP_ID || null;
const EDAMAM_APP_KEY = import.meta.env.VITE_EDAMAM_APP_KEY || null;
const SPOONACULAR_KEY = import.meta.env.VITE_SPOONACULAR_API_KEY || null;
const NUTRITIONIX_APP_ID = import.meta.env.VITE_NUTRITIONIX_APP_ID || null;
const NUTRITIONIX_API_KEY = import.meta.env.VITE_NUTRITIONIX_API_KEY || null;

// -------------------------------------------------------------------------
// SECTION: Endpoints
// -------------------------------------------------------------------------

const USDA_BASE = "https://api.nal.usda.gov/fdc/v1";
const OFF_BASE = "https://world.openfoodfacts.org";
const NUTRITIONIX_SEARCH_BASE = "https://trackapi.nutritionix.com/v2";
const EDAMAM_BASE = "https://api.edamam.com/api/food-database/v2";
const SPOONACULAR_BASE = "https://api.spoonacular.com";

// -------------------------------------------------------------------------
// SECTION: Fetch helpers — timeout + abort protection, never throws
// -------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 6000;

async function safeFetchJson(
  url,
  { timeout = DEFAULT_TIMEOUT_MS, headers = {} } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// Simple in-memory request cache to avoid duplicate parallel/repeat calls
const requestCache = new Map();
const REQUEST_CACHE_TTL_MS = 5 * 60 * 1000;

async function cachedFetchJson(key, url, opts) {
  const cached = requestCache.get(key);
  if (cached && Date.now() - cached.time < REQUEST_CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await safeFetchJson(url, opts);
  requestCache.set(key, { time: Date.now(), data });
  return data;
}

// -------------------------------------------------------------------------
// SECTION: Unified food model
// -------------------------------------------------------------------------

const UNIFIED_FIELDS = [
  "id",
  "source",
  "ref",
  "barcode",
  "name",
  "brand",
  "category",
  "image",
  "ingredients",
  "serving_size",
  "serving_unit",
  "calories",
  "protein",
  "carbs",
  "fat",
  "fiber",
  "sugar",
  "saturated_fat",
  "trans_fat",
  "cholesterol",
  "sodium",
  "potassium",
  "calcium",
  "iron",
  "magnesium",
  "phosphorus",
  "zinc",
  "copper",
  "selenium",
  "vitamin_a",
  "vitamin_b1",
  "vitamin_b2",
  "vitamin_b3",
  "vitamin_b5",
  "vitamin_b6",
  "vitamin_b12",
  "vitamin_c",
  "vitamin_d",
  "vitamin_e",
  "vitamin_k",
  "folate",
];

const NUMERIC_FIELDS = UNIFIED_FIELDS.filter(
  (f) =>
    ![
      "id",
      "source",
      "ref",
      "barcode",
      "name",
      "brand",
      "category",
      "image",
      "ingredients",
      "serving_unit",
    ].includes(f),
);

/**
 * normalizeFood — coerces any partial food object into the full unified shape.
 * Every numeric field defaults to 0. Never returns undefined for any field.
 */
export function normalizeFood(partial = {}) {
  const out = {};
  for (const field of UNIFIED_FIELDS) {
    if (field === "serving_size") {
      out.serving_size = partial.serving_size ?? 100;
    } else if (field === "serving_unit") {
      out.serving_unit = partial.serving_unit ?? "g";
    } else if (NUMERIC_FIELDS.includes(field)) {
      const v = partial[field];
      out[field] =
        typeof v === "number" && !Number.isNaN(v) ? v : Number(v) || 0;
    } else {
      out[field] = partial[field] ?? null;
    }
  }
  if (!out.id) {
    out.id = `${out.source || "unknown"}:${out.ref || out.barcode || normalizeName(out.name || "")}`;
  }
  return out;
}

/**
 * normalizeName — lowercases, strips punctuation/diacritics/extra whitespace
 * for use as a dedupe / relevance key.
 */
export function normalizeName(name = "") {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------------------------------------------------------------
// SECTION: Nutrient extraction — one function per source
// -------------------------------------------------------------------------

const USDA_NUTRIENT_MAP = {
  1008: "calories",
  1003: "protein",
  1005: "carbs",
  1079: "fiber",
  2000: "sugar",
  1004: "fat",
  1258: "saturated_fat",
  1257: "trans_fat",
  1253: "cholesterol",
  1093: "sodium",
  1092: "potassium",
  1087: "calcium",
  1089: "iron",
  1090: "magnesium",
  1091: "phosphorus",
  1095: "zinc",
  1098: "copper",
  1103: "selenium",
  1106: "vitamin_a",
  1162: "vitamin_c",
  1114: "vitamin_d",
  1109: "vitamin_e",
  1185: "vitamin_k",
  1165: "vitamin_b1",
  1166: "vitamin_b2",
  1167: "vitamin_b3",
  1170: "vitamin_b5",
  1175: "vitamin_b6",
  1178: "vitamin_b12",
  1177: "folate",
};

export function extractUsdaNutrients(foodNutrients = []) {
  const out = {};
  for (const n of foodNutrients) {
    const id = n.nutrientId || n.nutrient?.id;
    const key = USDA_NUTRIENT_MAP[id];
    if (key) out[key] = n.value ?? n.amount ?? 0;
  }
  return out;
}

export function extractOpenFoodFactsNutrients(n = {}) {
  return {
    calories: n["energy-kcal_100g"] ?? 0,
    protein: n["proteins_100g"] ?? 0,
    carbs: n["carbohydrates_100g"] ?? 0,
    fiber: n["fiber_100g"] ?? 0,
    sugar: n["sugars_100g"] ?? 0,
    fat: n["fat_100g"] ?? 0,
    saturated_fat: n["saturated-fat_100g"] ?? 0,
    trans_fat: n["trans-fat_100g"] ?? 0,
    cholesterol: n["cholesterol_100g"] ?? 0,
    sodium: (n["sodium_100g"] ?? 0) * 1000,
    potassium: n["potassium_100g"] ?? 0,
    calcium: n["calcium_100g"] ?? 0,
    iron: n["iron_100g"] ?? 0,
    magnesium: n["magnesium_100g"] ?? 0,
    phosphorus: n["phosphorus_100g"] ?? 0,
    zinc: n["zinc_100g"] ?? 0,
    copper: n["copper_100g"] ?? 0,
    selenium: (n["selenium_100g"] ?? 0) * 1000000,
    vitamin_a: (n["vitamin-a_100g"] ?? 0) * 1000000,
    vitamin_c: (n["vitamin-c_100g"] ?? 0) * 1000,
    vitamin_d: (n["vitamin-d_100g"] ?? 0) * 1000000,
    vitamin_e: (n["vitamin-e_100g"] ?? 0) * 1000,
    vitamin_k: (n["vitamin-k_100g"] ?? 0) * 1000000,
    vitamin_b1: (n["vitamin-b1_100g"] ?? 0) * 1000,
    vitamin_b2: (n["vitamin-b2_100g"] ?? 0) * 1000,
    vitamin_b3: (n["vitamin-pp_100g"] ?? 0) * 1000,
    vitamin_b6: (n["vitamin-b6_100g"] ?? 0) * 1000,
    vitamin_b12: (n["vitamin-b12_100g"] ?? 0) * 1000000,
    folate: (n["vitamin-b9_100g"] ?? 0) * 1000000,
  };
}

export function extractNutritionixNutrients(item = {}) {
  const grams = item.serving_weight_grams || 100;
  const factor = grams ? 100 / grams : 1;
  return {
    calories: (item.nf_calories ?? 0) * factor,
    protein: (item.nf_protein ?? 0) * factor,
    carbs: (item.nf_total_carbohydrate ?? 0) * factor,
    fiber: (item.nf_dietary_fiber ?? 0) * factor,
    sugar: (item.nf_sugars ?? 0) * factor,
    fat: (item.nf_total_fat ?? 0) * factor,
    saturated_fat: (item.nf_saturated_fat ?? 0) * factor,
    cholesterol: (item.nf_cholesterol ?? 0) * factor,
    sodium: (item.nf_sodium ?? 0) * factor,
    potassium: (item.nf_potassium ?? 0) * factor,
  };
}

export function extractEdamamNutrients(nutrients = {}) {
  return {
    calories: nutrients.ENERC_KCAL ?? 0,
    protein: nutrients.PROCNT ?? 0,
    carbs: nutrients.CHOCDF ?? 0,
    fiber: nutrients.FIBTG ?? 0,
    sugar: nutrients.SUGAR ?? 0,
    fat: nutrients.FAT ?? 0,
    saturated_fat: nutrients.FASAT ?? 0,
    cholesterol: nutrients.CHOLE ?? 0,
    sodium: nutrients.NA ?? 0,
    potassium: nutrients.K ?? 0,
    calcium: nutrients.CA ?? 0,
    iron: nutrients.FE ?? 0,
    magnesium: nutrients.MG ?? 0,
    zinc: nutrients.ZN ?? 0,
    vitamin_a: nutrients.VITA_RAE ?? 0,
    vitamin_c: nutrients.VITC ?? 0,
    vitamin_d: nutrients.VITD ?? 0,
    vitamin_e: nutrients.TOCPHA ?? 0,
    vitamin_k: nutrients.VITK1 ?? 0,
    vitamin_b6: nutrients.VITB6A ?? 0,
    vitamin_b12: nutrients.VITB12 ?? 0,
    folate: nutrients.FOLDFE ?? 0,
  };
}

export function extractSpoonacularNutrients(nutrition = {}) {
  const list = nutrition.nutrients || [];
  const find = (name) => list.find((n) => n.name === name)?.amount ?? 0;
  return {
    calories: find("Calories"),
    protein: find("Protein"),
    carbs: find("Carbohydrates"),
    fiber: find("Fiber"),
    sugar: find("Sugar"),
    fat: find("Fat"),
    saturated_fat: find("Saturated Fat"),
    cholesterol: find("Cholesterol"),
    sodium: find("Sodium"),
    potassium: find("Potassium"),
    calcium: find("Calcium"),
    iron: find("Iron"),
    magnesium: find("Magnesium"),
    zinc: find("Zinc"),
    vitamin_a: find("Vitamin A"),
    vitamin_c: find("Vitamin C"),
    vitamin_d: find("Vitamin D"),
    vitamin_e: find("Vitamin E"),
    vitamin_k: find("Vitamin K"),
    vitamin_b6: find("Vitamin B6"),
    vitamin_b12: find("Vitamin B12"),
    folate: find("Folate"),
  };
}

// -------------------------------------------------------------------------
// SECTION: Local databases — lazy-loaded, searched first
// -------------------------------------------------------------------------

let _localDbCache = null;

// Optional local databases — these files may not exist in every project yet.
// import.meta.glob only includes files that actually exist on disk, so this
// never causes a build-time resolution error even when japaneseFoods.js,
// koreanFoods.js, or recipes.js are absent. Adding them later is picked up
// automatically with zero changes to this file.
const OPTIONAL_LOCAL_DB_MODULES = import.meta.glob(
  "./{japaneseFoods,koreanFoods,recipes}.js",
);

async function tryLoadOptional(fileName, exportName) {
  const key = `./${fileName}.js`;
  const loader = OPTIONAL_LOCAL_DB_MODULES[key];
  if (!loader) return [];
  try {
    const mod = await loader();
    return mod[exportName] || mod.default || [];
  } catch {
    return [];
  }
}

async function loadLocalDatabases() {
  if (_localDbCache) return _localDbCache;

  const [japanese, korean, recipes] = await Promise.all([
    tryLoadOptional("japaneseFoods", "JAPANESE_FOODS"),
    tryLoadOptional("koreanFoods", "KOREAN_FOODS"),
    tryLoadOptional("recipes", "RECIPES"),
  ]);

  _localDbCache = {
    algerian: ALGERIAN_FOODS_STATIC || [],
    japanese,
    korean,
    recipes,
  };
  return _localDbCache;
}

/**
 * searchLocalFoods — searches all bundled local food/recipe databases.
 * Missing local files are skipped silently (never throws).
 */
export async function searchLocalFoods(query) {
  const q = normalizeName(query);
  if (!q) return [];
  let dbs;
  try {
    dbs = await loadLocalDatabases();
  } catch {
    return [];
  }

  const all = [
    ...(dbs.algerian || []),
    ...(dbs.japanese || []),
    ...(dbs.korean || []),
    ...(dbs.recipes || []),
  ];

  return all
    .filter((f) => normalizeName(f.name || "").includes(q))
    .map((f) => normalizeFood({ ...f, source: f.source || "local" }));
}

// Backward-compatible: original Algerian-only search, unchanged signature/behavior
export async function searchAlgerianLibrary(query) {
  const list = ALGERIAN_FOODS_STATIC || [];
  const q = query.toLowerCase();
  return list.filter((f) => f.name.toLowerCase().includes(q));
}

// -------------------------------------------------------------------------
// SECTION: Supabase cache (optional — never fails the search if unavailable)
// -------------------------------------------------------------------------

async function searchSupabaseCache(query) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("food_cache")
      .select("*")
      .ilike("name", `%${query}%`)
      .limit(25);
    if (error || !data) return [];
    return data.map((row) =>
      normalizeFood({ ...row, source: row.source || "cache" }),
    );
  } catch {
    return [];
  }
}

async function storeFoodsInSupabaseCache(foods = []) {
  if (!supabase || !foods.length) return;
  try {
    const rows = foods
      .filter((f) => f.source !== "cache" && f.source !== "local")
      .slice(0, 50)
      .map((f) => ({
        id: f.id,
        source: f.source,
        ref: f.ref,
        barcode: f.barcode,
        name: f.name,
        brand: f.brand,
        category: f.category,
        image: f.image,
        ingredients: f.ingredients,
        serving_size: f.serving_size,
        serving_unit: f.serving_unit,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        fiber: f.fiber,
        sugar: f.sugar,
        saturated_fat: f.saturated_fat,
        trans_fat: f.trans_fat,
        cholesterol: f.cholesterol,
        sodium: f.sodium,
        potassium: f.potassium,
        calcium: f.calcium,
        iron: f.iron,
        magnesium: f.magnesium,
        phosphorus: f.phosphorus,
        zinc: f.zinc,
        copper: f.copper,
        selenium: f.selenium,
        vitamin_a: f.vitamin_a,
        vitamin_b1: f.vitamin_b1,
        vitamin_b2: f.vitamin_b2,
        vitamin_b3: f.vitamin_b3,
        vitamin_b5: f.vitamin_b5,
        vitamin_b6: f.vitamin_b6,
        vitamin_b12: f.vitamin_b12,
        vitamin_c: f.vitamin_c,
        vitamin_d: f.vitamin_d,
        vitamin_e: f.vitamin_e,
        vitamin_k: f.vitamin_k,
        folate: f.folate,
      }));
    // Best-effort — if the food_cache table doesn't exist yet, fail silently.
    await supabase.from("food_cache").upsert(rows, { onConflict: "id" });
  } catch {
    // never throw — caching is purely an optimization
  }
}

// -------------------------------------------------------------------------
// SECTION: USDA FoodData Central
// -------------------------------------------------------------------------

export async function searchUsdaFoods(query, pageSize = 20) {
  const params = new URLSearchParams({
    api_key: USDA_KEY,
    query,
    pageSize,
  });

  const url = `${USDA_BASE}/foods/search?${params}`;
  const data = await cachedFetchJson(`usda:${query}:${pageSize}`, url);
  if (!data) return [];
  return (data.foods || []).map((f) =>
    normalizeFood({
      source: "usda",
      ref: String(f.fdcId),
      name: f.description,
      brand: f.brandOwner || null,
      category: f.foodCategory || null,
      serving_size: 100,
      serving_unit: "g",
      ...extractUsdaNutrients(f.foodNutrients),
    }),
  );
}

export async function getUsdaFoodDetail(fdcId) {
  const url = `${USDA_BASE}/food/${fdcId}?api_key=${USDA_KEY}`;
  const f = await cachedFetchJson(`usda-detail:${fdcId}`, url);
  if (!f) return null;
  return normalizeFood({
    source: "usda",
    ref: String(f.fdcId),
    name: f.description,
    brand: f.brandOwner || null,
    ingredients: f.ingredients || null,
    serving_size: f.servingSize || 100,
    serving_unit: f.servingSizeUnit || "g",
    ...extractUsdaNutrients(f.foodNutrients),
  });
}

// -------------------------------------------------------------------------
// SECTION: Open Food Facts
// -------------------------------------------------------------------------

export async function searchOpenFoodFacts(query, pageSize = 20) {
  const params = new URLSearchParams({
    search_terms: query,
    page_size: pageSize,
    fields:
      "code,product_name,brands,categories,image_front_small_url,ingredients_text,nutriments",
  });

  const url = `${OFF_BASE}/api/v2/search?${params}`;

  const data = await cachedFetchJson(`off:${query}:${pageSize}`, url);

  if (!data) return [];

  return (data.products || [])
    .filter((p) => p.product_name)
    .map((p) =>
      normalizeFood({
        source: "off",
        ref: p.code,
        barcode: p.code,
        name: p.product_name,
        brand: p.brands || null,
        category: p.categories || null,
        image: p.image_front_small_url || null,
        ingredients: p.ingredients_text || null,
        serving_size: 100,
        serving_unit: "g",
        ...extractOpenFoodFactsNutrients(p.nutriments || {}),
      }),
    );
}

async function lookupBarcodeOpenFoodFacts(barcode) {
  const url = `${OFF_BASE}/api/v2/product/${barcode}.json`;
  const data = await cachedFetchJson(`off-barcode:${barcode}`, url);
  if (!data || data.status !== 1) return null;
  const p = data.product;
  return normalizeFood({
    source: "off",
    ref: p.code,
    barcode: p.code,
    name: p.product_name,
    brand: p.brands || null,
    category: p.categories || null,
    image: p.image_front_small_url || null,
    ingredients: p.ingredients_text || null,
    serving_size: 100,
    serving_unit: "g",
    ...extractOpenFoodFactsNutrients(p.nutriments),
  });
}

// -------------------------------------------------------------------------
// SECTION: Nutritionix (optional)
// -------------------------------------------------------------------------

export async function searchNutritionix(query) {
  if (!NUTRITIONIX_APP_ID || !NUTRITIONIX_API_KEY) return [];
  const url = `${NUTRITIONIX_SEARCH_BASE}/search/instant?query=${encodeURIComponent(query)}`;
  const data = await cachedFetchJson(`nutritionix:${query}`, url, {
    headers: {
      "x-app-id": NUTRITIONIX_APP_ID,
      "x-app-key": NUTRITIONIX_API_KEY,
    },
  });
  if (!data) return [];
  const branded = (data.branded || []).map((item) =>
    normalizeFood({
      source: "nutritionix",
      ref: item.nix_item_id,
      name: item.food_name,
      brand: item.brand_name || null,
      image: item.photo?.thumb || null,
      serving_size: item.serving_weight_grams || 100,
      serving_unit: "g",
      ...extractNutritionixNutrients(item),
    }),
  );
  const common = (data.common || []).map((item) =>
    normalizeFood({
      source: "nutritionix",
      ref: item.food_name,
      name: item.food_name,
      image: item.photo?.thumb || null,
      serving_size: 100,
      serving_unit: "g",
    }),
  );
  return [...branded, ...common];
}

async function lookupBarcodeNutritionix(barcode) {
  if (!NUTRITIONIX_APP_ID || !NUTRITIONIX_API_KEY) return null;
  const url = `${NUTRITIONIX_SEARCH_BASE}/search/item?upc=${barcode}`;
  const data = await cachedFetchJson(`nutritionix-barcode:${barcode}`, url, {
    headers: {
      "x-app-id": NUTRITIONIX_APP_ID,
      "x-app-key": NUTRITIONIX_API_KEY,
    },
  });
  const item = data?.foods?.[0];
  if (!item) return null;
  return normalizeFood({
    source: "nutritionix",
    ref: item.nix_item_id || barcode,
    barcode,
    name: item.food_name,
    brand: item.brand_name || null,
    image: item.photo?.thumb || null,
    serving_size: item.serving_weight_grams || 100,
    serving_unit: "g",
    ...extractNutritionixNutrients(item),
  });
}

// -------------------------------------------------------------------------
// SECTION: Edamam (optional)
// -------------------------------------------------------------------------

export async function searchEdamam(query) {
  if (!EDAMAM_APP_ID || !EDAMAM_APP_KEY) return [];
  const url = `${EDAMAM_BASE}/parser?app_id=${EDAMAM_APP_ID}&app_key=${EDAMAM_APP_KEY}&ingr=${encodeURIComponent(query)}`;
  const data = await cachedFetchJson(`edamam:${query}`, url);
  if (!data) return [];
  return (data.hints || []).slice(0, 20).map((h) =>
    normalizeFood({
      source: "edamam",
      ref: h.food?.foodId,
      name: h.food?.label,
      brand: h.food?.brand || null,
      category: h.food?.category || null,
      image: h.food?.image || null,
      serving_size: 100,
      serving_unit: "g",
      ...extractEdamamNutrients(h.food?.nutrients),
    }),
  );
}

// -------------------------------------------------------------------------
// SECTION: Spoonacular (optional)
// -------------------------------------------------------------------------

export async function searchSpoonacular(query) {
  if (!SPOONACULAR_KEY) return [];
  const url = `${SPOONACULAR_BASE}/food/ingredients/search?apiKey=${SPOONACULAR_KEY}&query=${encodeURIComponent(query)}&number=15`;
  const data = await cachedFetchJson(`spoonacular:${query}`, url);
  if (!data?.results?.length) return [];

  const detailed = await Promise.allSettled(
    data.results.slice(0, 10).map(async (r) => {
      const infoUrl = `${SPOONACULAR_BASE}/food/ingredients/${r.id}/information?apiKey=${SPOONACULAR_KEY}&amount=100&unit=grams`;
      const info = await cachedFetchJson(`spoonacular-detail:${r.id}`, infoUrl);
      return normalizeFood({
        source: "spoonacular",
        ref: String(r.id),
        name: info?.name || r.name,
        image: info?.image
          ? `https://spoonacular.com/cdn/ingredients_100x100/${info.image}`
          : null,
        category: info?.aisle || null,
        serving_size: 100,
        serving_unit: "g",
        ...(info ? extractSpoonacularNutrients(info.nutrition) : {}),
      });
    }),
  );
  return detailed.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

// -------------------------------------------------------------------------
// SECTION: Deduplication & merging
// -------------------------------------------------------------------------

/**
 * mergeFoods — deduplicates a flat array of unified food objects.
 * Matches on (in priority order): barcode, USDA/source ref, normalized name.
 * Keeps the first occurrence encountered (callers control priority by the
 * order they concatenate result arrays before calling this).
 */
export function mergeFoods(foods = []) {
  const seenBarcode = new Set();
  const seenRef = new Set();
  const seenName = new Set();
  const out = [];

  for (const food of foods) {
    if (!food) continue;
    const barcodeKey = food.barcode ? String(food.barcode) : null;
    const refKey =
      food.source && food.ref ? `${food.source}:${food.ref}` : null;
    const nameKey = normalizeName(food.name || "");

    if (barcodeKey && seenBarcode.has(barcodeKey)) continue;
    if (refKey && seenRef.has(refKey)) continue;
    if (!barcodeKey && !refKey && nameKey && seenName.has(nameKey)) continue;

    if (barcodeKey) seenBarcode.add(barcodeKey);
    if (refKey) seenRef.add(refKey);
    if (nameKey) seenName.add(nameKey);

    out.push(food);
  }
  return out;
}

// -------------------------------------------------------------------------
// SECTION: Ranking
// -------------------------------------------------------------------------

const SOURCE_PRIORITY = [
  "local",
  "cache",
  "usda",
  "off",
  "nutritionix",
  "edamam",
  "spoonacular",
];

/**
 * sortFoods — ranks results by: exact name match, barcode match, then
 * source priority (local > cache > usda > off  > nutritionix >
 * edamam > spoonacular), then partial/substring relevance, then alphabetical.
 */
export function sortFoods(foods = [], query = "") {
  const q = normalizeName(query);
  return [...foods].sort((a, b) => {
    const aName = normalizeName(a.name || "");
    const bName = normalizeName(b.name || "");

    const aExact = aName === q ? 1 : 0;
    const bExact = bName === q ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    const aBarcode = a.barcode ? 1 : 0;
    const bBarcode = b.barcode ? 1 : 0;
    if (q && a.barcode === query) return -1;
    if (q && b.barcode === query) return 1;

    const aPrefix = aName.startsWith(q) ? 1 : 0;
    const bPrefix = bName.startsWith(q) ? 1 : 0;
    if (aPrefix !== bPrefix) return bPrefix - aPrefix;

    const aPriority = SOURCE_PRIORITY.indexOf(a.source);
    const bPriority = SOURCE_PRIORITY.indexOf(b.source);
    const aRank = aPriority === -1 ? SOURCE_PRIORITY.length : aPriority;
    const bRank = bPriority === -1 ? SOURCE_PRIORITY.length : bPriority;
    if (aRank !== bRank) return aRank - bRank;

    const aIncludes = aName.includes(q) ? 1 : 0;
    const bIncludes = bName.includes(q) ? 1 : 0;
    if (aIncludes !== bIncludes) return bIncludes - aIncludes;

    return aName.localeCompare(bName);
  });
}

// -------------------------------------------------------------------------
// SECTION: Food categorization — drives both search quality (raw-ingredient
// dedup) and correct unit options (e.g. "1 piece" = 1 egg, never offered
// for meat/fish, which are only ever measured by weight).
// -------------------------------------------------------------------------

// Order matters — first matching rule wins. Exclude patterns prevent
// false positives (e.g. "eggplant" matching the egg rule).
const CATEGORY_RULES = [
  {
    key: "egg", label: "Eggs",
    test: /\begg(s)?\b/i, exclude: /eggplant|egg\s*roll|egg\s*noodle/i,
    units: ["piece", "g", "oz"], pieceGrams: 50, pieceLabel: "egg",
  },
  {
    key: "poultry", label: "Poultry",
    test: /\b(chicken|turkey|duck|hen)\b/i, exclude: /egg/i,
    units: ["g", "kg", "oz", "lb"], pieceGrams: null,
  },
  {
    key: "red_meat", label: "Meat",
    test: /\b(beef|steak|pork|lamb|veal|bacon|sausage|ham|venison|mutton)\b/i,
    units: ["g", "kg", "oz", "lb"], pieceGrams: null,
  },
  {
    key: "seafood", label: "Seafood",
    test: /\b(salmon|tuna|shrimp|prawn|fish|cod|tilapia|crab|lobster|sardine|anchovy|mackerel|trout)\b/i,
    units: ["g", "kg", "oz", "lb"], pieceGrams: null,
  },
  {
    key: "milk", label: "Dairy (liquid)",
    test: /\bmilk\b/i, exclude: /milk\s*chocolate|coconut\s*milk\s*candy/i,
    units: ["ml", "l", "cup", "tbsp"], pieceGrams: null,
  },
  {
    key: "liquid", label: "Liquid",
    test: /\b(juice|oil|water|soda|broth|stock|beer|wine|smoothie)\b/i,
    units: ["ml", "l", "cup", "tbsp", "tsp"], pieceGrams: null,
  },
  {
    key: "dairy", label: "Dairy",
    test: /\b(yogurt|yoghurt|cheese|cream|butter)\b/i,
    units: ["g", "oz", "cup", "tbsp"], pieceGrams: null,
  },
  {
    key: "bread", label: "Bread",
    test: /\b(bread|toast|tortilla|bagel|bun|baguette)\b/i,
    units: ["slice", "g", "oz"], pieceGrams: 30, pieceLabel: "slice",
  },
  {
    key: "grain", label: "Grains",
    test: /\b(rice|pasta|oats?|oatmeal|quinoa|cereal|noodle|couscous)\b/i,
    units: ["g", "cup", "oz"], pieceGrams: null,
  },
  {
    key: "banana", label: "Fruit",
    test: /\bbanana(s)?\b/i,
    units: ["piece", "g", "oz"], pieceGrams: 118, pieceLabel: "banana",
  },
  {
    key: "apple", label: "Fruit",
    test: /\bapple(s)?\b/i, exclude: /apple\s*juice|apple\s*sauce|pineapple/i,
    units: ["piece", "g", "oz"], pieceGrams: 182, pieceLabel: "apple",
  },
  {
    key: "orange", label: "Fruit",
    test: /\borange(s)?\b/i, exclude: /orange\s*juice/i,
    units: ["piece", "g", "oz"], pieceGrams: 131, pieceLabel: "orange",
  },
  {
    key: "fruit", label: "Fruit",
    test: /\b(pear|peach|plum|mango|kiwi|avocado)\b/i,
    units: ["piece", "g", "oz"], pieceGrams: 150, pieceLabel: "piece",
  },
  {
    key: "vegetable", label: "Vegetables",
    test: /\b(broccoli|spinach|carrot|tomato|pepper|onion|potato|lettuce|cucumber|cabbage|kale|zucchini)\b/i,
    units: ["g", "cup", "oz"], pieceGrams: null,
  },
];

/**
 * categorizeFood — classifies a food by name into a raw-ingredient category
 * (or null for anything that doesn't match, e.g. prepared/branded dishes).
 */
export function categorizeFood(name = "") {
  const n = String(name);
  for (const rule of CATEGORY_RULES) {
    if (rule.exclude && rule.exclude.test(n)) continue;
    if (rule.test.test(n)) return rule;
  }
  return null;
}

/**
 * getUnitProfile — returns the correct list of loggable units for a given
 * food, plus the gram weight to use for "piece"-style units. Meat, poultry,
 * and seafood never get "piece" — they're weight-only. Eggs, bananas, etc.
 * get a real per-item gram weight instead of the generic (and wrong)
 * "amount x reference serving" fallback.
 */
export function getUnitProfile(food) {
  const rule = categorizeFood(food?.name || "");
  if (rule) {
    return {
      category: rule.key,
      categoryLabel: rule.label,
      units: rule.units,
      pieceGrams: rule.pieceGrams,
      pieceLabel: rule.pieceLabel || "piece",
    };
  }
  // Generic/prepared/branded food — fall back to the item's own serving info.
  return {
    category: null,
    categoryLabel: null,
    units: ["g", "oz", "cup", "serving"],
    pieceGrams: food?.serving_size || 100,
    pieceLabel: "serving",
  };
}

// -------------------------------------------------------------------------
// SECTION: Raw-ingredient result curation — for a simple query that matches
// a known raw-food category (e.g. "egg", "chicken breast"), prefer a small
// set of the single best, most viable entries (plain USDA reference data)
// over a long list of near-duplicate branded/prepared/zero-calorie results.
// -------------------------------------------------------------------------

function curateRawFoodResults(results, query) {
  const rule = categorizeFood(query);
  if (!rule) return results;

  const wordCount = query.trim().split(/\s+/).length;
  if (wordCount > 4) return results; // long/specific queries bypass curation

  const viable = results.filter(f => f.calories > 0);
  const usdaMatches = viable.filter(f => f.source === "usda" && rule.test.test(f.name) && !(rule.exclude && rule.exclude.test(f.name)));

  if (usdaMatches.length) {
    // Prefer plain/raw entries over heavily-prepared ones when both exist.
    const preferred = usdaMatches.filter(f => !/fried|breaded|battered|candied|glazed/i.test(f.name));
    const pool = preferred.length ? preferred : usdaMatches;
    const rest = viable.filter(f => !pool.includes(f));
    return [...pool.slice(0, 6), ...rest.slice(0, 6)];
  }

  // No USDA reference data available — fall back to the best-ranked viable
  // results from whatever sources did respond, still capped tightly.
  return viable.slice(0, 8);
}



/**
 * searchFood — searches every available source in parallel, merges,
 * deduplicates, ranks, and returns a single flat array of unified food
 * objects. Any source that is unavailable (missing key, network failure,
 * timeout) is skipped silently; the overall search never rejects.
 */
export async function searchFood(query, { limit = 40 } = {}) {
  if (!query || !query.trim()) return [];

  // 1. Local databases first (fast, always available, highest trust)
  const localResults = await searchLocalFoods(query).catch(() => []);

  // 2. Everything else runs in parallel — Supabase cache + all online APIs
  const settled = await Promise.allSettled([
    searchSupabaseCache(query),
    searchUsdaFoods(query),
    searchOpenFoodFacts(query),
    searchNutritionix(query),
    searchEdamam(query),
    searchSpoonacular(query),
  ]);

  const [cacheR, usdaR, offR, nutritionixR, edamamR, spoonacularR] = settled;
  const onlineResults = [
    ...(cacheR.status === "fulfilled" ? cacheR.value : []),
    ...(usdaR.status === "fulfilled" ? usdaR.value : []),
    ...(offR.status === "fulfilled" ? offR.value : []),
    ...(nutritionixR.status === "fulfilled" ? nutritionixR.value : []),
    ...(edamamR.status === "fulfilled" ? edamamR.value : []),
    ...(spoonacularR.status === "fulfilled" ? spoonacularR.value : []),
  ];

  const merged = mergeFoods([...localResults, ...onlineResults]);
  const ranked = sortFoods(merged, query);
  const curated = curateRawFoodResults(ranked, query).slice(0, limit);

  // Fire-and-forget cache write — never blocks or fails the search
  storeFoodsInSupabaseCache(onlineResults).catch(() => {});

  return curated;
}

// Backward-compatible: original unifiedFoodSearch, same signature/behavior,
// now internally backed by the full multi-source engine.
export async function unifiedFoodSearch(query) {
  return searchFood(query, { limit: 40 });
}

// -------------------------------------------------------------------------
// SECTION: Barcode lookup (improved, backward-compatible signature)
// -------------------------------------------------------------------------

/**
 * lookupBarcode — searches Open Food Facts, then Nutritionix,
 * in that order, returning the first successful match. Same signature and
 * return shape as before (a single unified food object, or null).
 */
export async function lookupBarcode(barcode) {
  if (!barcode) return null;

  const off = await lookupBarcodeOpenFoodFacts(barcode).catch(() => null);
  if (off) return off;

  const nutritionix = await lookupBarcodeNutritionix(barcode).catch(() => null);
  if (nutritionix) return nutritionix;

  return null;
}

// -------------------------------------------------------------------------
// SECTION: Serving-size scaling
// -------------------------------------------------------------------------

const UNIT_TO_GRAMS = {
  g: 1,
  kg: 1000,
  mg: 0.001,
  oz: 28.3495,
  lb: 453.592,
  ml: 1,
  l: 1000,
  cup: 240,
  tbsp: 15,
  tsp: 5,
};

/**
 * scaleNutrients — scales a unified food's nutrients to a logged amount/unit.
 * Supports g, kg, mg, oz, lb, ml, l, cup, tbsp, tsp, piece, slice, serving.
 * For "piece"/"slice" the correct real-world per-item gram weight is used
 * (from getUnitProfile's category rules — e.g. 1 egg = 50g, 1 banana =
 * 118g) rather than the food's own reference serving, which was wrong for
 * anything not already measured in single-item servings. "serving" still
 * uses the food's own serving_size, since that's what it actually means.
 */
export function scaleNutrients(food, amount, unit) {
  const baseGrams = food.serving_size || 100;
  const numericAmount = Number(amount) || 0;
  const unitKey = String(unit || "g").toLowerCase();

  let targetGrams;

  if (UNIT_TO_GRAMS[unitKey]) {
    targetGrams = numericAmount * UNIT_TO_GRAMS[unitKey];
  } else if (unitKey === "piece" || unitKey === "slice") {
    const profile = getUnitProfile(food);
    const pieceGrams = profile.pieceGrams || baseGrams;
    targetGrams = numericAmount * pieceGrams;
  } else if (unitKey === "serving") {
    targetGrams = numericAmount * baseGrams;
  } else {
    // Unknown unit — assume grams
    targetGrams = numericAmount;
  }

  const factor = baseGrams ? targetGrams / baseGrams : 0;
  const scaled = {};
  for (const key of NUMERIC_FIELDS) {
    if (key === "serving_size") continue;
    const val = food[key];
    if (typeof val === "number") {
      scaled[key] = Math.round(val * factor * 100) / 100;
    }
  }
  return scaled;
}
