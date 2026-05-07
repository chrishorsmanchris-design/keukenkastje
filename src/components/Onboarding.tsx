'use client'

import { useState, useEffect } from 'react'

const STEPS = [
  {
    icon: '👋',
    title: 'Welkom bij Keukenkastje',
    desc: 'Jouw slimme kookassistent. Plan maaltijden, beheer je voorraad en maak boodschappenlijsten samen met je huishouden.',
    bg: 'bg-orange-50',
    accent: 'text-orange-600',
  },
  {
    icon: '🧺',
    title: 'Pantry',
    desc: 'Scan producten met je camera of zoek op barcode. De app houdt de houdbaarheidsdatum bij en geeft je een seintje.',
    bg: 'bg-green-50',
    accent: 'text-green-600',
  },
  {
    icon: '📅',
    title: 'Weekmenu',
    desc: 'Plan je maaltijden voor de komende week. Selecteer recepten en voeg de ingrediënten direct toe aan je boodschappenlijst.',
    bg: 'bg-blue-50',
    accent: 'text-blue-600',
  },
  {
    icon: '🛒',
    title: 'Boodschappenlijst',
    desc: 'Gedeeld met je huishouden en gesorteerd op supermarkt-looproute. Items blijven zichtbaar, ook zonder internet.',
    bg: 'bg-yellow-50',
    accent: 'text-yellow-700',
  },
]

export default function Onboarding() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!localStorage.getItem('onboarding_done')) {
      setVisible(true)
    }
  }, [])

  function finish() {
    localStorage.setItem('onboarding_done', '1')
    setVisible(false)
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 bg-white z-[100] flex flex-col">
      {/* Skip */}
      <div className="flex justify-end px-6 pt-6">
        <button onClick={finish} className="text-stone-400 text-sm hover:text-stone-600 transition-colors">
          Overslaan
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-6">
        <div className={`w-28 h-28 rounded-3xl ${current.bg} flex items-center justify-center text-5xl shadow-sm`}>
          {current.icon}
        </div>
        <div className="space-y-3 max-w-xs">
          <h2 className="text-2xl font-semibold">{current.title}</h2>
          <p className="text-stone-500 text-sm leading-relaxed">{current.desc}</p>
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="px-6 pb-10 space-y-4">
        {/* Dots */}
        <div className="flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-orange-500' : 'w-2 bg-stone-200'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => (isLast ? finish() : setStep(s => s + 1))}
          className="w-full py-4 bg-orange-500 text-white font-medium rounded-2xl hover:bg-orange-600 active:scale-[0.98] transition-all"
        >
          {isLast ? 'Aan de slag →' : 'Volgende'}
        </button>
      </div>
    </div>
  )
}
