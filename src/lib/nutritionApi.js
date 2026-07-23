// =========================================================================
// nutritionApi.js
// Browser-only nutrition data engine — Open Food Facts (branded/packaged)
// + a self-learning AI-backed database (local curated foods + ai_foods
// table + Gemini fallback) for raw ingredients.
// No Node, no server, no TypeScript — fetch() + Supabase only.
// =========================================================================

import { supabase } from "./supabaseClient";
import { ALGERIAN_FOODS as ALGERIAN_FOODS_STATIC } from "./algerianFoods.js";

// -------------------------------------------------------------------------
// SECTION: Endpoints
// -------------------------------------------------------------------------

const OFF_BASE = "https://world.openfoodfacts.org";

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
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const row = [i];
    for (let j = 1; j <= n; j++) {
      row[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], row[j - 1]);
    }
    prev = row;
  }
  return prev[n];
}

/**
 * fuzzyEquivalent — true if two food names are the same food modulo
 * spelling/transliteration variants (chorba/chourba) or substring
 * containment (chicken breast / chicken breast raw).
 */
export function fuzzyEquivalent(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const dist = levenshtein(na, nb);
  const threshold = Math.max(1, Math.floor(Math.min(na.length, nb.length) / 4));
  return dist <= threshold;
}

// -------------------------------------------------------------------------
// SECTION: Open Food Facts nutrient extraction
// -------------------------------------------------------------------------

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

// -------------------------------------------------------------------------
// SECTION: Local databases — lazy-loaded, searched first
// -------------------------------------------------------------------------

let _localDbCache = null;

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

  const substringMatches = all.filter((f) => normalizeName(f.name || "").includes(q));
  const matches = substringMatches.length
    ? substringMatches
    : all.filter((f) => fuzzyEquivalent(f.name || "", query));

  return matches.map((f) => normalizeFood({ ...f, source: f.source || "local" }));
}

// Backward-compatible: original Algerian-only search, unchanged signature/behavior
export async function searchAlgerianLibrary(query) {
  const list = ALGERIAN_FOODS_STATIC || [];
  const q = query.toLowerCase();
  return list.filter((f) => f.name.toLowerCase().includes(q));
}

// -------------------------------------------------------------------------
// SECTION: Supabase cache — shared cache of previously-fetched branded
// (Open Food Facts) results only.
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
    await supabase.from("food_cache").upsert(rows, { onConflict: "id" });
  } catch {
    // never throw — caching is purely an optimization
  }
}

// -------------------------------------------------------------------------
// SECTION: Open Food Facts
// -------------------------------------------------------------------------

export async function searchOpenFoodFacts(query, pageSize = 20) {
  // world.openfoodfacts.org/api/v2/search is not a real endpoint — OFF's v2
  // REST API only exposes single-product reads. Keyword search has to go
  // through the legacy CGI search endpoint below, which OFF serves with
  // CORS headers enabled for browser use.
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: pageSize,
    fields:
      "code,product_name,brands,categories,image_front_small_url,ingredients_text,nutriments",
  });

  const url = `${OFF_BASE}/cgi/search.pl?${params}`;

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

/**
 * searchOpenFoodFactsByBrand — searches by brand name specifically, using
 * OFF's brand taxonomy tag filter rather than free-text search. This is
 * what makes a query like "Ferrero" or "Nestlé" reliably return every
 * product under that brand, including ones whose product name/description
 * doesn't happen to contain the brand string (which plain search_terms
 * would miss).
 */
