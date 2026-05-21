import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { ids } = await req.json() as { ids: string[] }
  if (!ids?.length) return NextResponse.json({ error: 'Geen IDs' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!profile?.household_id) return NextResponse.json({ error: 'Geen huishouden' }, { status: 400 })

  const admin = createAdminClient()
  const validIds = ids.filter(id => id.match(/^[0-9a-f-]{36}$/i)).slice(0, 20)

  const { data: originals } = await admin
    .from('recipes')
    .select('title, description, image_url, servings, prep_time_minutes, cook_time_minutes, cuisine, ingredient_type, diet_labels, ingredients, steps, notes')
    .in('id', validIds)

  if (!originals?.length) return NextResponse.json({ error: 'Recepten niet gevonden' }, { status: 404 })

  const { data: inserted, error } = await admin
    .from('recipes')
    .insert(
      originals.map(r => ({
        ...r,
        household_id: profile.household_id,
        user_id: user.id,
        is_favorite: false,
      }))
    )
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: inserted?.length ?? 0 })
}
