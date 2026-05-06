'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function WachtwoordVergetenPage() {
  const { locale } = useParams()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/${locale}/wachtwoord-reset`,
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🍳</div>
          <h1 className="text-2xl font-semibold tracking-tight">Wachtwoord vergeten</h1>
          <p className="text-stone-500 text-sm mt-1">We sturen je een herstelmail</p>
        </div>

        {sent ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center text-green-800 text-sm">
            Controleer je e-mail voor de herstellink.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">E-mailadres</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="naam@voorbeeld.nl"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Bezig...' : 'Herstelmail sturen'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-stone-500">
          <Link href={`/${locale}/login`} className="text-orange-500 font-medium hover:text-orange-600">
            Terug naar inloggen
          </Link>
        </p>
      </div>
    </div>
  )
}
