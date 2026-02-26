/**
 * KAH 면접 평가 시스템 - Service Worker
 * PWA 설치 지원용 최소 서비스 워커
 * Supabase 실시간 동기화를 위해 네트워크 요청은 항상 통과
 */

const CACHE_NAME = 'kah-interview-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
]

// 설치: 핵심 정적 파일 캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // 캐시 실패는 무시 (오프라인 지원 없이도 PWA 설치는 가능)
      })
    })
  )
  self.skipWaiting()
})

// 활성화: 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch: Network First 전략 (Supabase 실시간 데이터 우선)
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Supabase, 외부 API 요청은 항상 네트워크로
  if (url.hostname.includes('supabase') || url.hostname !== self.location.hostname) {
    event.respondWith(fetch(request))
    return
  }

  // 정적 자산: Cache First
  if (request.destination === 'image' || request.destination === 'style' || request.destination === 'script') {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const cloned = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned))
          }
          return response
        })
      })
    )
    return
  }

  // 페이지 탐색: Network First, 실패 시 캐시
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