export async function searchOpenFoodFactsByBrand(brand, pageSize = 30) {
  const params = new URLSearchParams({
    tagtype_0: "brands",
    tag_contains_0: "contains",
    tag_0: brand,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: pageSize,
    fields:
      "code,product_name,brands,categories,image_front_small_url,ingredients_text,nutriments",
  });

  const url = `${OFF_BASE}/cgi/search.pl?${params}`;

  const data = await cachedFetchJson(`off-brand:${brand}:${pageSize}`, url);

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
// SECTION: Deduplication & merging
// -------------------------------------------------------------------------

/**
 * mergeFoods — deduplicates a flat array of unified food objects.
 * Matches on (in priority order): barcode, source ref, normalized name.
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

const SOURCE_PRIORITY = ["local", "cache", "ai", "off", "ai-pending"];

/**
 * sortFoods — ranks results by: exact name match, barcode match, then
 * source priority (local > cache > ai > off), then partial/substring
 * relevance, then alphabetical.
 */
export function sortFoods(foods = [], query = "") {
  const q = normalizeName(query);
  return [...foods].sort((a, b) => {
    const aName = normalizeName(a.name || "");
    const bName = normalizeName(b.name || "");
    const aBrand = normalizeName(a.brand || "");
    const bBrand = normalizeName(b.brand || "");

    const aExact = aName === q || aBrand === q ? 1 : 0;
    const bExact = bName === q || bBrand === q ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    if (q && a.barcode === query) return -1;
    if (q && b.barcode === query) return 1;

    const aPrefix = aName.startsWith(q) || aBrand.startsWith(q) ? 1 : 0;
    const bPrefix = bName.startsWith(q) || bBrand.startsWith(q) ? 1 : 0;
    if (aPrefix !== bPrefix) return bPrefix - aPrefix;

    const aPriority = SOURCE_PRIORITY.indexOf(a.source);
    const bPriority = SOURCE_PRIORITY.indexOf(b.source);
    const aRank = aPriority === -1 ? SOURCE_PRIORITY.length : aPriority;
    const bRank = bPriority === -1 ? SOURCE_PRIORITY.length : bPriority;
    if (aRank !== bRank) return aRank - bRank;

    const aIncludes = aName.includes(q) || aBrand.includes(q) ? 1 : 0;
    const bIncludes = bName.includes(q) || bBrand.includes(q) ? 1 : 0;
    if (aIncludes !== bIncludes) return bIncludes - aIncludes;

    return aName.localeCompare(bName);
  });
}

// -------------------------------------------------------------------------
// SECTION: Food categorization — drives both search quality and correct
// unit options (e.g. "1 piece" = 1 egg, never offered for meat/fish, which
// are only ever measured by weight).
// -------------------------------------------------------------------------

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
  return {
    category: null,
    categoryLabel: null,
    units: ["g", "oz", "cup", "serving"],
    pieceGrams: food?.serving_size || 100,
    pieceLabel: "serving",
  };
}

// -------------------------------------------------------------------------
// SECTION: AI fallback for raw-ingredient search (Gemini). Only used by
// searchRawIngredient, and only when neither the local database nor the
// self-learned ai_foods cache has a match — or when explicitly forced.
// Searching never writes to ai_foods; only confirmAiFood (called when the
// user actually logs the result) persists it.
// -------------------------------------------------------------------------

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || null;
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const AI_NUTRIENT_KEYS = NUMERIC_FIELDS.filter((f) => f !== "serving_size");

const GEMINI_SYSTEM_PROMPT =
  'You are a nutrition database assistant. Given a food search query, ' +
  "return ONLY one JSON object describing that raw/whole food's canonical " +
  "identity and its full nutrition profile per 100 grams. Schema: " +
  '{"canonicalName":string,"category":string,"ingredient":string,' +
  '"preparation":string,"aliases":string[],' +
  `"nutrition":{${AI_NUTRIENT_KEYS.map((k) => `"${k}":number`).join(",")}},` +
  '"confidence":number}. Fill every nutrition field you can reasonably ' +
  "estimate; use 0 only for fields that are genuinely negligible or " +
  "unknown for this food. confidence is 0-1, how sure you are this is a " +
  "real, common food and the values are accurate. If the query is not a " +
  "real food, set confidence to 0. No markdown, no explanation, JSON only.";

