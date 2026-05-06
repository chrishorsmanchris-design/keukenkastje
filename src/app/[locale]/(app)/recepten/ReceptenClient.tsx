'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { Recipe } from '@/lib/types'

const CUISINES = ['Italiaans', 'Midden-Oosters', 'Aziatisch', 'Nederlands', 'Mexicaans', 'Frans', 'Amerikaans']
const TYPES = ['Vis', 'Vlees', 'Kip', 'Vegetarisch', 'Pasta', 'Rijst', 'Soep', 'Salade']

const CUISINE_FLAGS: Record<string, string> = {
  'Italiaans': '🇮🇹', 'Midden-Oosters': '🫙', 'Aziatisch': '🇯🇵',
  'Nederlands': '🇳🇱', 'Mexicaans': '🇲🇽', 'Frans': '🇫🇷', 'Amerikaans': '🇺🇸',
}

export default function ReceptenClient({ recipes }: { recipes: Recipe[] }) {
  const { locale } = useParams()
  const [search, setSearch] = useState('')
  const [filterCuisine, setFilterCuisine] = useState('')
  const [filterType, setFilterType] = useState('')

  const filtered = recipes.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase())
    const matchCuisine = !filterCuisine || r.cuisine === filterCuisine
    const matchType = !filterType || r.ingredient_type === filterType
    return matchSearch && matchCuisine && matchType
  })

  return (
    <div className="px-4 pt-10 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recepten</h1>
        <Link
          href={`/${locale}/recepten/nieuw`}
          className="bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-orange-600 transition-colors"
        >
          + Nieuw
        </Link>
      </div>

      <input
        type="search"
        placeholder="Zoek recepten..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-2xl border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TYPES.map(t => (
          <button
            key={t}
            onClick={() => setFilterType(filterType === t.toLowerCase() ? '' : t.toLowerCase())}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filterType === t.toLowerCase()
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-stone-600 border-stone-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CUISINES.map(c => (
          <button
            key={c}
            onClick={() => setFilterCuisine(filterCuisine === c ? '' : c)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filterCuisine === c
                ? 'bg-stone-800 text-white border-stone-800'
                : 'bg-white text-stone-600 border-stone-200'
            }`}
          >
            {CUISINE_FLAGS[c]} {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">📖</div>
          <p className="text-sm">Nog geen recepten</p>
          <Link href={`/${locale}/recepten/nieuw`} className="text-orange-500 text-sm mt-2 inline-block">
            Voeg je eerste recept toe
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} locale={locale as string} />
          ))}
        </div>
      )}
    </div>
  )
}

function RecipeCard({ recipe, locale }: { recipe: Recipe; locale: string }) {
  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0)
  return (
    <Link href={`/${locale}/recepten/${recipe.id}`} className="bg-white rounded-2xl overflow-hidden border border-stone-100 hover:shadow-md transition-shadow">
      {recipe.image_url ? (
        <img src={recipe.image_url} alt={recipe.title} className="w-full h-28 object-cover" />
      ) : (
        <div className="w-full h-28 bg-stone-100 flex items-center justify-center text-3xl">🍽️</div>
      )}
      <div className="p-3">
        <p className="font-medium text-sm leading-tight line-clamp-2">{recipe.title}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {recipe.cuisine && <span className="text-sm">{CUISINE_FLAGS[recipe.cuisine]}</span>}
          {totalTime > 0 && <span className="text-xs text-stone-400">{totalTime} min</span>}
        </div>
      </div>
    </Link>
  )
}
