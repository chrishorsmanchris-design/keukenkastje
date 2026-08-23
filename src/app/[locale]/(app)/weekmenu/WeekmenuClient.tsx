'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { findInPantry } from '@/lib/pantry-match'
import { categorizeShopping } from '@/lib/categorize'

const CUISINE_FLAGS: Record<string, string> = {
  'Italiaans': '🇮🇹', 'Midden-Oosters': '🫙', 'Aziatisch': '🇯🇵',
  'Nederlands': '🇳🇱', 'Mexicaans': '🇲🇽', 'Frans': '🇫🇷', 'Amerikaans': '🇺🇸',
}

const DAY_NAMES = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']

function getDayLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Vandaag'
  const d = new Date(dateStr + 'T12:00:00')
  const tomorrow = new Date(todayStr + 'T12:00:00')
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return 'Morgen'
  return DAY_NAMES[d.getDay()]
}

function getShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

type Recipe = { id: string; title: string; image_url?: string; cuisine?: string; servings: number }
type MealType = 'dinner' | 'lunch'
type MenuItem = { id: string; date: string; meal_type?: MealType; servings: number; recipe?: Recipe; cook_name?: string; notes?: string }

type ShoppingDraft = { name: string; quantity: number; unit: string; recipe_id: string }
type PantryHit = { item: ShoppingDraft; pantryName: string; pantryQty?: number; pantryUnit?: string }
type ReviewState = { need: ShoppingDraft[]; have: PantryHit[]; householdId: string }

/** 1,5 in plaats van 1.5000000000000002 */
function prettyQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',')
}

