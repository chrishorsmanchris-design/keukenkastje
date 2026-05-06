import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// Default shelf life in days for common products
const SHELF_LIFE: Record<string, number> = {
  melk: 14, yoghurt: 14, kwark: 14, 'creme fraiche': 14, slagroom: 10,
  kaas: 21, mozzarella: 7, boter: 60,
  ei: 28, eieren: 28,
  brood: 5, baguette: 2,
  appel: 21, peer: 14, banaan: 7, citroen: 21, limoen: 14,
  tomaat: 7, paprika: 7, komkommer: 7, sla: 5, spinazie: 5,
  wortel: 21, ui: 60, knoflook: 90, aardappel: 30,
  kip: 2, gehakt: 2, vlees: 3, vis: 2, zalm: 2,
  pasta: 730, rijst: 730, bloem: 365, suiker: 730,
  olie: 365, azijn: 730, sojasaus: 365, honing: 730,
  blik: 730, kokosmelk: 730,
}

function predictExpiry(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, days] of Object.entries(SHELF_LIFE)) {
    if (lower.includes(key)) {
      const d = new Date()
      d.setDate(d.getDate() + days)
      return d.toISOString().split('T')[0]
    }
  }
  // Default: 7 days for unknown fresh, 365 for unknown dry
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d.toISOString().split('T')[0]
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const image = formData.get('image') as File | null
  const name = formData.get('name') as string | null

  // Single product: just predict expiry
  if (name && !image) {
    return NextResponse.json({ expires_at: predictExpiry(name) })
  }

  // Photo scan
  if (!image) return NextResponse.json({ error: 'No image' }, { status: 400 })

  const buffer = Buffer.from(await image.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mediaType = (image.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        {
          type: 'text',
          text: `Identify all food products visible in this fridge or pantry photo.
Return ONLY valid JSON array:
[{"name": "product name in Dutch", "quantity": number, "unit": "stuks|liter|kg|gram|etc"}]
Only include clearly visible products. Keep names simple (e.g. "Melk", "Kaas", "Paprika").`,
        },
      ],
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return NextResponse.json({ error: 'No response' }, { status: 500 })

  const match = content.text.match(/\[[\s\S]*\]/)
  if (!match) return NextResponse.json({ products: [] })

  const products = JSON.parse(match[0]) as { name: string; quantity: number; unit: string }[]
  const withExpiry = products.map(p => ({ ...p, expires_at: predictExpiry(p.name) }))

  return NextResponse.json({ products: withExpiry })
}
