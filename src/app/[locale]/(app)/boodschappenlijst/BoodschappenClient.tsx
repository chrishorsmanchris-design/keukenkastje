'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ShoppingItem } from '@/lib/types'
import { predictExpiry } from '@/lib/expiry'
import { useToast } from '@/components/Toast'

// Supermarkt looproute — volgorde zoals in een echte winkel
const CATEGORY_CONFIG: { name: string; icon: string }[] = [
  { name: 'Groente & fruit',         icon: '🥦' },
  { name: 'Brood & bakkerij',        icon: '🍞' },
  { name: 'Vlees & vis',             icon: '🥩' },
  { name: 'Zuivel & eieren',         icon: '🥛' },
  { name: 'Pasta & rijst',           icon: '🍝' },
  { name: 'Blikken & potten',        icon: '🥫' },
  { name: 'Sauzen & kruiden',        icon: '🫙' },
  { name: 'Dranken',                 icon: '🥤' },
  { name: 'Diepvries',               icon: '❄️' },
  { name: 'Persoonlijke verzorging', icon: '🧴' },
  { name: 'Overig',                  icon: '📦' },
]

const CATEGORY_ICON = Object.fromEntries(CATEGORY_CONFIG.map(c => [c.name, c.icon]))
const CATEGORIES = CATEGORY_CONFIG.map(c => c.name)

function categorize(name: string): string {
  const n = name.toLowerCase()
  if (/tomaat|paprika|\bui\b|uien|knoflook|wortel|sla\b|spinazie|broccoli|courgette|aubergine|avocado|citroen|limoen|appel|peer|banaan|aardappel|zoete aardappel|venkel|komkommer|prei|champignon|paddenstoel/.test(n)) return 'Groente & fruit'
  if (/kip|rund|vark|gehakt|zalm|vis\b|garnaal|tonijn|spek|chorizo|bacon|ham|worst/.test(n)) return 'Vlees & vis'
  if (/melk|kaas|boter|room|yoghurt|kwark|ei\b|eieren|mozzarella|parmezaan|ricotta|creme fraiche|feta/.test(n)) return 'Zuivel & eieren'
  if (/brood|baguette|ciabatta|pita|tortilla|wrap|bagel|stokbrood/.test(n)) return 'Brood & bakkerij'
  if (/pasta|spaghetti|penne|tagliatelle|rijst|couscous|quinoa|noodle|mie\b|bloem|havermout/.test(n)) return 'Pasta & rijst'
  if (/blik|pot\b|kikkererwt|linzen|boon\b|bonen|tomatenblok|kokosmelk|olijven/.test(n)) return 'Blikken & potten'
  if (/olie|azijn|sojasaus|tahini|pesto|mosterd|ketchup|zout|peper\b|komijn|kurkuma|oregano|basilicum|tijm|rozemarijn|kaneel|honing|suiker/.test(n)) return 'Sauzen & kruiden'
  if (/water|sap\b|wijn|bier|cola|thee|koffie/.test(n)) return 'Dranken'
  if (/diepvries|bevroren/.test(n)) return 'Diepvries'
  if (/shampoo|zeep|tandpasta|wasmiddel|schoonmaak|toilet|tissues/.test(n)) return 'Persoonlijke verzorging'
  return 'Overig'
}

