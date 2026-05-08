'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { predictExpiry } from '@/lib/expiry'
import { useToast } from '@/components/Toast'
import type { PantryItem } from '@/lib/types'

function categorize(name: string): string {
  const n = name.toLowerCase()
  if (/melk|yoghurt|kwark|kaas|boter|room|slagroom|mozzarella|parmezaan|ricotta|creme fraiche|crème fraîche|feta|halloumi|brie|camembert|gouda|edam|ei\b|eieren/.test(n)) return 'Zuivel & eieren'
  if (/\bkip\b|kipfilet|kipdi|kippen|rund|biefstuk|gehakt|vark|spek|bacon|ham|worst|salami|chorizo|zalm|vis\b|kabeljauw|tilapia|garnaal|tonijn|makreel|haring|forel|inktvis|mosselen|oesters/.test(n)) return 'Vlees & vis'
  if (/appel|peer|banaan|aardbei|framboos|bosbes|mango|ananas|meloen|druif|kers|pruim|abrikoos|perzik|vijg|tomaat|paprika|\bui\b|uien|knoflook|wortel|sla\b|sla,|spinazie|broccoli|courgette|aubergine|avocado|citroen|limoen|sinaasappel|grapefruit|aardappel|zoete aardappel|venkel|komkommer|prei|selderij|witlof|radijs|biet|mais|erwtjes|boontjes|asperge|artisjok|kool|spruitjes|paddenstoel|champignon|portobello|courgetti/.test(n)) return 'Groente & fruit'
  if (/brood|baguette|ciabatta|pita|tortilla|wrap|croissant|bagel|brioche|focaccia|stokbrood|beschuit|crackers|knäckebröd/.test(n)) return 'Brood'
  if (/pasta|spaghetti|penne|fusilli|rigatoni|tagliatelle|lasagne|gnocchi|rijst|couscous|quinoa|bulgur|noodle|mie\b|meel|bloem|havermout|granola|muesli|cornflakes|polenta|griesmeel/.test(n)) return 'Droog & graan'
  if (/blik|pot\b|potje|kikkererwt|linzen|kidneyboon|boon\b|bonen|tomatenblok|gezeefde tomaten|tomatenpuree|kokosmelk|ingeblikte|conserven|augurk|kappertjes|olijven/.test(n)) return 'Blikken & potten'
  if (/olijfolie|zonnebloemolie|kokosolie|sesamolie|\bolie\b|azijn|balsamico|sojasaus|teriyaki|vissaus|worcestershire|tahini|hummus|pesto|mosterd|ketchup|mayonaise|sriracha|sambal|tabasco|hoisin|ketjap|saus\b/.test(n)) return 'Sauzen & oliën'
  if (/kruiden|specerij|kruid\b|\bzout\b|zeezout|peper\b|peperkorrel|komijn|kurkuma|kerrie|curry|oregano|basilicum|tijm|rozemarijn|paprikapoeder|cayenne|chilipoeder|kaneel|nootmuskaat|kardemom|koriander|korianderzaad|laurier|dille|peterselie|bieslook|munt|salie|dragon|venkelzaad|karwij|anijs|steranijs|kruidnagel|piment|gember|sumak|za'atar|ras el hanout|garam masala|5-kruidenpoeder|gemalen|poeder|gedroogd|italiaanse|provençaal|mixed herbs|bouillon|honing|suiker|vanille|bakpoeder|baking soda|maizena|gelatine/.test(n)) return 'Kruiden & specerijen'
  if (/water|bronwater|spa|frisdrank|sap\b|sinaasappelsap|appelsap|tomatensap|wijn|rode wijn|witte wijn|bier|cola|fanta|sprite|thee|groene thee|koffie|espresso|cappuccino|chocolademelk|limonade/.test(n)) return 'Dranken'
  if (/diepvries|bevroren|ingevroren|frozen/.test(n)) return 'Diepvries'
  return 'Overig'
}

const PANTRY_CATEGORIES = ['Zuivel & eieren','Vlees & vis','Groente & fruit','Brood','Droog & graan','Blikken & potten','Sauzen & oliën','Kruiden & specerijen','Dranken','Diepvries','Overig']

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

export default function PantryClient({ initialItems, householdId }: { initialItems: PantryItem[]; householdId: string }) {
  const [items, setItems] = useState<PantryItem[]>(initialItems)
  const [showAdd, setShowAdd] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<ScannedProduct[]>([])
  const [saving, setSaving] = useState(false)
  const [newItem, setNewItem] = useState({ name: '', quantity: 1, unit: 'stuks' })
  const [showBarcode, setShowBarcode] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const expiringSoon = items.filter(i => { const d = daysUntil(i.expires_at); return d !== null && d <= 3 })

  // Realtime sync — filter op household
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`pantry:${householdId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pantry_items',
        filter: `household_id=eq.${householdId}`,
      }, async payload => {
        if (payload.eventType === 'INSERT') {
          const { data } = await supabase.from('pantry_items').select('*').eq('id', payload.new.id).single()
          if (data) setItems(prev => prev.some(i => i.id === data.id) ? prev : [...prev, data as PantryItem])
        } else if (payload.eventType === 'UPDATE') {
          const { data } = await supabase.from('pantry_items').select('*').eq('id', payload.new.id).single()
          if (data) setItems(prev => prev.map(i => i.id === data.id ? data as PantryItem : i))
        } else if (payload.eventType === 'DELETE') {
          setItems(prev => prev.filter(i => i.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [householdId])

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

  async function addItemByName(name: string) {
    const supabase = createClient()
    const householdId = await getHousehold()
    const { data } = await supabase.from('pantry_items').insert({
      name, quantity: 1, unit: 'stuks',
      expires_at: predictExpiry(name),
      household_id: householdId,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
    toast(`${name} toegevoegd aan pantry`, 'success')
  }

  async function removeItem(id: string) {
    const supabase = createClient()
    setItems(prev => prev.filter(i => i.id !== id))
    await supabase.from('pantry_items').delete().eq('id', id)
  }

  const updateQuantity = useCallback(async (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id)
      return
    }
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i))
    const supabase = createClient()
    await supabase.from('pantry_items').update({ quantity }).eq('id', id)
  }, []) // eslint-disable-line

  const changeCategory = useCallback(async (id: string, category: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, category } : i))
    const supabase = createClient()
    await supabase.from('pantry_items').update({ category }).eq('id', id)
  }, [])

  return (
    <div className="px-4 pt-10 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pantry</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBarcode(true)}
            className="bg-stone-100 text-stone-700 text-sm px-3 py-2 rounded-full hover:bg-stone-200 transition-colors"
            title="Barcode scannen"
          >
            🔍
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={scanning}
            className="bg-stone-100 text-stone-700 text-sm px-3 py-2 rounded-full hover:bg-stone-200 transition-colors"
            title="Foto scannen"
          >
            {scanning ? '⏳' : '📷'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-orange-600 transition-colors"
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

      {/* Items list grouped by category */}
      {items.length === 0 && scanned.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">🧺</div>
          <p className="text-sm">Je pantry is leeg</p>
          <p className="text-xs mt-1">Scan je koelkast of voeg producten handmatig toe</p>
        </div>
      ) : (() => {
        const sorted = [...items].sort((a, b) => (daysUntil(a.expires_at) ?? 999) - (daysUntil(b.expires_at) ?? 999))
        const grouped: Record<string, PantryItem[]> = {}
        for (const item of sorted) {
          const cat = item.category ?? categorize(item.name)
          if (!grouped[cat]) grouped[cat] = []
          grouped[cat].push(item)
        }
        return (
          <div className="space-y-5">
            {PANTRY_CATEGORIES.filter(c => grouped[c]?.length).map(cat => (
              <div key={cat}>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">{cat}</p>
                <div className="space-y-2">
                  {grouped[cat].map(item => {
                    const days = daysUntil(item.expires_at)
                    const label = expiryLabel(days)
                    const rowClass =
                      days !== null && days < 0 ? 'bg-red-50 border-red-200' :
                      days !== null && days === 0 ? 'bg-red-50 border-red-200' :
                      days !== null && days <= 3 ? 'bg-orange-50 border-orange-200' :
                      days !== null && days <= 7 ? 'bg-yellow-50 border-yellow-200' :
                      'bg-white border-stone-100'
                    return (
                      <PantryRow
                        key={item.id}
                        item={item}
                        rowClass={rowClass}
                        label={label}
                        onRemove={removeItem}
                        onUpdateQuantity={updateQuantity}
                        onChangeCategory={changeCategory}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      })()}

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

      {/* Barcode scanner */}
      {showBarcode && (
        <BarcodeScanner
          onResult={async (name) => {
            setShowBarcode(false)
            await addItemByName(name)
          }}
          onClose={() => setShowBarcode(false)}
        />
      )}
    </div>
  )
}

// ─── PantryRow ────────────────────────────────────────────────────────────────

function PantryRow({ item, rowClass, label, onRemove, onUpdateQuantity, onChangeCategory }: {
  item: PantryItem
  rowClass: string
  label: { text: string; color: string } | null
  onRemove: (id: string) => void
  onUpdateQuantity: (id: string, qty: number) => void
  onChangeCategory: (id: string, category: string) => void
}) {
  const [showPicker, setShowPicker] = useState(false)
  const currentCat = item.category ?? categorize(item.name)

  return (
    <div className={`rounded-xl border transition-colors ${rowClass}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.name}</p>
        </div>

        {/* Quantity −/+ */}
        <div className="flex items-center gap-1 bg-white/70 rounded-full px-1.5 py-0.5 border border-stone-200 flex-shrink-0">
          <button
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            className="w-5 h-5 flex items-center justify-center text-stone-500 hover:text-red-500 transition-colors text-sm"
          >
            −
          </button>
          <span className="text-xs font-medium tabular-nums min-w-[2rem] text-center">
            {item.quantity} {item.unit}
          </span>
          <button
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            className="w-5 h-5 flex items-center justify-center text-stone-500 hover:text-green-600 transition-colors text-sm"
          >
            +
          </button>
        </div>

        {label && <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${label.color}`}>{label.text}</span>}
        <button
          onClick={() => setShowPicker(p => !p)}
          className="text-xs text-stone-300 hover:text-stone-500 flex-shrink-0 px-1"
          title="Categorie wijzigen"
        >
          ⋯
        </button>
        <button onClick={() => onRemove(item.id)} className="text-stone-300 hover:text-red-400 transition-colors flex-shrink-0">✕</button>
      </div>

      {showPicker && (
        <div className="px-3 pb-3">
          <p className="text-xs text-stone-400 mb-2">Verplaats naar categorie:</p>
          <div className="flex flex-wrap gap-1.5">
            {PANTRY_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => { onChangeCategory(item.id, cat); setShowPicker(false) }}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  cat === currentCat
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── BarcodeScanner ───────────────────────────────────────────────────────────

type ScanStatus = 'starting' | 'scanning' | 'looking-up' | 'not-found' | 'no-support' | 'error'

function BarcodeScanner({ onResult, onClose }: {
  onResult: (name: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const activeRef = useRef(true)
  const [status, setStatus] = useState<ScanStatus>('starting')
  const [manualCode, setManualCode] = useState('')
  const [foundName, setFoundName] = useState('')

  const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    if (!hasDetector) { setStatus('no-support'); return }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        streamRef.current = stream
        if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setStatus('scanning')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
        })

        const scan = async () => {
          if (!activeRef.current || !videoRef.current) return
          try {
            const barcodes = await detector.detect(videoRef.current)
            if (barcodes.length > 0) {
              streamRef.current?.getTracks().forEach(t => t.stop())
              await lookupBarcode(barcodes[0].rawValue)
              return
            }
          } catch { /* continue scanning */ }
          if (activeRef.current) requestAnimationFrame(scan)
        }
        requestAnimationFrame(scan)
      } catch {
        setStatus('error')
      }
    }
    start()

    return () => {
      activeRef.current = false
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, []) // eslint-disable-line

  async function lookupBarcode(code: string) {
    setStatus('looking-up')
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`)
      const data = await res.json()
      if (data.status === 1) {
        const name =
          data.product.product_name_nl ||
          data.product.product_name ||
          data.product.generic_name_nl ||
          data.product.generic_name
        if (name?.trim()) {
          setFoundName(name.trim())
          return
        }
      }
    } catch { /* fall through */ }
    setStatus('not-found')
  }

  async function handleManualLookup() {
    if (!manualCode.trim()) return
    streamRef.current?.getTracks().forEach(t => t.stop())
    await lookupBarcode(manualCode.trim())
  }

  // Product found — confirm screen
  if (foundName) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-end">
        <div className="bg-white w-full rounded-t-3xl p-6 space-y-4">
          <h2 className="font-semibold">Product gevonden</h2>
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
            <p className="text-sm font-medium text-green-800">{foundName}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 border border-stone-200 rounded-2xl text-sm">Annuleren</button>
            <button
              onClick={() => onResult(foundName)}
              className="flex-1 py-3 bg-orange-500 text-white rounded-2xl text-sm font-medium"
            >
              Toevoegen aan pantry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 z-10 bg-black/40">
        <h2 className="text-white font-semibold">Barcode scannen</h2>
        <button onClick={onClose} className="text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
      </div>

      {/* States */}
      {(status === 'no-support' || status === 'error' || status === 'not-found') ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="text-5xl">
            {status === 'not-found' ? '❓' : '📱'}
          </div>
          <p className="text-white text-center text-sm leading-relaxed">
            {status === 'not-found'
              ? 'Product niet gevonden in de database.\nVoer de barcode handmatig in:'
              : 'Live scanner niet beschikbaar op dit apparaat.\nVoer de barcode in om het product op te zoeken:'}
          </p>
          <div className="flex gap-2 w-full max-w-xs">
            <input
              type="number"
              placeholder="b.v. 8712345678901"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualLookup()}
              className="flex-1 px-4 py-3 rounded-2xl bg-stone-800 text-white text-sm outline-none border border-stone-700 focus:border-orange-400"
              autoFocus
            />
            <button
              onClick={handleManualLookup}
              className="px-4 py-3 bg-orange-500 text-white rounded-2xl text-sm font-medium"
            >
              Zoek
            </button>
          </div>
        </div>
      ) : status === 'looking-up' ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <svg className="animate-spin w-10 h-10 text-orange-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-white/70 text-sm">Product opzoeken…</p>
        </div>
      ) : (
        /* Live camera viewfinder */
        <div className="flex-1 relative overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          {/* Darkened overlay with cutout effect */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" />
            <div
              className="relative border-2 border-orange-400 rounded-xl animate-pulse"
              style={{ width: 260, height: 100, zIndex: 1 }}
            />
          </div>
          <p className="absolute bottom-6 left-0 right-0 text-center text-white/70 text-sm z-10">
            Richt de camera op een barcode
          </p>
        </div>
      )}

      {/* Manual entry button at bottom when scanning */}
      {(status === 'scanning' || status === 'starting') && (
        <button
          onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setStatus('no-support') }}
          className="text-white/50 text-sm text-center py-4 hover:text-white/80 transition-colors"
        >
          Handmatig invoeren
        </button>
      )}
    </div>
  )
}
