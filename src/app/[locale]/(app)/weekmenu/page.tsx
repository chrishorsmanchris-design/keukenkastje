import { createClient } from '@/lib/supabase/server'
import WeekmenuClient from './WeekmenuClient'

function getWeekDates() {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })
}

export default async function WeekmenuPage() {
  const supabase = await createClient()
  const dates = getWeekDates()

  // Haal alle huishoudenleden op
  const { data: profile } = await supabase.from('profiles').select('household_id').single()
  const { data: householdMembers } = await supabase
    .from('profiles')
    .select('id')
    .eq('household_id', profile?.household_id)
  const memberIds = (householdMembers ?? []).map(m => m.id)

  const [{ data: menuItems }, { data: recipes }] = await Promise.all([
    supabase
      .from('week_menu')
      .select('*, recipe:recipes(*)')
      .in('date', dates)
      .eq('meal_type', 'dinner'),
    supabase
      .from('recipes')
      .select('id, title, image_url, cuisine, servings, user_id')
      .in('user_id', memberIds.length ? memberIds : ['none'])
      .order('title'),
  ])

  return <WeekmenuClient menuItems={menuItems ?? []} recipes={recipes ?? []} dates={dates} />
}
