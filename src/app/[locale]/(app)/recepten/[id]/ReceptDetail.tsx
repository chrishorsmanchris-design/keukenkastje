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
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    const { data: profile } = await supabase.from('profiles').select('household_id').single()
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
          <div>
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
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleFavorite}
              className="text-xl hover:scale-110 transition-transform"
              aria-label={isFavorite ? 'Verwijder favoriet' : 'Voeg toe aan favorieten'}
            >
              {isFavorite ? '❤️' : '🤍'}
            </button>
            <button onClick={shareRecipe} className="text-stone-400 text-lg">⬆️</button>
            <button onClick={() => router.push(`${window.location.pathname}/bewerken`)} className="text-stone-400 text-sm px-2 py-1 bg-stone-100 rounded-lg">Bewerken</button>
            <button onClick={() => router.back()} className="text-stone-400">✕</button>
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
          <h2 className="font-semibold mb-3">Ingrediënten</h2>
          <ul className="space-y-2">
            {(recipe.ingredients as Ingredient[]).map((ing, i) => (
              <li key={i} className="flex justify-between text-sm border-b border-stone-100 pb-2">
                <span className="text-stone-700">{ing.name}</span>
                <span className="text-stone-500 font-medium">{scaleAmount(ing.amount)} {ing.unit}</span>
              </li>
            ))}
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

        <button
          onClick={() => setKookstand(true)}
          className="w-full py-3.5 bg-orange-500 text-white font-medium rounded-2xl hover:bg-orange-600 transition-colors"
        >
          🍳 Kookstand starten
        </button>
      </div>
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
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showIngredients, setShowIngredients] = useState(false)

  const ratio = servings / recipe.servings
  function scaleAmount(amount: string): string {
    const num = parseFloat(amount)
    if (isNaN(num)) return amount
    const scaled = num * ratio
    return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1)
  }

  function startTimer() {
    if (!step.timer_minutes) return
    const secs = step.timer_minutes * 60
    setSecondsLeft(secs)
    setTimerRunning(true)
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerRunning(false)
    setSecondsLeft(null)
  }

  useEffect(() => {
    if (timerRunning && secondsLeft !== null) {
      timerRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s === null || s <= 1) {
            clearInterval(timerRef.current!)
            setTimerRunning(false)
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([400, 100, 400])
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerRunning])

  // Timer blijft lopen bij stapwisseling

  const mins = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0
  const secs = secondsLeft !== null ? secondsLeft % 60 : 0
  const totalSecs = (step.timer_minutes ?? 0) * 60
  const progress = totalSecs > 0 && secondsLeft !== null ? secondsLeft / totalSecs : 0

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
          {/* Ingrediënten */}
          <button
            onClick={() => setShowIngredients(true)}
            className="text-stone-400 hover:text-white text-sm transition-colors"
            title="Ingrediënten bekijken"
          >
            📋
          </button>
          <button onClick={onExit} className="text-stone-400 text-sm">Sluiten</button>
        </div>
      </div>

      {/* Mini-timer: loopt door als je naar andere stap gaat */}
      {timerRunning && secondsLeft !== null && secondsLeft > 0 && !step.timer_minutes && (
        <div className="bg-orange-500/20 border border-orange-500/40 rounded-2xl px-4 py-2 mb-4 flex items-center justify-between">
          <span className="text-orange-300 text-sm">⏱ Timer loopt nog</span>
          <span className="text-white font-bold tabular-nums text-sm">
            {String(Math.floor(secondsLeft / 60)).padStart(2,'0')}:{String(secondsLeft % 60).padStart(2,'0')}
          </span>
          <button onClick={stopTimer} className="text-orange-300 text-xs ml-2">Stop</button>
        </div>
      )}

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

        {step.timer_minutes && (
          <div className="mt-8">
            {secondsLeft !== null ? (
              <div className="space-y-4">
                {/* Circular progress */}
                <div className="flex justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" fill="none" stroke="#292524" strokeWidth="8" />
                      <circle
                        cx="50" cy="50" r="44" fill="none"
                        stroke={secondsLeft === 0 ? '#22c55e' : '#f97316'}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 44}`}
                        strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress)}`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {secondsLeft === 0 ? (
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
                <button onClick={stopTimer} className="w-full py-3 bg-stone-800 rounded-2xl text-sm">
                  Timer stoppen
                </button>
              </div>
            ) : (
              <button
                onClick={startTimer}
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
          onClick={() => isLast ? onExit() : setActiveStep(activeStep + 1)}
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
            className="bg-stone-800 w-full rounded-t-3xl p-6 max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Ingrediënten</h2>
              <div className="flex items-center gap-3">
                {/* Personen inline */}
                <div className="flex items-center gap-2 bg-stone-700 rounded-full px-3 py-1">
                  <button
                    onClick={() => onServingsChange(Math.max(1, servings - 1))}
                    className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white"
                  >−</button>
                  <span className="text-xs font-medium text-white tabular-nums">{servings} personen</span>
                  <button
                    onClick={() => onServingsChange(servings + 1)}
                    className="w-5 h-5 flex items-center justify-center text-stone-400 hover:text-white"
                  >+</button>
                </div>
                <button onClick={() => setShowIngredients(false)} className="text-stone-400">✕</button>
              </div>
            </div>
            <div className="overflow-y-auto space-y-2">
              {(recipe.ingredients as Ingredient[]).map((ing, i) => (
                <div key={i} className="flex justify-between text-sm border-b border-stone-700 pb-2">
                  <span className="text-stone-200">{ing.name}</span>
                  <span className="text-orange-300 font-medium tabular-nums">
                    {scaleAmount(ing.amount)} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
