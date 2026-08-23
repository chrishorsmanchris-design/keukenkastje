'use client'

import { useState } from 'react'
import Link from 'next/link'
import { classify, type Bevinding, type Maaltijd, type Richting, type Vak, type WeekAnalyse } from '@/lib/schijf-van-vijf'

const VAK_LABEL: Record<Vak, { naam: string; icon: string; kleur: string }> = {
  groente:  { naam: 'Groente',            icon: '🥦', kleur: 'bg-green-500'  },
  fruit:    { naam: 'Fruit',              icon: '🍎', kleur: 'bg-red-400'    },
  granen:   { naam: 'Granen & aardappel', icon: '🍞', kleur: 'bg-amber-500'  },
  eiwit:    { naam: 'Vis, vlees, peul & noten', icon: '🐟', kleur: 'bg-blue-500' },
  zuivel:   { naam: 'Zuivel',             icon: '🥛', kleur: 'bg-sky-300'    },
  vetten:   { naam: 'Vetten',             icon: '🫒', kleur: 'bg-yellow-500' },
  dranken:  { naam: 'Dranken',            icon: '🥤', kleur: 'bg-cyan-500'   },
  rest:     { naam: 'Rest',               icon: '🧂', kleur: 'bg-stone-300'  },
}

/** De vijf vakken die we als "binnen de Schijf van Vijf" tonen. */
const HOOFDVAKKEN: Vak[] = ['groente', 'fruit', 'granen', 'eiwit', 'zuivel', 'vetten']

const DAG_LETTERS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']

function dagLabel(date: string): string {
  return DAG_LETTERS[new Date(date + 'T12:00:00').getDay()]
}

export type Periode = {
  analyse: WeekAnalyse
  bevindingen: Bevinding[]
  maaltijden: Maaltijd[]
  dates: string[]
}

