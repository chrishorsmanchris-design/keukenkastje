import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import JoinClient from './JoinClient'

export default async function JoinPage({ params }: { params: Promise<{ token: string; locale: string }> }) {
  const { token, locale } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=/join/${token}`)

  const { data: invite } = await supabase
    .from('invites')
    .select('*, household:households(name)')
    .eq('token', token)
    .eq('accepted', false)
    .single()

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
        <div>
          <div className="text-4xl mb-3">❌</div>
          <h1 className="text-lg font-semibold">Uitnodiging ongeldig</h1>
          <p className="text-stone-500 text-sm mt-1">Deze link is al gebruikt of verlopen.</p>
        </div>
      </div>
    )
  }

  return <JoinClient token={token} householdName={(invite.household as { name: string })?.name} locale={locale} />
}
