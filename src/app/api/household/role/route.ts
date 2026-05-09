import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // Auth check via normale client (RLS-beschermd)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { memberId, role } = await request.json()
  if (!memberId || !['owner', 'member', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 })
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

  // Update via admin client (bypasses RLS voor cross-user updates)
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({ role, is_owner: role === 'owner' })
    .eq('id', memberId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
