'use client'

import { ToastProvider } from './Toast'
import Onboarding from './Onboarding'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <Onboarding />
      {children}
    </ToastProvider>
  )
}
