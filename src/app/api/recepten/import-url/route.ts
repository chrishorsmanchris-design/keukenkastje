import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    if (html.length < 500) throw new Error('Pagina heeft te weinig inhoud')

    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
      ?? null

    // Try JSON-LD first (most reliable)
    const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    let structuredRecipe: Record<string, unknown> | null = null
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1])
        const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data]
        const found = items.find((item: Record<string, unknown>) => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')))
        if (found) { structuredRecipe = found; break }
      } catch { /* continue */ }
    }

    const sourceContent = structuredRecipe
      ? `JSON-LD structured data:\n${JSON.stringify(structuredRecipe).slice(0, 6000)}`
      : `Webpage text:\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 8000)}`

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Extract the recipe from this data. Translate everything to Dutch. Convert all measurements to metric units — never use cups, oz, lb, fl oz, or Fahrenheit. Use Dutch unit names: gram, ml, liter, eetlepel, theelepel. Convert Fahrenheit to Celsius.

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
}

${sourceContent}`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('No text response')

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')

    const recipe = JSON.parse(jsonMatch[0])
    if (ogImage) recipe.image_url = ogImage
    return NextResponse.json({ recipe, source_url: url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Onbekende fout'
    return NextResponse.json({ error: `Import mislukt: ${msg}` }, { status: 500 })
  }
}
