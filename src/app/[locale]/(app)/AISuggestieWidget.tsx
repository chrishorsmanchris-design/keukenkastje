'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

type Suggestie = { titel: string; reden: string; emoji: string }

export default function AISuggestieWidget() {
  const [suggesties, setSuggesties] = useState<Suggestie[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const locale = pathname.split('/')[1]

  const CACHE_KEY = 'ai_suggesties'
  const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 hours

  async function load(force = false) {
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { data, ts } = JSON.parse(cached)
          if (Date.now() - ts < CACHE_TTL) {
            setSuggesties(data)
            setLoaded(true)
            return
          }
        }
      } catch { /* ignore */ }
    }
    setLoading(true)
    const res = await fetch('/api/ai-suggestie', { method: 'POST' })
    const data = await res.json()
    const suggesties = data.suggesties ?? []
    setSuggesties(suggesties)
    setLoaded(true)
    setLoading(false)
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: suggesties, ts: Date.now() }))
    } catch { /* ignore */ }
  }

  return (
    <div className="bg-orange-50 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Wat kan ik maken?</p>
          <p className="text-xs text-stone-500">Op basis van jouw pantry</p>
        </div>
        <button
          onClick={() => load(loaded)}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-full disabled:opacity-60 hover:bg-orange-600 transition-colors"
        >
          {loading ? '...' : loaded ? 'Opnieuw' : '✨ Suggesties'}
        </button>
      </div>

      {loaded && suggesties.length === 0 && (
        <p className="text-xs text-stone-400">Geen suggesties gevonden. Voeg items toe aan je pantry.</p>
      )}

      {suggesties.map((s, i) => (
        <button
          key={i}
          onClick={() => router.push(`/${locale}/recepten/nieuw`)}
          className="w-full text-left bg-white rounded-xl px-3 py-2.5 border border-orange-100 hover:border-orange-300 transition-colors"
        >
          <p className="text-sm font-medium">{s.emoji} {s.titel}</p>
          <p className="text-xs text-stone-400 mt-0.5">{s.reden}</p>
        </button>
      ))}
    </div>
  )
}
