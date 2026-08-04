import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ahGetRecentReceipts, ahRefresh } from '@/lib/ah'
import { predictExpiry } from '@/lib/expiry'
import { NextResponse } from 'next/server'
import { categorizePantry } from '@/lib/categorize'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
  if (!profile?.household_id) return NextResponse.json({ error: 'Geen huishouden' }, { status: 400 })

  const admin = createAdminClient()
  const { data: conn } = await admin.from('store_connections')
    .select('*').eq('household_id', profile.household_id).eq('store', 'ah').single()
  if (!conn) return NextResponse.json({ error: 'AH niet gekoppeld' }, { status: 400 })

  let accessToken = conn.auth_token

  // Haal bonnen op — refresh token als nodig
  let receipts
  try {
    receipts = await ahGetRecentReceipts(accessToken)
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'SESSION_EXPIRED' && conn.refresh_token) {
      try {
        const newTokens = await ahRefresh(conn.refresh_token)
        accessToken = newTokens.access_token
        await admin.from('store_connections').update({
          auth_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
        }).eq('id', conn.id)
        receipts = await ahGetRecentReceipts(accessToken)
      } catch {
        return NextResponse.json({ error: 'AH sessie verlopen — koppel opnieuw' }, { status: 401 })
      }
    } else {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync mislukt' }, { status: 500 })
    }
  }

  // Filter bonnen die we nog niet hebben gesynchroniseerd
  const lastOrderId = conn.last_order_id
  const newReceipts = lastOrderId
    ? receipts.filter(r => r.receiptId > lastOrderId)
    : receipts.slice(0, 1) // Eerste sync: alleen meest recente bon

  if (!newReceipts.length) return NextResponse.json({ added: 0, message: 'Al gesynchroniseerd' })

  // Verzamel alle items uit nieuwe bonnen
  const pantryItems = newReceipts.flatMap(receipt =>
    receipt.items.map(item => ({
      household_id: profile.household_id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: categorizePantry(item.name),
      expires_at: predictExpiry(item.name),
    }))
  )

  if (pantryItems.length) {
    const { error: insertError } = await admin.from('pantry_items').insert(pantryItems)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Update last_order_id naar de nieuwste bon
  const latestReceiptId = newReceipts.sort((a, b) => b.receiptId.localeCompare(a.receiptId))[0].receiptId
  await admin.from('store_connections').update({
    last_order_id: latestReceiptId,
    last_synced_at: new Date().toISOString(),
  }).eq('id', conn.id)

  return NextResponse.json({ added: pantryItems.length })
}
