'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Profile = { household_id: string; display_name: string; is_owner: boolean; locale: string; household: { name: string } | null }
type StoreConnection = { store: string; last_synced_at: string | null }
type Member = { id: string; display_name: string; is_owner: boolean; role: string }
type Role = 'owner' | 'member' | 'viewer'

const ROLE_LABELS: Record<Role, string> = { owner: 'Eigenaar', member: 'Lid', viewer: 'Kijker' }
const ROLE_COLORS: Record<Role, string> = {
  owner: 'bg-orange-100 text-orange-600',
  member: 'bg-stone-100 text-stone-500',
  viewer: 'bg-blue-100 text-blue-600',
}
type Source = { id: string; name: string; url?: string; type: 'website' | 'cookbook' | 'instagram' }

const SUGGESTED_SOURCES: { name: string; url: string; type: 'website' | 'instagram' | 'cookbook'; category: string }[] = [
  // Internationale koks
  { name: 'Jamie Oliver', url: 'jamieoliver.com', type: 'website', category: 'Koks' },
  { name: 'Ottolenghi', url: 'ottolenghi.co.uk', type: 'website', category: 'Koks' },
  { name: 'Gordon Ramsay', url: 'gordonramsay.com', type: 'website', category: 'Koks' },
  { name: 'Nigella Lawson', url: 'nigella.com', type: 'website', category: 'Koks' },
  { name: 'Ina Garten', url: 'barefootcontessa.com', type: 'website', category: 'Koks' },
  { name: 'Nigel Slater', url: 'theguardian.com/profile/nigelslater', type: 'website', category: 'Koks' },
  { name: 'Rick Stein', url: 'rickstein.com', type: 'website', category: 'Koks' },
  { name: 'Kenji López-Alt', url: 'seriouseats.com/kenji', type: 'website', category: 'Koks' },
  { name: 'Diana Henry', url: 'dianahenry.co.uk', type: 'website', category: 'Koks' },
  // Nederlandse koks
  { name: 'Rudolph van Veen', url: 'rudolphsvandaag.nl', type: 'website', category: 'Nederlands' },
  { name: 'Miljuschka', url: 'miljuschka.nl', type: 'website', category: 'Nederlands' },
  { name: 'Sofie Dumont', url: 'sofiedumont.be', type: 'website', category: 'Nederlands' },
  // Food websites
  { name: 'Allerhande', url: 'ah.nl/allerhande', type: 'website', category: 'Websites' },
  { name: 'Leukerecepten', url: 'leukerecepten.nl', type: 'website', category: 'Websites' },
  { name: 'Culy', url: 'culy.nl', type: 'website', category: 'Websites' },
  { name: 'Smulweb', url: 'smulweb.nl', type: 'website', category: 'Websites' },
  { name: 'Serious Eats', url: 'seriouseats.com', type: 'website', category: 'Websites' },
  { name: 'BBC Good Food', url: 'bbcgoodfood.com', type: 'website', category: 'Websites' },
  { name: 'Bon Appétit', url: 'bonappetit.com', type: 'website', category: 'Websites' },
  { name: 'NYT Cooking', url: 'cooking.nytimes.com', type: 'website', category: 'Websites' },
  { name: 'Food52', url: 'food52.com', type: 'website', category: 'Websites' },
  { name: '24Kitchen', url: '24kitchen.nl', type: 'website', category: 'Websites' },
]

const SOURCE_CATEGORIES = ['Koks', 'Nederlands', 'Websites']

