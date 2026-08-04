import { createClient } from '@/lib/supabase/server'

/**
 * Controleert of er een ingelogde gebruiker is.
 * Geeft null terug als dat zo is, anders een 401-Response die je direct kunt returnen.
 *
 * Gebruik in een route handler:
 *   const denied = await requireUser()
 *   if (denied) return denied
 */
export async function requireUser(): Promise<Response | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Niet ingelogd' }, { status: 401 })
  }
  return null
}
