'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const VALID_ID = 'kgukah'
  const VALID_PW = 'kah2026'

  // Redirect to dashboard if already logged in (same tab session)
  useEffect(() => {
    const auth = sessionStorage.getItem('kah_auth')
    if (auth) {
      router.replace('/dashboard')
    }
  }, [router])

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')

    if (!id.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 모두 입력해주세요.')
      return
    }

    if (id.trim() !== VALID_ID || password !== VALID_PW) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      return
    }

    setLoading(true)
    // sessionStorage: auto-cleared when the tab/browser is closed
    sessionStorage.setItem('kah_auth', JSON.stringify({ id: id.trim(), loggedIn: true }))
    router.push('/dashboard')
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ───────────── Left: Login Form ───────────── */}
      <div className="flex flex-col justify-center items-center w-full md:w-1/2 bg-white px-10 lg:px-20">
        {/* Logo / Brand */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg" style={{ backgroundColor: '#800020' }}>
            <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 leading-snug">
            Welcome to<br />
            <span style={{ color: '#800020' }}>KAH Interview System</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">면접관 계정으로 로그인하세요</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              아이디
            </label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#800020] focus:border-transparent transition"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-white text-sm font-semibold tracking-wide shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#800020' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#600018'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#800020'}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="mt-8 text-xs text-gray-400">
          © 2025 KAH Interview System. All rights reserved.
        </p>
      </div>

      {/* ───────────── Right: User Guide ───────────── */}
      <div className="hidden md:flex flex-col justify-center w-1/2 px-12 lg:px-16 text-white" style={{ backgroundColor: '#800020' }}>
        <div className="max-w-md">
          <h2 className="text-3xl font-bold mb-3">이용 안내서</h2>
          <div className="w-12 h-1 bg-red-300 rounded mb-6" />

          <p className="text-red-100 text-sm leading-relaxed mb-8">
            KAH 면접 평가 시스템은 공정하고 효율적인 면접 진행을 위해 설계되었습니다.
            지원자 정보 확인부터 실시간 점수 입력, 최종 순위 산출까지 모든 과정을 하나의
            시스템에서 처리할 수 있습니다.
          </p>

          <ul className="space-y-5">
            {[
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                ),
                title: '지원자 정보 확인',
                desc: '이름, 학과, 지원 동기 등 지원자의 상세 정보를 한눈에 확인합니다.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                ),
                title: '실시간 점수 입력',
                desc: '슬라이더로 각 역량 점수를 입력하면 즉시 순위에 반영됩니다.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                ),
                title: '역량 분석 레이더 차트',
                desc: '6가지 핵심 역량을 레이더 차트로 시각화하여 강약점을 파악합니다.',
              },
              {
                icon: (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ),
                title: '올림픽 채점 방식 적용',
                desc: '5명 이상 평가 시 최고·최저 점수를 제외하여 더욱 공정한 결과를 도출합니다.',
              },
            ].map(({ icon, title, desc }) => (
              <li key={title} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    {icon}
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">{title}</p>
                  <p className="text-xs text-red-200 leading-relaxed">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
