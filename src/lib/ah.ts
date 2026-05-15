const BASE = 'https://api.ah.nl'
// Credentials van de officieuze AH app API (bekend via reverse engineering)
const CLIENT_ID = 'appie-android'
const CLIENT_SECRET = 'vMEPnEiJM6UMgNHDAMnBFzge'
const UA = 'Appie/8.22.3'

export interface AHTokens {
  access_token: string
  refresh_token: string
  expires_in: number
}

export async function ahLogin(email: string, password: string): Promise<AHTokens> {
  const res = await fetch(`${BASE}/mobile/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'password',
      username: email,
      password,
    }).toString(),
  })
  if (!res.ok) throw new Error('AH inloggegevens onjuist')
  return res.json()
}

export async function ahRefresh(refreshToken: string): Promise<AHTokens> {
  const res = await fetch(`${BASE}/mobile/v1/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })
  if (!res.ok) throw new Error('SESSION_EXPIRED')
  return res.json()
}

export interface StoreItem {
  name: string
  quantity: number
  unit: string
}

export async function ahGetRecentReceipts(
  accessToken: string
): Promise<{ receiptId: string; date: string; items: StoreItem[] }[]> {
  const res = await fetch(`${BASE}/mobile/v1/member/receipts`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': UA },
  })
  if (res.status === 401) throw new Error('SESSION_EXPIRED')
  if (!res.ok) throw new Error('Kan bonnen niet ophalen')
  const data = await res.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.receipts ?? data ?? []).slice(0, 10).map((receipt: any) => ({
    receiptId: String(receipt.transactionId ?? receipt.id ?? ''),
    date: receipt.dateTime ?? receipt.date ?? new Date().toISOString(),
    items: (receipt.receiptLines ?? receipt.lines ?? [])
      // Filters: geen bonusregel, geen statiegeld, geen lege namen
      .filter((l: any) => {
        const d: string = (l.description ?? '').toLowerCase()
        return d && !d.startsWith('statiegeld') && !d.startsWith('bonus') && !d.startsWith('totaal')
      })
      .map((l: any) => ({
        name: (l.description ?? '').trim(),
        quantity: Math.abs(l.quantity ?? l.amount ?? 1),
        unit: l.quantityUnitDescription ?? l.unit ?? 'stuks',
      })),
  }))
}
