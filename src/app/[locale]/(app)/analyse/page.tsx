import { createClient } from '@/lib/supabase/server'
import { analyseerWeek, bevindingen, type Maaltijd } from '@/lib/schijf-van-vijf'
import AnalyseClient from './AnalyseClient'

export const dynamic = 'force-dynamic'

/** De afgelopen 7 dagen, inclusief vandaag. */
function afgelopenWeek(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return d.toISOString().split('T')[0]
  }).reverse()
}

export default async function AnalysePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()
  const dates = afgelopenWeek()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('household_id').eq('id', user!.id).single()
  const householdId = profile?.household_id ?? ''

  const [{ data: menuRows }, { data: bought }] = await Promise.all([
    supabase
      .from('week_menu')
      .select('date, meal_type, recipe:recipes(title, ingredients, cuisine)')
      .in('date', dates)
      .eq('household_id', householdId),
    // Afgevinkte boodschappen van deze week: het bewijs van wat er écht in huis
    // kwam op dagen waarop niets gepland stond.
    supabase
      .from('shopping_items')
      .select('name, checked_at')
      .eq('household_id', householdId)
      .eq('checked', true)
      .gte('checked_at', `${dates[0]}T00:00:00`),
  ])

  type Row = {
    date: string
    meal_type: string | null
    recipe: { title: string; ingredients: unknown; cuisine: string | null } | null
  }

  const maaltijden: Maaltijd[] = ((menuRows ?? []) as unknown as Row[])
    .filter(r => r.recipe)
    .map(r => ({
      date: r.date,
      title: r.recipe!.title,
      cuisine: r.recipe!.cuisine,
      ingredients: Array.isArray(r.recipe!.ingredients)
        ? (r.recipe!.ingredients as { name: string }[]).filter(i => i?.name)
        : [],
    }))

  const analyse = analyseerWeek(maaltijden, dates.length)
  const punten = bevindingen(analyse)

  const gekocht = (bought ?? []).map(b => ({ name: b.name as string }))

  return (
    <AnalyseClient
      locale={locale}
      analyse={analyse}
      bevindingen={punten}
      maaltijden={maaltijden}
      gekocht={gekocht}
      dates={dates}
    />
  )
}
