'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Profile = { household_id: string; display_name: string; is_owner: boolean; locale: string; household: { name: string } }
type Member = { id: string; display_name: string; is_owner: boolean }
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
  profile, members, sources: initialSources, email,
}: {
  profile: Profile
  members: Member[]
  sources: Source[]
  email: string
}) {
  const router = useRouter()
  const [sources, setSources] = useState<Source[]>(initialSources)
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
    const { data } = await supabase.from('profiles').select('household_id').single()
    return data?.household_id
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

  const [copySuccess, setCopySuccess] = useState(false)
  const sourceIds = sources.map(s => s.name)

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
        <p className="font-medium">{profile.household?.name}</p>
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-2 text-sm">
              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">
                {(m.display_name ?? '?')[0].toUpperCase()}
              </div>
              <span>{m.display_name ?? 'Naamloos'}</span>
              {m.is_owner && <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Eigenaar</span>}
            </div>
          ))}
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

      <button
        onClick={logout}
        className="w-full py-3 border border-stone-200 rounded-2xl text-sm text-stone-500 hover:bg-stone-50 transition-colors"
      >
        Uitloggen
      </button>
    </div>
  )
}
