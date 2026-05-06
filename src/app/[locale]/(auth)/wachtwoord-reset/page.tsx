'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function WachtwoordResetPage() {
  const router = useRouter()
  const { locale } = useParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      </div>
    </div>
  )
}