export default function AnalyseClient({
  locale, terug, vooruit, gekocht,
}: {
  locale: string
  terug: Periode
  vooruit: Periode
  gekocht: { name: string }[]
}) {
  const [richting, setRichting] = useState<Richting>('terug')
  const periode = richting === 'terug' ? terug : vooruit
  const isVooruit = richting === 'vooruit'
  const { analyse, bevindingen, maaltijden, dates } = periode

  const vandaag = new Date().toISOString().split('T')[0]
  const totaalIngredienten = HOOFDVAKKEN.reduce((sum, v) => sum + analyse.vakken[v], 0)

  const maaltijdPerDag = new Map<string, Maaltijd[]>()
  for (const m of maaltijden) {
    const lijst = maaltijdPerDag.get(m.date) ?? []
    lijst.push(m)
    maaltijdPerDag.set(m.date, lijst)
  }

  const opeDagen = dates.filter(d => !maaltijdPerDag.has(d))

  /**
   * Op dagen zonder weekmenu weten we niet wat er gegeten is. Wel wat er die
   * week is gekocht — dat geeft nog een indicatie van groente en fruit.
   */
  const gekochteGroenteFruit = gekocht.filter(g => {
    const vak = classify(g.name).vak
    return vak === 'groente' || vak === 'fruit'
  })

  const dekking = analyse.bekendeDagen / analyse.totaalDagen

  return (
    <div className="px-4 pt-12 pb-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Weekanalyse</h1>
        <p className="text-stone-500 text-sm mt-1">
          {isVooruit
            ? 'De komende 7 dagen, langs de Schijf van Vijf gelegd — nu nog bij te sturen.'
            : 'De afgelopen 7 dagen, langs de Schijf van Vijf gelegd.'}
        </p>
      </div>

      {/* Terug- of vooruitkijken */}
      <div role="tablist" aria-label="Periode" className="flex bg-stone-100 rounded-2xl p-1">
        {([
          { key: 'terug' as const,   label: 'Afgelopen week' },
          { key: 'vooruit' as const, label: 'Komende week'   },
        ]).map(tab => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={richting === tab.key}
            onClick={() => setRichting(tab.key)}
            className={`flex-1 text-sm font-medium py-2 rounded-xl transition-colors ${
              richting === tab.key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dekking: eerlijk zijn over hoeveel we eigenlijk weten */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-medium text-sm">
            {isVooruit ? 'Wat er al gepland staat' : 'Wat we van deze week weten'}
          </p>
          <span className="text-xs text-stone-400">
            {analyse.bekendeDagen} van {analyse.totaalDagen} dagen
          </span>
        </div>
        <div className="flex justify-between">
          {dates.map(date => {
            const heeft = maaltijdPerDag.has(date)
            const isVandaag = date === vandaag
            return (
              <div key={date} className="flex flex-col items-center gap-1">
                <span className={`text-[10px] ${isVandaag ? 'text-orange-500 font-medium' : 'text-stone-400'}`}>
                  {dagLabel(date)}
                </span>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    heeft ? 'bg-green-500 text-white'
                      : isVooruit ? 'border-2 border-dashed border-stone-300 bg-white text-stone-400'
                      : 'bg-stone-200 text-stone-400'
                  } ${isVandaag ? 'ring-2 ring-orange-300 ring-offset-1' : ''}`}
                  title={heeft ? maaltijdPerDag.get(date)!.map(m => m.title).join(', ') : 'Nog niets gepland'}
                >
                  {heeft ? '✓' : isVooruit ? '' : '?'}
                </div>
              </div>
            )
          })}
        </div>
        {dekking < 1 && (
          <p className="text-xs text-stone-500 mt-3">
            {isVooruit ? (
              <>
                Nog {opeDagen.length} {opeDagen.length === 1 ? 'dag' : 'dagen'} open:{' '}
                {opeDagen.map(dagLabel).join(', ')}.{' '}
                <Link href={`/${locale}/weekmenu`} className="text-orange-500 underline">
                  Vul je weekmenu aan
                </Link>{' '}
                en zie hier meteen wat het met je week doet.
              </>
            ) : (
              <>
                Op de dagen met een vraagteken staat niets in het weekmenu, dus daar kunnen we niets over
                zeggen.{' '}
                <Link href={`/${locale}/weekmenu`} className="text-orange-500 underline">
                  Vul je weekmenu aan
                </Link>{' '}
                voor een completer beeld.
              </>
            )}
          </p>
        )}
      </div>

      {analyse.bekendeDagen === 0 ? (
        <div className="bg-white border border-dashed border-stone-300 rounded-2xl p-6 text-center">
          <p className="text-3xl">{isVooruit ? '🗓️' : '📊'}</p>
          <p className="font-medium text-sm mt-2">
            {isVooruit ? 'Nog niets gepland' : 'Nog niets te analyseren'}
          </p>
          <p className="text-stone-500 text-xs mt-1">
            {isVooruit
              ? 'Zet maaltijden in het weekmenu, dan zie je hier meteen of je week gevarieerd wordt.'
              : 'Zodra je maaltijden in het weekmenu zet, zie je hier of je week gevarieerd is.'}
          </p>
          <Link
            href={`/${locale}/weekmenu`}
            className="inline-block mt-4 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-2xl"
          >
            Naar het weekmenu
          </Link>
        </div>
      ) : (
        <>
          {/* Verdeling over de vakken */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4">
            <p className="font-medium text-sm mb-3">Verdeling over de Schijf van Vijf</p>
            <div className="space-y-2.5">
              {HOOFDVAKKEN.map(vak => {
                const aantal = analyse.vakken[vak]
                const deel = totaalIngredienten > 0 ? aantal / totaalIngredienten : 0
                const { naam, icon, kleur } = VAK_LABEL[vak]
                return (
                  <div key={vak} className="flex items-center gap-3">
                    <span className="text-base w-6 flex-shrink-0" aria-hidden="true">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-stone-600 truncate">{naam}</span>
                        <span className="text-xs text-stone-400 flex-shrink-0 ml-2">{aantal}×</span>
                      </div>
                      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${kleur} rounded-full transition-all`}
                          style={{ width: `${Math.round(deel * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-stone-400 mt-3">
              Geteld per ingrediënt in de gerechten van {isVooruit ? 'komende' : 'deze'} week — een
              indicatie, geen weegschaal.
            </p>
          </div>

          {/* Bevindingen */}
          <div className="space-y-2">
            {bevindingen.map((b, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-2xl p-3 border ${
                  b.status === 'goed' ? 'bg-green-50 border-green-200'
                    : b.status === 'let-op' ? 'bg-amber-50 border-amber-200'
                    : 'bg-stone-50 border-stone-200'
                }`}
              >
                <span className="text-base" aria-hidden="true">
                  {b.status === 'goed' ? '✅' : b.status === 'let-op' ? '💡' : 'ℹ️'}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{b.titel}</p>
                  <p className="text-stone-600 text-xs mt-0.5">{b.uitleg}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bij vooruitkijken: de open dagen zijn de knop, niet een klacht */}
          {isVooruit && opeDagen.length > 0 && (
            <Link
              href={`/${locale}/weekmenu`}
              className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl p-3 hover:brightness-95 transition-all"
            >
              <span className="text-xl" aria-hidden="true">🗓️</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">
                  {opeDagen.length === 1
                    ? 'Er is nog één avond vrij'
                    : `Er zijn nog ${opeDagen.length} avonden vrij`}
                </p>
                <p className="text-stone-500 text-xs">
                  Vul ze in met wat er nog ontbreekt en de analyse loopt meteen mee.
                </p>
              </div>
              <span className="text-stone-400 text-sm" aria-hidden="true">→</span>
            </Link>
          )}

          {/* Variatie */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4">
            <p className="font-medium text-sm mb-3">Variatie</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-semibold">{analyse.uniekeRecepten}</p>
                <p className="text-xs text-stone-500">verschillende gerechten</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{analyse.vleesloosDagen}</p>
                <p className="text-xs text-stone-500">dagen zonder vlees of vis</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{analyse.keukens.length}</p>
                <p className="text-xs text-stone-500">keukens</p>
              </div>
            </div>
            {analyse.keukens.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {analyse.keukens.map(k => (
                  <span key={k.naam} className="text-xs bg-stone-100 text-stone-600 rounded-full px-2.5 py-1">
                    {k.naam} {k.aantal > 1 && `${k.aantal}×`}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Vooruit: kwam iets van vorige week ook al voorbij? */}
          {isVooruit && (() => {
            const vorige = new Set(terug.maaltijden.map(m => m.title))
            const opnieuw = [...new Set(
              vooruit.maaltijden.filter(m => vorige.has(m.title)).map(m => m.title),
            )]
            if (opnieuw.length === 0) return null
            return (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                <p className="font-medium text-sm">Ook vorige week al gegeten</p>
                <p className="text-stone-500 text-xs mt-0.5">
                  Niet per se erg — handig om te weten als je afwisseling zoekt.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {opnieuw.map(t => (
                    <span key={t} className="text-xs bg-white border border-stone-200 text-stone-600 rounded-full px-2.5 py-1">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* Boodschappen als aanvullend signaal — alleen bij terugkijken */}
      {!isVooruit && gekochteGroenteFruit.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-4">
          <p className="font-medium text-sm">Ook gekocht deze week</p>
          <p className="text-stone-500 text-xs mt-0.5">
            {gekochteGroenteFruit.length} keer groente of fruit afgevinkt op de boodschappenlijst — ook als er
            geen recept bij hoorde.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {gekochteGroenteFruit.slice(0, 12).map((g, i) => (
              <span key={`${g.name}-${i}`} className="text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-1">
                {g.name}
              </span>
            ))}
            {gekochteGroenteFruit.length > 12 && (
              <span className="text-xs text-stone-400 px-1 py-1">+{gekochteGroenteFruit.length - 12}</span>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-stone-400 text-center px-4">
        Gebaseerd op de adviezen van het Voedingscentrum. Dit is een grove indicatie op basis van
        ingrediëntnamen en geen voedingsadvies.
      </p>
    </div>
  )
}
