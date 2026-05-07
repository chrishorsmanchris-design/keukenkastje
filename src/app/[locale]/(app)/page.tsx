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

  const [{ data: profile }, weekMenuResult] = await Promise.all([
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
        .select('date')
        .in('date', weekDates)
        .eq('meal_type', 'dinner')
      return { dates: weekDates, planned: new Set((data ?? []).map((m: { date: string }) => m.date)) }
    })(),
  ])

  const name = profile?.display_name?.split(' ')[0] ?? ''
  const householdName = (profile?.household as { name?: string } | null)?.name ?? ''
  const greeting = getGreeting()
  const today = new Date().toISOString().split('T')[0]
  const { dates: weekDates, planned: plannedDates } = weekMenuResult
  const plannedCount = plannedDates.size

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
