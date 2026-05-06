'use client'

import { useState, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const DAYS_NL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
const CUISINE_FLAGS: Record<string, string> = {
  'Italiaans': '🇮🇹', 'Midden-Oosters': '🫙', 'Aziatisch': '🇯🇵',
  'Nederlands': '🇳🇱', 'Mexicaans': '🇲🇽', 'Frans': '🇫🇷', 'Amerikaans': '🇺🇸',
}

type Recipe = { id: string; title: string; image_url?: string; cuisine?: string; servings: number }
type MenuItem = { id: string; date: string; servings: number; recipe?: Recipe }

export default function WeekmenuClient({
  menuItems, recipes, dates,
}: {
  menuItems: MenuItem[]
  recipes: Recipe[]
  dates: string[]
}) {
  const router = useRouter()
  const { locale } = useParams()
  const [menu, setMenu] = useState<MenuItem[]>(menuItems)
  const [picker, setPicker] = useState<string | null>(null)
  const [moving, setMoving] = useState<string | null>(null) // date being moved
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState(false)
  const [isPending, startTransition] = useTransition()

  const menuByDate = Object.fromEntries(menu.map(m => [m.date, m]))

  async function assignRecipe(date: string, recipe: Recipe) {
    const supabase = createClient()
    const existing = menuByDate[date]

    if (existing) {
      await supabase.from('week_menu').update({ recipe_id: recipe.id, servings: recipe.servings }).eq('id', existing.id)
      setMenu(m => m.map(item => item.date === date ? { ...item, recipe, servings: recipe.servings } : item))
    } else {
      const { data: profile } = await supabase.from('profiles').select('household_id').single()
      const { data } = await supabase.from('week_menu').insert({
        date, meal_type: 'dinner', recipe_id: recipe.id,
        servings: recipe.servings, household_id: profile?.household_id,
      }).select('*, recipe:recipes(*)').single()
      if (data) setMenu(m => [...m, data])
    }
    setPicker(null)
    setSearch('')
  }

  async function removeDay(date: string) {
    const supabase = createClient()
    const item = menuByDate[date]
    if (!item) return
    await supabase.from('week_menu').delete().eq('id', item.id)
    setMenu(m => m.filter(x => x.date !== date))
  }

  async function updateServings(date: string, servings: number) {
    const supabase = createClient()
    const item = menuByDate[date]
    if (!item) return
    await supabase.from('week_menu').update({ servings }).eq('id', item.id)
    setMenu(m => m.map(x => x.date === date ? { ...x, servings } : x))
  }

  async function moveToDate(fromDate: string, toDate: string) {
    if (fromDate === toDate) { setMoving(null); return }
    const supabase = createClient()
    const fromItem = menuByDate[fromDate]
    const toItem = menuByDate[toDate]
    if (!fromItem) { setMoving(null); return }

    if (toItem) {
      // Swap the two recipes
      await Promise.all([
        supabase.from('week_menu').update({ recipe_id: toItem.recipe?.id ?? null }).eq('id', fromItem.id),
        supabase.from('week_menu').update({ recipe_id: fromItem.recipe?.id ?? null }).eq('id', toItem.id),
      ])
      setMenu(m => m.map(x => {
        if (x.date === fromDate) return { ...x, recipe: toItem.recipe }
        if (x.date === toDate) return { ...x, recipe: fromItem.recipe }
        return x
      }))
    } else {
      // Move to empty day
      await supabase.from('week_menu').update({ date: toDate }).eq('id', fromItem.id)
      setMenu(m => m.map(x => x.date === fromDate ? { ...x, date: toDate } : x))
    }
    setMoving(null)
  }

  async function generateShoppingList() {
    setGenerating(true)
    const supabase = createClient()
    const { data: profile } = await supabase.from('profiles').select('household_id').single()
    const householdId = profile?.household_id

    // Get full recipe data for planned items
    const planned = menu.filter(m => m.recipe)
    const recipeIds = planned.map(m => m.recipe!.id)
    const { data: fullRecipes } = await supabase.from('recipes').select('id, ingredients, servings').in('id', recipeIds)

    const recipeMap = Object.fromEntries((fullRecipes ?? []).map(r => [r.id, r]))

    // Build shopping items
    const items: { name: string; quantity: number; unit: string; recipe_id: string }[] = []
    for (const m of planned) {
      const full = recipeMap[m.recipe!.id]
      if (!full) continue
      const ratio = m.servings / full.servings
      for (const ing of full.ingredients as { name: string; amount: string; unit: string }[]) {
        const qty = parseFloat(ing.amount) * ratio
        items.push({ name: ing.name, quantity: isNaN(qty) ? 1 : qty, unit: ing.unit, recipe_id: m.recipe!.id })
      }
    }

    // Merge duplicates by name
    const merged: Record<string, typeof items[0]> = {}
    for (const item of items) {
      const key = item.name.toLowerCase()
      if (merged[key]) merged[key].quantity += item.quantity
      else merged[key] = { ...item }
    }

    // Clear existing non-manual items and insert new ones
    await supabase.from('shopping_items').delete().eq('household_id', householdId).eq('is_manual', false)
    await supabase.from('shopping_items').insert(
      Object.values(merged).map(item => ({ ...item, household_id: householdId, is_manual: false, checked: false }))
    )

    setGenerating(false)
    startTransition(() => router.push(`/${locale}/boodschappenlijst`))
  }

  const filteredRecipes = recipes.filter(r => r.title.toLowerCase().includes(search.toLowerCase()))
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="px-4 pt-10 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Weekmenu</h1>
          <Link href={`/${locale}/geschiedenis`} className="text-xs text-stone-400 hover:text-stone-600">Geschiedenis</Link>
        </div>
        <button
          onClick={generateShoppingList}
          disabled={generating || menu.filter(m => m.recipe).length === 0}
          className="bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-orange-600 transition-colors disabled:opacity-40"
        >
          {generating ? '...' : '🛒 Boodschappen'}
        </button>
      </div>

      {moving && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-2.5 text-sm text-orange-700 flex items-center justify-between">
          <span>Tik op een dag om het recept daarheen te verplaatsen</span>
          <button onClick={() => setMoving(null)} className="text-orange-400 ml-2">✕</button>
        </div>
      )}

      <div className="space-y-2">
        {dates.map((date, i) => {
          const item = menuByDate[date]
          const isToday = date === today
          const isMoving = moving === date
          const isDropTarget = moving && moving !== date && dragOver === date
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
                    {DAYS_NL[i]}
                  </span>
                  {isToday && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">Vandaag</span>}
                </div>
                {item?.recipe && !moving && (
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); setMoving(date) }} className="text-stone-300 hover:text-orange-400 text-sm px-1">⇄</button>
                    <button onClick={e => { e.stopPropagation(); removeDay(date) }} className="text-stone-300 hover:text-red-400 text-sm">✕</button>
                  </div>
                )}
              </div>

              {item?.recipe ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.recipe.image_url ? (
                      <img src={item.recipe.image_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">🍽️</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.recipe.title}</p>
                      {item.recipe.cuisine && (
                        <p className="text-xs text-stone-400">{CUISINE_FLAGS[item.recipe.cuisine]} {item.recipe.cuisine}</p>
                      )}
                    </div>
                  </div>
                  {!moving && (
                    <div className="flex items-center gap-2 bg-stone-100 rounded-full px-2 py-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => updateServings(date, Math.max(1, item.servings - 1))} className="w-5 h-5 flex items-center justify-center text-sm">−</button>
                      <span className="text-xs font-medium w-3 text-center">{item.servings}</span>
                      <button onClick={() => updateServings(date, item.servings + 1)} className="w-5 h-5 flex items-center justify-center text-sm">+</button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={e => { e.stopPropagation(); if (!moving) setPicker(date) }}
                  className="mt-2 w-full text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl py-2.5 hover:border-orange-300 hover:text-orange-400 transition-colors"
                >
                  {moving ? '→ Hier neerzetten' : '+ Recept kiezen'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Recipe picker modal */}
      {picker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setPicker(null)}>
          <div className="bg-white w-full rounded-t-3xl p-4 max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Kies een recept</h2>
              <button onClick={() => setPicker(null)} className="text-stone-400">✕</button>
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
                    <img src={recipe.image_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">🍽️</div>
                  )}
                  <div>
                    <p className="text-sm font-medium">{recipe.title}</p>
                    {recipe.cuisine && <p className="text-xs text-stone-400">{CUISINE_FLAGS[recipe.cuisine]} {recipe.cuisine}</p>}
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
