'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const { locale } = useParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('E-mailadres of wachtwoord onjuist')
      setLoading(false)
      return
    }
    router.push(`/${locale}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🍳</div>
          <h1 className="text-2xl font-semibold tracking-tight">Keukenkastje</h1>
          <p className="text-stone-500 text-sm mt-1">Welkom terug</p>
        </div>

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
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Wachtwoord</label>
              <Link href={`/${locale}/wachtwoord-vergeten`} className="text-xs text-orange-500 hover:text-orange-600">
                Vergeten?
              </Link>
            </div>
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Bezig...' : 'Inloggen'}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500">
          Nog geen account?{' '}
          <Link href={`/${locale}/registreren`} className="text-orange-500 font-medium hover:text-orange-600">
            Account aanmaken
          </Link>
        </p>
      </div>
    </div>
  )
}
