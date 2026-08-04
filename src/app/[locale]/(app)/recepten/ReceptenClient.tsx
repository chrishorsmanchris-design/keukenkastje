'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Recipe } from '@/lib/types'
import { isInPantry } from '@/lib/pantry-match'

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

export default function ReceptenClient({
  recipes,
  pantry = [],
}: {
  recipes: Recipe[]
  pantry?: { name: string; quantity: number }[]
}) {
  const { locale } = useParams()
  const [search, setSearch] = useState('')
  const [filterCuisine, setFilterCuisine] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterTime, setFilterTime] = useState<number | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [canCookOnly, setCanCookOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('az')

  /**
   * Hoeveel ingrediënten mist dit recept? Berekend uit de pantry, zodat
   * "wat kan ik nú koken?" beantwoord kan worden.
   */
  const missingByRecipe = useMemo(() => {
    const map = new Map<string, number>()
    if (!pantry.length) return map
    for (const r of recipes) {
      const ingredients = Array.isArray(r.ingredients) ? r.ingredients : []
      if (!ingredients.length) continue
      const missing = ingredients.filter(ing => !isInPantry(ing.name, pantry)).length
      map.set(r.id, missing)
    }
    return map
  }, [recipes, pantry])

  // Local favorites state — optimistic updates
  const [favorites, setFavorites] = useState<Set<string>>(
    () => new Set(recipes.filter(r => r.is_favorite).map(r => r.id))
  )

  const [shareMode, setShareMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sharing, setSharing] = useState(false)

  // Inplannen vanaf de receptkaart
  const [planFor, setPlanFor] = useState<Recipe | null>(null)
  const [planning, setPlanning] = useState<string | null>(null)
  const [planned, setPlanned] = useState<string | null>(null)
  const [planError, setPlanError] = useState('')

  const nextDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      return d
    }),
    []
  )

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

  const activeFilterCount = [filterCuisine, filterType, filterTime, onlyFavorites ? 'fav' : '', canCookOnly ? 'pantry' : ''].filter(Boolean).length

  function clearAll() {
    setFilterCuisine('')
    setFilterType('')
    setFilterTime(null)
    setOnlyFavorites(false)
    setCanCookOnly(false)
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

  /** Plant een recept in op een dag, zonder de receptpagina te openen. */
  async function planOnDay(date: string) {
    if (!planFor) return
    setPlanning(date)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles').select('household_id').eq('id', user!.id).single()

      const { data: existing } = await supabase
        .from('week_menu').select('id')
        .eq('date', date).eq('meal_type', 'dinner')
        .eq('household_id', profile!.household_id)
        .maybeSingle()

      const { error } = existing
        ? await supabase.from('week_menu')
            .update({ recipe_id: planFor.id, servings: planFor.servings })
            .eq('id', existing.id)
        : await supabase.from('week_menu').insert({
            date, meal_type: 'dinner', recipe_id: planFor.id,
            servings: planFor.servings, household_id: profile!.household_id,
          })
      if (error) throw error

      setPlanned(date)
      setTimeout(() => { setPlanFor(null); setPlanned(null) }, 900)
    } catch {
      setPlanError('Inplannen lukte niet — probeer het opnieuw')
    }
    setPlanning(null)
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
      // "Kan ik koken": hooguit 2 ingrediënten missen, anders is het geen
      // realistisch voorstel voor vanavond.
      if (canCookOnly) {
        const missing = missingByRecipe.get(r.id)
        if (missing === undefined || missing > 2) return false
      }
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
      if (canCookOnly) {
        const diff = (missingByRecipe.get(a.id) ?? 99) - (missingByRecipe.get(b.id) ?? 99)
        if (diff !== 0) return diff
      }
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
          aria-pressed={onlyFavorites}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
            onlyFavorites ? 'bg-red-500 text-white border-red-500' : 'bg-white text-stone-600 border-stone-200'
          }`}
        >
          {onlyFavorites ? '❤️ Favorieten' : '🤍 Favorieten'}
        </button>
        {/* Wat kan ik nu koken? */}
        {pantry.length > 0 && (
          <button
            onClick={() => setCanCookOnly(v => !v)}
            aria-pressed={canCookOnly}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              canCookOnly ? 'bg-green-600 text-white border-green-600' : 'bg-white text-stone-600 border-stone-200'
            }`}
          >
            🧺 Kan ik koken
          </button>
        )}
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
                missing={canCookOnly ? missingByRecipe.get(recipe.id) : undefined}
                onPlan={(r, e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPlanError('')
                  setPlanFor(r)
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Inplannen: kies een dag */}
      {planFor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setPlanFor(null)}>
          <div className="bg-white w-full rounded-t-3xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold">Wanneer eten we dit?</h2>
              <button onClick={() => setPlanFor(null)} className="text-stone-400 p-2 -m-2" aria-label="Sluiten">✕</button>
            </div>
            <p className="text-stone-500 text-sm mb-3 truncate">{planFor.title}</p>

            {planError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{planError}</p>
            )}

            <div className="space-y-1.5 pb-2">
              {nextDays.map((d, i) => {
                const iso = d.toISOString().split('T')[0]
                const label = i === 0 ? 'Vandaag' : i === 1 ? 'Morgen'
                  : d.toLocaleDateString('nl-NL', { weekday: 'long' })
                return (
                  <button
                    key={iso}
                    onClick={() => planOnDay(iso)}
                    disabled={planning !== null}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-stone-50 hover:bg-stone-100 transition-colors text-left disabled:opacity-50"
                  >
                    <span className="text-sm font-medium capitalize">{label}</span>
                    <span className="text-xs text-stone-400">
                      {planned === iso ? '✓ gepland'
                        : planning === iso ? 'Bezig...'
                        : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RecipeCard({
  recipe, locale, isFavorite, onToggleFavorite, shareMode, selected, onToggleSelect,
  missing, onPlan,
}: {
  recipe: Recipe
  locale: string
  isFavorite: boolean
  onToggleFavorite: (id: string, e: React.MouseEvent) => void
  shareMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  /** Aantal ontbrekende ingrediënten, of undefined als dat niet bekend is. */
  missing?: number
  onPlan?: (recipe: Recipe, e: React.MouseEvent) => void
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
        <div className="absolute top-2 right-2 flex flex-col gap-1.5">
          <button
            onClick={e => onToggleFavorite(recipe.id, e)}
            aria-label={isFavorite ? `${recipe.title} uit favorieten` : `${recipe.title} als favoriet`}
            className="w-9 h-9 bg-white/85 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
          >
            <span className="text-base leading-none">{isFavorite ? '❤️' : '🤍'}</span>
          </button>
          {onPlan && (
            <button
              onClick={e => onPlan(recipe, e)}
              aria-label={`${recipe.title} inplannen`}
              title="Inplannen"
              className="w-9 h-9 bg-white/85 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
            >
              <span className="text-base leading-none">📅</span>
            </button>
          )}
        </div>
      )}
      {/* Hoeveel ingrediënten mis je nog? */}
      {missing !== undefined && (
        <span
          className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-1 rounded-full ${
            missing === 0 ? 'bg-green-600 text-white' : 'bg-white/90 text-stone-600 backdrop-blur-sm'
          }`}
        >
          {missing === 0 ? '✓ compleet' : `mist ${missing}`}
        </span>
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
