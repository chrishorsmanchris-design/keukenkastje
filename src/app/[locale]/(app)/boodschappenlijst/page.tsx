import { createClient } from '@/lib/supabase/server'
import BoodschappenClient from './BoodschappenClient'

export default async function BoodschappenlijstPage() {
  const supabase = await createClient()
  const { data: items } = await supabase
    .from('shopping_items')
    .select('*')
    .order('category', { ascending: true, nullsFirst: false })
    .order('created_at')

  return <BoodschappenClient initialItems={items ?? []} />
}
