import './globals.css'

export const metadata = {
  title: 'KAH 면접 평가 시스템',
  description: '대학생 학회 신입 기수 면접 평가 시스템',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
