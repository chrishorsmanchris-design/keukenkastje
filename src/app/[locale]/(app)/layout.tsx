import BottomNav from '@/components/BottomNav'
import { Providers } from '@/components/Providers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/nl/login')

  const { locale } = await params

  // Haal huishouden + leden op voor de banner — fouten mogen de layout nooit crashen
  let householdName: string | null = null
  let members: { id: string; display_name: string | null }[] = []
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('household_id, household:households(name)')
      .eq('id', user.id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = profile?.household as any
    householdName = (Array.isArray(raw) ? raw[0]?.name : raw?.name) ?? null
    const householdId = profile?.household_id
    if (householdId) {
      const { data: m } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('household_id', householdId)
      members = m ?? []
    }
  } catch { /* toon banner niet bij fout */ }

  return (
    <Providers>
      <div className="flex flex-col min-h-screen max-w-2xl mx-auto">
        {/* Household banner */}
        {householdName && members && members.length > 0 && (
          <Link
            href={`/${locale}/instellingen`}
            className="flex items-center justify-between px-4 py-2 bg-orange-50 border-b border-orange-100"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🏠</span>
              <span className="text-sm font-medium text-orange-800">{householdName}</span>
            </div>
            <div className="flex items-center gap-1">
              {members.map(m => (
                <div
                  key={m.id}
                  className="w-6 h-6 rounded-full bg-orange-200 flex items-center justify-center text-xs font-bold text-orange-700"
                  title={m.display_name ?? 'Naamloos'}
                >
                  {(m.display_name ?? '?')[0].toUpperCase()}
                </div>
              ))}
            </div>
          </Link>
        )}
        <main className="flex-1 pb-20">{children}</main>
        <BottomNav />
      </div>
    </Providers>
  )
}
