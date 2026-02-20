'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import InterviewSystem from '../components/InterviewSystem'

export default function DashboardPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const auth = sessionStorage.getItem('kah_auth')
    if (!auth) {
      router.replace('/')
    } else {
      setAuthorized(true)
    }
  }, [router])

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-400 text-sm">인증 확인 중...</div>
      </div>
    )
  }

  return <InterviewSystem />
}
