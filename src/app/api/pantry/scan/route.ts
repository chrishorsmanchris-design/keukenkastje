import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { predictExpiry } from '@/lib/expiry'

const anthropic = new Anthropic()

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
