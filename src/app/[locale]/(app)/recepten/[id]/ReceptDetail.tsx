'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  const [servings, setServings] = useState(recipe.servings)
  const [kookstand, setKookstand] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [imageUrl, setImageUrl] = useState(recipe.image_url ?? '')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

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
    const formData = new FormData()
    formData.append('file', file)
    formData.append('recipeId', recipe.id)
    const res = await fetch('/api/recepten/upload-image', { method: 'POST', body: formData })
    const { url } = await res.json()
    if (url) setImageUrl(url)
    setUploadingPhoto(false)
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
    return <KookstandView recipe={recipe} activeStep={activeStep} setActiveStep={setActiveStep} onExit={() => setKookstand(false)} />
  }

  return (
    <div className="pb-8">
      <label className="relative block cursor-pointer group">
        {imageUrl ? (
          <img src={imageUrl} alt={recipe.title} className="w-full h-56 object-cover" />
        ) : (
          <div className="w-full h-40 bg-stone-100 flex items-center justify-center text-5xl">🍽️</div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium bg-black/50 px-3 py-1.5 rounded-full transition-opacity">
            {uploadingPhoto ? 'Uploaden...' : '📷 Foto wijzigen'}
          </span>
        </div>
        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
      </label>

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
          <button onClick={() => router.back()} className="text-stone-400 flex-shrink-0">✕</button>
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
  recipe, activeStep, setActiveStep, onExit,
}: {
  recipe: Recipe
  activeStep: number
  setActiveStep: (n: number) => void
  onExit: () => void
}) {
  const steps = recipe.steps as { order: number; text: string; timer_minutes?: number }[]
  const step = steps[activeStep]
  const isLast = activeStep === steps.length - 1

  return (
    <div className="min-h-screen bg-stone-900 text-white flex flex-col px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <span className="text-stone-400 text-sm">{recipe.title}</span>
        <button onClick={onExit} className="text-stone-400 text-sm">Sluiten</button>
      </div>

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
    </div>
  )
}
