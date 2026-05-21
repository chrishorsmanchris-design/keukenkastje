'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'

const CUISINE_FLAGS: Record<string, string> = {
  'Italiaans': '🇮🇹', 'Midden-Oosters': '🫙', 'Aziatisch': '🇯🇵',
  'Nederlands': '🇳🇱', 'Mexicaans': '🇲🇽', 'Frans': '🇫🇷', 'Amerikaans': '🇺🇸',
}

type Recipe = {
  id: string; title: string; description?: string; image_url?: string
  servings: number; prep_time_minutes?: number; cook_time_minutes?: number
  cuisine?: string; ingredient_type?: string; diet_labels?: string[]
  ingredients: { name: string; amount: string; unit: string }[]
}

export default function ShareClient({ recipes, ids }: { recipes: Recipe[]; ids: string[] }) {
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { locale } = useParams()

  async function handleImport() {
    setImporting(true)
    setError('')
    const res = await fetch('/api/recepten/share/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })

    if (res.status === 401) {
      // Niet ingelogd — stuur naar login met return URL
      router.push(`/${locale}/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Import mislukt')
      setImporting(false)
      return
    }

    setImported(true)
    setImporting(false)
    setTimeout(() => router.push(`/${locale}/recepten`), 1500)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="text-4xl">📖</div>
        <h1 className="text-2xl font-semibold">
          {recipes.length === 1 ? '1 recept gedeeld' : `${recipes.length} recepten gedeeld`}
        </h1>
        <p className="text-stone-500 text-sm">Voeg ze toe aan jouw account om ze te bewaren</p>
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={importing || imported}
        className={`w-full py-4 rounded-2xl font-semibold text-base transition-colors ${
          imported
            ? 'bg-green-500 text-white'
            : 'bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60'
        }`}
      >
        {imported
          ? `✓ ${recipes.length} recept${recipes.length !== 1 ? 'en' : ''} toegevoegd!`
          : importing
          ? 'Bezig met importeren…'
          : `🍳 Importeer ${recipes.length === 1 ? 'dit recept' : `alle ${recipes.length} recepten`}`}
      </button>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      {/* Recipe cards */}
      <div className="space-y-4">
        {recipes.map(recipe => {
          const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0)
          return (
            <div key={recipe.id} className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
              {recipe.image_url && (
                <img src={recipe.image_url} alt={recipe.title} className="w-full h-44 object-cover" />
              )}
              <div className="p-4 space-y-2">
                <h2 className="font-semibold text-lg leading-tight">{recipe.title}</h2>
                <div className="flex flex-wrap gap-2">
                  {recipe.cuisine && (
                    <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                      {CUISINE_FLAGS[recipe.cuisine] ?? ''} {recipe.cuisine}
                    </span>
                  )}
                  {recipe.ingredient_type && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full capitalize">
                      {recipe.ingredient_type}
                    </span>
                  )}
                  {totalTime > 0 && (
                    <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                      ⏱ {totalTime} min
                    </span>
                  )}
                  <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                    👤 {recipe.servings} pers.
                  </span>
                </div>
                {recipe.description && (
                  <p className="text-sm text-stone-500 leading-relaxed">{recipe.description}</p>
                )}
                <details className="text-sm">
                  <summary className="text-stone-400 cursor-pointer text-xs py-1 hover:text-stone-600">
                    {recipe.ingredients.length} ingrediënten bekijken
                  </summary>
                  <ul className="mt-2 space-y-1 text-stone-600">
                    {recipe.ingredients.map((ing, i) => (
                      <li key={i} className="flex justify-between border-b border-stone-50 pb-1 text-xs">
                        <span>{ing.name}</span>
                        <span className="text-stone-400">{ing.amount} {ing.unit}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-stone-300 pb-4">
        Keukenkastje — Slimme kookapp voor jouw huishouden
      </p>
    </div>
  )
}
