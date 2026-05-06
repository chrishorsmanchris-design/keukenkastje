import BottomNav from '@/components/BottomNav'
import { Providers } from '@/components/Providers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/nl/login')

  return (
    <Providers>
      <div className="flex flex-col min-h-screen max-w-2xl mx-auto">
        <main className="flex-1 pb-20">{children}</main>
        <BottomNav />
      </div>
    </Providers>
  )
}
