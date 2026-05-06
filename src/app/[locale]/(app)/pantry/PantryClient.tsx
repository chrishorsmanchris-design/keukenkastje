'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { predictExpiry } from '@/lib/expiry'
import type { PantryItem } from '@/lib/types'

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function expiryLabel(days: number | null) {
  if (days === null) return null
  if (days < 0) return { text: 'Verlopen', color: 'text-red-600 bg-red-50' }
  if (days === 0) return { text: 'Verloopt vandaag', color: 'text-red-500 bg-red-50' }
  if (days <= 3) return { text: `${days}d`, color: 'text-orange-500 bg-orange-50' }
  if (days <= 7) return { text: `${days}d`, color: 'text-yellow-600 bg-yellow-50' }
  return { text: `${days}d`, color: 'text-stone-400 bg-stone-100' }
}

type ScannedProduct = { name: string; quantity: number; unit: string; expires_at: string; selected: boolean }

export default function PantryClient({ initialItems }: { initialItems: PantryItem[] }) {
  const [items, setItems] = useState<PantryItem[]>(initialItems)
  const [showAdd, setShowAdd] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<ScannedProduct[]>([])
  const [saving, setSaving] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, unit: 'stuks' })
  const fileRef = useRef<HTMLInputElement>(null)

  const expiringSoon = items.filter(i => { const d = daysUntil(i.expires_at); return d !== null && d <= 3 })

  async function getHousehold() {
    const supabase = createClient()
    const { data } = await supabase.from('profiles').select('household_id').single()
    return data?.household_id
  }

  async function handlePhotoScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    const formData = new FormData()
    formData.append('image', file)
    const res = await fetch('/api/pantry/scan', { method: 'POST', body: formData })
    const { products } = await res.json()
    setScanned((products ?? []).map((p: Omit<ScannedProduct, 'selected'>) => ({ ...p, selected: true })))
    setScanning(false)
  }

  async function saveScanned() {
    setSaving(true)
    const supabase = createClient()
    const householdId = await getHousehold()
    const toSave = scanned.filter(p => p.selected)
    const { data } = await supabase.from('pantry_items').insert(
      toSave.map(p => ({ name: p.name, quantity: p.quantity, unit: p.unit, expires_at: p.expires_at, household_id: householdId }))
    ).select()
    if (data) setItems(prev => [...prev, ...data])
    setScanned([])
    setSaving(false)
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem.name.trim()) return
    setSaving(true)
    const supabase = createClient()
    const householdId = await getHousehold()

    const { data } = await supabase.from('pantry_items').insert({
      ...newItem, expires_at: predictExpiry(newItem.name), household_id: householdId,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
    setNewItem({ name: '', quantity: 1, unit: 'stuks' })
    setShowAdd(false)
    setSaving(false)
  }

  async function removeItem(id: string) {
    const supabase = createClient()
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('pantry_items').delete().eq('id', id)
  }

  return (
    <div className="px-4 pt-10 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pantry</h1>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="bg-stone-100 text-stone-700 text-sm font-medium px-3 py-2 rounded-full hover:bg-stone-200 transition-colors"
          >
            {scanning ? '...' : '📷 Scan'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-orange-500 text-white text-sm font-medium px-3 py-2 rounded-full hover:bg-orange-600 transition-colors"
          >
            + Toevoegen
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoScan} />

      {/* Expiring soon banner */}
      {expiringSoon.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3">
          <p className="text-sm font-medium text-orange-700 mb-1">⚠️ Verloopt binnenkort</p>
          <p className="text-xs text-orange-600">{expiringSoon.map(i => i.name).join(', ')}</p>
        </div>
      )}

      {/* Scanned products review */}
      {scanned.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold">Gevonden producten — selecteer wat je wil opslaan</p>
          <div className="space-y-2">
            {scanned.map((p, i) => {
              const days = daysUntil(p.expires_at)
              const label = expiryLabel(days)
              return (
                <div key={i} className="flex items-center gap-3">
                  <button
                    onClick={() => setScanned(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${p.selected ? 'bg-orange-500 border-orange-500' : 'border-stone-300'}`}
                  >
                    {p.selected && <span className="text-white text-xs">✓</span>}
                  </button>
                  <span className="flex-1 text-sm">{p.name}</span>
                  <span className="text-xs text-stone-400">{p.quantity} {p.unit}</span>
                  {label && <span className={`text-xs px-2 py-0.5 rounded-full ${label.color}`}>{label.text}</span>}
                </div>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setScanned([])} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm text-stone-500">Annuleren</button>
            <button onClick={saveScanned} disabled={saving || scanned.every(p => !p.selected)} className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-sm disabled:opacity-50">
              {saving ? '...' : `${scanned.filter(p => p.selected).length} opslaan`}
            </button>
          </div>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 && scanned.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">🧺</div>
          <p className="text-sm">Je pantry is leeg</p>
          <p className="text-xs mt-1">Scan je koelkast of voeg producten handmatig toe</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items
            .sort((a, b) => {
              const da = daysUntil(a.expires_at) ?? 999
              const db = daysUntil(b.expires_at) ?? 999
              return da - db
            })
            .map(item => {
              const days = daysUntil(item.expires_at)
              const label = expiryLabel(days)
              const rowClass =
                days !== null && days < 0 ? 'bg-red-50 border-red-200' :
                days !== null && days === 0 ? 'bg-red-50 border-red-200' :
                days !== null && days <= 3 ? 'bg-orange-50 border-orange-200' :
                days !== null && days <= 7 ? 'bg-yellow-50 border-yellow-200' :
                'bg-white border-stone-100'
              return (
                <div key={item.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${rowClass}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-stone-400">{item.quantity} {item.unit}</p>
                  </div>
                  {label && <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${label.color}`}>{label.text}</span>}
                  <button onClick={() => removeItem(item.id)} className="text-stone-300 hover:text-red-400 transition-colors flex-shrink-0">✕</button>
                </div>
              )
            })}
        </div>
      )}

      {/* Add manually modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowAdd(false)}>
          <form onSubmit={addManual} className="bg-white w-full rounded-t-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold">Product toevoegen</h2>
            <input
              autoFocus
              type="text"
              placeholder="Naam (bijv. Melk)"
              value={newItem.name}
              onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
            <div className="flex gap-3">
              <input
                type="number"
                value={newItem.quantity}
                onChange={e => setNewItem(n => ({ ...n, quantity: +e.target.value }))}
                className="w-24 px-3 py-3 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
              />
              <input
                type="text"
                placeholder="eenheid"
                value={newItem.unit}
                onChange={e => setNewItem(n => ({ ...n, unit: e.target.value }))}
                className="flex-1 px-3 py-3 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <p className="text-xs text-stone-400">Houdbaarheidsdatum wordt automatisch voorspeld</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3 border border-stone-200 rounded-2xl text-sm">Annuleren</button>
              <button type="submit" disabled={saving || !newItem.name.trim()} className="flex-1 py-3 bg-orange-500 text-white rounded-2xl text-sm disabled:opacity-50">
                {saving ? '...' : 'Toevoegen'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
