import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAppStore } from '../context/useAppStore'
import { unifiedFoodSearch, scaleNutrients, lookupBarcode } from '../lib/nutritionApi'
import { DRI, NUTRIENT_LABELS, NUTRIENT_UNITS } from '../lib/dri'
import Modal from '../components/Modal'
import { format, addDays } from 'date-fns'
import toast from 'react-hot-toast'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
const SOURCE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'local', label: 'Local' },
  { key: 'off', label: 'Packaged' },
  { key: 'custom', label: 'My foods' },
  { key: 'recipe', label: 'Recipes' }
]

export default function Food() {
  const { user, profile } = useAuth()
  const { foodLogs, fetchDayData, addFoodLog, deleteFoodLog, selectedDate, setSelectedDate } = useAppStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [sourceFilter, setSourceFilter] = useState('all')
  const [searching, setSearching] = useState(false)
  const [selectedFood, setSelectedFood] = useState(null)
  const [amount, setAmount] = useState(100)
  const [unit, setUnit] = useState('g')
  const [mealType, setMealType] = useState('breakfast')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickCalories, setQuickCalories] = useState('')
  const [barcodeOpen, setBarcodeOpen] = useState(false)
  const [barcode, setBarcode] = useState('')
  const [savedTab, setSavedTab] = useState('recent')
  const [expanded, setExpanded] = useState({})

  useEffect(() => { if (user) fetchDayData(user.id, selectedDate) }, [user, selectedDate])

  const runSearch = async (e) => {
    e?.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const res = await unifiedFoodSearch(query)
      setResults(res.slice(0, 30))
    } catch {
      toast.error('Search failed')
    } finally {
      setSearching(false)
    }
  }

  const filteredResults = results.filter(f => {
    if (sourceFilter === 'all') return true
    if (sourceFilter === 'local') return f.source === 'local'
    if (sourceFilter === 'off') return f.source === 'off'
    if (sourceFilter === 'custom') return f.source === 'custom'
    if (sourceFilter === 'recipe') return f.source === 'recipe'
    return true
  })

  const runBarcodeSearch = async () => {
    try {
      const food = await lookupBarcode(barcode)
      if (!food) { toast.error('Product not found'); return }
      setSelectedFood(food)
      setBarcodeOpen(false)
    } catch {
      toast.error('Barcode lookup failed')
    }
  }

  const confirmLog = async () => {
    const scaled = scaleNutrients(selectedFood, Number(amount), unit)
    await addFoodLog(user.id, {
      log_date: selectedDate, meal_type: mealType,
      food_source: selectedFood.source, food_ref: selectedFood.ref,
      food_name: selectedFood.name, brand: selectedFood.brand,
      amount: Number(amount), unit, ...scaled
    })
    toast.success('Logged')
    setSelectedFood(null)
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
        <div className="eyebrow" style={{ marginBottom: 16 }}>Local database, or Open Food Facts when online</div>
        <form onSubmit={runSearch}>
          <input placeholder="chicken" value={query} onChange={e => setQuery(e.target.value)} style={{ marginBottom: 14 }} />
        </form>
        <div className="pill-group" style={{ marginBottom: 14 }}>
          {SOURCE_FILTERS.map(f => (
            <button key={f.key} className={'filter-pill' + (sourceFilter === f.key ? ' active' : '')} onClick={() => setSourceFilter(f.key)}>{f.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setBarcodeOpen(true)}>BARCODE LOOKUP</button>
          <button className="btn btn-secondary" onClick={() => toast('Custom food builder coming soon')}>CREATE FOOD</button>
          <button className="btn btn-secondary" onClick={() => setQuickAddOpen(true)}>QUICK ADD</button>
        </div>

        {searching && <p className="eyebrow">Searching...</p>}
        {filteredResults.map((f, i) => (
          <div key={i} onClick={() => setSelectedFood(f)}
            className="list-row" style={{ cursor: 'pointer' }}>
            <div>
              <div>{f.name}{f.source === 'local' && <span className="chip-est">EST</span>}</div>
              <div className="eyebrow">{f.brand || f.category || f.source.toUpperCase()}</div>
            </div>
            <div className="value" style={{ textAlign: 'right' }}>
              {Math.round(f.calories)}<div className="eyebrow">kcal/100g</div>
            </div>
          </div>
        ))}
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
        <div className="list-row"><span className="label">Calories</span><span className="value">{Math.round(dayTotals.calories)} / {'—'} kcal</span></div>
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
              <span className="value">{val} / {target} {NUTRIENT_UNITS[key]} &middot; {pct}% &middot; {pct < 50 ? 'low' : pct > 150 ? 'high' : 'ok'}</span>
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
        {selectedFood && (
          <div>
            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div><label>Amount</label><input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
              <div>
                <label>Unit</label>
                <select value={unit} onChange={e => setUnit(e.target.value)}>
                  <option value="g">grams</option><option value="oz">ounces</option><option value="ml">ml</option><option value="cup">cup</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>Meal</label>
              <select value={mealType} onChange={e => setMealType(e.target.value)}>
                {MEAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={confirmLog}>Add to log</button>
          </div>
        )}
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
