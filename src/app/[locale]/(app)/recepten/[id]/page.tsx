import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ReceptDetail from './ReceptDetail'

export default async function ReceptPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: recipe } = await supabase.from('recipes').select('*').eq('id', id).single()
  if (!recipe) notFound()
  return <ReceptDetail recipe={recipe} />
}
