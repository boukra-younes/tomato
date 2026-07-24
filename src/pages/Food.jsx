import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAppStore } from '../context/useAppStore'
import { searchRawIngredient, searchBrandedProduct, scaleNutrients, lookupBarcode, getUnitProfile, confirmAiFood } from '../lib/nutritionApi'
import { DRI, NUTRIENT_LABELS, NUTRIENT_UNITS } from '../lib/dri'
import Modal from '../components/Modal'
import { format, addDays } from 'date-fns'
import toast from 'react-hot-toast'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
const SEARCH_MODES = [
  { key: 'raw', label: 'Raw ingredient', hint: 'Curated + AI-backed database — eggs, meat, produce, grains. No brands.' },
  { key: 'branded', label: 'Packaged / branded', hint: 'Open Food Facts — search by product or brand name.' }
]

// The only columns that actually exist on food_logs. Everything else
// scaleNutrients returns (potassium, vitamin_a, etc.) has to go into the
// micronutrients jsonb column instead — passing them as top-level keys
// silently fails the insert (unknown column), which was the root cause of
// "food doesn't add correctly".
const TOP_LEVEL_NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fiber', 'sugar', 'fat', 'saturated_fat', 'sodium']

function splitScaledNutrients(scaled) {
  const topLevel = {}
  const micronutrients = {}
  for (const [key, value] of Object.entries(scaled)) {
    if (TOP_LEVEL_NUTRIENT_KEYS.includes(key)) topLevel[key] = value
    else micronutrients[key] = value
  }
  return { topLevel, micronutrients }
}

const EXTRA_NUTRIENT_KEYS = [
  'trans_fat', 'cholesterol', 'potassium', 'calcium', 'iron', 'magnesium',
  'phosphorus', 'zinc', 'copper', 'selenium', 'vitamin_a', 'vitamin_c',
  'vitamin_d', 'vitamin_e', 'vitamin_k', 'vitamin_b1', 'vitamin_b2',
  'vitamin_b3', 'vitamin_b6', 'vitamin_b12', 'folate'
]

