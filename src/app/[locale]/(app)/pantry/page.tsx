import { createClient } from '@/lib/supabase/server'
import PantryClient from './PantryClient'

export default async function PantryPage() {
  const supabase = await createClient()
  const { data: items } = await supabase
    .from('pantry_items')
    .select('*')
    .order('expires_at', { ascending: true, nullsFirst: false })

  return <PantryClient initialItems={items ?? []} />
}
