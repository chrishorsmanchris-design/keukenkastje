import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Houdt het Supabase-project wakker. Gratis projecten pauzeren na ~1 week
 * zonder activiteit; dan werkt inloggen niet meer en komen er geen mails aan.
 *
 * Draait via vercel.json → /api/cron/keepalive
 * Handmatig testen kan gewoon in de browser: /api/cron/keepalive
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('profiles').select('id').limit(1)
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, at: new Date().toISOString() },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: true, at: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Onbekende fout', at: new Date().toISOString() },
      { status: 500 }
    )
  }
}
