import { createClient } from '@supabase/supabase-js'

// Service-role client — gebruik alleen server-side in API routes
// Bypasses RLS: doe altijd handmatige autorisatiecontroles
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
