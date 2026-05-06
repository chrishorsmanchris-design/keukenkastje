'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Recipe, Ingredient, Step } from '@/lib/types'

const CUISINES = ['Italiaans', 'Midden-Oosters', 'Aziatisch', 'Nederlands', 'Mexicaans', 'Frans', 'Amerikaans']
const TYPES = ['vis', 'vlees', 'kip', 'vegetarisch', 'pasta', 'rijst', 'soep', 'salade']
const DIETS = ['vegetarisch', 'vegan', 'glutenvrij']

export default function BewerkenClient({ recipe, locale }: { recipe: Recipe; locale: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: recipe.title,
    description: recipe.description ?? '',
    source_url: recipe.source_url ?? '',
    source_name: recipe.source_name ?? '',
    servings: recipe.servings,
    prep_time_minutes: recipe.prep_time_minutes ?? 0,
    cook_time_minutes: recipe.cook_time_minutes ?? 0,
    cuisine: recipe.cuisine ?? '',
    ingredient_type: recipe.ingredient_type ?? '',
    diet_labels: recipe.diet_labels ?? [],
    ingredients: recipe.ingredients as Ingredient[],
    steps: recipe.steps as Step[],
    notes: recipe.notes ?? '',
  })

  function updateIngredient(i: number, field: keyof Ingredient, value: string) {
    setForm(f => {
      const ingredients = [...f.ingredients]
      ingredients[i] = { ...ingredients[i], [field]: value }
      return { ...f, ingredients }
    })
  }

  function removeIngredient(i: number) {
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }))
  }

  function updateStep(i: number, value: string) {
    setForm(f => {
      const steps = [...f.steps]
      steps[i] = { ...steps[i], text: value }
      return { ...f, steps }
    })
  }

  function removeStep(i: number) {
    setForm(f => ({
      ...f,
      steps: f.steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, order: idx + 1 })),
    }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('recipes').update(form).eq('id', recipe.id)
    setSaving(false)
    router.push(`/${locale}/recepten/${recipe.id}`)
  }

  return (
    <div className="px-4 pt-10 pb-8 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-stone-400 hover:text-stone-700">←</button>
        <h1 className="text-xl font-semibold">Recept bewerken</h1>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Naam</label>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Personen', key: 'servings' },
          { label: 'Prep (min)', key: 'prep_time_minutes' },
          { label: 'Koken (min)', key: 'cook_time_minutes' },
        ].map(({ label, key }) => (
          <div key={key} className="space-y-1">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</label>
            <input
              type="number"
              value={(form as Record<string, unknown>)[key] as number}
              onChange={e => setForm(f => ({ ...f, [key]: +e.target.value }))}
              className="w-full px-3 py-2.5 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Keukenstijl</label>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map(c => (
            <button key={c} type="button"
              onClick={() => setForm(f => ({ ...f, cuisine: f.cuisine === c ? '' : c }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.cuisine === c ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-200'}`}
            >{c}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Type</label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(t => (
            <button key={t} type="button"
              onClick={() => setForm(f => ({ ...f, ingredient_type: f.ingredient_type === t ? '' : t }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${form.ingredient_type === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-stone-600 border-stone-200'}`}
            >{t}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Dieet</label>
        <div className="flex gap-2">
          {DIETS.map(d => (
            <button key={d} type="button"
              onClick={() => setForm(f => ({
                ...f,
                diet_labels: f.diet_labels.includes(d) ? f.diet_labels.filter(x => x !== d) : [...f.diet_labels, d],
              }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.diet_labels.includes(d) ? 'bg-green-500 text-white border-green-500' : 'bg-white text-stone-600 border-stone-200'}`}
            >{d}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Ingrediënten</label>
        {form.ingredients.map((ing, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input placeholder="Hoeveelheid" value={ing.amount} onChange={e => updateIngredient(i, 'amount', e.target.value)}
              className="w-20 px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400" />
            <input placeholder="Eenheid" value={ing.unit} onChange={e => updateIngredient(i, 'unit', e.target.value)}
              className="w-20 px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400" />
            <input placeholder="Ingrediënt" value={ing.name} onChange={e => updateIngredient(i, 'name', e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400" />
            <button type="button" onClick={() => removeIngredient(i)} className="text-stone-300 hover:text-red-400 text-lg flex-shrink-0">×</button>
          </div>
        ))}
        <button type="button"
          onClick={() => setForm(f => ({ ...f, ingredients: [...f.ingredients, { name: '', amount: '', unit: '' }] }))}
          className="text-orange-500 text-sm">+ Ingrediënt toevoegen</button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Stappen</label>
        {form.steps.map((step, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="mt-2.5 text-xs text-stone-400 font-medium w-5 flex-shrink-0">{i + 1}</span>
            <textarea value={step.text} onChange={e => updateStep(i, e.target.value)}
              rows={2}
              className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
            <button type="button" onClick={() => removeStep(i)} className="mt-2 text-stone-300 hover:text-red-400 text-lg flex-shrink-0">×</button>
          </div>
        ))}
        <button type="button"
          onClick={() => setForm(f => ({ ...f, steps: [...f.steps, { order: f.steps.length + 1, text: '' }] }))}
          className="text-orange-500 text-sm">+ Stap toevoegen</button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Notities</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Persoonlijke notities..." rows={3}
          className="w-full px-3 py-2.5 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
      </div>

      <button onClick={handleSave} disabled={saving || !form.title}
        className="w-full py-3.5 bg-orange-500 text-white font-medium rounded-2xl disabled:opacity-50 hover:bg-orange-600 transition-colors">
        {saving ? 'Opslaan...' : 'Wijzigingen opslaan'}
      </button>
    </div>
  )
}
