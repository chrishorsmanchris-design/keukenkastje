import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function GeschiedenisPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()

  const today = new Date().toISOString().split('T')[0]
  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  const { data: items } = await supabase
    .from('week_menu')
    .select('date, servings, recipe:recipes(id, title, image_url, cuisine, prep_time_minutes, cook_time_minutes)')
    .lt('date', today)
    .gte('date', eightWeeksAgo.toISOString().split('T')[0])
    .not('recipe_id', 'is', null)
    .order('date', { ascending: false })

  const CUISINE_FLAGS: Record<string, string> = {
    'Italiaans': '🇮🇹', 'Midden-Oosters': '🫙', 'Aziatisch': '🇯🇵',
    'Nederlands': '🇳🇱', 'Mexicaans': '🇲🇽', 'Frans': '🇫🇷', 'Amerikaans': '🇺🇸',
  }

  // Group by week label
  const weeks: Record<string, typeof items> = {}
  for (const item of items ?? []) {
    const d = new Date(item.date)
    const monday = new Date(d)
    monday.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1))
    const label = monday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
    const key = `Week van ${label}`
    if (!weeks[key]) weeks[key] = []
    weeks[key]!.push(item)
  }

  return (
    <div className="px-4 pt-10 pb-20 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/weekmenu`} className="text-stone-400">←</Link>
        <h1 className="text-2xl font-semibold">Maaltijdgeschiedenis</h1>
      </div>

      {Object.keys(weeks).length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-sm">Nog geen geschiedenis</p>
          <p className="text-xs mt-1">Plan je weekmenu om hier maaltijden te zien</p>
        </div>
      ) : (
        Object.entries(weeks).map(([week, entries]) => (
          <div key={week}>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">{week}</p>
            <div className="space-y-2">
              {entries!.map((entry, i) => {
                const recipe = entry.recipe as { id: string; title: string; image_url?: string; cuisine?: string } | null
                if (!recipe) return null
                const d = new Date(entry.date)
                const dayName = d.toLocaleDateString('nl-NL', { weekday: 'long' })
                return (
                  <Link
                    key={i}
                    href={`/${locale}/recepten/${recipe.id}`}
                    className="flex items-center gap-3 bg-white rounded-2xl border border-stone-100 p-3 hover:shadow-sm transition-shadow"
                  >
                    {recipe.image_url ? (
                      <img src={recipe.image_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center text-xl flex-shrink-0">🍽️</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium capitalize">{dayName}</p>
                      <p className="text-sm text-stone-600 truncate">{recipe.title}</p>
                      {recipe.cuisine && (
                        <p className="text-xs text-stone-400">{CUISINE_FLAGS[recipe.cuisine]} {recipe.cuisine}</p>
                      )}
                    </div>
                    <span className="text-xs text-stone-300 ml-auto flex-shrink-0">{entry.servings}p</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
