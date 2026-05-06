'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function JoinClient({ token, householdName, locale }: { token: string; householdName: string; locale: string }) {
  const router = useRouter()
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin() {
    setJoining(true)
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Niet ingelogd'); setJoining(false); return }

    const { data: invite } = await supabase
      .from('invites')
      .select('household_id')
      .eq('token', token)
      .eq('accepted', false)
      .single()

    if (!invite) { setError('Uitnodiging niet meer geldig'); setJoining(false); return }

    // Get current (auto-created) household to delete later
    const { data: currentProfile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
    const oldHouseholdId = currentProfile?.household_id

    // Join the new household
    await supabase.from('profiles').update({
      household_id: invite.household_id,
      is_owner: false,
    }).eq('id', user.id)

    // Mark invite accepted
    await supabase.from('invites').update({ accepted: true }).eq('token', token)

    // Delete the auto-created empty household
    if (oldHouseholdId && oldHouseholdId !== invite.household_id) {
      await supabase.from('households').delete().eq('id', oldHouseholdId)
    }

    router.push(`/${locale}`)
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
