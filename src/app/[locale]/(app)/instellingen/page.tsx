import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstellingenClient from './InstellingenClient'

export default async function InstellingenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/nl/login')

  const { data: myProfile } = await supabase
    .from('profiles').select('household_id, role').eq('id', user.id).single()
  const householdId = myProfile?.household_id

  const [{ data: profile }, { data: members }, { data: sources }, { data: storeConnections }] = await Promise.all([
    supabase.from('profiles').select('*, household:households(name)').eq('id', user.id).single(),
    householdId
      ? supabase.from('profiles').select('id, display_name, is_owner, role').eq('household_id', householdId)
      : Promise.resolve({ data: [] }),
    supabase.from('sources').select('*').order('created_at'),
    householdId
      ? supabase.from('store_connections').select('store, last_synced_at').eq('household_id', householdId)
      : Promise.resolve({ data: [] }),
  ])

  return (
    <InstellingenClient
      profile={profile}
      members={members ?? []}
      sources={sources ?? []}
      email={user.email ?? ''}
      myRole={myProfile?.role ?? 'member'}
      myId={user.id}
      storeConnections={storeConnections ?? []}
    />
  )
}
