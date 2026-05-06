import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import BewerkenClient from './BewerkenClient'

export default async function BewerkenPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = await params
  const supabase = await createClient()
  const { data: recipe } = await supabase.from('recipes').select('*').eq('id', id).single()
  if (!recipe) notFound()
  return <BewerkenClient recipe={recipe} locale={locale} />
}
