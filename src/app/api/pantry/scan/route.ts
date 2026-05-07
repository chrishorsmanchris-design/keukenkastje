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
          text: `Identify food products that are CLEARLY and UNAMBIGUOUSLY visible in this photo. Be conservative — when in doubt, leave it out.

Rules:
- Only include products you can identify with high confidence (>80%)
- Include a confidence score (0.0–1.0) for each product
- Use Dutch product names, keep them simple (e.g. "Melk", "Kaas", "Paprika")
- Do NOT guess products that are partially hidden or blurry
- Do NOT invent products that aren't visible

Return ONLY valid JSON array:
[{"name": "string", "quantity": number, "unit": "stuks|liter|kg|gram", "confidence": number}]`,
        },
      ],
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return NextResponse.json({ error: 'No response' }, { status: 500 })

  const match = content.text.match(/\[[\s\S]*\]/)
  if (!match) return NextResponse.json({ products: [] })

  const raw = JSON.parse(match[0]) as { name: string; quantity: number; unit: string; confidence?: number }[]
  // Filter out low-confidence guesses
  const products = raw.filter(p => (p.confidence ?? 1) >= 0.75)
  const withExpiry = products.map(({ confidence: _c, ...p }) => ({ ...p, expires_at: predictExpiry(p.name) }))

  return NextResponse.json({ products: withExpiry })
}
