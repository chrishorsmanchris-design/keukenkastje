'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { useToast } from '@/components/Toast'
import type { Recipe, Ingredient } from '@/lib/types'

function categorize(name: string): string {
  const n = name.toLowerCase()
  if (/tomaat|paprika|ui|knoflook|wortel|sla|spinazie|broccoli|courgette|aubergine|avocado|citroen|limoen|appel|peer|banaan|aardappel|zoete aardappel|venkel/.test(n)) return 'Groente & fruit'
  if (/kip|rund|vark|gehakt|zalm|vis|garnaal|tonijn|spek|chorizo/.test(n)) return 'Vlees & vis'
  if (/melk|kaas|boter|room|yoghurt|kwark|ei|mozzarella|parmezaan|ricotta|creme fraiche/.test(n)) return 'Zuivel & eieren'
  if (/brood|baguette|ciabatta|pita|tortilla|wrap/.test(n)) return 'Brood & bakkerij'
  if (/pasta|spaghetti|penne|tagliatelle|rijst|couscous|quinoa|noodle/.test(n)) return 'Pasta & rijst'
  if (/blik|pot|kikkererwt|linzen|boon|tomatenblok|kokosmelk/.test(n)) return 'Blikken & potten'
  if (/olie|azijn|sojasaus|tahini|harissa|pesto|mosterd|ketchup|zout|peper|komijn|kurkuma|oregano|basilicum|tijm|rozemarijn|paprikapoeder|kaneel|honing|suiker|bloem/.test(n)) return 'Sauzen & kruiden'
  if (/water|sap|wijn|bier|cola|thee|koffie/.test(n)) return 'Dranken'
  return 'Overig'
}

const CUISINE_FLAGS: Record<string, string> = {
  'Italiaans': '🇮🇹', 'Midden-Oosters': '🫙', 'Aziatisch': '🇯🇵',
  'Nederlands': '🇳🇱', 'Mexicaans': '🇲🇽', 'Frans': '🇫🇷', 'Amerikaans': '🇺🇸',
}

