/**
 * KAH 면접 평가 시스템 - Service Worker
 * PWA 설치 지원용 최소 서비스 워커
 * 외부 오리진(Supabase) 요청은 SW가 개입하지 않고 브라우저에 맡김
 */

const CACHE_NAME = 'kah-interview-v2'

// 설치: 캐시 초기화 (정적 자산은 캐시하지 않음 - Supabase 실시간 데이터 앱 특성상)
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// 활성화: 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

// Fetch 핸들러
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // ★ 외부 오리진 요청(Supabase API 포함)은 SW가 처리하지 않음
  // event.respondWith를 호출하지 않으면 브라우저가 기본 동작으로 처리
  if (url.origin !== self.location.origin) {
    return
  }

  // 비 GET 요청(POST, PATCH, DELETE)도 SW 개입 없이 네트워크로
  if (request.method !== 'GET') {
    return
  }

  // 동일 오리진 GET 요청: Network First 전략
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
