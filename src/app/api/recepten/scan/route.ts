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
          text: `This image contains a recipe — it could be a cookbook page, a social media screenshot (Instagram, TikTok), or any other recipe source. Extract ALL recipe information and translate everything to Dutch.

Rules:
- Convert all measurements to metric (never cups, oz, lb, fl oz, Fahrenheit)
- Use Dutch unit names: gram, ml, liter, eetlepel, theelepel, snufje
- Convert Fahrenheit to Celsius
- If you see a social media post (Instagram etc), focus on the recipe text in the caption or overlay
- If the image contains no recognizable recipe, return {"error": "Geen recept gevonden"}
- Add timer_minutes to steps that have a clear cooking/resting duration

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "string (Dutch)",
  "description": "string (Dutch, max 100 chars)",
  "servings": number,
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "cuisine": "Italiaans|Midden-Oosters|Aziatisch|Nederlands|Mexicaans|Frans|Amerikaans|null",
  "ingredient_type": "vis|vlees|kip|vegetarisch|pasta|rijst|soep|salade|null",
  "diet_labels": ["vegetarisch"|"vegan"|"glutenvrij"],
  "ingredients": [{"name": "string", "amount": "string", "unit": "string"}],
  "steps": [{"order": number, "text": "string (Dutch)", "timer_minutes": number|null}]
}`,
        },
      ],
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return NextResponse.json({ error: 'No response' }, { status: 500 })

  const match = content.text.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: 'Geen recept gevonden in de afbeelding. Probeer een duidelijkere foto of gebruik de tekst-plak optie.' }, { status: 422 })

  try {
    const parsed = JSON.parse(match[0])
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 422 })
    return NextResponse.json({ recipe: parsed })
  } catch {
    return NextResponse.json({ error: 'Kon het recept niet verwerken. Probeer opnieuw.' }, { status: 500 })
  }
}