export default function WeekmenuClient({
  menuItems, recipes, dates, householdId, role = 'member', members = [],
}: {
  menuItems: MenuItem[]
  recipes: Recipe[]
  dates: string[]
  householdId: string
  role?: string
  members?: { id: string; name: string }[]
}) {
  const canWrite = role !== 'viewer'
  const router = useRouter()
  const { locale } = useParams()
  const [menu, setMenu] = useState<MenuItem[]>(menuItems)
  const [mealType, setMealType] = useState<MealType>('dinner')
  const [picker, setPicker] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [review, setReview] = useState<ReviewState | null>(null)
  const [alsoBuy, setAlsoBuy] = useState<Set<string>>(new Set())
  const [copying, setCopying] = useState(false)
  /** id → tijdstip waarop een lokale wijziging niet meer beschermd hoeft te worden. */
  const localWrites = useRef<Map<string, number>>(new Map())
  const holdLocal = (id: string) => { localWrites.current.set(id, Date.now() + 4000) }
  const releaseLocal = (id: string) => { localWrites.current.delete(id) }
  const [, startTransition] = useTransition()
  const [selectedDates, setSelectedDates] = useState<Set<string>>(
    () => new Set(menuItems.filter(m => m.recipe && (m.meal_type ?? 'dinner') === 'dinner').map(m => m.date))
  )
  const [hid, setHid] = useState(householdId)

  const today = new Date().toISOString().split('T')[0]

  // Zorg altijd voor geldige hid — ook bij gecachede prop
  useEffect(() => {
    if (hid) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('household_id').eq('id', user.id).single()
        .then(({ data }) => { if (data?.household_id) setHid(data.household_id) })
    })
  }, [hid])

  // Realtime sync — reload alles bij elke wijziging
  useEffect(() => {
    if (!hid) return
    const supabase = createClient()
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]
    })

    async function reloadMenu() {
      const { data } = await supabase
        .from('week_menu').select('*, recipe:recipes(*)')
        .in('date', dates).in('meal_type', ['dinner', 'lunch']).eq('household_id', hid)
      if (!data) return
      // Wijzigingen die hier net zijn gedaan maar nog niet bevestigd zijn,
      // mogen niet overschreven worden door deze verse serverdata.
      setMenu(prev => (data as MenuItem[]).map(row => {
        const until = localWrites.current.get(row.id)
        if (!until) return row
        if (until < Date.now()) { localWrites.current.delete(row.id); return row }
        return prev.find(x => x.id === row.id) ?? row
      }))
    }

    const channel = supabase
      .channel(`weekmenu:${hid}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'week_menu',
        filter: `household_id=eq.${hid}`,
      }, async () => { await reloadMenu() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [hid])

  // Alleen de maaltijd die nu getoond wordt.
  const mealsShown = menu.filter(m => (m.meal_type ?? 'dinner') === mealType)
  const menuByDate = Object.fromEntries(mealsShown.map(m => [m.date, m]))

  /** Wisselt tussen avondeten en lunch; de selectie volgt die maaltijd. */
  function switchMealType(next: MealType) {
    setMealType(next)
    setMoving(null)
    setSelectedDates(
      new Set(menu.filter(m => m.recipe && (m.meal_type ?? 'dinner') === next).map(m => m.date))
    )
  }

  function toggleSelected(date: string) {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  async function assignRecipe(date: string, recipe: Recipe) {
    const supabase = createClient()
    const existing = menuByDate[date]

    if (existing) {
      await supabase.from('week_menu').update({ recipe_id: recipe.id, servings: recipe.servings }).eq('id', existing.id)
      setMenu(m => m.map(item => item.id === existing.id ? { ...item, recipe, servings: recipe.servings } : item))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user!.id).single()
      const { data } = await supabase.from('week_menu').insert({
        date, meal_type: mealType, recipe_id: recipe.id,
        servings: recipe.servings, household_id: profile?.household_id,
      }).select('*, recipe:recipes(*)').single()
      if (data) setMenu(m => [...m, data])
    }
    setSelectedDates(prev => new Set([...prev, date]))
    setPicker(null)
    setSearch('')
  }

  /**
   * Neemt het menu van 7 dagen geleden over. Vult alleen lege dagen, zodat je
   * nooit per ongeluk iets overschrijft wat je al gepland had.
   */
  async function copyPreviousWeek() {
    setCopying(true)
    setGenerateError('')
    try {
      const supabase = createClient()

      const sourceDates = dates.map(d => {
        const prev = new Date(d + 'T12:00:00')
        prev.setDate(prev.getDate() - 7)
        return prev.toISOString().split('T')[0]
      })

      const { data: previous, error } = await supabase
        .from('week_menu')
        .select('date, servings, recipe:recipes(*)')
        .in('date', sourceDates)
        .eq('meal_type', mealType)
        .not('recipe_id', 'is', null)
      if (error) throw error

      const byDate = Object.fromEntries((previous ?? []).map(p => [p.date, p]))
      const toInsert = dates
        .map((target, i) => ({ target, source: byDate[sourceDates[i]] }))
        .filter(({ target, source }) => source?.recipe && !menuByDate[target]?.recipe)

      if (!toInsert.length) {
        setGenerateError('Vorige week stond niets gepland dat hier nog past.')
        setCopying(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user!.id).single()

      const { data: inserted, error: insError } = await supabase
        .from('week_menu')
        .insert(toInsert.map(({ target, source }) => ({
          date: target,
          meal_type: mealType,
          recipe_id: (source!.recipe as unknown as Recipe).id,
          servings: source!.servings,
          household_id: profile?.household_id,
        })))
        .select('*, recipe:recipes(*)')
      if (insError) throw insError

      if (inserted?.length) {
        setMenu(m => [...m, ...inserted])
        setSelectedDates(prev => new Set([...prev, ...inserted.map((i: { date: string }) => i.date)]))
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : 'Vorige week overnemen lukte niet')
    }
    setCopying(false)
  }

  async function removeDay(date: string) {
    const supabase = createClient()
    const item = menuByDate[date]
    if (!item) return
    await supabase.from('week_menu').delete().eq('id', item.id)
    setMenu(m => m.filter(x => x.id !== item.id))
    setSelectedDates(prev => { const next = new Set(prev); next.delete(date); return next })
  }

  /**
   * Past één menu-item aan: eerst in beeld, dan in de database, en bij een
   * mislukking netjes terug.
   *
   * Deze schrijfacties gaven eerder geen enkel signaal als ze faalden. De
   * realtime-reload haalde daarna de oude waarde weer op, waardoor een keuze
   * als "wie kookt" zonder uitleg terugsprong naar de beginstand.
   */
  async function patchMenuItem(date: string, patch: Partial<MenuItem>) {
    const item = menuByDate[date]
    if (!item) return
    const previous = item
    setMenu(m => m.map(x => x.id === item.id ? { ...x, ...patch } : x))
    holdLocal(item.id)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('week_menu').update(patch).eq('id', item.id).select()
    releaseLocal(item.id)
    if (error || !data?.length) {
      setMenu(m => m.map(x => x.id === item.id ? previous : x))
      setGenerateError(
        error ? `Opslaan mislukt: ${error.message}` : 'Opslaan mislukt — je hebt hier misschien geen rechten voor.',
      )
    }
  }

  async function updateServings(date: string, servings: number) {
    await patchMenuItem(date, { servings })
  }

  async function updateCookName(date: string, cookName: string) {
    await patchMenuItem(date, { cook_name: cookName })
  }

  async function updateNotes(date: string, notes: string) {
    await patchMenuItem(date, { notes })
  }

  async function moveToDate(fromDate: string, toDate: string) {
    if (fromDate === toDate) { setMoving(null); return }
    const supabase = createClient()
    const fromItem = menuByDate[fromDate]
    const toItem = menuByDate[toDate]
    if (!fromItem) { setMoving(null); return }

    const fromSelected = selectedDates.has(fromDate)
    const toSelected = selectedDates.has(toDate)

    if (toItem) {
      // Swap the two recipes
      await Promise.all([
        supabase.from('week_menu').update({ recipe_id: toItem.recipe?.id ?? null }).eq('id', fromItem.id),
        supabase.from('week_menu').update({ recipe_id: fromItem.recipe?.id ?? null }).eq('id', toItem.id),
      ])
      setMenu(m => m.map(x => {
        if (x.id === fromItem.id) return { ...x, recipe: toItem.recipe }
        if (x.id === toItem.id) return { ...x, recipe: fromItem.recipe }
        return x
      }))
      // Mirror selection state in the swap
      setSelectedDates(prev => {
        const next = new Set(prev)
        if (toItem.recipe && fromSelected) next.add(toDate); else next.delete(toDate)
        if (fromItem.recipe && toSelected) next.add(fromDate); else next.delete(fromDate)
        return next
      })
    } else {
      // Move to empty day
      await supabase.from('week_menu').update({ date: toDate }).eq('id', fromItem.id)
        setMenu(m => m.map(x => x.id === fromItem.id ? { ...x, date: toDate } : x))
      setSelectedDates(prev => {
        const next = new Set(prev)
        if (next.has(fromDate)) { next.delete(fromDate); next.add(toDate) }
        return next
      })
    }
    setMoving(null)
  }

  /** Stelt de lijst samen en splitst af wat er al in de pantry ligt. */
  async function generateShoppingList() {
    setGenerating(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user!.id).single()
      const householdId = profile?.household_id
      if (!householdId) throw new Error('Geen huishouden gevonden')

      const planned = menu.filter(m => m.recipe && selectedDates.has(m.date))
      const recipeIds = planned.map(m => m.recipe!.id)
      const [{ data: fullRecipes, error: recipeError }, { data: pantry }] = await Promise.all([
        supabase.from('recipes').select('id, ingredients, servings').in('id', recipeIds),
        supabase.from('pantry_items').select('name, quantity, unit').eq('household_id', householdId),
      ])
      if (recipeError) throw recipeError

      const recipeMap = Object.fromEntries((fullRecipes ?? []).map(r => [r.id, r]))

      const items: ShoppingDraft[] = []
      for (const m of planned) {
        const full = recipeMap[m.recipe!.id]
        if (!full) continue
        const ratio = m.servings / full.servings
        for (const ing of full.ingredients as { name: string; amount: string; unit: string }[]) {
          const qty = parseFloat(ing.amount) * ratio
          items.push({ name: ing.name, quantity: isNaN(qty) ? 1 : qty, unit: ing.unit, recipe_id: m.recipe!.id })
        }
      }

      const merged: Record<string, ShoppingDraft> = {}
      for (const item of items) {
        const key = item.name.toLowerCase()
        if (merged[key]) merged[key].quantity += item.quantity
        else merged[key] = { ...item }
      }
      const allItems = Object.values(merged)

      // Wat ligt er al in huis? Niet stilzwijgend weglaten — de gebruiker
      // krijgt het te zien en kan het alsnog op de lijst zetten.
      const pantryItems = pantry ?? []
      const have: PantryHit[] = []
      const need: ShoppingDraft[] = []
      for (const item of allItems) {
        const hit = findInPantry(item.name, pantryItems)
        if (hit) have.push({ item, pantryName: hit.name, pantryQty: hit.quantity, pantryUnit: hit.unit })
        else need.push(item)
      }

      if (have.length > 0) {
        setReview({ need, have, householdId })
        setGenerating(false)
        return
      }

      await writeShoppingList(need, householdId)
    } catch (e) {
      setGenerating(false)
      setGenerateError(e instanceof Error ? e.message : 'Boodschappenlijst maken lukte niet')
    }
  }

  /** Schrijft de definitieve lijst weg en gaat door naar de boodschappenlijst. */
  async function writeShoppingList(itemsToAdd: ShoppingDraft[], householdId: string) {
    const supabase = createClient()
    const { error: delError } = await supabase
      .from('shopping_items').delete().eq('household_id', householdId).eq('is_manual', false)
    if (delError) throw delError

    if (itemsToAdd.length) {
      const { error: insError } = await supabase.from('shopping_items').insert(
        itemsToAdd.map(item => ({
          ...item,
          household_id: householdId,
          is_manual: false,
          checked: false,
          category: categorizeShopping(item.name),
        }))
      )
      if (insError) throw insError
    }
    setGenerating(false)
    setReview(null)
    startTransition(() => router.push(`/${locale}/boodschappenlijst`))
  }

  /** Bevestigt het overzicht: alles wat aangevinkt staat gaat alsnog mee. */
  async function confirmReview() {
    if (!review) return
    setGenerating(true)
    try {
      const extra = review.have.filter(h => alsoBuy.has(h.item.name)).map(h => h.item)
      await writeShoppingList([...review.need, ...extra], review.householdId)
    } catch (e) {
      setGenerating(false)
      setGenerateError(e instanceof Error ? e.message : 'Opslaan lukte niet')
    }
  }

  const filteredRecipes = recipes.filter(r => r.title.toLowerCase().includes(search.toLowerCase()))
  const selectedCount = [...selectedDates].filter(d => menuByDate[d]?.recipe).length

  return (
    <div className="px-4 pt-10 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Weekmenu</h1>
        <div className="flex items-center gap-2">
          <Link href={`/${locale}/geschiedenis`} className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1.5">Geschiedenis</Link>
          {canWrite && (
            <button
              onClick={generateShoppingList}
              disabled={generating || selectedCount === 0}
              className="bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-orange-600 transition-colors disabled:opacity-40"
            >
              {generating ? '...' : `🛒 ${selectedCount > 0 ? `${selectedCount}` : ''}`}
            </button>
          )}
        </div>
      </div>

      {moving && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-2.5 text-sm text-orange-700 flex items-center justify-between">
          <span>Tik op een dag om het recept daarheen te verplaatsen</span>
          <button onClick={() => setMoving(null)} className="text-orange-400 ml-2" aria-label="Verplaatsen annuleren">✕</button>
        </div>
      )}

      {/* Avondeten of lunch */}
      <div className="flex gap-1 bg-stone-100 rounded-full p-1">
        {([
          { value: 'dinner' as const, label: '🍽️ Avondeten' },
          { value: 'lunch' as const, label: '🥪 Lunch' },
        ]).map(opt => (
          <button
            key={opt.value}
            onClick={() => switchMealType(opt.value)}
            aria-pressed={mealType === opt.value}
            className={`flex-1 text-sm font-medium py-2 rounded-full transition-colors ${
              mealType === opt.value ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {canWrite && dates.some(d => !menuByDate[d]?.recipe) && (
        <button
          onClick={copyPreviousWeek}
          disabled={copying}
          className="w-full py-2.5 rounded-2xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-40"
        >
          {copying ? 'Bezig...' : '↻ Vorige week overnemen'}
        </button>
      )}

      {generateError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 text-sm text-red-700 flex items-center justify-between">
          <span>{generateError}</span>
          <button onClick={() => setGenerateError('')} className="text-red-400 ml-2" aria-label="Melding sluiten">✕</button>
        </div>
      )}

      <div className="space-y-2">
        {dates.map((date) => {
          const item = menuByDate[date]
          const isToday = date === today
          const isMoving = moving === date
          const isDropTarget = moving && moving !== date && dragOver === date
          const isSelected = selectedDates.has(date)
          const dayLabel = getDayLabel(date, today)
          const shortDate = getShortDate(date)

          return (
            <div
              key={date}
              draggable={!!item?.recipe}
              onDragStart={() => setMoving(date)}
              onDragEnd={() => { setMoving(null); setDragOver(null) }}
              onDragOver={e => { e.preventDefault(); setDragOver(date) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { e.preventDefault(); if (moving) moveToDate(moving, date); setDragOver(null) }}
              onClick={() => { if (moving && moving !== date) moveToDate(moving, date) }}
              className={`bg-white rounded-2xl border p-3 transition-all ${
                isMoving ? 'border-orange-400 opacity-60 scale-[0.98]' :
                isDropTarget ? 'border-orange-400 bg-orange-50' :
                isToday ? 'border-orange-300 bg-orange-50' :
                moving ? 'border-dashed border-orange-200 cursor-pointer' :
                'border-stone-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isToday ? 'text-orange-600' : 'text-stone-500'}`}>
                    {dayLabel}
                  </span>
                  {!isToday && <span className="text-xs text-stone-300">{shortDate}</span>}
                  {isToday && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">Vandaag</span>}
                </div>
                {item?.recipe && !moving && canWrite && (
                  <div className="flex items-center gap-2">
                    {/* Checkbox: include in shopping list */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleSelected(date) }}
                      title={isSelected ? 'Verwijder uit selectie' : 'Voeg toe aan selectie'}
                      className={`w-5 h-5 rounded flex items-center justify-center text-xs border-2 transition-colors flex-shrink-0 ${
                        isSelected
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-stone-300 text-transparent hover:border-orange-300'
                      }`}
                    >
                      ✓
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setMoving(date) }}
                      title="Verplaatsen"
                      aria-label="Maaltijd verplaatsen naar andere dag"
                      className="text-stone-300 hover:text-orange-400 text-base px-2 py-2 -my-2"
                    >
                      ⇄
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); removeDay(date) }}
                      aria-label="Maaltijd van deze dag verwijderen"
                      className="text-stone-300 hover:text-red-400 text-base px-2 py-2 -my-2"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {item?.recipe ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.recipe.image_url ? (
                      <Image src={item.recipe.image_url} alt="" width={40} height={40} className="rounded-xl object-cover flex-shrink-0" unoptimized />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">🍽️</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.recipe.title}</p>
                      {item.recipe.cuisine && (
                        <p className="text-xs text-stone-400">{CUISINE_FLAGS[item.recipe.cuisine] ?? ''} {item.recipe.cuisine}</p>
                      )}
                      {members.length > 1 && !moving && canWrite && (
                        <div className="flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                          <span className="text-xs text-stone-400" aria-hidden="true">👤</span>
                          <select
                            value={item.cook_name ?? ''}
                            aria-label="Wie kookt er deze dag"
                            onChange={e => updateCookName(date, e.target.value)}
                            className="text-xs text-stone-500 bg-transparent border-none outline-none cursor-pointer max-w-[90px] truncate"
                          >
                            <option value="">Wie kookt?</option>
                            {members.map(m => (
                              <option key={m.id} value={m.name}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                  {!moving && canWrite && (
                    <div
                      className="flex items-center gap-2 bg-stone-100 rounded-full px-2 py-1 flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <button onClick={() => updateServings(date, Math.max(1, item.servings - 1))} className="w-5 h-5 flex items-center justify-center text-sm">−</button>
                      <span className="text-xs font-medium w-3 text-center">{item.servings}</span>
                      <button onClick={() => updateServings(date, item.servings + 1)} className="w-5 h-5 flex items-center justify-center text-sm">+</button>
                    </div>
                  )}
                </div>
              ) : canWrite ? (
                <button
                  onClick={e => { e.stopPropagation(); if (!moving) setPicker(date) }}
                  className="mt-2 w-full text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl py-2.5 hover:border-orange-300 hover:text-orange-400 transition-colors"
                >
                  {moving ? '→ Hier neerzetten' : '+ Recept kiezen'}
                </button>
              ) : (
                <div className="mt-2 w-full text-sm text-stone-300 border border-dashed border-stone-100 rounded-xl py-2.5 text-center">
                  Vrij
                </div>
              )}
              {/* Notitie per dag */}
              {canWrite && !moving && (
                <div className="mt-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={item?.notes ?? ''}
                    onChange={e => updateNotes(date, e.target.value)}
                    placeholder="📝 Notitie toevoegen…"
                    className="w-full text-xs text-stone-500 placeholder-stone-300 bg-transparent outline-none border-none px-0 py-0.5"
                  />
                </div>
              )}
              {!canWrite && item?.notes && (
                <p className="mt-2 text-xs text-stone-400 px-0.5">📝 {item.notes}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Overzicht: dit heb je al in huis */}
      {review && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setReview(null)}>
          <div className="bg-white w-full rounded-t-3xl p-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold">Dit heb je al in huis</h2>
              <button onClick={() => setReview(null)} className="text-stone-400 p-2 -m-2" aria-label="Sluiten">✕</button>
            </div>
            <p className="text-stone-500 text-sm mb-3">
              {review.have.length} van {review.have.length + review.need.length} ingrediënten liggen al in je
              pantry. Die slaan we over — vink aan wat je tóch wilt kopen.
            </p>

            <div className="overflow-y-auto -mx-1 px-1 space-y-1.5">
              {review.have.map(hit => {
                const checked = alsoBuy.has(hit.item.name)
                return (
                  <label
                    key={hit.item.name}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-stone-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setAlsoBuy(prev => {
                        const next = new Set(prev)
                        if (next.has(hit.item.name)) next.delete(hit.item.name)
                        else next.add(hit.item.name)
                        return next
                      })}
                      className="w-5 h-5 accent-orange-500 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${checked ? '' : 'text-stone-500'}`}>
                        {hit.item.name}
                        <span className="text-stone-400 font-normal">
                          {' '}· {prettyQty(hit.item.quantity)} {hit.item.unit}
                        </span>
                      </p>
                      <p className="text-xs text-stone-400 truncate">
                        🧺 in huis: {hit.pantryName}
                        {hit.pantryQty ? ` (${prettyQty(hit.pantryQty)} ${hit.pantryUnit ?? ''})` : ''}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="pt-3 mt-1 border-t border-stone-100 flex gap-2">
              <button
                onClick={() => setAlsoBuy(new Set(review.have.map(h => h.item.name)))}
                className="px-4 py-3 rounded-2xl border border-stone-200 text-sm font-medium hover:bg-stone-50 transition-colors"
              >
                Alles tóch kopen
              </button>
              <button
                onClick={confirmReview}
                disabled={generating}
                className="flex-1 py-3 rounded-2xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-40"
              >
                {generating
                  ? 'Bezig...'
                  : `${review.need.length + alsoBuy.size} op de lijst zetten`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe picker modal */}
      {picker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setPicker(null)}>
          <div className="bg-white w-full rounded-t-3xl p-4 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Kies een recept</h2>
              <button onClick={() => setPicker(null)} className="text-stone-400 p-2 -m-2" aria-label="Receptkiezer sluiten">✕</button>
            </div>
            <input
              type="search"
              placeholder="Zoeken..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full px-4 py-2.5 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400 mb-3"
            />
            <div className="overflow-y-auto space-y-2">
              {filteredRecipes.length === 0 ? (
                <p className="text-center text-stone-400 text-sm py-8">Geen recepten gevonden</p>
              ) : filteredRecipes.map(recipe => (
                <button
                  key={recipe.id}
                  onClick={() => assignRecipe(picker, recipe)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors text-left"
                >
                  {recipe.image_url ? (
                    <Image src={recipe.image_url} alt="" width={40} height={40} className="rounded-xl object-cover flex-shrink-0" unoptimized />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">🍽️</div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{recipe.title}</p>
                    {recipe.cuisine && <p className="text-xs text-stone-400">{CUISINE_FLAGS[recipe.cuisine] ?? ''} {recipe.cuisine}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
