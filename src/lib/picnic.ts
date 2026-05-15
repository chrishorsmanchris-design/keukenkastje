import crypto from 'crypto'

const BASE = 'https://storefront-prod.nl.picnicinternational.com/api/15'
const AGENT = '30100;1.15.233-15389'

function headers(token?: string) {
  return {
    'Content-Type': 'application/json',
    'x-picnic-agent': AGENT,
    'x-picnic-did': '1234567890',
    ...(token ? { 'x-picnic-auth': token } : {}),
  }
}

export async function picnicLogin(email: string, password: string): Promise<string> {
  const secret = crypto.createHash('md5').update(password).digest('hex')
  const res = await fetch(`${BASE}/user/login`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ key: email, secret, client_id: 1 }),
  })
  if (!res.ok) throw new Error('Inloggegevens onjuist')
  const data = await res.json()
  const token = data['x-picnic-auth'] ?? res.headers.get('x-picnic-auth')
  if (!token) throw new Error('Geen auth token ontvangen van Picnic')
  return token
}

export interface StoreItem {
  name: string
  quantity: number
  unit: string
}

export async function picnicGetLatestDelivery(
  token: string
): Promise<{ deliveryId: string; deliveredAt: string; items: StoreItem[] } | null> {
  const res = await fetch(`${BASE}/deliveries/summary`, {
    headers: headers(token),
  })
  if (res.status === 401) throw new Error('SESSION_EXPIRED')
  if (!res.ok) throw new Error('Kan bezorgingen niet ophalen')

  const deliveries: { delivery_id: string; status: string }[] = await res.json()
  const delivered = deliveries.filter(d => d.status === 'DELIVERED')
  if (!delivered.length) return null

  const latest = delivered[0]
  const detailRes = await fetch(`${BASE}/deliveries/${latest.delivery_id}`, {
    headers: headers(token),
  })
  if (!detailRes.ok) throw new Error('Kan bezorgingsdetails niet ophalen')
  const detail = await detailRes.json()

  const items: StoreItem[] = []
  for (const order of detail.orders ?? []) {
    for (const item of order.items ?? []) {
      const subItems: { name?: string; unit_quantity?: string }[] =
        item.items?.length ? item.items : [item]
      for (const sub of subItems) {
        const name = (sub.name ?? item.name ?? '').trim()
        if (!name) continue
        const match = (sub.unit_quantity ?? '').match(/^(\d+(?:[.,]\d+)?)\s*(.+)?$/)
        items.push({
          name,
          quantity: match ? parseFloat(match[1].replace(',', '.')) : 1,
          unit: match?.[2]?.trim() ?? 'stuks',
        })
      }
    }
  }

  return {
    deliveryId: latest.delivery_id,
    deliveredAt: detail.delivery_time?.end ?? new Date().toISOString(),
    items,
  }
}
