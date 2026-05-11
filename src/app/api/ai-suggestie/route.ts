import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user!.id).single()
  if (!profile?.household_id) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: pantry } = await supabase
    .from('pantry_items')
    .select('name, quantity, unit')
    .eq('household_id', profile.household_id)

  const { data: recipes } = await supabase
    .from('recipes')
    .select('title, ingredient_type, cuisine')
    .eq('household_id', profile.household_id)
    .limit(20)

  const pantryList = pantry?.map(p => `${p.name} (${p.quantity} ${p.unit ?? ''})`).join(', ') ?? 'leeg'
  const recipeList = recipes?.map(r => r.title).join(', ') ?? 'geen'

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Je bent een vriendelijke kookassistent. Geef 3 concrete gerechtsuggesties op basis van de pantry-inhoud. Antwoord in het Nederlands, informeel en kort.

Pantry-inhoud: ${pantryList}
Bestaande recepten in app: ${recipeList}

Geef 3 suggesties als JSON array:
[{"titel": "string", "reden": "string (kort, waarom dit met de pantry-inhoud)", "emoji": "string"}]

Geef ALLEEN de JSON array terug, geen uitleg.`,
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return NextResponse.json({ error: 'No response' }, { status: 500 })

  const match = content.text.match(/\[[\s\S]*\]/)
  if (!match) return NextResponse.json({ suggesties: [] })

  try {
    const suggesties = JSON.parse(match[0])
    return NextResponse.json({ suggesties })
  } catch {
    return NextResponse.json({ suggesties: [] })
  }
}
