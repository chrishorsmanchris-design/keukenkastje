import { createClient } from '@/lib/supabase/server'
import WeekmenuClient from './WeekmenuClient'

export const dynamic = 'force-dynamic'

function getWeekDates() {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

export default async function WeekmenuPage() {
  const supabase = await createClient()
  const dates = getWeekDates()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('household_id, role').eq('id', user!.id).single()
  const [{ data: menuItems }, { data: recipes }, { data: members }] = await Promise.all([
    supabase
      .from('week_menu')
      .select('*, recipe:recipes(*)')
      .in('date', dates)
      .eq('meal_type', 'dinner')
      .eq('household_id', profile?.household_id ?? ''),
    supabase
      .from('recipes')
      .select('id, title, image_url, cuisine, servings')
      .order('title'),
    supabase
      .from('profiles')
      .select('id, display_name')
      .eq('household_id', profile?.household_id ?? '')
      .order('display_name'),
  ])

  return <WeekmenuClient menuItems={menuItems ?? []} recipes={recipes ?? []} dates={dates} householdId={profile?.household_id ?? ''} role={profile?.role ?? 'member'} members={(members ?? []).map(m => ({ id: m.id, name: m.display_name ?? 'Onbekend' }))} />
}
