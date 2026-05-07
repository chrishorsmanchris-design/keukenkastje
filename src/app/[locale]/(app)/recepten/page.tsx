import { createClient } from '@/lib/supabase/server'
import ReceptenClient from './ReceptenClient'

export default async function ReceptenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return <ReceptenClient recipes={recipes ?? []} />
}
