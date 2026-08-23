import { createClient } from '@/lib/supabase/server'
import { analyseerWeek, bevindingen, type Maaltijd } from '@/lib/schijf-van-vijf'
import AnalyseClient from './AnalyseClient'

export const dynamic = 'force-dynamic'

function datumReeks(vanOffset: number, aantal: number): string[] {
  return Array.from({ length: aantal }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + vanOffset + i)
    return d.toISOString().split('T')[0]
  })
}

export default async function AnalysePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()

  // Terugkijken: de zes dagen vóór vandaag plus vandaag.
  const terugDates = datumReeks(-6, 7)
  // Vooruitkijken: vandaag plus de zes dagen erna. Vandaag zit bewust in
  // allebei — het is zowel de dag die net (bijna) voorbij is als de eerste dag
  // die je nog kunt veranderen.
  const vooruitDates = datumReeks(0, 7)
  const alleDates = [...new Set([...terugDates, ...vooruitDates])]

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('household_id').eq('id', user!.id).single()
  const householdId = profile?.household_id ?? ''

  const [{ data: menuRows }, { data: bought }] = await Promise.all([
    supabase
      .from('week_menu')
      .select('date, meal_type, recipe:recipes(title, ingredients, cuisine, servings)')
      .in('date', alleDates)
      .eq('household_id', householdId),
    // Afgevinkte boodschappen van deze week: het bewijs van wat er écht in huis
    // kwam op dagen waarop niets gepland stond.
    supabase
      .from('shopping_items')
      .select('name, checked_at')
      .eq('household_id', householdId)
      .eq('checked', true)
      .gte('checked_at', `${terugDates[0]}T00:00:00`),
  ])

  type Row = {
    date: string
    meal_type: string | null
    recipe: {
      title: string
      ingredients: unknown
      cuisine: string | null
      servings: number | null
    } | null
  }

  const alleMaaltijden: Maaltijd[] = ((menuRows ?? []) as unknown as Row[])
    .filter(r => r.recipe)
    .map(r => ({
      date: r.date,
      title: r.recipe!.title,
      cuisine: r.recipe!.cuisine,
      servings: r.recipe!.servings ?? 2,
      ingredients: Array.isArray(r.recipe!.ingredients)
        ? (r.recipe!.ingredients as { name: string; amount?: string; unit?: string }[])
            .filter(i => i?.name)
        : [],
    }))

  const binnen = (dates: string[]) => {
    const set = new Set(dates)
    return alleMaaltijden.filter(m => set.has(m.date))
  }

  const terugMaaltijden = binnen(terugDates)
  const vooruitMaaltijden = binnen(vooruitDates)

  const terugAnalyse = analyseerWeek(terugMaaltijden, terugDates.length)
  const vooruitAnalyse = analyseerWeek(vooruitMaaltijden, vooruitDates.length)

  return (
    <AnalyseClient
      locale={locale}
      terug={{
        analyse: terugAnalyse,
        bevindingen: bevindingen(terugAnalyse, 'terug'),
        maaltijden: terugMaaltijden,
        dates: terugDates,
      }}
      vooruit={{
        analyse: vooruitAnalyse,
        bevindingen: bevindingen(vooruitAnalyse, 'vooruit'),
        maaltijden: vooruitMaaltijden,
        dates: vooruitDates,
      }}
      gekocht={(bought ?? []).map(b => ({ name: b.name as string }))}
    />
  )
}
