import { createClient } from '@/lib/supabase/server'
import ReceptenClient from './ReceptenClient'

export default async function ReceptenPage() {
  const supabase = await createClient()
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false })

  return <ReceptenClient recipes={recipes ?? []} />
}
