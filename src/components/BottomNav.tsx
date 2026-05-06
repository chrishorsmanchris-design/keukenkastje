'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

const navItems = [
  { href: '/recepten', icon: '📖', key: 'recepten' },
  { href: '/pantry', icon: '🧺', key: 'pantry' },
  { href: '/', icon: '🍳', key: null },
  { href: '/weekmenu', icon: '📅', key: 'weekmenu' },
  { href: '/boodschappenlijst', icon: '🛒', key: 'boodschappenlijst' },
]

export default function BottomNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const locale = pathname.split('/')[1]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-100 safe-area-pb">
      <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-2">
        {navItems.map(({ href, icon, key }) => {
          const fullHref = `/${locale}${href}`
          const isActive = href === '/' ? pathname === fullHref : pathname.startsWith(fullHref)
          const isCenter = href === '/'

          return (
            <Link
              key={href}
              href={fullHref}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                isCenter
                  ? 'bg-orange-500 text-white p-3 rounded-2xl -mt-4 shadow-lg'
                  : isActive
                  ? 'text-orange-500'
                  : 'text-stone-400'
              }`}
            >
              <span className={isCenter ? 'text-xl' : 'text-xl'}>{icon}</span>
              {key && (
                <span className="text-[10px] font-medium">{t(key as 'recepten' | 'pantry' | 'weekmenu' | 'boodschappenlijst')}</span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
