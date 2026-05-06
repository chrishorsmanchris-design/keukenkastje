import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InstellingenClient from './InstellingenClient'

export default async function InstellingenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/nl/login')

  const [{ data: profile }, { data: members }, { data: sources }] = await Promise.all([
    supabase.from('profiles').select('*, household:households(name)').eq('id', user.id).single(),
    supabase.from('profiles').select('id, display_name, is_owner').eq('household_id',
      (await supabase.from('profiles').select('household_id').eq('id', user.id).single()).data?.household_id
    ),
    supabase.from('sources').select('*').order('created_at'),
  ])

  return (
    <InstellingenClient
      profile={profile}
      members={members ?? []}
      sources={sources ?? []}
      email={user.email ?? ''}
    />
  )
}
