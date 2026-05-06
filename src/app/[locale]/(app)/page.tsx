import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user!.id).single()
  const name = profile?.display_name?.split(' ')[0] ?? ''
  const greeting = getGreeting()

  return (
    <div className="px-4 pt-12 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{greeting}{name ? `, ${name}` : ''} 👋</h1>
          <p className="text-stone-500 text-sm mt-1">Wat kook je vanavond?</p>
        </div>
        <Link href={`/${locale}/instellingen`} className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors">
          ⚙️
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: '📖', title: 'Recepten', subtitle: 'Jouw collectie', href: 'recepten', color: 'bg-orange-50' },
          { icon: '🧺', title: 'Pantry', subtitle: 'Wat heb je in huis?', href: 'pantry', color: 'bg-green-50' },
          { icon: '📅', title: 'Weekmenu', subtitle: 'Plan je week', href: 'weekmenu', color: 'bg-blue-50' },
          { icon: '🛒', title: 'Boodschappen', subtitle: 'Jouw lijst', href: 'boodschappenlijst', color: 'bg-yellow-50' },
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