export default function ReceptDetail({ recipe }: { recipe: Recipe }) {
  const router = useRouter()
  const toast = useToast()
  const [servings, setServings] = useState(recipe.servings)
  const [kookstand, setKookstand] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [imageUrl, setImageUrl] = useState(recipe.image_url ?? '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [notes, setNotes] = useState(recipe.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [isFavorite, setIsFavorite] = useState(recipe.is_favorite ?? false)
  const [showPlanner, setShowPlanner] = useState(false)
  const [plannerLoading, setPlannerLoading] = useState<string | null>(null)
  const [plannerDone, setPlannerDone] = useState<string | null>(null)
  const [pantryItems, setPantryItems] = useState<{ name: string; quantity: number }[]>([])
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sla laatste geopende recept op voor scroll-terugkeer
  useEffect(() => {
    localStorage.setItem('lastRecipeId', recipe.id)
  }, [recipe.id])

  // Laad pantry items voor "in huis" check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('household_id').eq('id', user.id).single()
        .then(({ data: profile }) => {
          if (!profile?.household_id) return
          supabase.from('pantry_items').select('name, quantity')
            .eq('household_id', profile.household_id)
            .then(({ data }) => { if (data) setPantryItems(data) })
        })
    })
  }, [])

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const date = d.toISOString().split('T')[0]
    const label = i === 0 ? 'Vandaag' : i === 1 ? 'Morgen' : ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'][d.getDay()]
    return { date, label }
  })

  async function planOnDay(date: string) {
    setPlannerLoading(date)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user!.id).single()

    const { data: existing } = await supabase.from('week_menu')
      .select('id').eq('date', date).eq('household_id', profile!.household_id).eq('meal_type', 'dinner').maybeSingle()

    if (existing) {
      await supabase.from('week_menu').update({ recipe_id: recipe.id, servings: recipe.servings }).eq('id', existing.id)
    } else {
      await supabase.from('week_menu').insert({ date, meal_type: 'dinner', recipe_id: recipe.id, servings: recipe.servings, household_id: profile!.household_id })
    }
    setPlannerLoading(null)
    setPlannerDone(date)
    setTimeout(() => { setShowPlanner(false); setPlannerDone(null) }, 1200)
  }

  async function toggleFavorite() {
    const next = !isFavorite
    setIsFavorite(next)
    const supabase = createClient()
    await supabase.from('recipes').update({ is_favorite: next }).eq('id', recipe.id)
    toast(next ? '❤️ Toegevoegd aan favorieten' : 'Verwijderd uit favorieten')
  }

  const ratio = servings / recipe.servings

  function scaleAmount(amount: string): string {
    const num = parseFloat(amount)
    if (isNaN(num)) return amount
    const scaled = num * ratio
    return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1)
  }

  function isInPantry(ingredientName: string): boolean {
    const needle = ingredientName.toLowerCase().trim()
    return pantryItems.some(p => {
      const hay = p.name.toLowerCase().trim()
      return hay.includes(needle) || needle.includes(hay)
    })
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    const compressed = await compressImage(file)
    const formData = new FormData()
    formData.append('file', compressed)
    formData.append('recipeId', recipe.id)
    const res = await fetch('/api/recepten/upload-image', { method: 'POST', body: formData })
    const { url } = await res.json()
    if (url) setImageUrl(url)
    setUploadingPhoto(false)
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      setSavingNotes(true)
      const supabase = createClient()
      await supabase.from('recipes').update({ notes: value }).eq('id', recipe.id)
      setSavingNotes(false)
    }, 800)
  }

  async function shareRecipe() {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: recipe.title, url })
    } else {
      await navigator.clipboard.writeText(url)
      toast('Link gekopieerd!')
    }
  }

  async function addToShoppingList() {
    setAdding(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user!.id).single()
    const ingredients = recipe.ingredients as Ingredient[]
    await supabase.from('shopping_items').insert(
      ingredients.map(ing => ({
        name: `${ing.name}${ing.amount ? ` (${scaleAmount(ing.amount)}${ing.unit ? ' ' + ing.unit : ''})` : ''}`,
        household_id: profile?.household_id,
        is_manual: false,
        checked: false,
        category: categorize(ing.name),
      }))
    )
    setAdding(false)
    setAdded(true)
    setTimeout(() => setAdded(false), 3000)
  }

  if (kookstand) {
    return (
      <KookstandView
        recipe={recipe}
        activeStep={activeStep}
        setActiveStep={setActiveStep}
        onExit={() => setKookstand(false)}
        servings={servings}
        onServingsChange={setServings}
      />
    )
  }

  return (
    <div className="pb-8">
      <div className="relative">
        {imageUrl ? (
          <img src={imageUrl} alt={recipe.title} className="w-full h-56 object-cover" />
        ) : (
          <div className="w-full h-40 bg-stone-100 flex items-center justify-center text-5xl">🍽️</div>
        )}
        <label className="absolute bottom-3 right-3 cursor-pointer">
          <div className="bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <span>📷</span>
            <span>{uploadingPhoto ? 'Uploaden...' : 'Foto wijzigen'}</span>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </label>
      </div>

      <div className="px-4 pt-4 space-y-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold leading-tight">{recipe.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {recipe.cuisine && recipe.cuisine !== 'null' && <span className="text-sm">{CUISINE_FLAGS[recipe.cuisine]} {recipe.cuisine}</span>}
              {recipe.ingredient_type && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full capitalize">
                  {recipe.ingredient_type}
                </span>
              )}
              {recipe.diet_labels?.map(d => (
                <span key={d} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{d}</span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={toggleFavorite}
              className="text-xl hover:scale-110 transition-transform"
              aria-label={isFavorite ? 'Verwijder favoriet' : 'Voeg toe aan favorieten'}
            >
              {isFavorite ? '❤️' : '🤍'}
            </button>
            <button onClick={shareRecipe} className="text-stone-400 text-lg" aria-label="Delen">⬆️</button>
            <button
              onClick={() => router.push(`${window.location.pathname}/bewerken`)}
              className="text-stone-400 text-lg"
              aria-label="Bewerken"
            >✏️</button>
            <button
              onClick={async () => {
                if (!confirm('Weet je zeker dat je dit recept wilt verwijderen?')) return
                const supabase = createClient()
                await supabase.from('recipes').delete().eq('id', recipe.id)
                router.back()
              }}
              className="text-stone-400 text-lg"
              aria-label="Verwijderen"
            >🗑️</button>
            <button onClick={() => router.back()} className="text-stone-400 text-lg font-medium" aria-label="Sluiten">✕</button>
          </div>
        </div>

        {/* Time info */}
        {(recipe.prep_time_minutes || recipe.cook_time_minutes) ? (
          <div className="flex gap-4">
            {recipe.prep_time_minutes ? (
              <div className="text-center">
                <p className="text-xs text-stone-400">Voorbereiden</p>
                <p className="font-medium text-sm">{recipe.prep_time_minutes} min</p>
              </div>
            ) : null}
            {recipe.cook_time_minutes ? (
              <div className="text-center">
                <p className="text-xs text-stone-400">Koken</p>
                <p className="font-medium text-sm">{recipe.cook_time_minutes} min</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Servings */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-stone-500">Personen</span>
          <div className="flex items-center gap-3 bg-stone-100 rounded-full px-3 py-1">
            <button onClick={() => setServings(s => Math.max(1, s - 1))} className="text-lg w-6 h-6 flex items-center justify-center">−</button>
            <span className="font-medium text-sm w-4 text-center">{servings}</span>
            <button onClick={() => setServings(s => s + 1)} className="text-lg w-6 h-6 flex items-center justify-center">+</button>
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Ingrediënten</h2>
            {pantryItems.length > 0 && (() => {
              const inHuis = (recipe.ingredients as Ingredient[]).filter(ing => isInPantry(ing.name)).length
              const total = (recipe.ingredients as Ingredient[]).length
              return (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  inHuis === total ? 'bg-green-100 text-green-700' :
                  inHuis > 0 ? 'bg-orange-100 text-orange-700' :
                  'bg-stone-100 text-stone-500'
                }`}>
                  {inHuis}/{total} in huis
                </span>
              )
            })()}
          </div>
          <ul className="space-y-2">
            {(recipe.ingredients as Ingredient[]).map((ing, i) => {
              const inHuis = isInPantry(ing.name)
              return (
                <li key={i} className="flex justify-between text-sm border-b border-stone-100 pb-2">
                  <span className={`flex items-center gap-1.5 ${inHuis ? 'text-green-700' : 'text-stone-700'}`}>
                    {inHuis && <span className="text-green-500 text-xs leading-none">✓</span>}
                    {ing.name}
                  </span>
                  <span className="text-stone-500 font-medium">{scaleAmount(ing.amount)} {ing.unit}</span>
                </li>
              )
            })}
          </ul>
        </div>

        <button
          onClick={addToShoppingList}
          disabled={adding}
          className={`w-full py-3 rounded-2xl text-sm font-medium transition-colors ${
            added
              ? 'bg-green-100 text-green-700'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          {added ? '✓ Toegevoegd aan boodschappenlijst' : adding ? '...' : '🛒 Voeg ingrediënten toe aan boodschappenlijst'}
        </button>

        {/* Steps preview */}
        <div>
          <h2 className="font-semibold mb-3">Bereiding</h2>
          <ol className="space-y-3">
            {(recipe.steps as { order: number; text: string }[]).map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex-shrink-0 w-6 h-6 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {step.order}
                </span>
                <p className="text-stone-700 leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Notities</h2>
            {savingNotes && <span className="text-xs text-stone-400">Opslaan...</span>}
          </div>
          <textarea
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Jouw notities bij dit recept..."
            rows={3}
            className="w-full px-3 py-2.5 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setKookstand(true)}
            className="flex-1 py-3.5 bg-orange-500 text-white font-medium rounded-2xl hover:bg-orange-600 transition-colors"
          >
            🍳 Kookstand starten
          </button>
          <button
            onClick={() => setShowPlanner(true)}
            className="py-3.5 px-4 bg-stone-100 text-stone-700 font-medium rounded-2xl hover:bg-stone-200 transition-colors"
          >
            📅 Inplannen
          </button>
        </div>
      </div>

      {showPlanner && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowPlanner(false)}>
          <div className="bg-white w-full rounded-t-3xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold">Inplannen voor…</h2>
              <button onClick={() => setShowPlanner(false)} className="text-stone-400">✕</button>
            </div>
            {days.map(({ date, label }) => (
              <button
                key={date}
                onClick={() => planOnDay(date)}
                disabled={!!plannerLoading}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-colors ${
                  plannerDone === date ? 'bg-green-50 border-green-200' : 'bg-stone-50 border-stone-100 hover:border-orange-300 hover:bg-orange-50'
                } disabled:opacity-50`}
              >
                <span className="font-medium text-sm">{label}</span>
                {plannerLoading === date ? (
                  <svg className="animate-spin w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                  </svg>
                ) : plannerDone === date ? (
                  <span className="text-green-500 text-sm">✓ Ingepland</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function KookstandView({
  recipe, activeStep, setActiveStep, onExit, servings, onServingsChange,
}: {
  recipe: Recipe
  activeStep: number
  setActiveStep: (n: number) => void
  onExit: () => void
  servings: number
  onServingsChange: (n: number) => void
}) {
  const steps = recipe.steps as { order: number; text: string; timer_minutes?: number }[]
  const step = steps[activeStep]
  const isLast = activeStep === steps.length - 1
  const [showIngredients, setShowIngredients] = useState(false)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [showCookDone, setShowCookDone] = useState(false)
  const [deducting, setDeducting] = useState(false)
  const toast = useToast()

  // Houd scherm wakker tijdens kookstand
  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock.request('screen').then(l => { lock = l; setWakeLockActive(true) }).catch(() => {})
    const reacquire = () => {
      if (document.visibilityState === 'visible') {
        navigator.wakeLock.request('screen').then(l => { lock = l; setWakeLockActive(true) }).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', reacquire)
    return () => {
      lock?.release()
      setWakeLockActive(false)
      document.removeEventListener('visibilitychange', reacquire)
    }
  }, [])

  // --- Multi-timer systeem ---
  interface ActiveTimer { id: string; label: string; endTime: number; stepIndex: number; totalSecs: number }
  const [timers, setTimers] = useState<ActiveTimer[]>([])
  const [, setTick] = useState(0)

  // Web Audio beep — werkt ook als scherm aan is maar app op achtergrond
  function playBeep() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = new (window.AudioContext ?? (window as any).webkitAudioContext)()
      ;[0, 0.4, 0.8].forEach(t => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.setValueAtTime(0.4, ctx.currentTime + t)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35)
        osc.start(ctx.currentTime + t)
        osc.stop(ctx.currentTime + t + 0.35)
      })
    } catch { /* AudioContext niet beschikbaar */ }
  }

  function sendSwMessage(msg: Record<string, unknown>) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(msg)
    }
  }

  function addTimer(stepIndex: number, minutes: number) {
    const id = `${stepIndex}-${Date.now()}`
    const label = `Stap ${stepIndex + 1}`
    const durationMs = minutes * 60 * 1000
    setTimers(ts => [...ts, {
      id, stepIndex, totalSecs: minutes * 60, label,
      endTime: Date.now() + durationMs,
    }])
    // Plan ook een SW-notificatie zodat scherm-uit werkt
    sendSwMessage({ type: 'SCHEDULE_TIMER', id, label, durationMs })
  }

  function removeTimer(id: string) {
    setTimers(ts => ts.filter(t => t.id !== id))
    sendSwMessage({ type: 'CANCEL_TIMER', id })
  }

  async function deductAndExit() {
    setDeducting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user!.id).single()
      const { data: pantry } = await supabase.from('pantry_items')
        .select('id, name, quantity')
        .eq('household_id', profile!.household_id)

      const ratio = servings / recipe.servings
      const ingredients = recipe.ingredients as { name: string; amount: string; unit: string }[]

      for (const ing of ingredients) {
        const match = pantry?.find(p =>
          p.name.toLowerCase().includes(ing.name.toLowerCase()) ||
          ing.name.toLowerCase().includes(p.name.toLowerCase())
        )
        if (!match) continue
        const amt = parseFloat(ing.amount) * ratio
        if (isNaN(amt) || amt <= 0) continue
        const newQty = match.quantity - amt
        if (newQty <= 0.01) {
          await supabase.from('pantry_items').delete().eq('id', match.id)
        } else {
          await supabase.from('pantry_items').update({ quantity: Math.round(newQty * 10) / 10 }).eq('id', match.id)
        }
      }
      toast('🧺 Pantry bijgewerkt')
    } catch { /* silently ignore */ }
    setDeducting(false)
    onExit()
  }

  // Tick elke seconde zolang er timers actief zijn
  useEffect(() => {
    if (timers.length === 0) return
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [timers.length])

  // Herbereken bij terugkeren van slaapstand
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') setTick(t => t + 1) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Controleer afgelopen timers bij elke tick
  useEffect(() => {
    const now = Date.now()
    const done = timers.filter(t => t.endTime <= now)
    if (done.length > 0) {
      done.forEach(() => {
        playBeep()
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([400, 100, 400, 100, 400])
      })
      setTimers(ts => ts.filter(t => t.endTime > now))
    }
  }) // elke render checken

  const ratio = servings / recipe.servings
  function scaleAmount(amount: string): string {
    const num = parseFloat(amount)
    if (isNaN(num)) return amount
    const scaled = num * ratio
    return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1)
  }

  // Huidige stap timer
  const currentTimer = timers.find(t => t.stepIndex === activeStep)
  const secsLeft = currentTimer ? Math.max(0, Math.ceil((currentTimer.endTime - Date.now()) / 1000)) : null
  const mins = secsLeft !== null ? Math.floor(secsLeft / 60) : 0
  const secs = secsLeft !== null ? secsLeft % 60 : 0
  const totalSecs = (step.timer_minutes ?? 0) * 60
  const progress = totalSecs > 0 && secsLeft !== null ? secsLeft / totalSecs : 0
  const otherTimers = timers.filter(t => t.stepIndex !== activeStep)

  return (
    <div className="min-h-screen bg-stone-900 text-white flex flex-col px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 min-w-0">
          <span className="text-stone-400 text-sm truncate block">{recipe.title}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Personen aanpassen */}
          <div className="flex items-center gap-2 bg-stone-800 rounded-full px-3 py-1">
            <button
              onClick={() => onServingsChange(Math.max(1, servings - 1))}
              className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white"
            >−</button>
            <span className="text-xs font-medium tabular-nums">{servings}p</span>
            <button
              onClick={() => onServingsChange(servings + 1)}
              className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white"
            >+</button>
          </div>
          {/* Wake lock indicator */}
          {wakeLockActive && (
            <span title="Scherm blijft aan" className="text-base leading-none">💡</span>
          )}
          {/* Ingrediënten */}
          <button
            onClick={() => setShowIngredients(true)}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
            title="Ingrediënten bekijken"
          >
            <span>📋</span>
            <span>{(recipe.ingredients as Ingredient[]).length}</span>
          </button>
          <button onClick={onExit} className="text-stone-400 text-sm">Sluiten</button>
        </div>
      </div>

      {/* Andere actieve timers (andere stappen) */}
      {otherTimers.map(t => {
        const s = Math.max(0, Math.ceil((t.endTime - Date.now()) / 1000))
        return (
          <div key={t.id} className="bg-orange-500/20 border border-orange-500/40 rounded-2xl px-4 py-2 mb-2 flex items-center justify-between">
            <span className="text-orange-300 text-sm">⏱ {t.label}</span>
            <span className="text-white font-bold tabular-nums text-sm">
              {String(Math.floor(s / 60)).padStart(2,'0')}:{String(s % 60).padStart(2,'0')}
            </span>
            <button onClick={() => removeTimer(t.id)} className="text-orange-300 text-xs ml-2">Stop</button>
          </div>
        )
      })}

      <div className="flex gap-1 mb-8">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i <= activeStep ? 'bg-orange-500' : 'bg-stone-700'}`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <p className="text-orange-400 text-sm font-medium mb-4">Stap {activeStep + 1} van {steps.length}</p>
        <p className="text-2xl leading-relaxed font-medium">{step.text}</p>

        {/* Relevante ingrediënten voor deze stap */}
        {(() => {
          const stopWords = new Set(['een', 'het', 'van', 'met', 'dat', 'dan', 'toe', 'voor', 'door', 'aan', 'uit', 'over', 'maar', 'ook', 'als', 'wat', 'dit', 'zet', 'voeg', 'roer', 'bak', 'kook', 'laat', 'haal', 'snij', 'snijd'])
          const stepLower = step.text.toLowerCase()

          function mentionedInStep(ingName: string): boolean {
            const n = ingName.toLowerCase()
            if (stepLower.includes(n)) return true
            // Woorden uit ingrediëntnaam in staptekst ("verse salie" → "salie")
            const ingWords = n.split(/\s+/).filter(w => w.length >= 4 && !stopWords.has(w))
            if (ingWords.some(w => stepLower.includes(w))) return true
            // Woorden uit staptekst in ingrediëntnaam ("boter" → "roomboter")
            const stepWords = stepLower.split(/\W+/).filter(w => w.length >= 4 && !stopWords.has(w))
            if (stepWords.some(w => n.includes(w))) return true
            return false
          }

          const relevant = activeStep === 0
            ? (recipe.ingredients as Ingredient[])
            : (recipe.ingredients as Ingredient[]).filter(ing => mentionedInStep(ing.name))
          if (relevant.length === 0) return null
          return (
            <div className="flex flex-wrap gap-2 mt-5">
              {relevant.map((ing, i) => {
                const scaled = scaleAmount(ing.amount)
                const hasAmount = ing.amount && !isNaN(parseFloat(ing.amount))
                return (
                  <div key={i} className="flex items-baseline gap-1 bg-stone-800 rounded-full px-3.5 py-2">
                    {hasAmount && (
                      <span className="text-orange-400 font-bold text-base tabular-nums leading-none">{scaled}</span>
                    )}
                    {ing.unit && hasAmount && (
                      <span className="text-orange-300/60 text-xs font-medium leading-none">{ing.unit}</span>
                    )}
                    <span className="text-stone-300 text-sm leading-none ml-1">{ing.name}</span>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {step.timer_minutes && (
          <div className="mt-8">
            {currentTimer ? (
              <div className="space-y-4">
                {/* Circular progress */}
                <div className="flex justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" fill="none" stroke="#292524" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="44" fill="none"
                        stroke={secsLeft === 0 ? '#22c55e' : '#f97316'}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 44}`}
                        strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {secsLeft === 0 ? (
                        <span className="text-green-400 text-2xl">✓</span>
                      ) : (
                        <>
                          <span className="text-2xl font-bold tabular-nums">
                            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                          </span>
                          <span className="text-xs text-stone-400">over</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => removeTimer(currentTimer.id)} className="w-full py-3 bg-stone-800 rounded-2xl text-sm">
                  Timer stoppen
                </button>
              </div>
            ) : (
              <button
                onClick={() => addTimer(activeStep, step.timer_minutes!)}
                className="w-full py-3.5 bg-stone-800 border border-stone-700 rounded-2xl font-medium flex items-center justify-center gap-2"
              >
                <span>⏱</span>
                <span>Timer starten — {step.timer_minutes} min</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-8">
        {activeStep > 0 && (
          <button
            onClick={() => setActiveStep(activeStep - 1)}
            className="flex-1 py-4 bg-stone-800 rounded-2xl font-medium"
          >
            ← Vorige
          </button>
        )}
        <button
          onClick={() => isLast ? setShowCookDone(true) : setActiveStep(activeStep + 1)}
          className="flex-1 py-4 bg-orange-500 rounded-2xl font-medium"
        >
          {isLast ? '✓ Klaar' : 'Volgende →'}
        </button>
      </div>

      {/* Ingrediënten bottom sheet */}
      {showIngredients && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-end"
          onClick={() => setShowIngredients(false)}
        >
          <div
            className="bg-stone-900 w-full rounded-t-3xl max-h-[78vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-stone-800">
              <h2 className="font-semibold text-white text-base">Ingrediënten</h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-stone-800 rounded-full px-3 py-1.5">
                  <button
                    onClick={() => onServingsChange(Math.max(1, servings - 1))}
                    className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white text-base leading-none"
                  >−</button>
                  <span className="text-sm font-medium text-white tabular-nums w-12 text-center">
                    {servings} {servings === 1 ? 'pers.' : 'pers.'}
                  </span>
                  <button
                    onClick={() => onServingsChange(servings + 1)}
                    className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white text-base leading-none"
                  >+</button>
                </div>
                <button onClick={() => setShowIngredients(false)} className="text-stone-500 hover:text-white text-lg leading-none">✕</button>
              </div>
            </div>

            {/* Grid */}
            <div className="overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                {(recipe.ingredients as Ingredient[]).map((ing, i) => {
                  const scaled = scaleAmount(ing.amount)
                  const hasAmount = ing.amount && !isNaN(parseFloat(ing.amount))
                  return (
                    <div key={i} className="bg-stone-800 rounded-2xl px-4 py-3.5 flex flex-col gap-1.5 active:bg-stone-700 transition-colors">
                      {hasAmount ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-orange-400 font-bold text-2xl tabular-nums leading-none">{scaled}</span>
                          {ing.unit && <span className="text-orange-300/70 text-sm font-medium leading-none">{ing.unit}</span>}
                        </div>
                      ) : (
                        <span className="text-orange-300/70 text-sm font-medium leading-none">{scaled || '—'}</span>
                      )}
                      <span className="text-stone-300 text-sm leading-snug">{ing.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCookDone && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="bg-stone-800 w-full rounded-t-3xl p-6 space-y-4">
            <h2 className="font-semibold text-white text-lg">Goed gekookt! 🎉</h2>
            <p className="text-stone-400 text-sm">Wil je de gebruikte ingrediënten van je pantry aftrekken?</p>
            <button
              onClick={deductAndExit}
              disabled={deducting}
              className="w-full py-3.5 bg-orange-500 text-white font-medium rounded-2xl disabled:opacity-50"
            >
              {deducting ? 'Bezig...' : '🧺 Ja, pantry bijwerken'}
            </button>
            <button
              onClick={onExit}
              className="w-full py-3 text-stone-400 text-sm"
            >
              Overslaan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
