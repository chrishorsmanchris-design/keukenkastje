'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Recipe, Ingredient } from '@/lib/types'

const CUISINE_FLAGS: Record<string, string> = {
  'Italiaans': '🇮🇹', 'Midden-Oosters': '🫙', 'Aziatisch': '🇯🇵',
  'Nederlands': '🇳🇱', 'Mexicaans': '🇲🇽', 'Frans': '🇫🇷', 'Amerikaans': '🇺🇸',
}

export default function ReceptDetail({ recipe }: { recipe: Recipe }) {
  const router = useRouter()
  const [servings, setServings] = useState(recipe.servings)
  const [kookstand, setKookstand] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  const ratio = servings / recipe.servings

  function scaleAmount(amount: string): string {
    const num = parseFloat(amount)
    if (isNaN(num)) return amount
    const scaled = num * ratio
    return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1)
  }

  if (kookstand) {
    return <KookstandView recipe={recipe} activeStep={activeStep} setActiveStep={setActiveStep} onExit={() => setKookstand(false)} />
  }

  return (
    <div className="pb-8">
      {recipe.image_url ? (
        <img src={recipe.image_url} alt={recipe.title} className="w-full h-56 object-cover" />
      ) : (
        <div className="w-full h-40 bg-stone-100 flex items-center justify-center text-5xl">🍽️</div>
      )}

      <div className="px-4 pt-4 space-y-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold leading-tight">{recipe.title}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {recipe.cuisine && <span className="text-sm">{CUISINE_FLAGS[recipe.cuisine]} {recipe.cuisine}</span>}
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
