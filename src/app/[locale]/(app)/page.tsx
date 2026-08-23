import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AISuggestieWidget from './AISuggestieWidget'

// Z M D W D V Z  (indexed by JS getDay(), 0 = Sunday)
const DAY_LETTERS = ['Z', 'M', 'D', 'W', 'D', 'V', 'Z']

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Goedemorgen'
  if (hour < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const todayDate = new Date().toISOString().split('T')[0]
  const inThreeDays = new Date()
  inThreeDays.setDate(inThreeDays.getDate() + 3)

  const [{ data: profile }, weekMenuResult, { data: expiring }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, household:households(name)')
      .eq('id', user!.id)
      .single(),
    (async () => {
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() + i)
        return d.toISOString().split('T')[0]
      })
      const { data } = await supabase
        .from('week_menu')
        .select('date, meal_type, servings, cook_name, recipe:recipes(id, title, image_url, prep_time_minutes, cook_time_minutes)')
        .in('date', weekDates)
      const dinners = (data ?? []).filter((m) => m.meal_type === 'dinner')
      return {
        dates: weekDates,
        planned: new Set(dinners.map((m: { date: string }) => m.date)),
        today: (data ?? []).find((m) => m.date === weekDates[0] && m.meal_type === 'dinner') ?? null,
      }
    })(),
    supabase
      .from('pantry_items')
      .select('id, name, expires_at')
      .not('expires_at', 'is', null)
      .lte('expires_at', inThreeDays.toISOString().split('T')[0])
      .order('expires_at', { ascending: true }),
  ])

  const name = profile?.display_name?.split(' ')[0] ?? ''
  const householdName = (profile?.household as { name?: string } | null)?.name ?? ''
  const greeting = getGreeting()
  const today = todayDate
  const { dates: weekDates, planned: plannedDates, today: tonight } = weekMenuResult
  const plannedCount = plannedDates.size

  const tonightRecipe = (tonight?.recipe ?? null) as {
    id: string; title: string; image_url?: string
    prep_time_minutes?: number; cook_time_minutes?: number
  } | null
  const tonightTime =
    (tonightRecipe?.prep_time_minutes ?? 0) + (tonightRecipe?.cook_time_minutes ?? 0)

  const expiringSoon = expiring ?? []

  return (
    <div className="px-4 pt-12 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{greeting}{name ? `, ${name}` : ''} 👋</h1>
          {householdName ? (
            <p className="text-stone-500 text-sm mt-1">🏠 {householdName}</p>
          ) : (
            <p className="text-stone-500 text-sm mt-1">Wat kook je vanavond?</p>
          )}
        </div>
        <Link
          href={`/${locale}/instellingen`}
          className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors"
        >
          ⚙️
        </Link>
      </div>

      {/* Vanavond eten we... — de vraag waarvoor je de app 's middags opent */}
      {tonightRecipe ? (
        <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
          <Link href={`/${locale}/recepten/${tonightRecipe.id}`} className="flex gap-3 p-3">
            {tonightRecipe.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tonightRecipe.image_url}
                alt=""
                className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-orange-50 flex items-center justify-center text-3xl flex-shrink-0">
                🍽️
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-orange-500 uppercase tracking-wide">Vanavond</p>
              <p className="font-semibold leading-tight mt-0.5 truncate">{tonightRecipe.title}</p>
              <p className="text-stone-500 text-xs mt-1">
                {tonightTime > 0 && `⏱️ ${tonightTime} min`}
                {tonightTime > 0 && tonight?.servings ? ' · ' : ''}
                {tonight?.servings ? `${tonight.servings} personen` : ''}
              </p>
              {tonight?.cook_name && (
                <p className="text-stone-500 text-xs mt-0.5">👤 {tonight.cook_name} kookt</p>
              )}
            </div>
          </Link>
          <Link
            href={`/${locale}/recepten/${tonightRecipe.id}?kookstand=1`}
            className="block bg-orange-500 text-white text-center text-sm font-medium py-3 hover:bg-orange-600 transition-colors"
          >
            Start koken →
          </Link>
        </div>
      ) : (
        <Link
          href={`/${locale}/weekmenu`}
          className="block bg-white border border-dashed border-stone-300 rounded-2xl p-4 text-center hover:border-orange-300 transition-colors"
        >
          <p className="text-2xl">🍽️</p>
          <p className="font-medium text-sm mt-1">Nog niets gepland voor vanavond</p>
          <p className="text-stone-500 text-xs mt-0.5">Kies een recept in het weekmenu</p>
        </Link>
      )}

      {/* Bederft binnenkort */}
      {expiringSoon.length > 0 && (
        <Link
          href={`/${locale}/pantry`}
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 hover:brightness-95 transition-all"
        >
          <span className="text-xl">⏳</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">
              {expiringSoon.length === 1
                ? '1 product is bijna over datum'
                : `${expiringSoon.length} producten zijn bijna over datum`}
            </p>
            <p className="text-stone-500 text-xs truncate">
              {expiringSoon.slice(0, 3).map((p) => p.name).join(', ')}
              {expiringSoon.length > 3 && ` +${expiringSoon.length - 3}`}
            </p>
          </div>
          <span className="text-stone-400 text-sm">→</span>
        </Link>
      )}

      {/* AI suggestions */}
      <AISuggestieWidget />

      {/* Week dots widget */}
      <Link href={`/${locale}/weekmenu`} className="block">
        <div className="bg-blue-50 rounded-2xl p-4 hover:brightness-95 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-medium text-sm">📅 Weekmenu</p>
              <p className="text-stone-500 text-xs">
                {plannedCount === 0
                  ? 'Nog niets gepland'
                  : `${plannedCount} van 7 avonden gepland`}
              </p>
            </div>
            <span className="text-stone-400 text-sm">→</span>
          </div>
          <div className="flex justify-between">
            {weekDates.map((date) => {
              const isToday = date === today
              const isPlanned = plannedDates.has(date)
              const letter = DAY_LETTERS[new Date(date + 'T12:00:00').getDay()]
              return (
                <div key={date} className="flex flex-col items-center gap-1">
                  <span className={`text-xs font-medium ${isToday ? 'text-orange-600' : 'text-stone-400'}`}>
                    {letter}
                  </span>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isPlanned && isToday ? 'bg-orange-500 text-white' :
                    isPlanned        ? 'bg-green-500 text-white' :
                    isToday          ? 'border-2 border-orange-400 bg-white text-orange-400' :
                                       'bg-stone-200 text-transparent'
                  }`}>
                    {isPlanned ? '✓' : isToday ? '·' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Link>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: '📖', title: 'Recepten',      subtitle: 'Jouw collectie',       href: 'recepten',         color: 'bg-orange-50' },
          { icon: '🧺', title: 'Pantry',         subtitle: 'Wat heb je in huis?',  href: 'pantry',           color: 'bg-green-50'  },
          { icon: '🛒', title: 'Boodschappen',   subtitle: 'Jouw lijst',           href: 'boodschappenlijst',color: 'bg-yellow-50' },
          { icon: '📊', title: 'Weekanalyse',    subtitle: 'Eten we gevarieerd?',  href: 'analyse',          color: 'bg-purple-50' },
          { icon: '👨‍👩‍👧', title: 'Huishouden',   subtitle: 'Leden & instellingen', href: 'instellingen',     color: 'bg-stone-100' },
        ].map(card => (
          <Link
            key={card.href}
            href={`/${locale}/${card.href}`}
            className={`${card.color} rounded-2xl p-4 flex flex-col gap-2 hover:brightness-95 transition-all`}
          >
            <span className="text-2xl">{card.icon}</span>
            <div>
              <p className="font-medium text-sm">{card.title}</p>
              <p className="text-stone-500 text-xs">{card.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
