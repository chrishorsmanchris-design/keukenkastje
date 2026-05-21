import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Publiek endpoint — haalt recepten op via service role (bypasses RLS)
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get('ids')
  if (!ids) return NextResponse.json({ error: 'Geen IDs' }, { status: 400 })

  const idList = ids.split(',').filter(id => id.match(/^[0-9a-f-]{36}$/i)).slice(0, 20)
  if (!idList.length) return NextResponse.json({ error: 'Ongeldige IDs' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('id, title, description, image_url, servings, prep_time_minutes, cook_time_minutes, cuisine, ingredient_type, diet_labels, ingredients, steps')
    .in('id', idList)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ recipes: recipes ?? [] })
}
