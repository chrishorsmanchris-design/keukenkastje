// Keukenkastje Service Worker

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))

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