export default function BoodschappenClient({ initialItems }: { initialItems: ShoppingItem[] }) {
  const [items, setItems] = useState<ShoppingItem[]>(initialItems)
  const [newItem, setNewItem] = useState('')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const undoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pendingDeletes = useRef<Map<string, ShoppingItem>>(new Map())

  // Realtime sync
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('shopping')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, payload => {
        if (payload.eventType === 'INSERT') {
          const incoming = payload.new as ShoppingItem
          // Skip if we just added this ourselves (pending delete guard)
          if (!pendingDeletes.current.has(incoming.id)) {
            setItems(prev => prev.some(i => i.id === incoming.id) ? prev : [...prev, incoming])
          }
        } else if (payload.eventType === 'UPDATE') {
          setItems(prev => prev.map(i => i.id === payload.new.id ? payload.new as ShoppingItem : i))
        } else if (payload.eventType === 'DELETE') {
          if (!pendingDeletes.current.has(payload.old.id)) {
            setItems(prev => prev.filter(i => i.id !== payload.old.id))
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    setAdding(true)
    const supabase = createClient()
    const { data: profile } = await supabase.from('profiles').select('household_id').single()
    const category = categorize(newItem)
    await supabase.from('shopping_items').insert({
      name: newItem.trim(),
      household_id: profile?.household_id,
      is_manual: true,
      checked: false,
      category,
    })
    setNewItem('')
    setAdding(false)
    inputRef.current?.focus()
  }

  async function toggleItem(item: ShoppingItem) {
    const supabase = createClient()
    const checked = !item.checked
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked } : i))
    await supabase.from('shopping_items').update({
      checked,
      checked_at: checked ? new Date().toISOString() : null,
    }).eq('id', item.id)

    if (checked && item.category !== 'Persoonlijke verzorging' && item.category !== 'Overig') {
      const { data: profile } = await supabase.from('profiles').select('household_id').single()
      await supabase.from('pantry_items').insert({
        name: item.name,
        quantity: item.quantity ?? 1,
        unit: item.unit ?? 'stuks',
        expires_at: predictExpiry(item.name),
        household_id: profile?.household_id,
      })
    }
  }

  const undoDelete = useCallback((itemId: string) => {
    const timer = undoTimers.current.get(itemId)
    if (timer) clearTimeout(timer)
    undoTimers.current.delete(itemId)
    const item = pendingDeletes.current.get(itemId)
    if (item) {
      pendingDeletes.current.delete(itemId)
      setItems(prev => [...prev, item].sort((a, b) => a.created_at.localeCompare(b.created_at)))
    }
  }, [])

  const deleteItem = useCallback((item: ShoppingItem) => {
    setItems(prev => prev.filter(i => i.id !== item.id))
    pendingDeletes.current.set(item.id, item)
    const id = item.id
    toast(`${item.name} verwijderd`, 'info', { action: { label: 'Ongedaan maken', onClick: () => undoDelete(id) } })
    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(item.id)
      const supabase = createClient()
      await supabase.from('shopping_items').delete().eq('id', item.id)
    }, 5000)
    undoTimers.current.set(item.id, timer)
  }, [toast, undoDelete])

  function clearChecked() {
    items.filter(i => i.checked).forEach(item => deleteItem(item))
  }

  const filtered = search.trim()
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items
  const unchecked = filtered.filter(i => !i.checked)
  const checked = filtered.filter(i => i.checked)

  const grouped: Record<string, ShoppingItem[]> = {}
  for (const item of unchecked) {
    const cat = item.category ?? categorize(item.name)
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }
  const sortedCategories = CATEGORIES.filter(c => grouped[c]?.length)

  return (
    <div className="px-4 pt-10 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Boodschappen</h1>
        {checked.length > 0 && (
          <button onClick={clearChecked} className="text-sm text-stone-400 hover:text-red-400 transition-colors">
            Wis afgevinkt ({checked.length})
          </button>
        )}
      </div>

      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Zoeken..."
        className="w-full px-4 py-2.5 rounded-2xl border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-400"
      />

      {/* Add item */}
      <form onSubmit={addItem} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder="Item toevoegen..."
          className="flex-1 px-4 py-2.5 rounded-2xl border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          type="submit"
          disabled={adding || !newItem.trim()}
          className="px-4 py-2.5 bg-orange-500 text-white text-sm rounded-2xl disabled:opacity-50 hover:bg-orange-600 transition-colors"
        >
          +
        </button>
      </form>

      {items.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">🛒</div>
          <p className="text-sm">Je lijst is leeg</p>
          <p className="text-xs mt-1">Plan je weekmenu om automatisch items toe te voegen</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedCategories.map((category, idx) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base leading-none">{CATEGORY_ICON[category]}</span>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">{category}</p>
                <span className="text-xs text-stone-300 ml-auto">{grouped[category].length}</span>
              </div>
              <div className="space-y-1">
                {grouped[category].map(item => (
                  <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
                ))}
              </div>
              {idx < sortedCategories.length - 1 && (
                <div className="mt-4 border-t border-stone-100" />
              )}
            </div>
          ))}

          {checked.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base leading-none">✅</span>
                <p className="text-xs font-semibold text-stone-300 uppercase tracking-wide">Afgevinkt</p>
                <span className="text-xs text-stone-300 ml-auto">{checked.length}</span>
              </div>
              <div className="space-y-1 opacity-50">
                {checked.map(item => (
                  <ItemRow key={item.id} item={item} onToggle={toggleItem} onDelete={deleteItem} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, onToggle, onDelete }: {
  item: ShoppingItem
  onToggle: (item: ShoppingItem) => void
  onDelete: (item: ShoppingItem) => void
}) {
  const [offsetX, setOffsetX] = useState(0)
  const startX = useRef(0)
  const isDragging = useRef(false)

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX
    isDragging.current = false
  }

  function onPointerMove(e: React.PointerEvent) {
    const dx = e.clientX - startX.current
    if (Math.abs(dx) > 5) isDragging.current = true
    if (dx < 0) setOffsetX(Math.max(dx, -80))
    else setOffsetX(Math.min(dx, 0))
  }

  function onPointerUp() {
    if (offsetX < -60) {
      onDelete(item)
    } else {
      setOffsetX(0)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center rounded-xl">
        <span className="text-white text-sm font-medium">Wis</span>
      </div>
      <div
        className="relative flex items-center gap-3 bg-white px-3 py-2.5 border border-stone-100 rounded-xl text-left touch-pan-y"
        style={{ transform: `translateX(${offsetX}px)`, transitionDuration: offsetX === 0 ? '200ms' : '0ms', transition: 'transform' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={() => { if (!isDragging.current) onToggle(item) }}
      >
        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
          item.checked ? 'bg-orange-500 border-orange-500' : 'border-stone-300'
        }`}>
          {item.checked && <span className="text-white text-xs">✓</span>}
        </div>
        <span className={`flex-1 text-sm ${item.checked ? 'line-through text-stone-400' : 'text-stone-800'}`}>
          {item.name}
        </span>
        {(item.quantity || item.unit) && (
          <span className="text-xs text-stone-400 flex-shrink-0">
            {item.quantity ? (Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)) : ''} {item.unit}
          </span>
        )}
      </div>
    </div>
  )
}
