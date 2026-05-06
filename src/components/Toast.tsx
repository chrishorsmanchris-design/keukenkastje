'use client'

import { createContext, useContext, useState, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'info'
type ToastFn = (msg: string, type?: ToastType) => void

const ToastContext = createContext<ToastFn>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: ToastType }[]>([])

  const show = useCallback((msg: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-24 inset-x-4 max-w-sm mx-auto space-y-2 z-[100] pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-2xl text-sm font-medium shadow-lg text-center animate-fade-in ${
              t.type === 'error' ? 'bg-red-500 text-white' : 'bg-stone-900 text-white'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
