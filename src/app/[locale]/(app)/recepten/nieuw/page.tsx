'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import type { Ingredient, Step } from '@/lib/types'

const CUISINES = ['Italiaans', 'Midden-Oosters', 'Aziatisch', 'Nederlands', 'Mexicaans', 'Frans', 'Amerikaans']
const TYPES = ['vis', 'vlees', 'kip', 'vegetarisch', 'pasta', 'rijst', 'soep', 'salade']
const DIETS = ['vegetarisch', 'vegan', 'glutenvrij']

export default function NieuwReceptPage() {
  const router = useRouter()
  const { locale } = useParams()
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', source_url: '', source_name: '',
    servings: 2, prep_time_minutes: 0, cook_time_minutes: 0,
    cuisine: '', ingredient_type: '', diet_labels: [] as string[],
    image_url: '',
    ingredients: [{ name: '', amount: '', unit: '' }] as Ingredient[],
    steps: [{ order: 1, text: '', timer_minutes: undefined }] as Step[],
  })

  async function handleImport() {
    setImporting(true)
    setImportError('')
    try {
      const res = await fetch('/api/recepten/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl }),
      })
      const data = await res.json()
      if (!res.ok) { setImportError(data.error); setImporting(false); return }
      setForm(f => ({ ...f, ...data.recipe, source_url: data.source_url ?? importUrl }))
      if (data.recipe.image_url) setPhotoPreview(data.recipe.image_url)
    } catch (e) {
      setImportError('Kan de URL niet bereiken.')
    }
    setImporting(false)
  }

  async function handleBookScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setScanError('')
    setPhotoPreview(URL.createObjectURL(file))
    setPendingPhoto(file)
    const fd = new FormData()
    fd.append('image', file)
    try {
      const res = await fetch('/api/recepten/scan', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setScanError(data.error); setScanning(false); return }
      setForm(f => ({ ...f, ...data.recipe }))
    } catch {
      setScanError('Kan de foto niet verwerken.')
    }
    setScanning(false)
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setPendingPhoto(compressed)
    setPhotoPreview(URL.createObjectURL(compressed))
    setForm(f => ({ ...f, image_url: '' }))
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const [{ data: profile }, { data: { user } }] = await Promise.all([
      supabase.from('profiles').select('household_id').single(),
      supabase.auth.getUser(),
    ])
    const { data, error } = await supabase.from('recipes').insert({
      ...form,
      household_id: profile?.household_id,
      user_id: user!.id,
    }).select().single()
    if (!error && data && pendingPhoto) {
      const fd = new FormData()
      fd.append('file', pendingPhoto)
      fd.append('recipeId', data.id)
      await fetch('/api/recepten/upload-image', { method: 'POST', body: fd })
    }
    setSaving(false)
    if (!error && data) router.push(`/${locale}/recepten/${data.id}`)
  }

  function updateIngredient(i: number, field: keyof Ingredient, value: string) {
    setForm(f => {
      const ingredients = [...f.ingredients]
      ingredients[i] = { ...ingredients[i], [field]: value }
      return { ...f, ingredients }
    })
  }

  function updateStep(i: number, value: string) {
    setForm(f => {
      const steps = [...f.steps]
      steps[i] = { ...steps[i], text: value }
      return { ...f, steps }
    })
  }

  return (
    <div className="px-4 pt-10 pb-8 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-stone-400 hover:text-stone-700">←</button>
        <h1 className="text-xl font-semibold">Nieuw recept</h1>
      </div>

      {/* Import opties */}
      <div className="grid grid-cols-2 gap-3">
        {/* URL Import */}
        <div className="col-span-2 bg-orange-50 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-medium text-orange-800">Importeer via URL</p>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://jamieoliver.com/..."
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-orange-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={handleImport}
              disabled={importing || !importUrl}
              className="px-4 py-2 bg-orange-500 text-white text-sm rounded-xl disabled:opacity-50 hover:bg-orange-600 transition-colors"
            >
              {importing ? '...' : 'Haal op'}
            </button>
          </div>
          {importError && <p className="text-red-500 text-xs">{importError}</p>}
        </div>

        {/* Kookboek scan */}
        <label className={`col-span-2 ${scanning ? 'cursor-wait' : 'cursor-pointer'}`}>
          <div className={`bg-stone-100 rounded-2xl p-4 flex items-center gap-3 transition-colors ${scanning ? '' : 'hover:bg-stone-200'}`}>
            <span className="text-2xl">{scanning ? '⏳' : '📖'}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-stone-700">
                {scanning ? 'Bezig met scannen...' : 'Scan kookboekpagina'}
              </p>
              <p className="text-xs text-stone-400">
                {scanning ? 'Claude leest het recept uit de foto' : 'Maak een foto of kies een afbeelding'}
              </p>
            </div>
            {scanning && (
              <svg className="animate-spin w-5 h-5 text-orange-500 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
          </div>
          {scanError && <p className="text-red-500 text-xs mt-1 px-1">{scanError}</p>}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleBookScan}
            disabled={scanning}
          />
        </label>
      </div>

      {/* Photo */}
      <label className={`relative block ${scanning ? 'cursor-wait' : 'cursor-pointer'}`}>
        {photoPreview ? (
          <div className="relative">
            <img src={photoPreview} alt="" className={`w-full h-48 object-cover rounded-2xl transition-all ${scanning ? 'brightness-50' : ''}`} />
            {scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl">
                <svg className="animate-spin w-8 h-8 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <div className="text-center">
                  <p className="text-white text-sm font-medium">Claude leest het recept…</p>
                  <p className="text-white/70 text-xs mt-0.5">Dit duurt 10–20 seconden</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-32 bg-stone-100 rounded-2xl flex flex-col items-center justify-center gap-1 text-stone-400 hover:bg-stone-200 transition-colors">
            <span className="text-2xl">📷</span>
            <span className="text-xs">Foto toevoegen</span>
          </div>
        )}
        {photoPreview && !scanning && (
          <div className="absolute inset-0 bg-black/0 hover:bg-black/20 rounded-2xl transition-colors flex items-center justify-center">
            <span className="opacity-0 hover:opacity-100 text-white text-xs bg-black/50 px-3 py-1 rounded-full transition-opacity">📷 Wijzigen</span>
          </div>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} disabled={scanning} />
      </label>

      {/* Title */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Naam</label>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Naam van het recept"
          className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Servings + times */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Personen', key: 'servings', suffix: '' },
          { label: 'Prep (min)', key: 'prep_time_minutes', suffix: '' },
          { label: 'Koken (min)', key: 'cook_time_minutes', suffix: '' },
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

      {/* Cuisine */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Keukenstijl</label>
        <div className="flex flex-wrap gap-2">
          {CUISINES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setForm(f => ({ ...f, cuisine: f.cuisine === c ? '' : c }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.cuisine === c ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-200'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Type */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Type</label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setForm(f => ({ ...f, ingredient_type: f.ingredient_type === t ? '' : t }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize ${form.ingredient_type === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-stone-600 border-stone-200'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Diet labels */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Dieet</label>
        <div className="flex gap-2">
          {DIETS.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setForm(f => ({
                ...f,
                diet_labels: f.diet_labels.includes(d) ? f.diet_labels.filter(x => x !== d) : [...f.diet_labels, d],
              }))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${form.diet_labels.includes(d) ? 'bg-green-500 text-white border-green-500' : 'bg-white text-stone-600 border-stone-200'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Ingredients */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Ingrediënten</label>
        {form.ingredients.map((ing, i) => (
          <div key={i} className="flex gap-2">
            <input
              placeholder="Hoeveelheid"
              value={ing.amount}
              onChange={e => updateIngredient(i, 'amount', e.target.value)}
              className="w-20 px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              placeholder="Eenheid"
              value={ing.unit}
              onChange={e => updateIngredient(i, 'unit', e.target.value)}
              className="w-20 px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              placeholder="Ingrediënt"
              value={ing.name}
              onChange={e => updateIngredient(i, 'name', e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, ingredients: [...f.ingredients, { name: '', amount: '', unit: '' }] }))}
          className="text-orange-500 text-sm"
        >
          + Ingrediënt toevoegen
        </button>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Stappen</label>
        {form.steps.map((step, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="mt-2.5 text-xs text-stone-400 font-medium w-5 flex-shrink-0">{i + 1}</span>
            <textarea
              value={step.text}
              onChange={e => updateStep(i, e.target.value)}
              placeholder={`Stap ${i + 1}`}
              rows={2}
              className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, steps: [...f.steps, { order: f.steps.length + 1, text: '' }] }))}
          className="text-orange-500 text-sm"
        >
          + Stap toevoegen
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !form.title}
        className="w-full py-3.5 bg-orange-500 text-white font-medium rounded-2xl disabled:opacity-50 hover:bg-orange-600 transition-colors"
      >
        {saving ? 'Opslaan...' : 'Recept opslaan'}
      </button>
    </div>
  )
}
