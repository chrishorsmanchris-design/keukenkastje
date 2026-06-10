'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Recipe } from '@/lib/types'

const CUISINES = ['Italiaans', 'Midden-Oosters', 'Aziatisch', 'Nederlands', 'Mexicaans', 'Frans', 'Amerikaans']
const TYPES = ['Vis', 'Vlees', 'Kip', 'Vegetarisch', 'Pasta', 'Rijst', 'Soep', 'Salade']

const CUISINE_FLAGS: Record<string, string> = {
  'Italiaans': '🇮🇹', 'Midden-Oosters': '🫙', 'Aziatisch': '🇯🇵',
  'Nederlands': '🇳🇱', 'Mexicaans': '🇲🇽', 'Frans': '🇫🇷', 'Amerikaans': '🇺🇸',
}

const TIME_FILTERS = [
  { label: '≤ 20 min', value: 20 },
  { label: '≤ 30 min', value: 30 },
  { label: '≤ 45 min', value: 45 },
]

type SortOption = 'az' | 'nieuwst' | 'snelst'

export default function ReceptenClient({ recipes }: { recipes: Recipe[] }) {
  const { locale } = useParams()
  const [search, setSearch] = useState('')
  const [filterCuisine, setFilterCuisine] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterTime, setFilterTime] = useState<number | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('az')

  // Local favorites state — optimistic updates
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(recipes.filter(r => r.is_favorite).map(r => r.id))
  )

  const [shareMode, setShareMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sharing, setSharing] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const lastId = localStorage.getItem('lastRecipeId')
    if (!lastId) return
    localStorage.removeItem('lastRecipeId')
    requestAnimationFrame(() => {
      const el = document.getElementById(`recipe-${lastId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  async function toggleFavorite(id: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const next = !favorites.has(id)
    setFavorites(prev => {
      const s = new Set(prev)
      next ? s.add(id) : s.delete(id)
      return s
    })
    const supabase = createClient()
    await supabase.from('recipes').update({ is_favorite: next }).eq('id', id)
  }

  const activeFilterCount = [filterCuisine, filterType, filterTime, onlyFavorites ? 'fav' : ''].filter(Boolean).length

  function clearAll() {
    setFilterCuisine('')
    setFilterType('')
    setFilterTime(null)
    setOnlyFavorites(false)
    setSearch('')
  }

  async function shareSelected() {
    if (!selected.size) return
    setSharing(true)
    const ids = [...selected].join(',')
    const url = `${window.location.origin}/${locale}/share?ids=${ids}`
    const count = selected.size
    try {
      if (navigator.share) {
        await navigator.share({
          title: count === 1 ? '1 recept gedeeld via Keukenkastje' : `${count} recepten gedeeld via Keukenkastje`,
          text: count === 1 ? 'Bekijk dit recept!' : `Bekijk deze ${count} recepten!`,
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
        alert('Link gekopieerd!')
      }
    } catch { /* gebruiker heeft geannuleerd */ }
    setSharing(false)
    setShareMode(false)
    setSelected(new Set())
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filtered = recipes
    .filter(r => {
      if (onlyFavorites && !favorites.has(r.id)) return false
      const matchSearch = r.title.toLowerCase().includes(search.toLowerCase())
      const matchCuisine = !filterCuisine || r.cuisine === filterCuisine
      const matchType = !filterType || r.ingredient_type === filterType
      const totalTime = (r.prep_time_minutes ?? 0) + (r.cook_time_minutes ?? 0)
      const matchTime = !filterTime || totalTime === 0 || totalTime <= filterTime
      return matchSearch && matchCuisine && matchType && matchTime
    })
    .sort((a, b) => {
      if (sortBy === 'az') return a.title.localeCompare(b.title, 'nl')
      if (sortBy === 'nieuwst') return b.created_at.localeCompare(a.created_at)
      if (sortBy === 'snelst') {
        const ta = (a.prep_time_minutes ?? 0) + (a.cook_time_minutes ?? 0)
        const tb = (b.prep_time_minutes ?? 0) + (b.cook_time_minutes ?? 0)
        return (ta || 9999) - (tb || 9999)
      }
      return 0
    })

  return (
    <div className="px-4 pt-10 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recepten</h1>
        <div className="flex items-center gap-2">
          {shareMode ? (
            <>
              <button
                onClick={() => { setShareMode(false); setSelected(new Set()) }}
                className="text-sm text-stone-400 px-3 py-2"
              >
                Annuleren
              </button>
              <button
                onClick={shareSelected}
                disabled={!selected.size || sharing}
                className="bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-orange-600 transition-colors disabled:opacity-40"
              >
                {sharing ? '…' : `Deel${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShareMode(true)}
                className="text-sm text-stone-500 px-3 py-2 rounded-full border border-stone-200 hover:bg-stone-50 transition-colors"
              >
                Selecteer
              </button>
              <Link
                href={`/${locale}/recepten/nieuw`}
                className="bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-orange-600 transition-colors"
              >
                + Nieuw
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Share mode banner */}
      {shareMode && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-2.5 text-sm text-orange-700 flex items-center justify-between">
          <span>{selected.size === 0 ? 'Tik op recepten om te selecteren' : `${selected.size} geselecteerd`}</span>
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="text-orange-400 text-xs">Wis selectie</button>
          )}
        </div>
      )}

      {/* Search */}
      <input
        type="search"
        placeholder="Zoek recepten..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-2xl border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
      />

      {/* Sort + Favorites row */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide flex-1">
          <span className="text-xs text-stone-400 self-center flex-shrink-0">Sorteer:</span>
          {([['az', 'A–Z'], ['nieuwst', 'Nieuwste'], ['snelst', 'Snelste']] as [SortOption, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSortBy(val)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                sortBy === val ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Favorites toggle */}
        <button
          onClick={() => setOnlyFavorites(v => !v)}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
            onlyFavorites ? 'bg-red-500 text-white border-red-500' : 'bg-white text-stone-600 border-stone-200'
          }`}
        >
          {onlyFavorites ? '❤️ Favorieten' : '🤍 Favorieten'}
        </button>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TYPES.map(t => (
          <button
            key={t}
            onClick={() => setFilterType(filterType === t.toLowerCase() ? '' : t.toLowerCase())}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filterType === t.toLowerCase() ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-stone-600 border-stone-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Cuisine filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CUISINES.map(c => (
          <button
            key={c}
            onClick={() => setFilterCuisine(filterCuisine === c ? '' : c)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filterCuisine === c ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-200'
            }`}
          >
            {CUISINE_FLAGS[c]} {c}
          </button>
        ))}
      </div>

      {/* Time filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-400 flex-shrink-0">Tijd:</span>
        <div className="flex gap-1.5">
          {TIME_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setFilterTime(filterTime === value ? null : value)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterTime === value ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-stone-600 border-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {activeFilterCount > 0 && (
          <button onClick={clearAll} className="ml-auto text-xs text-stone-400 hover:text-red-400 transition-colors flex-shrink-0">
            Wis ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">{onlyFavorites ? '🤍' : '📖'}</div>
          <p className="text-sm">
            {recipes.length === 0 ? 'Nog geen recepten' : onlyFavorites ? 'Geen favorieten' : 'Geen recepten gevonden'}
          </p>
          {recipes.length === 0 ? (
            <Link href={`/${locale}/recepten/nieuw`} className="text-orange-500 text-sm mt-2 inline-block">
              Voeg je eerste recept toe
            </Link>
          ) : (
            <button onClick={clearAll} className="text-orange-500 text-sm mt-2">Filters wissen</button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-stone-400">{filtered.length} recept{filtered.length !== 1 ? 'en' : ''}</p>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                locale={locale as string}
                isFavorite={favorites.has(recipe.id)}
                onToggleFavorite={toggleFavorite}
                shareMode={shareMode}
                selected={selected.has(recipe.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function RecipeCard({
  recipe, locale, isFavorite, onToggleFavorite, shareMode, selected, onToggleSelect,
}: {
  recipe: Recipe
  locale: string
  isFavorite: boolean
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
  shareMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const totalTime = (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0)
  const cardClass = `bg-white rounded-2xl overflow-hidden border transition-all relative ${
    shareMode
      ? selected ? 'border-orange-400 ring-2 ring-orange-400 shadow-md' : 'border-stone-200'
      : 'border-stone-100 hover:shadow-md'
  }`

  const inner = (
    <>
      {recipe.image_url ? (
        <div className="relative w-full h-28">
          <Image src={recipe.image_url} alt={recipe.title} fill className="object-cover" sizes="(max-width: 768px) 50vw, 200px" />
        </div>
      ) : (
        <div className="w-full h-28 bg-stone-100 flex items-center justify-center text-3xl">🍽️</div>
      )}
      {shareMode ? (
        <div className={`absolute top-2 right-2 w-7 h-7 rounded-full border-2 flex items-center justify-center ${
          selected ? 'bg-orange-500 border-orange-500' : 'bg-white/80 border-stone-300'
        }`}>
          {selected && <span className="text-white text-xs font-bold">✓</span>}
        </div>
      ) : (
        <button
          onClick={e => onToggleFavorite(recipe.id, e)}
          className="absolute top-2 right-2 w-7 h-7 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
        >
          <span className="text-base leading-none">{isFavorite ? '❤️' : '🤍'}</span>
        </button>
      )}
      <div className="p-3">
        <p className="font-medium text-sm leading-tight line-clamp-2 pr-1">{recipe.title}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {recipe.cuisine && <span className="text-sm">{CUISINE_FLAGS[recipe.cuisine]}</span>}
          {totalTime > 0 && <span className="text-xs text-stone-400">{totalTime} min</span>}
        </div>
      </div>
    </>
  )

  if (shareMode) {
    return <div id={`recipe-${recipe.id}`} className={cardClass} onClick={() => onToggleSelect?.(recipe.id)}>{inner}</div>
  }
  return <Link id={`recipe-${recipe.id}`} href={`/${locale}/recepten/${recipe.id}`} className={cardClass}>{inner}</Link>
}
