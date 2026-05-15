import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { picnicGetLatestDelivery, picnicLogin } from '@/lib/picnic'
import { predictExpiry } from '@/lib/expiry'
import { NextResponse } from 'next/server'

function categorize(name: string): string {
  const n = name.toLowerCase()
  if (/melk|yoghurt|kwark|kaas|boter|room|ei\b|eieren|mozzarella|feta/.test(n)) return 'Zuivel & eieren'
  if (/kip|rund|gehakt|vark|spek|bacon|ham|worst|zalm|vis\b|garnaal|tonijn/.test(n)) return 'Vlees & vis'
  if (/appel|peer|banaan|tomaat|paprika|\bui\b|wortel|sla\b|spinazie|broccoli|courgette|avocado|citroen|aardappel|komkommer|prei|champignon/.test(n)) return 'Groente & fruit'
  if (/brood|baguette|pita|tortilla|wrap/.test(n)) return 'Brood'
  if (/pasta|spaghetti|rijst|couscous|quinoa|mie\b|bloem|havermout/.test(n)) return 'Droog & graan'
  if (/blik|pot\b|kikkererwt|linzen|boon\b|kokosmelk|tomatenpuree/.test(n)) return 'Blikken & potten'
  if (/olie|azijn|sojasaus|pesto|mosterd|ketchup|mayonaise|saus\b/.test(n)) return 'Sauzen & oliën'
  if (/zout|peper\b|komijn|kurkuma|oregano|basilicum|tijm|kaneel|honing|suiker/.test(n)) return 'Kruiden & specerijen'
  if (/water|sap\b|wijn|bier|cola|thee|koffie/.test(n)) return 'Dranken'
  if (/diepvries|bevroren/.test(n)) return 'Diepvries'
  return 'Overig'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
  if (!profile?.household_id) return NextResponse.json({ error: 'Geen huishouden' }, { status: 400 })

  const admin = createAdminClient()
  const { data: conn } = await admin.from('store_connections')
    .select('*').eq('household_id', profile.household_id).eq('store', 'picnic').single()
  if (!conn) return NextResponse.json({ error: 'Picnic niet gekoppeld' }, { status: 400 })

  let token = conn.auth_token

  // Haal laatste bezorging op
  let delivery
  try {
    delivery = await picnicGetLatestDelivery(token)
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
      return NextResponse.json({ error: 'Picnic sessie verlopen — koppel opnieuw' }, { status: 401 })
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync mislukt' }, { status: 500 })
  }

  if (!delivery) return NextResponse.json({ added: 0, message: 'Geen bezorgingen gevonden' })

  // Controleer of we deze bezorging al hebben gesynchroniseerd
  if (conn.last_order_id === delivery.deliveryId) {
    return NextResponse.json({ added: 0, message: 'Al gesynchroniseerd' })
  }

  // Voeg items toe aan pantry
  const pantryItems = delivery.items.map(item => ({
    household_id: profile.household_id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    category: categorize(item.name),
    expires_at: predictExpiry(item.name),
  }))

  const { error: insertError } = await admin.from('pantry_items').insert(pantryItems)
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Update last_order_id en last_synced_at
  await admin.from('store_connections').update({
    last_order_id: delivery.deliveryId,
    last_synced_at: new Date().toISOString(),
  }).eq('id', conn.id)

  return NextResponse.json({ added: pantryItems.length, deliveredAt: delivery.deliveredAt })
}
