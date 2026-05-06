import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const image = formData.get('image') as File | null
  if (!image) return NextResponse.json({ error: 'No image' }, { status: 400 })

  const buffer = Buffer.from(await image.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mediaType = (image.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp'

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        {
          type: 'text',
          text: `This is a photo of a cookbook page. Extract the recipe and translate everything to Dutch. Convert all measurements to metric units — never use cups, oz, lb, fl oz, or Fahrenheit. Use Dutch unit names: gram, ml, liter, eetlepel, theelepel. Convert Fahrenheit to Celsius.

Return ONLY valid JSON:
{
  "title": "string (Dutch)",
  "description": "string (Dutch)",
  "servings": number,
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "cuisine": "Italiaans|Midden-Oosters|Aziatisch|Nederlands|Mexicaans|Frans|Amerikaans|null",
  "ingredient_type": "vis|vlees|kip|vegetarisch|pasta|rijst|soep|salade|null",
  "diet_labels": [],
  "ingredients": [{"name": "string", "amount": "string", "unit": "string"}],
  "steps": [{"order": number, "text": "string", "timer_minutes": number|null}]
}`,
        },
      ],
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return NextResponse.json({ error: 'No response' }, { status: 500 })

  const match = content.text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Geen recept gevonden in de foto' }, { status: 422 })

  try {
    const recipe = JSON.parse(match[0])
    return NextResponse.json({ recipe })
  } catch {
    return NextResponse.json({ error: 'Kon het recept niet verwerken' }, { status: 500 })
  }
}
