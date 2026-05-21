import { createAdminClient } from '@/lib/supabase/admin'
import ShareClient from './ShareClient'

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const { ids } = await searchParams
  if (!ids) return <div className="p-8 text-center text-stone-400">Geen recepten gevonden in deze link.</div>

  const idList = ids.split(',').filter(id => id.match(/^[0-9a-f-]{36}$/i)).slice(0, 20)
  if (!idList.length) return <div className="p-8 text-center text-stone-400">Ongeldige link.</div>

  const supabase = createAdminClient()
  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, title, description, image_url, servings, prep_time_minutes, cook_time_minutes, cuisine, ingredient_type, diet_labels, ingredients, steps')
    .in('id', idList)

  if (!recipes?.length) return <div className="p-8 text-center text-stone-400">Recepten niet gevonden of verwijderd.</div>

  return <ShareClient recipes={recipes} ids={idList} />
}
