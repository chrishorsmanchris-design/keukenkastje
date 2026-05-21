'use client'

import { createContext, useContext, useState, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'info'
type ToastOptions = { action?: { label: string; onClick: () => void } }
type ToastFn = (msg: string, type?: ToastType, options?: ToastOptions) => void

const ToastContext = createContext<ToastFn>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: ToastType; action?: ToastOptions['action'] }[]>([])

  const MAX_TOASTS = 3

  const show = useCallback((msg: string, type: ToastType = 'success', options?: ToastOptions) => {
    const id = Date.now()
    setToasts(t => {
      const trimmed = t.length >= MAX_TOASTS ? t.slice(t.length - MAX_TOASTS + 1) : t
      return [...trimmed, { id, msg, type, action: options?.action }]
    })
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-24 inset-x-4 max-w-sm mx-auto space-y-2 z-[100]">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-2xl text-sm font-medium shadow-lg flex items-center justify-between gap-3 ${
              t.type === 'error' ? 'bg-red-500 text-white' : 'bg-stone-900 text-white'
            }`}
          >
            <span>{t.msg}</span>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); setToasts(ts => ts.filter(x => x.id !== t.id)) }}
                className="text-orange-400 font-semibold flex-shrink-0 hover:text-orange-300"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
