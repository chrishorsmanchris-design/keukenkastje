import { createClient } from '@/lib/supabase/server'
import ReceptenClient from './ReceptenClient'

export default async function ReceptenPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user!.id)
    .single()

  const [{ data: recipes }, { data: pantry }] = await Promise.all([
    supabase
      .from('recipes')
      .select('*')
      .eq('household_id', profile?.household_id ?? '')
      .order('title'),
    supabase
      .from('pantry_items')
      .select('name, quantity')
      .eq('household_id', profile?.household_id ?? ''),
  ])

  return <ReceptenClient recipes={recipes ?? []} pantry={pantry ?? []} />
}
