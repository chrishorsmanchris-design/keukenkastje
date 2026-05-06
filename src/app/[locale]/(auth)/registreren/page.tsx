'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegistrerenPage() {
  const router = useRouter()
  const { locale } = useParams()
  const [form, setForm] = useState({ naam: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Wachtwoorden komen niet overeen'); return }
    if (form.password.length < 8) { setError('Wachtwoord minimaal 8 tekens'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { display_name: form.naam } },
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.push(`/${locale}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🍳</div>
          <h1 className="text-2xl font-semibold tracking-tight">Keukenkastje</h1>
          <p className="text-stone-500 text-sm mt-1">Account aanmaken</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { label: 'Naam', key: 'naam', type: 'text', placeholder: 'Jan de Vries', autoComplete: 'name' },
            { label: 'E-mailadres', key: 'email', type: 'email', placeholder: 'naam@voorbeeld.nl', autoComplete: 'email' },
            { label: 'Wachtwoord', key: 'password', type: 'password', placeholder: 'Minimaal 8 tekens', autoComplete: 'new-password' },
            { label: 'Bevestig wachtwoord', key: 'confirm', type: 'password', placeholder: '••••••••', autoComplete: 'new-password' },
          ].map(({ label, key, type, placeholder, autoComplete }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</label>
              <input
                type={type}
                required
                autoComplete={autoComplete}
                placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={set(key as keyof typeof form)}
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
            {loading ? 'Bezig...' : 'Account aanmaken'}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500">
          Al een account?{' '}
          <Link href={`/${locale}/login`} className="text-orange-500 font-medium hover:text-orange-600">
            Inloggen
          </Link>
        </p>
      </div>
    </div>
  )
}
