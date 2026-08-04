import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireUser } from '@/lib/require-user'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const denied = await requireUser()
  if (denied) return denied

  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'Geen tekst opgegeven' }, { status: 400 })

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Extraheer het recept uit deze tekst. Vertaal alles naar het Nederlands. Gebruik metrische eenheden (gram, ml, liter, eetlepel, theelepel). Converteer Fahrenheit naar Celsius.

Geef ALLEEN geldige JSON terug:
{
  "title": "string",
  "description": "string",
  "servings": number,
  "prep_time_minutes": number,
  "cook_time_minutes": number,
  "cuisine": "Italiaans|Midden-Oosters|Aziatisch|Nederlands|Mexicaans|Frans|Amerikaans|null",
  "ingredient_type": "vis|vlees|kip|vegetarisch|pasta|rijst|soep|salade|null",
  "diet_labels": [],
  "ingredients": [{"name": "string", "amount": "string", "unit": "string"}],
  "steps": [{"order": number, "text": "string", "timer_minutes": number|null}]
}

Tekst:
${text.slice(0, 6000)}`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('Geen tekstresponse')

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Kon geen recept vinden in de tekst')

    const recipe = JSON.parse(jsonMatch[0])
    return NextResponse.json({ recipe })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Onbekende fout'
    return NextResponse.json({ error: `Extractie mislukt: ${msg}` }, { status: 500 })
  }
}
