import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { picnicLogin } from '@/lib/picnic'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { email, password } = await request.json()
  if (!email || !password) return NextResponse.json({ error: 'Email en wachtwoord verplicht' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
  if (!profile?.household_id) return NextResponse.json({ error: 'Geen huishouden gevonden' }, { status: 400 })

  // Login bij Picnic — gooit error als credentials onjuist
  let token: string
  try {
    token = await picnicLogin(email, password)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Inloggen mislukt' }, { status: 400 })
  }

  // Sla token op (geen wachtwoord opslaan)
  const admin = createAdminClient()
  const { error } = await admin.from('store_connections').upsert({
    household_id: profile.household_id,
    store: 'picnic',
    auth_token: token,
    refresh_token: null,
  }, { onConflict: 'household_id,store' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
  const admin = createAdminClient()
  await admin.from('store_connections').delete()
    .eq('household_id', profile?.household_id ?? '')
    .eq('store', 'picnic')

  return NextResponse.json({ ok: true })
}