export default function Food() {
  const { user, profile } = useAuth()
  const { foodLogs, fetchDayData, addFoodLog, deleteFoodLog, selectedDate, setSelectedDate } = useAppStore()
  const [searchMode, setSearchMode] = useState('raw')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedFood, setSelectedFood] = useState(null)
  const [amount, setAmount] = useState(100)
  const [unit, setUnit] = useState('g')
  const [mealType, setMealType] = useState('breakfast')
  const [showMoreNutrients, setShowMoreNutrients] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickCalories, setQuickCalories] = useState('')
  const [barcodeOpen, setBarcodeOpen] = useState(false)
  const [barcode, setBarcode] = useState('')
  const [savedTab, setSavedTab] = useState('recent')
  const [expanded, setExpanded] = useState({})
  const [adding, setAdding] = useState(false)

  useEffect(() => { if (user) fetchDayData(user.id, selectedDate) }, [user, selectedDate])

  const runSearch = async (e, forceAi = false) => {
    e?.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = searchMode === 'branded'
        ? await searchBrandedProduct(query)
        : await searchRawIngredient(query, { forceAi })
      setResults(res)
      setHasSearched(true)
      if (forceAi && !res.some(f => f.source === 'ai-pending')) {
        toast('AI found a match already in the database')
      }
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    setHasSearched(false)
  }

  const openFoodDetail = (food) => {
    setSelectedFood(food)
    const profile = getUnitProfile(food)
    if (profile.pieceGrams && profile.units.includes('piece')) {
      setAmount(1)
      setUnit('piece')
    } else {
      setAmount(food.serving_size || 100)
      setUnit(profile.units.includes(food.serving_unit) ? food.serving_unit : profile.units[0])
    }
    setShowMoreNutrients(false)
  }

  const runBarcodeSearch = async () => {
    try {
      const food = await lookupBarcode(barcode)
      if (!food) { toast.error('Product not found'); return }
      setSearchMode('branded')
      openFoodDetail(food)
      setBarcodeOpen(false)
      setBarcode('')
    } catch {
      toast.error('Barcode lookup failed')
    }
  }

  const logFood = async (food, amountVal, unitVal, meal) => {
    const resolvedFood = food.source === 'ai-pending' ? await confirmAiFood(food) : food
    const scaled = scaleNutrients(resolvedFood, Number(amountVal), unitVal)
    const { topLevel, micronutrients } = splitScaledNutrients(scaled)
    await addFoodLog(user.id, {
      log_date: selectedDate, meal_type: meal,
      food_source: resolvedFood.source, food_ref: resolvedFood.ref,
      food_name: resolvedFood.name, brand: resolvedFood.brand,
      amount: Number(amountVal), unit: unitVal,
      micronutrients,
      ...topLevel
    })
    return resolvedFood
  }

  const confirmLog = async () => {
    setAdding(true)
    try {
      await logFood(selectedFood, amount, unit, mealType)
      toast.success(`${selectedFood.name} added`)
      setSelectedFood(null)
      clearSearch()
    } catch (err) {
      toast.error(err.message || 'Could not add food')
    } finally {
      setAdding(false)
    }
  }

  // "Add directly" from the results list — logs at the food's natural
  // default (1 egg, 1 banana, or its own reference serving) without opening
  // the detail modal.
  const quickAddFromResult = async (food, e) => {
    e.stopPropagation()
    const profile = getUnitProfile(food)
    const useUnit = profile.pieceGrams && profile.units.includes('piece') ? 'piece' : (profile.units.includes(food.serving_unit) ? food.serving_unit : profile.units[0])
    const useAmount = useUnit === 'piece' ? 1 : (food.serving_size || 100)
    try {
      await logFood(food, useAmount, useUnit, mealType)
      toast.success(`${food.name} added`)
      clearSearch()
    } catch (err) {
      toast.error(err.message || 'Could not add food')
    }
  }

  const confirmQuickAdd = async () => {
    await addFoodLog(user.id, {
      log_date: selectedDate, meal_type: mealType, food_source: 'quick_add',
      food_name: 'Quick add', amount: 1, unit: 'entry', calories: Number(quickCalories), is_quick_add: true
    })
    setQuickAddOpen(false)
    setQuickCalories('')
    toast.success('Logged')
  }

  const previewScaled = useMemo(() => {
    if (!selectedFood) return null
    return scaleNutrients(selectedFood, Number(amount) || 0, unit)
  }, [selectedFood, amount, unit])

  const mealsGrouped = MEAL_TYPES.reduce((acc, m) => { acc[m] = foodLogs.filter(f => f.meal_type === m); return acc }, {})
  const dayTotals = foodLogs.reduce((acc, f) => ({
    calories: acc.calories + Number(f.calories || 0), protein: acc.protein + Number(f.protein || 0),
    carbs: acc.carbs + Number(f.carbs || 0), fiber: acc.fiber + Number(f.fiber || 0), sugar: acc.sugar + Number(f.sugar || 0),
    fat: acc.fat + Number(f.fat || 0), saturated_fat: acc.saturated_fat + Number(f.saturated_fat || 0), sodium: acc.sodium + Number(f.sodium || 0),
    micros: Object.entries(f.micronutrients || {}).reduce((m, [k, v]) => { m[k] = (m[k] || 0) + Number(v || 0); return m }, acc.micros)
  }), { calories: 0, protein: 0, carbs: 0, fiber: 0, sugar: 0, fat: 0, saturated_fat: 0, sodium: 0, micros: {} })

  const dri = DRI[profile?.sex] || DRI.male
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd')

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 20 }}>
        <button className="btn btn-pill" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), -1), 'yyyy-MM-dd'))}>&larr; PREV</button>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600 }}>{isToday ? 'Today' : format(new Date(selectedDate), 'MMM d, yyyy')}</div>
        <button className="btn btn-pill" onClick={() => setSelectedDate(format(addDays(new Date(selectedDate), 1), 'yyyy-MM-dd'))}>NEXT &rarr;</button>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Search foods</div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Choose what you're looking for, then search</div>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          {SEARCH_MODES.map(m => (
            <button
              key={m.key}
              onClick={() => { setSearchMode(m.key); clearSearch() }}
              className="card"
              style={{
                textAlign: 'left', cursor: 'pointer', margin: 0, padding: 14,
                borderColor: searchMode === m.key ? 'var(--teal)' : 'var(--border)',
                background: searchMode === m.key ? 'var(--teal-soft)' : 'var(--panel)'
              }}
            >
              <div style={{ fontWeight: 600, color: searchMode === m.key ? 'var(--teal)' : 'var(--text-primary)' }}>{m.label}</div>
              <div className="eyebrow" style={{ marginTop: 4 }}>{m.hint}</div>
            </button>
          ))}
        </div>

        <form onSubmit={runSearch} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input placeholder={searchMode === 'raw' ? 'e.g. chicken breast, egg, banana' : 'e.g. Nutella, Coca-Cola'} value={query} onChange={e => { setQuery(e.target.value); setHasSearched(false) }} />
          {query && <button type="button" className="btn btn-pill" onClick={clearSearch}>Clear</button>}
          <button className="btn btn-primary" type="submit">Search</button>
        </form>
        <div style={{ marginBottom: 14 }}>
          <label>Logging to meal</label>
          <select value={mealType} onChange={e => setMealType(e.target.value)} style={{ maxWidth: 220 }}>
            {MEAL_TYPES.map(m => <option key={m} value={m} style={{ textTransform: 'capitalize' }}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setBarcodeOpen(true)}>BARCODE LOOKUP</button>
          <button className="btn btn-secondary" onClick={() => toast('Custom food builder coming soon')}>CREATE FOOD</button>
          <button className="btn btn-secondary" onClick={() => setQuickAddOpen(true)}>QUICK ADD</button>
        </div>

        {searching && <p className="eyebrow">Searching...</p>}
        {!searching && hasSearched && results.length === 0 && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>No foods matched "{query}".</div>
            {searchMode === 'raw' && (
              <button className="btn btn-secondary btn-pill" onClick={() => runSearch(null, true)}>ASK AI</button>
            )}
          </div>
        )}
        {!searching && hasSearched && searchMode === 'raw' && results.length > 0 && !results.some(f => f.source === 'ai-pending' || f.source === 'ai') && (
          <div style={{ textAlign: 'right', marginBottom: 8 }}>
            <button className="btn btn-secondary btn-pill" onClick={() => runSearch(null, true)}>ASK AI INSTEAD</button>
          </div>
        )}
        {results.map((f, i) => {
          const catProfile = getUnitProfile(f)
          return (
            <div key={i} onClick={() => openFoodDetail(f)}
              className="list-row" style={{ cursor: 'pointer' }}>
              <div>
                <div>
                  {f.name}
                  {f.source === 'local' && <span className="chip-est">EST</span>}
                  {f.source === 'ai-pending' && <span className="chip-est" title="AI estimate — saved to the database only once you add it">AI &middot; not saved yet</span>}
                  {f.source === 'ai' && <span className="chip-est">AI</span>}
                  {catProfile.categoryLabel && <span className="chip-est" style={{ background: 'var(--teal-soft)', color: 'var(--teal)' }}>{catProfile.categoryLabel}</span>}
                </div>
                <div className="eyebrow">{(searchMode === 'branded' ? f.brand : null) || f.category || f.source.toUpperCase()} &middot; {f.serving_size || 100}{f.serving_unit || 'g'} serving</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="value" style={{ textAlign: 'right' }}>
                  {Math.round(f.calories)}<div className="eyebrow">kcal</div>
                </div>
                <button className="btn btn-pill" onClick={(e) => quickAddFromResult(f, e)} title="Add directly at default serving">+ Add</button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="row-between" style={{ marginBottom: 8, marginTop: 28 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600 }}>Meals</div>
        <button className="btn btn-secondary btn-pill">+ CUSTOM MEAL</button>
      </div>

      {MEAL_TYPES.map(meal => (
        <div key={meal} className="card">
          <div className="row-between" style={{ cursor: 'pointer' }} onClick={() => setExpanded({ ...expanded, [meal]: !expanded[meal] })}>
            <div style={{ fontFamily: 'Fraunces, serif', fontSize: 17, fontWeight: 600, textTransform: 'capitalize' }}>{meal}</div>
            <div className="value">{Math.round(mealsGrouped[meal].reduce((a, f) => a + Number(f.calories || 0), 0))} kcal</div>
          </div>
          {expanded[meal] !== false && (
            <div style={{ marginTop: 12 }}>
              {mealsGrouped[meal].length === 0 && <div className="eyebrow" style={{ textAlign: 'center', padding: '16px 0' }}>Nothing logged in this meal.</div>}
              {mealsGrouped[meal].map(f => (
                <div key={f.id} className="list-row">
                  <div><div>{f.food_name}</div><div className="eyebrow">{f.amount} {f.unit}</div></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="value">{Math.round(f.calories)} kcal</span>
                    <button className="btn btn-pill" onClick={() => deleteFoodLog(f.id)}>Remove</button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button className="btn btn-secondary btn-pill" onClick={() => { setMealType(meal); document.querySelector('input')?.focus() }}>+ ADD FOOD</button>
                <button className="btn btn-secondary btn-pill">SAVE AS TEMPLATE</button>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Day totals</div>
        <div className="list-row"><span className="label">Calories</span><span className="value">{Math.round(dayTotals.calories)} kcal</span></div>
        <div className="list-row"><span className="label">Protein</span><span className="value">{Math.round(dayTotals.protein)} g</span></div>
        <div className="list-row"><span className="label">Carbs</span><span className="value">{Math.round(dayTotals.carbs)} g</span></div>
        <div className="list-row"><span className="label">Fat</span><span className="value">{Math.round(dayTotals.fat)} g</span></div>
        <div className="list-row" style={{ marginTop: 8, borderTop: '1px solid var(--border)' }}><span className="label text-secondary">Net carbs</span><span className="value">{Math.round(dayTotals.carbs - dayTotals.fiber)} g</span></div>
        <div className="list-row"><span className="label text-secondary">Fiber</span><span className="value">{Math.round(dayTotals.fiber)} g</span></div>
        <div className="list-row"><span className="label text-secondary">Sugar</span><span className="value">{Math.round(dayTotals.sugar)} g</span></div>
        <div className="list-row"><span className="label text-secondary">Saturated fat</span><span className="value">{dayTotals.saturated_fat.toFixed(1)} g</span></div>
        <div className="list-row"><span className="label text-secondary">Sodium</span><span className="value">{Math.round(dayTotals.sodium)} mg</span></div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 2 }}>Micronutrients</div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Against Dietary Reference Intakes for your profile</div>
        {Object.entries(dri).filter(([k]) => !['sodium', 'fiber'].includes(k)).map(([key, target]) => {
          const val = dayTotals.micros[key] || 0
          const pct = Math.round((val / target) * 100)
          return (
            <div key={key} className="list-row">
              <span className="label">{NUTRIENT_LABELS[key] || key}</span>
              <span className="value">{Math.round(val * 10) / 10} / {target} {NUTRIENT_UNITS[key]} &middot; {pct}% &middot; {pct < 50 ? 'low' : pct > 150 ? 'high' : 'ok'}</span>
            </div>
          )
        })}
        <div className="eyebrow" style={{ marginTop: 12 }}>Fiber and sodium appear in the day totals above. Percentages use DRIs for a {profile?.sex || 'male'} adult.</div>
      </div>

      <div className="card">
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 14 }}>Saved</div>
        <div className="pill-group" style={{ marginBottom: 16 }}>
          {['recent', 'favorites', 'frequent', 'my foods', 'recipes', 'meal templates'].map(t => (
            <button key={t} className={'filter-pill' + (savedTab === t ? ' active' : '')} onClick={() => setSavedTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-secondary btn-pill">+ NEW RECIPE</button>
          <button className="btn btn-secondary btn-pill">SAVE TODAY'S MEAL AS TEMPLATE</button>
        </div>
        <div className="eyebrow" style={{ textAlign: 'center', padding: '20px 0' }}>Foods you log will show up here.</div>
      </div>

      <Modal open={!!selectedFood} onClose={() => setSelectedFood(null)} title={selectedFood?.name}>
        {selectedFood && previewScaled && (() => {
          const unitProfile = getUnitProfile(selectedFood)
          const UNIT_LABELS = {
            g: 'grams', kg: 'kg', oz: 'ounces', lb: 'lb', ml: 'ml', l: 'liters',
            cup: 'cup', tbsp: 'tbsp', tsp: 'tsp',
            piece: unitProfile.pieceLabel === 'slice' ? 'slice' : (unitProfile.pieceLabel || 'piece'),
            serving: 'serving'
          }
          return (
          <div>
            {selectedFood.brand && searchMode === 'branded' && <div className="eyebrow" style={{ marginBottom: 4 }}>{selectedFood.brand}</div>}
            {unitProfile.categoryLabel && <div className="eyebrow" style={{ marginBottom: 12, color: 'var(--teal)' }}>{unitProfile.categoryLabel}</div>}

            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div><label>Amount</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
              <div>
                <label>Unit</label>
                <select value={unit} onChange={e => {
                  const newUnit = e.target.value
                  const wasPieceLike = unit === 'piece' || unit === 'slice'
                  const isPieceLike = newUnit === 'piece' || newUnit === 'slice'
                  if (isPieceLike && !wasPieceLike) setAmount(1)
                  else if (!isPieceLike && wasPieceLike) setAmount(unitProfile.pieceGrams || 100)
                  setUnit(newUnit)
                }}>
                  {unitProfile.units.map(u => <option key={u} value={u}>{UNIT_LABELS[u] || u}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>Meal</label>
              <select value={mealType} onChange={e => setMealType(e.target.value)}>
                {MEAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="card" style={{ background: 'var(--panel-2)', marginBottom: 16 }}>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <span className="eyebrow">Nutrition for {amount} {UNIT_LABELS[unit] || unit}{(unit === 'piece' && Number(amount) > 1) ? 's' : ''}</span>
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600 }}>{Math.round(previewScaled.calories)} kcal</span>
              </div>
              <div className="list-row"><span className="label">Protein</span><span className="value">{previewScaled.protein.toFixed(1)} g</span></div>
              <div className="list-row"><span className="label">Carbs</span><span className="value">{previewScaled.carbs.toFixed(1)} g</span></div>
              <div className="list-row"><span className="label">Fat</span><span className="value">{previewScaled.fat.toFixed(1)} g</span></div>
              <div className="list-row"><span className="label text-secondary">Fiber</span><span className="value">{(previewScaled.fiber || 0).toFixed(1)} g</span></div>
              <div className="list-row"><span className="label text-secondary">Sugar</span><span className="value">{(previewScaled.sugar || 0).toFixed(1)} g</span></div>
              <div className="list-row"><span className="label text-secondary">Saturated fat</span><span className="value">{(previewScaled.saturated_fat || 0).toFixed(1)} g</span></div>
              <div className="list-row"><span className="label text-secondary">Sodium</span><span className="value">{Math.round(previewScaled.sodium || 0)} mg</span></div>

              <button
                className="btn btn-pill"
                style={{ marginTop: 10 }}
                onClick={() => setShowMoreNutrients(s => !s)}
              >
                {showMoreNutrients ? 'Hide' : 'Show'} more nutrients
              </button>

              {showMoreNutrients && (
                <div style={{ marginTop: 10 }}>
                  {EXTRA_NUTRIENT_KEYS.map(key => (
                    <div key={key} className="list-row">
                      <span className="label text-secondary">{NUTRIENT_LABELS[key] || key.replace(/_/g, ' ')}</span>
                      <span className="value">{Math.round((previewScaled[key] || 0) * 10) / 10} {NUTRIENT_UNITS[key] || (key === 'cholesterol' || key === 'trans_fat' ? 'mg' : '')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button className="btn btn-primary" style={{ width: '100%' }} disabled={adding} onClick={confirmLog}>
              {adding ? 'Adding...' : 'Add to log'}
            </button>
          </div>
          )
        })()}
      </Modal>

      <Modal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} title="Quick add calories">
        <label>Calories</label>
        <input type="number" value={quickCalories} onChange={e => setQuickCalories(e.target.value)} style={{ marginBottom: 16 }} />
        <label>Meal</label>
        <select value={mealType} onChange={e => setMealType(e.target.value)} style={{ marginBottom: 16 }}>
          {MEAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={confirmQuickAdd}>Add</button>
      </Modal>

      <Modal open={barcodeOpen} onClose={() => setBarcodeOpen(false)} title="Scan barcode">
        <label>Barcode number</label>
        <input value={barcode} onChange={e => setBarcode(e.target.value)} style={{ marginBottom: 16 }} />
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={runBarcodeSearch}>Look up</button>
      </Modal>
    </div>
  )
}
