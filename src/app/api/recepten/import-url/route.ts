import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/require-user'

const anthropic = new Anthropic()

/** Extract JSON-LD Recipe from standard <script type="application/ld+json"> tags */
function extractStandardJsonLd(html: string): Record<string, unknown> | null {
  const matches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const match of matches) {
    try {
      const data = JSON.parse(match[1])
      const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data]
      const found = items.find(
        (item: Record<string, unknown>) =>
          item['@type'] === 'Recipe' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))
      )
      if (found) return found
    } catch { /* continue */ }
  }
  return null
}

/**
 * Extract JSON-LD Recipe from Next.js RSC streaming format.
 * Picnic and other Next.js apps embed JSON-LD as escaped strings inside:
 *   self.__next_f.push([1,"{ \"@type\":\"Recipe\", ... }"])
 */
function extractNextRscJsonLd(html: string): Record<string, unknown> | null {
  // Search for escaped variant first: \"@type\":\"Recipe\"
  const escapedNeedle = '\\"@type\\":\\"Recipe\\"'
  const plainNeedle = '"@type":"Recipe"'

  for (const { needle, escaped } of [
    { needle: escapedNeedle, escaped: true },
    { needle: plainNeedle, escaped: false },
  ]) {
    const idx = html.indexOf(needle)
    if (idx === -1) continue

    // Take a large window around the match
    const windowStart = Math.max(0, idx - 15000)
    const windowEnd = Math.min(html.length, idx + 60000)
    let chunk = html.slice(windowStart, windowEnd)

    if (escaped) {
      // Unescape the JS string encoding
      chunk = chunk
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
    }

    // Find "@type":"Recipe" in the processed chunk
    const recipePos = chunk.indexOf('"@type":"Recipe"')
    if (recipePos === -1) continue

    // Walk backwards to find the opening { of this JSON object
    let start = recipePos
    while (start > 0 && chunk[start] !== '{') start--

    // Walk forwards counting braces to find the matching }
    let depth = 0
    let end = start
    for (; end < chunk.length; end++) {
      if (chunk[end] === '{') depth++
      else if (chunk[end] === '}') {
        depth--
        if (depth === 0) { end++; break }
      }
    }

    try {
      const obj = JSON.parse(chunk.slice(start, end))
      if (obj?.['@type'] === 'Recipe') return obj
    } catch { /* continue */ }
  }

  return null
}

/**
 * Extract the main article/recipe text from HTML.
 * Tries common WordPress/blog content containers before falling back to full HTML.
 */
function extractMainText(html: string): string {
  // Try common content containers in order of specificity
  const containers = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]+class="[^"]*(?:entry-content|post-content|recipe-content|wprm-recipe|tasty-recipe|mv-recipe-card)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]+(?:id|class)="[^"]*(?:content|main|post)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ]

  for (const re of containers) {
    const match = html.match(re)
    if (match?.[1]) {
      const text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      if (text.length > 300) return text.slice(0, 10000)
    }
  }

  // Fallback: strip all tags from full HTML but skip <head> section
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const source = bodyMatch?.[1] ?? html
  return source.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000)
}

/** Extract meta tag content */
function getMeta(html: string, property: string): string | null {
  return (
    html.match(new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'))?.[1] ??
    null
  )
}

const CLAUDE_PROMPT = `Extract the recipe from this data. Translate everything to Dutch. Convert all measurements to metric units — never use cups, oz, lb, fl oz, or Fahrenheit. Use Dutch unit names: gram, ml, liter, eetlepel, theelepel. Convert Fahrenheit to Celsius.

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
}`

export async function POST(req: NextRequest) {
  const denied = await requireUser()
  if (denied) return denied

  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 })

  // Return existing recipe if this URL was already imported
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('recipes')
    .select('*')
    .eq('source_url', url)
    .maybeSingle()
  if (existing) return NextResponse.json({ recipe: existing, source_url: url, cached: true })

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

    const ogImage = getMeta(html, 'og:image')

    // ── 1. Standard JSON-LD ──────────────────────────────────────────────────
    let structuredRecipe = extractStandardJsonLd(html)

    // ── 2. Next.js RSC streaming format (Picnic etc.) ────────────────────────
    if (!structuredRecipe) {
      structuredRecipe = extractNextRscJsonLd(html)
    }

    // ── 3. Instagram: they serve an empty JS shell — no content extractable ──
    const isInstagram = /instagram\.com\/(p|reel|tv)\//.test(url)
    if (isInstagram && !structuredRecipe) {
      return NextResponse.json({
        error: 'instagram_blocked',
        message: 'Instagram laadt recepten niet in de browser. Kopieer het bijschrift (caption) van de Instagram-app en plak het hieronder.',
      }, { status: 422 })
    }

    // ── Build source content for Claude ──────────────────────────────────────
    const sourceContent = structuredRecipe
      ? `JSON-LD structured data:\n${JSON.stringify(structuredRecipe).slice(0, 6000)}`
      : `Webpage text:\n${extractMainText(html)}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `${CLAUDE_PROMPT}\n\n${sourceContent}`,
      }],
    })

    const content = message.content[0]
    if (content.type !== 'text') throw new Error('No text response')

    // Pak de laatste (meest complete) JSON-blob — bij afgekapte output is de eerste soms incompleet
    const jsonMatches = [...content.text.matchAll(/\{[\s\S]*?\}/g)]
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')

    // Probeer te parsen; bij fout: verwijder trailing incomplete array-elementen
    let recipe
    try {
      recipe = JSON.parse(jsonMatch[0])
    } catch {
      // Herstel afgeknipte JSON: verwijder incomplete laatste regel en sluit af
      const cleaned = jsonMatch[0]
        .replace(/,\s*\{[^}]*$/, '')   // incomplete laatste object in array
        .replace(/,\s*"[^"]*$/, '')    // incomplete laatste key
        .replace(/,\s*$/, '')          // trailing comma
      // Sluit open arrays/objects
      const opens = (cleaned.match(/\[/g) ?? []).length - (cleaned.match(/\]/g) ?? []).length
      const closes = ']'.repeat(Math.max(0, opens))
      recipe = JSON.parse(cleaned + closes + '}')
    }
    void jsonMatches // suppress unused warning
    // Use og:image for image — for Instagram this is the video thumbnail
    if (ogImage) recipe.image_url = ogImage
    return NextResponse.json({ recipe, source_url: url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Onbekende fout'
    return NextResponse.json({ error: `Import mislukt: ${msg}` }, { status: 500 })
  }
}