export default function InstellingenClient({
  profile, members: initialMembers, sources: initialSources, email, myRole, myId, storeConnections: initialStoreConnections,
}: {
  profile: Profile
  members: Member[]
  sources: Source[]
  email: string
  myRole: string
  myId: string
  storeConnections: StoreConnection[]
}) {
  const router = useRouter()
  const [sources, setSources] = useState<Source[]>(initialSources)
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [memberLoading, setMemberLoading] = useState<string | null>(null)
  const [memberError, setMemberError] = useState('')

  // Winkelkoppelingen
  const [storeConnections, setStoreConnections] = useState<StoreConnection[]>(initialStoreConnections)
  const [storeForm, setStoreForm] = useState<{ store: string; email: string; password: string } | null>(null)
  const [storeLoading, setStoreLoading] = useState<string | null>(null)
  const [storeError, setStoreError] = useState('')
  const [syncResult, setSyncResult] = useState<{ store: string; added: number } | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [newSource, setNewSource] = useState({ name: '', url: '', type: 'website' as Source['type'] })
  const [showAddSource, setShowAddSource] = useState(false)

  async function getHouseholdId() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('profiles').select('household_id').eq('id', user!.id).single()
    return data?.household_id
  }

  async function changeRole(memberId: string, role: Role) {
    setMemberLoading(memberId)
    setMemberError('')
    const res = await fetch('/api/household/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, role }),
    })
    const data = await res.json()
    if (!res.ok) { setMemberError(data.error); setMemberLoading(null); return }
    setMembers(ms => ms.map(m => m.id === memberId ? { ...m, role, is_owner: role === 'owner' } : m))
    setMemberLoading(null)
  }

  async function removeMember(memberId: string) {
    if (!confirm('Weet je zeker dat je dit lid wilt verwijderen?')) return
    setMemberLoading(memberId)
    setMemberError('')
    const res = await fetch('/api/household/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    })
    const data = await res.json()
    if (!res.ok) { setMemberError(data.error); setMemberLoading(null); return }
    setMembers(ms => ms.filter(m => m.id !== memberId))
    setMemberLoading(null)
  }

  async function addSource(name: string, url: string, type: Source['type']) {
    const supabase = createClient()
    const householdId = await getHouseholdId()
    const { data } = await supabase.from('sources').insert({ name, url, type, household_id: householdId }).select().single()
    if (data) setSources(s => [...s, data])
  }

  async function removeSource(id: string) {
    const supabase = createClient()
    setSources(s => s.filter(x => x.id !== id))
    await supabase.from('sources').delete().eq('id', id)
  }

  async function handleAddCustomSource(e: React.FormEvent) {
    e.preventDefault()
    if (!newSource.name.trim()) return
    await addSource(newSource.name, newSource.url, newSource.type)
    setNewSource({ name: '', url: '', type: 'website' })
    setShowAddSource(false)
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError('')
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const data = await res.json()
    if (!res.ok) { setInviteError(data.error); setInviting(false); return }
    setInviteSent(true)
    setInviting(false)
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ display_name: displayName }).eq('id', (await supabase.auth.getUser()).data.user!.id)
    setSaving(false)
  }

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/nl/login')
  }

  async function connectStore(e: React.FormEvent) {
    e.preventDefault()
    if (!storeForm) return
    setStoreLoading(storeForm.store)
    setStoreError('')
    const res = await fetch(`/api/stores/${storeForm.store}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: storeForm.email, password: storeForm.password }),
    })
    const data = await res.json()
    if (!res.ok) { setStoreError(data.error); setStoreLoading(null); return }
    setStoreConnections(sc => {
      const existing = sc.filter(s => s.store !== storeForm.store)
      return [...existing, { store: storeForm.store, last_synced_at: null }]
    })
    setStoreForm(null)
    setStoreLoading(null)
  }

  async function disconnectStore(store: string) {
    if (!confirm(`Weet je zeker dat je ${store === 'picnic' ? 'Picnic' : 'Albert Heijn'} wilt loskoppelen?`)) return
    setStoreLoading(store)
    await fetch(`/api/stores/${store}/connect`, { method: 'DELETE' })
    setStoreConnections(sc => sc.filter(s => s.store !== store))
    setStoreLoading(null)
  }

  async function syncStore(store: string) {
    setStoreLoading(store)
    setStoreError('')
    setSyncResult(null)
    const res = await fetch(`/api/stores/${store}/sync`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setStoreError(data.error); setStoreLoading(null); return }
    setStoreConnections(sc => sc.map(s => s.store === store ? { ...s, last_synced_at: new Date().toISOString() } : s))
    setSyncResult({ store, added: data.added })
    setStoreLoading(null)
    setTimeout(() => setSyncResult(null), 4000)
  }

  const STORES = [
    { id: 'picnic', label: 'Picnic', emoji: '🚲', color: 'bg-green-50 border-green-200' },
    { id: 'ah', label: 'Albert Heijn', emoji: '🏪', color: 'bg-blue-50 border-blue-200' },
  ]

  // Push notificaties
  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushError, setPushError] = useState('')
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null)

  // Converteer base64url VAPID key naar Uint8Array (vereist door browsers)
  function vapidKey() {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
    const padding = '='.repeat((4 - key.length % 4) % 4)
    const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = window.atob(base64)
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setPushSupported(supported)
    if (!supported) return

    navigator.serviceWorker.register('/sw.js').then(async reg => {
      swRegRef.current = reg
      const sub = await reg.pushManager.getSubscription()
      setPushEnabled(!!sub && Notification.permission === 'granted')
    }).catch(() => {})
  }, [])

  async function togglePush() {
    setPushLoading(true)
    setPushError('')
    try {
      let reg = swRegRef.current
      if (!reg) reg = await navigator.serviceWorker.register('/sw.js')
      swRegRef.current = reg

      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          })
        }
        setPushEnabled(false)
      } else {
        const perm = await Notification.requestPermission()
        if (perm === 'denied') {
          setPushError('Notificaties zijn geblokkeerd in je browser. Ga naar browserinstellingen om ze toe te staan.')
          setPushLoading(false)
          return
        }
        if (perm !== 'granted') { setPushLoading(false); return }

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey(),
        })
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub),
        })
        setPushEnabled(true)
      }
    } catch (e) {
      setPushError(e instanceof Error ? e.message : 'Kon notificaties niet inschakelen')
    }
    setPushLoading(false)
  }

  const [copySuccess, setCopySuccess] = useState(false)
  const [householdName, setHouseholdName] = useState(profile.household?.name ?? '')
  const [savingHousehold, setSavingHousehold] = useState(false)
  const sourceIds = sources.map(s => s.name)

  async function saveHouseholdName(e: React.FormEvent) {
    e.preventDefault()
    if (!householdName.trim()) return
    setSavingHousehold(true)
    const supabase = createClient()
    await supabase.from('households').update({ name: householdName.trim() }).eq('id', profile.household_id)
    setSavingHousehold(false)
  }

  async function copyInviteLink() {
    setInviting(true)
    setInviteError('')
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: null }),
    })
    const data = await res.json()
    if (!res.ok) { setInviteError(data.error); setInviting(false); return }
    await navigator.clipboard.writeText(data.inviteUrl)
    setCopySuccess(true)
    setInviting(false)
    setTimeout(() => setCopySuccess(false), 3000)
  }

  return (
    <div className="px-4 pt-10 pb-8 space-y-6">
      <h1 className="text-2xl font-semibold">Instellingen</h1>

      {/* Profile */}
      <section className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Profiel</h2>
        <p className="text-xs text-stone-400">{email}</p>
        <form onSubmit={saveProfile} className="flex gap-2">
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Jouw naam"
            className="flex-1 px-4 py-2.5 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button type="submit" disabled={saving} className="px-4 py-2.5 bg-orange-500 text-white text-sm rounded-2xl disabled:opacity-50">
            {saving ? '...' : 'Opslaan'}
          </button>
        </form>
      </section>

      {/* Favoriete bronnen */}
      <section className="bg-white rounded-2xl border border-stone-100 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Favoriete bronnen</h2>

        {/* Suggesties per categorie */}
        {SOURCE_CATEGORIES.map(cat => (
          <div key={cat}>
            <p className="text-xs text-stone-400 mb-2">{cat}</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_SOURCES.filter(s => s.category === cat).map(s => {
                const active = sourceIds.includes(s.name)
                return (
                  <button
                    key={s.name}
                    onClick={() => active
                      ? removeSource(sources.find(x => x.name === s.name)!.id)
                      : addSource(s.name, s.url, s.type)
                    }
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      active ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-stone-600 border-stone-200 hover:border-orange-300'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}{s.name}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Toegevoegde bronnen */}
        {sources.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-stone-400">Jouw bronnen</p>
            {sources.map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm bg-stone-50 rounded-xl px-3 py-2">
                <div>
                  <span className="font-medium">{s.name}</span>
                  {s.url && <span className="text-stone-400 text-xs ml-2">{s.url}</span>}
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    s.type === 'cookbook' ? 'bg-blue-100 text-blue-600' :
                    s.type === 'instagram' ? 'bg-pink-100 text-pink-600' :
                    'bg-stone-100 text-stone-500'
                  }`}>
                    {s.type === 'cookbook' ? 'Kookboek' : s.type === 'instagram' ? 'Instagram' : 'Website'}
                  </span>
                </div>
                <button onClick={() => removeSource(s.id)} className="text-stone-300 hover:text-red-400 ml-2">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Custom toevoegen */}
        {showAddSource ? (
          <form onSubmit={handleAddCustomSource} className="space-y-2 border-t border-stone-100 pt-3">
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                placeholder="Naam (bijv. Pien laat zien)"
                value={newSource.name}
                onChange={e => setNewSource(n => ({ ...n, name: e.target.value }))}
                className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
              />
              <select
                value={newSource.type}
                onChange={e => setNewSource(n => ({ ...n, type: e.target.value as Source['type'] }))}
                className="px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="website">Website</option>
                <option value="instagram">Instagram</option>
                <option value="cookbook">Kookboek</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="URL (optioneel)"
              value={newSource.url}
              onChange={e => setNewSource(n => ({ ...n, url: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAddSource(false)} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm text-stone-500">Annuleren</button>
              <button type="submit" className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-sm">Toevoegen</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowAddSource(true)}
            className="w-full py-2 border border-dashed border-stone-200 rounded-xl text-sm text-stone-400 hover:border-orange-300 hover:text-orange-400 transition-colors"
          >
            + Eigen bron toevoegen
          </button>
        )}
      </section>

      {/* Household */}
      <section className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Huishouden</h2>
        {myRole === 'owner' && (
          <form onSubmit={saveHouseholdName} className="flex gap-2">
            <input
              type="text"
              value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              placeholder="Naam van het huishouden"
              className="flex-1 px-4 py-2.5 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button type="submit" disabled={savingHousehold || !householdName.trim()} className="px-4 py-2.5 bg-orange-500 text-white text-sm rounded-2xl disabled:opacity-50">
              {savingHousehold ? '...' : 'Opslaan'}
            </button>
          </form>
        )}
        {!householdName && myRole !== 'owner' && (
          <p className="text-sm text-stone-500">{householdName || 'Geen naam'}</p>
        )}
        <div className="space-y-2">
          {memberError && <p className="text-xs text-red-500">{memberError}</p>}
          {members.map(m => {
            const isMe = m.id === myId
            const isLoading = memberLoading === m.id
            const memberRole = (m.role ?? (m.is_owner ? 'owner' : 'member')) as Role
            return (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600 shrink-0">
                  {(m.display_name ?? '?')[0].toUpperCase()}
                </div>
                <span className="flex-1 truncate">{m.display_name ?? 'Naamloos'}{isMe && ' (jij)'}</span>
                {/* Rollen beheren — alleen eigenaar, niet voor zichzelf */}
                {myRole === 'owner' && !isMe ? (
                  <select
                    value={memberRole}
                    disabled={isLoading}
                    onChange={e => changeRole(m.id, e.target.value as Role)}
                    className="text-xs border border-stone-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
                  >
                    <option value="owner">Eigenaar</option>
                    <option value="member">Lid</option>
                    <option value="viewer">Kijker</option>
                  </select>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[memberRole] ?? 'bg-stone-100 text-stone-500'}`}>
                    {ROLE_LABELS[memberRole] ?? memberRole}
                  </span>
                )}
                {myRole === 'owner' && !isMe && (
                  <button
                    onClick={() => removeMember(m.id)}
                    disabled={isLoading}
                    className="text-stone-300 hover:text-red-400 transition-colors disabled:opacity-50 text-lg leading-none"
                    title="Verwijder lid"
                  >
                    {isLoading ? '…' : '×'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Invite */}
      <section className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Iemand uitnodigen</h2>
        <p className="text-xs text-stone-400">Deel een link of stuur een uitnodiging via e-mail. Iedereen met de link kan lid worden van jouw huishouden.</p>

        {/* Link kopiëren */}
        <button
          onClick={copyInviteLink}
          disabled={inviting}
          className="w-full py-2.5 bg-stone-100 text-stone-700 text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-stone-200 transition-colors disabled:opacity-50"
        >
          {copySuccess ? '✓ Link gekopieerd!' : inviting ? '...' : '🔗 Kopieer uitnodigingslink'}
        </button>

        <div className="flex items-center gap-2 text-xs text-stone-400">
          <div className="flex-1 h-px bg-stone-100" />
          <span>of via e-mail</span>
          <div className="flex-1 h-px bg-stone-100" />
        </div>

        {inviteSent ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
            ✓ Uitnodiging verstuurd naar {inviteEmail}
          </div>
        ) : (
          <form onSubmit={sendInvite} className="space-y-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="E-mailadres"
              className="w-full px-4 py-2.5 rounded-2xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
            />
            {inviteError && <p className="text-red-500 text-xs">{inviteError}</p>}
            <button
              type="submit"
              disabled={inviting || !inviteEmail}
              className="w-full py-2.5 bg-orange-500 text-white text-sm rounded-2xl disabled:opacity-50 hover:bg-orange-600 transition-colors"
            >
              {inviting ? '...' : 'Uitnodiging versturen'}
            </button>
          </form>
        )}
      </section>

      {/* Winkelkoppelingen */}
      <section className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Winkelkoppelingen</h2>
          <p className="text-xs text-stone-400 mt-1">Koppel je winkel om na aankopen automatisch je pantry bij te werken.</p>
        </div>

        {storeError && <p className="text-xs text-red-500">{storeError}</p>}
        {syncResult && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700">
            ✓ {syncResult.added} {syncResult.added === 1 ? 'product' : 'producten'} toegevoegd aan pantry
            {syncResult.added === 0 && ' — al up-to-date'}
          </div>
        )}

        <div className="space-y-2">
          {STORES.map(s => {
            const conn = storeConnections.find(c => c.store === s.id)
            const isLoading = storeLoading === s.id
            const isFormOpen = storeForm?.store === s.id

            return (
              <div key={s.id} className={`rounded-xl border p-3 ${conn ? s.color : 'bg-stone-50 border-stone-100'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{s.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{s.label}</p>
                      {conn?.last_synced_at && (
                        <p className="text-xs text-stone-400">
                          Gesynchroniseerd {new Date(conn.last_synced_at).toLocaleDateString('nl-NL')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {conn ? (
                      <>
                        <button
                          onClick={() => syncStore(s.id)}
                          disabled={isLoading}
                          className="text-xs px-3 py-1.5 bg-white border border-stone-200 rounded-full hover:border-orange-300 transition-colors disabled:opacity-50"
                        >
                          {isLoading ? '...' : 'Sync'}
                        </button>
                        <button
                          onClick={() => disconnectStore(s.id)}
                          disabled={isLoading}
                          className="text-stone-300 hover:text-red-400 transition-colors text-lg leading-none"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setStoreForm(isFormOpen ? null : { store: s.id, email: '', password: '' })}
                        className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors"
                      >
                        Koppelen
                      </button>
                    )}
                  </div>
                </div>

                {isFormOpen && (
                  <form onSubmit={connectStore} className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                    <input
                      type="email"
                      placeholder={`${s.label} e-mailadres`}
                      value={storeForm!.email}
                      onChange={e => setStoreForm(f => f ? { ...f, email: e.target.value } : f)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <input
                      type="password"
                      placeholder="Wachtwoord"
                      value={storeForm!.password}
                      onChange={e => setStoreForm(f => f ? { ...f, password: e.target.value } : f)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <p className="text-xs text-stone-400">Je wachtwoord wordt nooit opgeslagen — alleen het inlogtoken.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setStoreForm(null)} className="flex-1 py-2 border border-stone-200 rounded-xl text-sm text-stone-500">Annuleren</button>
                      <button type="submit" disabled={isLoading} className="flex-1 py-2 bg-orange-500 text-white rounded-xl text-sm disabled:opacity-50">
                        {isLoading ? 'Verbinden...' : 'Verbinden'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Notificaties */}
      {pushSupported && (
        <section className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide">Notificaties</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Timer-meldingen</p>
              <p className="text-xs text-stone-400 mt-0.5">Melding als een timer afloopt, ook als het scherm uit is</p>
            </div>
            <button
              onClick={togglePush}
              disabled={pushLoading}
              className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${pushEnabled ? 'bg-orange-500' : 'bg-stone-200'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pushEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {pushLoading && (
            <p className="text-xs text-stone-400 bg-stone-50 rounded-xl px-3 py-2">
              ⏳ Bezig...
            </p>
          )}
          {pushError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">
              ⚠️ {pushError}
            </p>
          )}
          {pushEnabled && !pushLoading && (
            <p className="text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2">
              ✓ Notificaties ingeschakeld voor dit apparaat
            </p>
          )}
        </section>
      )}

      <button
        onClick={logout}
        className="w-full py-3 border border-stone-200 rounded-2xl text-sm text-stone-500 hover:bg-stone-50 transition-colors"
      >
        Uitloggen
      </button>
    </div>
  )
}
