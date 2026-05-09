import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { memberId } = await request.json()
  if (!memberId) return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 })

  if (memberId === user.id) {
    return NextResponse.json({ error: 'Je kunt jezelf niet verwijderen' }, { status: 400 })
  }

  // Controleer of de huidige gebruiker eigenaar is
  const { data: myProfile } = await supabase
    .from('profiles').select('household_id, role').eq('id', user.id).single()
  if (myProfile?.role !== 'owner') {
    return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })
  }

  // Controleer of het lid tot hetzelfde huishouden behoort
  const { data: targetProfile } = await supabase
    .from('profiles').select('household_id').eq('id', memberId).single()
  if (targetProfile?.household_id !== myProfile.household_id) {
    return NextResponse.json({ error: 'Lid niet gevonden' }, { status: 404 })
  }

  // Verwijder lid uit huishouden via admin client
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ household_id: null, role: 'member', is_owner: false })
    .eq('id', memberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
