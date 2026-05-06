import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Keukenkastje/1.0)' },
    })
    const html = await res.text()
    // Strip HTML tags for cleaner input
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000)

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Extract the recipe from this webpage text and return ONLY valid JSON with this exact structure:
{
  "title": "string",
  "description": "string",
  "servings": number,
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "cuisine": "one of: Italiaans|Midden-Oosters|Aziatisch|Nederlands|Mexicaans|Frans|Amerikaans|null",
  "ingredient_type": "one of: vis|vlees|kip|vegetarisch|pasta|rijst|soep|salade|null",
  "diet_labels": ["vegetarisch"|"vegan"|"glutenvrij"],
  "ingredients": [{"name": "string", "amount": "string", "unit": "string"}],
  "steps": [{"order": number, "text": "string", "timer_minutes": number|null}]
}

Webpage text:
${text}`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('No text response')

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')

    const recipe = JSON.parse(jsonMatch[0])
    return NextResponse.json({ recipe, source_url: url })
  } catch (e) {
    return NextResponse.json({ error: 'Import mislukt' }, { status: 500 })
  }
}
