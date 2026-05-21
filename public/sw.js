// Keukenkastje Service Worker

self.addEventListener('install', () => self.skipWaiting())
// activate listener replaced below with cache-cleanup version

// Push notification ontvangen van server
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Keukenkastje', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url ?? '/' },
      tag: data.tag ?? 'keukenkastje',
      renotify: true,
    })
  )
})

// Klik op notificatie → app openen
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      const existing = windowClients.find(w => w.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow(url)
    })
  )
})

// ── Offline caching ───────────────────────────────────────────────────────────
const CACHE_NAME = 'keukenkastje-v1'
const IMAGE_CACHE = 'keukenkastje-images-v1'

// Schoon oude caches op bij activatie
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== IMAGE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // API routes: nooit cachen
  if (url.pathname.startsWith('/api/')) return

  // Recipe images (Supabase storage of externe URL): CacheFirst
  const isImage = /\.(png|jpe?g|webp|gif|svg)($|\?)/i.test(url.pathname) ||
    url.hostname.includes('supabase.co')
  if (isImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone())
            return response
          }).catch(() => cached ?? new Response('', { status: 404 }))
        })
      )
    )
    return
  }

  // Recept-detailpagina's: NetworkFirst met 4s timeout, dan cache
  const isRecipePage = /\/recepten\/[^/]+$/.test(url.pathname)
  if (isRecipePage) {
    event.respondWith(
      Promise.race([
        fetch(request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
          }
          return response
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
      ]).catch(() =>
        caches.match(request).then(cached => cached ?? fetch(request))
      )
    )
    return
  }

  // Next.js statische assets: CacheFirst (hebben content-hash in URL)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
        })
      )
    )
    return
  }
})

// Timer notificaties plannen (client → SW bericht)
const timerTimeouts = new Map()

self.addEventListener('message', (event) => {
  const { type, id, label, durationMs } = event.data ?? {}

  if (type === 'SCHEDULE_TIMER') {
    // Annuleer eventuele bestaande timer voor dit id
    if (timerTimeouts.has(id)) {
      clearTimeout(timerTimeouts.get(id))
      timerTimeouts.delete(id)
    }
    const t = setTimeout(() => {
      timerTimeouts.delete(id)
      self.registration.showNotification('⏱ Timer klaar!', {
        body: label + ' is klaar',
        icon: '/icon-192.png',
        vibrate: [400, 100, 400, 100, 400],
        tag: 'timer-' + id,
        renotify: true,
      })
    }, durationMs)
    timerTimeouts.set(id, t)
  }

  if (type === 'CANCEL_TIMER') {
    if (timerTimeouts.has(id)) {
      clearTimeout(timerTimeouts.get(id))
      timerTimeouts.delete(id)
    }
  }
})