async function safePostJson(url, body, { timeout = 12000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function slugifyFoodName(name = "") {
  return normalizeName(name).trim().replace(/\s+/g, "-");
}

const geminiQueryPromises = new Map();

async function callGeminiForFood(query) {
  if (!GEMINI_API_KEY) return null;
  const key = normalizeName(query);
  if (geminiQueryPromises.has(key)) return geminiQueryPromises.get(key);

  const promise = (async () => {
    const data = await safePostJson(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      systemInstruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: `Search query:\n\n${query}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 800,
      },
    });
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();

  geminiQueryPromises.set(key, promise);
  return promise;
}

function validateAiFoodResult(obj) {
  if (!obj || typeof obj !== "object") return null;
  const canonicalName = typeof obj.canonicalName === "string" ? obj.canonicalName.trim() : "";
  if (!canonicalName) return null;

  const nutrition = obj.nutrition || {};
  const calories = Number(nutrition.calories);
  const confidence = Number(obj.confidence);
  if (!Number.isFinite(calories) || calories < 0) return null;
  if (!Number.isFinite(confidence) || confidence < 0.4) return null;

  const nutrients = {};
  for (const key of AI_NUTRIENT_KEYS) {
    if (key === "calories") continue;
    const v = Number(nutrition[key]);
    nutrients[key] = Number.isFinite(v) && v >= 0 ? v : 0;
  }

  return {
    canonicalName,
    category: typeof obj.category === "string" && obj.category.trim() ? obj.category.trim() : "Other",
    ingredient: typeof obj.ingredient === "string" && obj.ingredient.trim() ? obj.ingredient.trim() : canonicalName,
    preparation: typeof obj.preparation === "string" ? obj.preparation.trim() : "",
    aliases: Array.isArray(obj.aliases)
      ? [...new Set(obj.aliases.filter((a) => typeof a === "string" && a.trim()).map((a) => a.trim().toLowerCase()))]
      : [],
    calories,
    ...nutrients,
    confidence,
  };
}

async function saveAiFood(validated, originalQuery) {
  const slug = slugifyFoodName(validated.canonicalName);
  const aliases = [
    ...new Set([...validated.aliases, normalizeName(originalQuery), normalizeName(validated.canonicalName)].filter(Boolean)),
  ];
  const row = {
    slug,
    canonical_name: validated.canonicalName,
    ingredient: validated.ingredient,
    category: validated.category,
    preparation: validated.preparation,
    aliases,
    confidence: validated.confidence,
    ai_generated: true,
  };
  for (const key of AI_NUTRIENT_KEYS) row[key] = validated[key] ?? 0;

  if (!supabase) return row;
  try {
    const { data, error } = await supabase.from("ai_foods").upsert(row, { onConflict: "slug" }).select().single();
    if (error || !data) {
      if (error) console.error("saveAiFood: ai_foods upsert failed, food was not persisted", error);
      return row;
    }
    return data;
  } catch (err) {
    console.error("saveAiFood: ai_foods upsert threw, food was not persisted", err);
    return row;
  }
}

function mapAiFoodRow(row) {
  const nutrients = {};
  for (const key of AI_NUTRIENT_KEYS) nutrients[key] = row[key] ?? 0;
  return normalizeFood({
    source: "ai",
    ref: row.slug,
    name: row.canonical_name,
    category: row.category || null,
    serving_size: 100,
    serving_unit: "g",
    ...nutrients,
  });
}

function buildAiPreviewFood(validated, originalQuery) {
  const nutrients = {};
  for (const key of AI_NUTRIENT_KEYS) nutrients[key] = validated[key] ?? 0;
  const food = normalizeFood({
    source: "ai-pending",
    ref: slugifyFoodName(validated.canonicalName),
    name: validated.canonicalName,
    category: validated.category,
    serving_size: 100,
    serving_unit: "g",
    ...nutrients,
  });
  food._aiPending = { validated, originalQuery };
  return food;
}

/**
 * confirmAiFood — call only when the user actually logs an ai-pending
 * result. Persists it to ai_foods so it becomes part of the searchable
 * database from then on. Searching alone never writes to ai_foods.
 */
export async function confirmAiFood(food) {
  if (!food || food.source !== "ai-pending" || !food._aiPending) return food;
  const { validated, originalQuery } = food._aiPending;
  const saved = await saveAiFood(validated, originalQuery);
  return mapAiFoodRow(saved);
}

/**
 * searchAiFoodCache — searches the self-learned ai_foods table (previously
 * validated + user-confirmed Gemini results). Tries exact/substring matches
 * first (alias, canonical name, slug, ingredient), then falls back to a
 * fuzzy pass (typos, transliteration variants like chorba/chourba) over a
 * broader candidate set so near-matches still surface.
 */
export async function searchAiFoodCache(query) {
  if (!supabase || !query || !query.trim()) return [];
  const q = normalizeName(query);
  const slug = slugifyFoodName(query);

  try {
    let { data } = await supabase.from("ai_foods").select("*").contains("aliases", [q]).limit(20);
    if (data?.length) return data.map(mapAiFoodRow);

    ({ data } = await supabase.from("ai_foods").select("*").ilike("canonical_name", `%${query}%`).limit(20));
    if (data?.length) return data.map(mapAiFoodRow);

    ({ data } = await supabase.from("ai_foods").select("*").ilike("slug", `%${slug}%`).limit(20));
    if (data?.length) return data.map(mapAiFoodRow);

    ({ data } = await supabase.from("ai_foods").select("*").ilike("ingredient", `%${query}%`).limit(20));
    if (data?.length) return data.map(mapAiFoodRow);

    const firstWord = q.split(" ")[0];
    if (firstWord && firstWord.length > 2) {
      ({ data } = await supabase
        .from("ai_foods")
        .select("*")
        .or(`canonical_name.ilike.%${firstWord}%,ingredient.ilike.%${firstWord}%`)
        .limit(20));
      if (data?.length) return data.map(mapAiFoodRow);
    }

    const { data: broad } = await supabase.from("ai_foods").select("*").limit(300);
    if (!broad?.length) return [];
    const fuzzy = broad.filter(
      (row) =>
        fuzzyEquivalent(row.canonical_name || "", query) ||
        (row.aliases || []).some((a) => fuzzyEquivalent(a, query)),
    );
    return fuzzy.map(mapAiFoodRow);
  } catch {
    return [];
  }
}

/**
 * searchRawIngredient — database-first raw-ingredient search: local curated
 * database + the self-learned ai_foods cache, in parallel. Gemini is only
 * called when nothing matches there (or when forceAi is set, from the
 * "Ask AI" button), and its result is never written to ai_foods until the
 * user actually logs it (confirmAiFood) — searching never pollutes the
 * database. If a forced AI result turns out to be the same food as
 * something already found, the existing database entry is reused instead
 * of creating a duplicate.
 */
export async function searchRawIngredient(query, { forceAi = false } = {}) {
  if (!query || !query.trim()) return [];

  const [localResults, cacheResults] = await Promise.all([
    searchLocalFoods(query).catch(() => []),
    searchAiFoodCache(query).catch(() => []),
  ]);

  const dbResults = sortFoods(mergeFoods([...localResults, ...cacheResults]), query).slice(0, 30);

  if (dbResults.length && !forceAi) return dbResults;
  if (!GEMINI_API_KEY) return dbResults;

  const aiRaw = await callGeminiForFood(query).catch(() => null);
  const validated = validateAiFoodResult(aiRaw);
  if (!validated) return dbResults;

  const existingMatch = dbResults.find(
    (f) =>
      fuzzyEquivalent(f.name, validated.canonicalName) ||
      validated.aliases.some((a) => fuzzyEquivalent(f.name, a)),
  );
  if (existingMatch) return sortFoods(mergeFoods([existingMatch, ...dbResults]), query).slice(0, 30);

  const preview = buildAiPreviewFood(validated, query);
  return sortFoods(mergeFoods([preview, ...dbResults]), query).slice(0, 30);
}

/**
 * searchBrandedProduct — for packaged/processed products. Calls Open Food
 * Facts only (plus the shared cache of previously-fetched OFF results),
 * kept entirely separate from the raw-ingredient/AI path above.
 */
export async function searchBrandedProduct(query) {
  if (!query || !query.trim()) return [];

  const [cacheResults, offResults, offBrandResults] = await Promise.all([
    searchSupabaseCache(query).catch(() => []),
    searchOpenFoodFacts(query, 30).catch(() => []),
    searchOpenFoodFactsByBrand(query, 30).catch(() => []),
  ]);

  const merged = mergeFoods([...offBrandResults, ...offResults, ...cacheResults]);
  const ranked = sortFoods(merged, query).slice(0, 40);

  storeFoodsInSupabaseCache([...offResults, ...offBrandResults]).catch(() => {});

  return ranked;
}

// -------------------------------------------------------------------------
// SECTION: Barcode lookup
// -------------------------------------------------------------------------

export async function lookupBarcode(barcode) {
  if (!barcode) return null;
  return lookupBarcodeOpenFoodFacts(barcode).catch(() => null);
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
