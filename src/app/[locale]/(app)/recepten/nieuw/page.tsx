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
  const [showPasteText, setShowPasteText] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [pasteError, setPasteError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
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
      if (!res.ok) {
        if (data.error === 'instagram_blocked') {
          setShowPasteText(true)
          setImportError('')
        } else {
          setImportError(data.error ?? data.message ?? 'Import mislukt')
        }
        setImporting(false)
        return
      }
      setForm(f => ({ ...f, ...data.recipe, source_url: data.source_url ?? importUrl }))
      if (data.recipe.image_url) setPhotoPreview(data.recipe.image_url)
    } catch {
      setImportError('Kan de URL niet bereiken.')
    }
    setImporting(false)
  }

  async function handleExtractText() {
    if (!pasteText.trim()) return
    setExtracting(true)
    setPasteError('')
    try {
      const res = await fetch('/api/recepten/import-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      })
      const data = await res.json()
      if (!res.ok) { setPasteError(data.error); setExtracting(false); return }
      setForm(f => ({ ...f, ...data.recipe, source_url: importUrl }))
      setShowPasteText(false)
      setPasteText('')
    } catch {
      setPasteError('Extractie mislukt.')
    }
    setExtracting(false)
  }

  const [scanPreviews, setScanPreviews] = useState<string[]>([])

  async function handleBookScan(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setScanning(true)
    setScanError('')
    // Toon previews van alle geselecteerde afbeeldingen
    const previews = files.map(f => URL.createObjectURL(f))
    setScanPreviews(previews)
    setPhotoPreview(previews[0])
    setPendingPhoto(files[0])
    const fd = new FormData()
    files.forEach((f, i) => fd.append(i === 0 ? 'image' : `image_${i}`, f))
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
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user!.id).single()
    const { data, error } = await supabase.from('recipes').insert({
      ...form,
      household_id: profile?.household_id,
    }).select().single()
    if (error) { setSaveError(error.message); setSaving(false); return }
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

      {/* ── Importeer opties ── */}
      <div className="space-y-3">

        {/* URL */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Via URL</p>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://jamieoliver.com/..."
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={handleImport}
              disabled={importing || !importUrl}
              className="px-4 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl disabled:opacity-50 hover:bg-orange-600 transition-colors flex-shrink-0"
            >
              {importing ? (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : 'Haal op'}
            </button>
          </div>
          {importError && (
            <p className="text-red-500 text-xs flex items-center gap-1">
              <span>⚠️</span> {importError}
            </p>
          )}
        </div>

        {/* Foto scannen — 3 gelijke opties */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Via foto</p>
          <div className="grid grid-cols-3 gap-2">
            {/* Camera */}
            <label className={scanning ? 'cursor-wait' : 'cursor-pointer'}>
              <div className={`bg-white border border-stone-200 rounded-xl py-3 px-2 flex flex-col items-center gap-1.5 transition-colors ${!scanning ? 'hover:border-orange-300 hover:bg-orange-50' : 'opacity-50'}`}>
                <span className="text-xl">📷</span>
                <p className="text-xs font-medium text-stone-600 text-center leading-tight">Camera</p>
              </div>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleBookScan} disabled={scanning} />
            </label>

            {/* Screenshots */}
            <label className={scanning ? 'cursor-wait' : 'cursor-pointer'}>
              <div className={`bg-white border border-stone-200 rounded-xl py-3 px-2 flex flex-col items-center gap-1.5 transition-colors ${!scanning ? 'hover:border-orange-300 hover:bg-orange-50' : 'opacity-50'}`}>
                <span className="text-xl">🖼️</span>
                <p className="text-xs font-medium text-stone-600 text-center leading-tight">Screenshot</p>
              </div>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleBookScan} disabled={scanning} />
            </label>

            {/* Tekst plakken */}
            <button
              type="button"
              onClick={() => setShowPasteText(v => !v)}
              className={`bg-white border rounded-xl py-3 px-2 flex flex-col items-center gap-1.5 transition-colors ${showPasteText ? 'border-orange-400 bg-orange-50' : 'border-stone-200 hover:border-orange-300 hover:bg-orange-50'}`}
            >
              <span className="text-xl">📋</span>
              <p className="text-xs font-medium text-stone-600 text-center leading-tight">Tekst</p>
            </button>
          </div>

          {/* Foto preview + scan-status */}
          {photoPreview && (
            <div className="relative">
              <img src={photoPreview} alt="" className={`w-full h-40 object-cover rounded-xl transition-all ${scanning ? 'brightness-50' : ''}`} />
              {scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl">
                  <svg className="animate-spin w-7 h-7 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <p className="text-white text-xs font-medium">Claude leest het recept…</p>
                </div>
              )}
              {!scanning && (
                <label className="absolute bottom-2 right-2 cursor-pointer">
                  <div className="bg-black/50 text-white text-xs px-2.5 py-1 rounded-full">📷 Wijzigen</div>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                </label>
              )}
            </div>
          )}

          {/* Scan status zonder foto */}
          {scanning && !photoPreview && (
            <div className="flex items-center gap-3 py-2">
              <svg className="animate-spin w-5 h-5 text-orange-500 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-sm text-stone-600">Claude leest het recept… (10–20 sec)</p>
            </div>
          )}

          {/* Meerdere foto previews */}
          {scanPreviews.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {scanPreviews.map((src, i) => (
                <img key={i} src={src} alt="" className="h-14 w-14 object-cover rounded-lg flex-shrink-0 border border-stone-200" />
              ))}
              <div className="flex-shrink-0 h-14 w-14 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center text-xs text-stone-400 text-center leading-tight p-1">
                {scanPreviews.length}×
              </div>
            </div>
          )}

          {scanError && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 flex items-start justify-between gap-2">
              <p className="text-xs text-red-600">{scanError}</p>
              <button onClick={() => setScanError('')} className="text-red-300 hover:text-red-500 flex-shrink-0">✕</button>
            </div>
          )}
        </div>

        {/* Tekst plakken panel */}
        {showPasteText && (
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Plak recepttekst</p>
            <p className="text-xs text-stone-500">Kopieer de tekst uit Instagram, een blog of een ander bron en plak hem hieronder.</p>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Plak hier het recept of bijschrift..."
              rows={5}
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
            {pasteError && <p className="text-red-500 text-xs">{pasteError}</p>}
            <button
              onClick={handleExtractText}
              disabled={extracting || !pasteText.trim()}
              className="w-full py-2.5 bg-orange-500 text-white text-sm font-medium rounded-xl disabled:opacity-50 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
            >
              {extracting && (
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}
              {extracting ? 'Recept extraheren…' : 'Recept extraheren'}
            </button>
          </div>
        )}

        {/* Foto toevoegen (alleen als nog geen foto) */}
        {!photoPreview && (
          <label className="cursor-pointer block">
            <div className="bg-stone-50 border border-dashed border-stone-300 rounded-2xl py-5 flex flex-col items-center gap-1.5 text-stone-400 hover:border-orange-300 hover:bg-orange-50 transition-colors">
              <span className="text-2xl">🖼️</span>
              <span className="text-xs font-medium">Foto toevoegen</span>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
          </label>
        )}
      </div>

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

      {saveError && <p className="text-red-500 text-sm text-center">{saveError}</p>}
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
