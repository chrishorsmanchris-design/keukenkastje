'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function JoinClient({ token, householdName, locale }: { token: string; householdName: string; locale: string }) {
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin() {
    setJoining(true)
    setError('')
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Niet ingelogd — log eerst in.'); setJoining(false); return }

    const { data: invite } = await supabase
      .from('invites')
      .select('household_id')
      .eq('token', token)
      .single()

    if (!invite) { setError('Uitnodiging ongeldig.'); setJoining(false); return }

    // Al lid van dit huishouden
    const { data: currentProfile } = await supabase
      .from('profiles').select('household_id').eq('id', user.id).single()
    const oldHouseholdId = currentProfile?.household_id

    if (oldHouseholdId === invite.household_id) {
      window.location.href = `/${locale}`
      return
    }

    // Join: upsert zodat het werkt óók als er nog geen profielrij bestaat
    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(
        { id: user.id, household_id: invite.household_id, is_owner: false, role: 'member' },
        { onConflict: 'id' }
      )

    if (upsertError) {
      setError(`Aanmelden mislukt: ${upsertError.message}`)
      setJoining(false)
      return
    }

    // Verify dat de upsert écht is doorgekomen
    const { data: updatedProfile } = await supabase
      .from('profiles').select('household_id').eq('id', user.id).single()

    if (updatedProfile?.household_id !== invite.household_id) {
      setError('Aanmelden mislukt: profiel kon niet worden bijgewerkt. Controleer de INSERT/UPDATE policies op de profiles tabel.')
      setJoining(false)
      return
    }

    // Uitnodiging markeren als gebruikt
    await supabase.from('invites').update({ accepted: true }).eq('token', token)

    // Leeg oud huishouden verwijderen
    if (oldHouseholdId && oldHouseholdId !== invite.household_id) {
      await supabase.from('households').delete().eq('id', oldHouseholdId)
    }

    // Volledige reload zodat server fresh household-data ophaalt
    window.location.href = `/${locale}`
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="text-5xl">🏠</div>
        <div>
          <h1 className="text-xl font-semibold">Je bent uitgenodigd!</h1>
          <p className="text-stone-500 text-sm mt-2">
            Sluit je aan bij <span className="font-medium text-stone-800">{householdName}</span> en kook samen.
          </p>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full py-3.5 bg-orange-500 text-white font-medium rounded-2xl hover:bg-orange-600 transition-colors disabled:opacity-50"
        >
          {joining ? 'Aanmelden...' : 'Aanmelden bij huishouden'}
        </button>
      </div>
    </div>
  )
}
