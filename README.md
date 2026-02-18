# KAH Interview Evaluation System

대학생 학회 신입 기수 면접 평가 시스템 - 다중 평가자 실시간 평균 계산 시스템

## 🎯 주요 기능

### ✅ 완벽하게 구현된 기능

1. **다중 평가자 시스템**
   - 여러 명의 면접관이 동시에 같은 지원자를 평가
   - 각 면접관의 평가는 독립적으로 저장
   - 자동으로 평균 점수 계산

2. **실시간 순위 시스템**
   - 평균 점수 기준으로 자동 정렬
   - 평가 저장 시 즉시 순위 업데이트
   - 사이드바에서 실시간 확인

3. **평가 상세보기**
   - 각 지원자의 모든 평가 내역 조회
   - 면접관별 점수/태그/메모 확인
   - 평균 점수 및 점수 분포 확인

4. **PDF 자동 파싱** (시뮬레이션)
   - 드래그 앤 드롭으로 업로드
   - 자동으로 지원자 정보 추출
   - 수동 수정 가능

5. **질적 피드백 시스템**
   - 긍정 태그 9개
   - 부정 태그 7개
   - 클릭으로 간편하게 추가

6. **역량 시각화**
   - 레이더 차트로 역량 표시
   - 6개 영역 점수 시각화
   - 실시간 업데이트

## 🚀 설치 및 실행

### 1. 프로젝트 설정

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000` 열기

### 2. Supabase 설정

#### 2-1. Supabase 프로젝트 생성
1. https://supabase.com 접속
2. 새 프로젝트 생성
3. 프로젝트 설정에서 API URL과 anon key 복사

#### 2-2. 환경 변수 설정
프로젝트 루트에 `.env.local` 파일이 이미 제공되어 있습니다:
```env
NEXT_PUBLIC_SUPABASE_URL=https://kldmiyyjjlsysjevmblz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 2-3. 데이터베이스 스키마 실행
1. Supabase 대시보드 → SQL Editor
2. `supabase-schema.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기
4. Run 버튼 클릭

## 📊 데이터베이스 구조

### candidates 테이블
```sql
- id (UUID): 지원자 고유 ID
- name (TEXT): 지원자 이름
- info (JSONB): 상세 정보
- created_at, updated_at
```

### evaluations 테이블
```sql
- id (UUID): 평가 고유 ID
- candidate_id (UUID): 지원자 ID (FK)
- interviewer_id (TEXT): 면접관 ID
- scores (JSONB): 점수 상세
- total_score (INTEGER): 총점
- tags (JSONB): 태그 목록
- note (TEXT): 메모
- UNIQUE(candidate_id, interviewer_id)
```

## 💡 사용 방법

### 1. 신규 지원자 등록

**방법 A: PDF 업로드**
1. PDF 파일을 드래그 앤 드롭
2. 자동으로 정보 추출됨
3. 필요 시 수정

**방법 B: 수동 입력**
1. "신규 지원자" 버튼 클릭
2. 정보 직접 입력

### 2. 평가 작성

1. 사이드바에서 지원자 선택
2. 점수 입력 (각 항목별 최대 점수 자동 제한)
3. 태그 선택 (긍정/부정)
4. 메모 작성
5. "평가 저장" 버튼 클릭

### 3. 평균 점수 시스템

```
예시:
지원자: 김민준
- 면접관 A: 42점
- 면접관 B: 38점
- 면접관 C: 45점

평균: (42 + 38 + 45) / 3 = 41.67 → 42점 (반올림)

👉 사이드바에 "평균: 42점 (3명)" 표시
```

### 4. 평가 상세보기

1. 사이드바에서 "📊 평가 상세보기" 클릭
2. 모든 면접관의 평가 확인
3. 점수 분포 및 태그 확인

## 📁 프로젝트 구조

```
kah-interview-system/
├── app/
│   ├── components/
│   │   └── InterviewSystem.js    # 메인 컴포넌트
│   ├── globals.css                # 전역 스타일
│   ├── layout.js                  # 레이아웃
│   └── page.js                    # 홈 페이지
├── .env.local                     # 환경 변수 (Supabase)
├── supabase-schema.sql            # DB 스키마
├── package.json
├── next.config.js
├── tailwind.config.js
└── README.md
```

## 🎨 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: JavaScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **State**: React Hooks (useState)

## 🔍 문제 해결

### 버튼이 작동하지 않을 때
- 브라우저 콘솔(F12) 확인
- "Button clicked!" 로그 확인
- Supabase 연결 상태 확인

### 데이터가 안 보일 때
1. Supabase 대시보드에서 테이블 확인
2. `.env.local` 파일 확인
3. SQL 스키마 실행 여부 확인

### 평균 점수가 이상할 때
- Supabase 대시보드 → evaluations 테이블 확인
- total_score 컬럼 값 확인

## 📈 향후 개선 사항

- [ ] 실시간 동기화 (Supabase Realtime)
- [ ] 실제 PDF 파싱 (pdf.js)
- [ ] Excel 내보내기
- [ ] 통계 대시보드
- [ ] 이메일 알림
- [ ] 사용자 인증 시스템

## 🐛 알려진 이슈

1. **LocalStorage 의존성**: 브라우저 데이터 삭제 시 면접관 ID 초기화
   - 해결: 실제 인증 시스템 구현 필요

2. **PDF 파싱**: 현재는 시뮬레이션
   - 해결: pdf.js 또는 서버 사이드 파싱 구현

## 📞 지원

문제 발생 시:
1. 브라우저 콘솔 확인
2. Supabase 대시보드에서 데이터 확인
3. Network 탭에서 API 호출 확인

## 📄 라이선스

MIT License

---

**제작**: KAH Interview System v2.0
**작성일**: 2024
