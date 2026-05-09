import { createClient } from '@/lib/supabase/server'
import PantryClient from './PantryClient'

export const dynamic = 'force-dynamic'

export default async function PantryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user!.id).single()
  const householdId = profile?.household_id ?? ''

  const { data: items } = await supabase
    .from('pantry_items')
    .select('*')
    .eq('household_id', householdId)
    .order('expires_at', { ascending: true, nullsFirst: false })

  return <PantryClient initialItems={items ?? []} householdId={householdId} />
}
