import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? 'keukenkastje@example.com'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

// Stuur notificatie naar alle abonnees van huishouden of specifieke user
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { title, body, url, targetUserId } = await req.json()
  const admin = createAdminClient()

  let query = admin.from('push_subscriptions').select('subscription, user_id')
  if (targetUserId) {
    query = query.eq('user_id', targetUserId)
  } else {
    // Stuur naar alle leden van huishouden
    const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
    if (!profile?.household_id) return NextResponse.json({ error: 'Geen huishouden' }, { status: 400 })
    const { data: members } = await admin.from('profiles').select('id').eq('household_id', profile.household_id)
    const memberIds = (members ?? []).map(m => m.id)
    query = query.in('user_id', memberIds)
  }

  const { data: subs } = await query
  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const payload = JSON.stringify({ title, body, url: url ?? '/', tag: 'weekmenu' })
  let sent = 0

  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription as webpush.PushSubscription, payload)
      sent++
    } catch {
      // Verlopen subscription verwijderen
      await admin.from('push_subscriptions').delete()
        .eq('user_id', row.user_id)
        .eq('endpoint', (row.subscription as { endpoint: string }).endpoint)
    }
  }

  return NextResponse.json({ sent })
}
