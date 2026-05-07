import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('household_id, is_owner').eq('id', user.id).single()
  if (!profile?.is_owner) return NextResponse.json({ error: 'Only the owner can invite' }, { status: 403 })

  const token = crypto.randomUUID()
  const { error } = await supabase.from('invites').insert({
    household_id: profile.household_id,
    email: email ?? null,
    token,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inviteUrl = `${req.headers.get('origin')}/nl/join/${token}`

  // Optionally send email invite
  if (email) {
    await supabase.auth.admin.inviteUserByEmail(email, { redirectTo: inviteUrl })
  }

  return NextResponse.json({ success: true, inviteUrl })
}
