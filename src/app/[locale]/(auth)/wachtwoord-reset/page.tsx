'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function WachtwoordResetPage() {
  const router = useRouter()
  const { locale } = useParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Implicit flow: Supabase verwerkt #access_token automatisch en vuurt PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setSessionReady(true)
        setSessionLoading(false)
      }
    })

    // Na 4s stoppen met wachten als er geen sessie komt
    const timeout = setTimeout(() => setSessionLoading(false), 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Wachtwoorden komen niet overeen'); return }
    if (password.length < 8) { setError('Wachtwoord minimaal 8 tekens'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push(`/${locale}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🍳</div>
          <h1 className="text-2xl font-semibold tracking-tight">Nieuw wachtwoord</h1>
          <p className="text-stone-500 text-sm mt-1">Kies een nieuw wachtwoord</p>
        </div>

        {sessionLoading ? (
          <div className="text-center py-8 text-stone-400">
            <div className="animate-spin text-2xl mb-2">⏳</div>
            <p className="text-sm">Link verifiëren…</p>
          </div>
        ) : !sessionReady ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
              {error || 'Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.'}
            </div>
            <button
              onClick={() => router.push(`/${locale}/wachtwoord-vergeten`)}
              className="w-full py-3 rounded-2xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              Nieuwe link aanvragen
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {[
              { label: 'Nieuw wachtwoord', value: password, onChange: setPassword, placeholder: 'Minimaal 8 tekens' },
              { label: 'Bevestig wachtwoord', value: confirm, onChange: setConfirm, placeholder: '••••••••' },
            ].map(({ label, value, onChange, placeholder }) => (
              <div key={label} className="space-y-1">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</label>
                <input
                  type="password"
                  required
                  placeholder={placeholder}
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-stone-200 bg-white text-sm outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
            ))}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Bezig...' : 'Wachtwoord opslaan'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
