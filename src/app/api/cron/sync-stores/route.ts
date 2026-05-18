import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { picnicGetLatestDelivery } from '@/lib/picnic'
import { ahGetRecentReceipts, ahRefresh } from '@/lib/ah'
import { predictExpiry } from '@/lib/expiry'

// Vercel cron: vercel.json → {"crons": [{"path": "/api/cron/sync-stores", "schedule": "0 6 * * *"}]}
// Of handmatig aanroepen: POST /api/cron/sync-stores

function categorize(name: string): string {
  const n = name.toLowerCase()
  if (/melk|yoghurt|kwark|kaas|boter|room|ei\b|eieren|mozzarella|feta/.test(n)) return 'Zuivel & eieren'
  if (/kip|rund|gehakt|vark|spek|bacon|ham|worst|zalm|vis\b|garnaal|tonijn/.test(n)) return 'Vlees & vis'
  if (/appel|peer|banaan|tomaat|paprika|\bui\b|wortel|sla\b|spinazie|broccoli|courgette|avocado|citroen|aardappel|komkommer|prei|champignon/.test(n)) return 'Groente & fruit'
  if (/brood|baguette|pita|tortilla|wrap/.test(n)) return 'Brood & bakkerij'
  if (/pasta|spaghetti|rijst|couscous|quinoa|mie\b|bloem/.test(n)) return 'Pasta & rijst'
  if (/blik|pot\b|kikkererwt|linzen|boon\b|kokosmelk|tomatenpuree/.test(n)) return 'Blikken & potten'
  if (/olie|azijn|sojasaus|pesto|mosterd|ketchup|zout|peper\b|komijn|kurkuma|oregano|basilicum|tijm|kaneel|honing|suiker/.test(n)) return 'Sauzen & kruiden'
  if (/water|sap\b|wijn|bier|cola|thee|koffie/.test(n)) return 'Dranken'
  return 'Overig'
}

export async function GET(req: NextRequest) {
  // Vercel cron authenticatie
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runSync()
}

export async function POST(req: NextRequest) {
  return runSync()
}

async function runSync() {
  const admin = createAdminClient()
  const { data: connections } = await admin.from('store_connections').select('*')
  if (!connections?.length) return NextResponse.json({ synced: 0 })

  let totalAdded = 0

  for (const conn of connections) {
    try {
      if (conn.store === 'picnic') {
        const delivery = await picnicGetLatestDelivery(conn.auth_token)
        if (!delivery) continue

        const pantryItems = delivery.items.map((item: { name: string; quantity: number; unit: string }) => ({
          household_id: conn.household_id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit || 'stuks',
          category: categorize(item.name),
          expires_at: predictExpiry(item.name),
        }))

        await admin.from('pantry_items').insert(pantryItems)
        await admin.from('store_connections').update({
          last_order_id: delivery.deliveryId,
          last_synced_at: new Date().toISOString(),
        }).eq('id', conn.id)
        totalAdded += pantryItems.length

      } else if (conn.store === 'ah') {
        let accessToken = conn.auth_token

        let receipts
        try {
          receipts = await ahGetRecentReceipts(accessToken)
        } catch (e: unknown) {
          if (e instanceof Error && e.message === 'SESSION_EXPIRED' && conn.refresh_token) {
            const newTokens = await ahRefresh(conn.refresh_token)
            accessToken = newTokens.access_token
            await admin.from('store_connections').update({
              auth_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token,
            }).eq('id', conn.id)
            receipts = await ahGetRecentReceipts(accessToken)
          } else {
            continue
          }
        }

        const lastOrderId = conn.last_order_id
        const newReceipts = lastOrderId
          ? receipts.filter(r => r.receiptId > lastOrderId)
          : receipts.slice(0, 1)

        if (!newReceipts.length) continue

        const pantryItems = newReceipts.flatMap(receipt =>
          receipt.items.map(item => ({
            household_id: conn.household_id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: categorize(item.name),
            expires_at: predictExpiry(item.name),
          }))
        )

        if (pantryItems.length) await admin.from('pantry_items').insert(pantryItems)

        const latestReceiptId = newReceipts.sort((a, b) => b.receiptId.localeCompare(a.receiptId))[0].receiptId
        await admin.from('store_connections').update({
          last_order_id: latestReceiptId,
          last_synced_at: new Date().toISOString(),
        }).eq('id', conn.id)

        totalAdded += pantryItems.length
      }
    } catch {
      // Log maar ga door met volgende verbinding
    }
  }

  return NextResponse.json({ synced: connections.length, added: totalAdded })
}
