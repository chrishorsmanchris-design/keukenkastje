'use client'

import { useState } from 'react'
import {
  maaltijdSignalen, riPercentage, voedingVoorRecept,
  type IngredientRegel, type MaaltijdVoeding, type Voedingswaarde,
} from '@/lib/voeding'

/** De vier waarden die je op een etiket als eerste ziet. */
const MACROS: { key: keyof Voedingswaarde; label: string; kleur: string; eenheid: string }[] = [
  { key: 'koolhydraten', label: 'Koolhydraten', kleur: 'bg-amber-500', eenheid: 'g' },
  { key: 'eiwit',        label: 'Eiwit',        kleur: 'bg-blue-500',  eenheid: 'g' },
  { key: 'vet',          label: 'Vet',          kleur: 'bg-yellow-500', eenheid: 'g' },
  { key: 'vezels',       label: 'Vezels',       kleur: 'bg-green-500', eenheid: 'g' },
]

/** Waarden die alleen in de details horen. */
const DETAILS: { key: keyof Voedingswaarde; label: string; eenheid: string; decimalen?: number }[] = [
  { key: 'verzadigd', label: 'waarvan verzadigd vet', eenheid: 'g' },
  { key: 'suikers',   label: 'waarvan suikers',       eenheid: 'g' },
  { key: 'zout',      label: 'Zout',                  eenheid: 'g', decimalen: 1 },
]

function rond(n: number, decimalen = 0): string {
  return n.toFixed(decimalen).replace('.', ',')
}

/**
 * Voedingswaarde van één portie, met een eerlijke marge.
 *
 * Bewust geen cijfers achter de komma bij kcal: dat suggereert een precisie die
 * er niet is. De dekkingsmelding staat er niet als voetnoot maar als eerste
 * regel wanneer die laag is — dan is het namelijk het belangrijkste wat je moet
 * weten voordat je naar de getallen kijkt.
 */
export default function Voedingskaart({
  ingredients, porties, compact = false,
}: {
  ingredients: IngredientRegel[]
  porties: number
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const v: MaaltijdVoeding = voedingVoorRecept(ingredients, porties)
  const n = v.perPortie

  if (v.meegerekend === 0) {
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
        <p className="font-medium text-sm">Voedingswaarde onbekend</p>
        <p className="text-stone-500 text-xs mt-1">
          Van dit recept kennen we geen enkele hoeveelheid. Vul bij de ingrediënten een gewicht in
          (bijvoorbeeld &quot;200 gram&quot;), dan rekenen we het meteen door.
        </p>
      </div>
    )
  }

  const onzeker = v.dekking < 0.6
  const signalen = onzeker ? [] : maaltijdSignalen(n)

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-medium text-sm">Voedingswaarde per portie</p>
        <p className="text-xs text-stone-400">{riPercentage(n, 'kcal')}% van een dag</p>
      </div>

      <p className="text-3xl font-semibold mt-1">
        {Math.round(n.kcal)} <span className="text-base font-normal text-stone-400">kcal</span>
      </p>

      {onzeker && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2 mt-3">
          Ruwe schatting: we konden maar {v.meegerekend} van de {v.totaalIngredienten} ingrediënten
          meerekenen. De echte waarde ligt hoger.
        </p>
      )}

      {/* Macro's als aandeel van de dagreferentie */}
      <div className="space-y-2.5 mt-4">
        {MACROS.map(m => {
          const pct = Math.min(100, riPercentage(n, m.key))
          return (
            <div key={m.key} className="flex items-center gap-3">
              <span className="text-xs text-stone-600 w-24 flex-shrink-0">{m.label}</span>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden flex-1">
                <div className={`h-full ${m.kleur} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-stone-500 w-14 text-right flex-shrink-0">
                {rond(n[m.key])} {m.eenheid}
              </span>
            </div>
          )
        })}
      </div>

      {signalen.length > 0 && (
        <div className="space-y-1.5 mt-4">
          {signalen.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs leading-5" aria-hidden="true">
                {s.status === 'goed' ? '✅' : s.status === 'let-op' ? '💡' : 'ℹ️'}
              </span>
              <p className="text-xs text-stone-600">
                <span className="font-medium text-stone-800">{s.titel}</span> — {s.uitleg}
              </p>
            </div>
          ))}
        </div>
      )}

      {!compact && (
        <>
          <button
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            className="text-xs text-stone-500 underline mt-4"
          >
            {open ? 'Verberg details' : 'Toon details'}
          </button>

          {open && (
            <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5">
              {DETAILS.map(d => (
                <div key={d.key} className="flex justify-between text-xs">
                  <span className="text-stone-500">{d.label}</span>
                  <span className="text-stone-700">{rond(n[d.key], d.decimalen ?? 0)} g</span>
                </div>
              ))}
              <div className="flex justify-between text-xs pt-1.5 border-t border-stone-100">
                <span className="text-stone-500">Hele gerecht ({v.porties} porties)</span>
                <span className="text-stone-700">{Math.round(v.totaal.kcal)} kcal</span>
              </div>

              {v.overgeslagen.length > 0 && (
                <p className="text-xs text-stone-400 pt-2">
                  Niet meegerekend: {v.overgeslagen.map(o => o.name).join(', ')}.
                </p>
              )}

              <p className="text-xs text-stone-400 pt-2">
                Gemiddelde waarden in de geest van de NEVO-tabel, omgerekend naar de hoeveelheden in dit
                recept. Merk, bereiding en portiegrootte maken verschil — zie het als een indicatie.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
