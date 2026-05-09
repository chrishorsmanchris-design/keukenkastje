import { createClient } from '@/lib/supabase/server'
import BoodschappenClient from './BoodschappenClient'

export const dynamic = 'force-dynamic'

export default async function BoodschappenlijstPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('household_id, role').eq('id', user!.id).single()
  const householdId = profile?.household_id ?? ''
  const role = profile?.role ?? 'member'

  const { data: items } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('household_id', householdId)
    .order('category', { ascending: true, nullsFirst: false })
    .order('created_at')

  return <BoodschappenClient initialItems={items ?? []} householdId={householdId} role={role} />
}
