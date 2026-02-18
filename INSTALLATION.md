# 🚀 로컬 설치 가이드 (Windows/Mac/Linux)

## ⚡ 3단계로 실행하기

### 📥 1단계: 파일 다운로드

outputs 폴더의 모든 파일을 다운로드하여 원하는 폴더에 압축 해제

```
kah-interview-system/
├── app/
│   ├── components/
│   │   └── InterviewSystem.js
│   ├── globals.css
│   ├── layout.js
│   └── page.js
├── .env.local
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── supabase-schema.sql
├── README.md
└── QUICKSTART.md
```

### 🔧 2단계: 의존성 설치

**Windows (PowerShell):**
```powershell
cd kah-interview-system
npm install
```

**Mac/Linux (Terminal):**
```bash
cd kah-interview-system
npm install
```

설치가 완료될 때까지 1-2분 대기 (인터넷 속도에 따라 다름)

### 🗄️ 3단계: Supabase 데이터베이스 설정

#### A. Supabase 웹사이트 접속
1. https://supabase.com 접속
2. 로그인 (GitHub 계정으로 가능)
3. 왼쪽 메뉴에서 **SQL Editor** 클릭

#### B. SQL 스키마 실행
1. `supabase-schema.sql` 파일 열기
2. 전체 내용 복사 (Ctrl+A, Ctrl+C)
3. Supabase SQL Editor에 붙여넣기 (Ctrl+V)
4. **Run** 버튼 클릭
5. "Success. No rows returned" 메시지 확인 ✅

#### C. 환경 변수 확인
`.env.local` 파일이 이미 제공되어 있으므로 추가 설정 불필요!

### ▶️ 4단계: 실행!

```bash
npm run dev
```

터미널에 다음과 같은 메시지가 나타남:
```
  ▲ Next.js 14.2.3
  - Local:        http://localhost:3000
  - Ready in 2.3s
```

브라우저에서 **http://localhost:3000** 접속!

---

## 🎯 첫 사용 가이드

### 1️⃣ 신규 지원자 추가
1. **"+ 신규 지원자"** 버튼 클릭
2. 이름 입력 (예: "김민준")
3. 전화번호, 이메일 등 입력
4. **"✓ 평가 저장"** 클릭

### 2️⃣ 평가하기
1. 사이드바에서 지원자 이름 클릭
2. 점수 입력:
   - 성실성: 3
   - 협조성: 3
   - 표현력: 3
   - ... (총 12개 항목)
3. 태그 선택 (예: "논리정연함", "자신감 있음")
4. 메모 작성
5. **"✓ 평가 저장"** 클릭

### 3️⃣ 다중 평가자 테스트
1. **Chrome 일반 창**: 면접관 A로 평가
2. **Chrome 시크릿 창** (Ctrl+Shift+N): 면접관 B로 평가
3. **Firefox 또는 Edge**: 면접관 C로 평가

각 브라우저에서 동일한 지원자를 평가하면 평균 점수가 자동 계산됩니다!

---

## 🐛 문제 해결

### ❌ "npm: command not found"
**Node.js가 설치되지 않음**

**해결 방법:**
1. https://nodejs.org 접속
2. **LTS 버전** 다운로드 (20.x)
3. 설치 후 터미널/PowerShell 재시작
4. `node --version` 확인

### ❌ "Module not found: Can't resolve '@supabase/supabase-js'"
**의존성 설치 실패**

**해결 방법:**
```bash
rm -rf node_modules package-lock.json  # Mac/Linux
# 또는
rmdir /s node_modules & del package-lock.json  # Windows

npm install
```

### ❌ "Error: connect ECONNREFUSED"
**Supabase 연결 실패**

**해결 방법:**
1. `.env.local` 파일 확인
2. Supabase URL과 ANON_KEY 정확한지 확인
3. Supabase 프로젝트가 활성화되어 있는지 확인

### ❌ 포트 3000이 이미 사용 중
**다른 프로세스가 포트 사용**

**해결 방법:**
```bash
npm run dev -- -p 3001  # 3001 포트 사용
```

---

## 📊 데이터 확인

### Supabase 대시보드에서 데이터 보기
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. **Table Editor** 클릭
4. **candidates** 테이블 선택 → 지원자 목록 확인
5. **evaluations** 테이블 선택 → 평가 내역 확인

---

## 🎨 커스터마이징

### 태그 수정
`app/components/InterviewSystem.js` 파일에서:
```javascript
const POSITIVE_TAGS = ["논리정연함", "자신감 있음", ...] // 여기 수정
const NEGATIVE_TAGS = ["소극적 태도", "동문서답", ...] // 여기 수정
```

### 점수 배점 수정
```javascript
const MAX_SCORES = {
  sincerity: 3,      // 성실성 만점 (수정 가능)
  cooperation: 3,    // 협조성 만점
  ...
}
```

---

## 🚀 프로덕션 배포

### Vercel에 배포 (무료)
1. https://vercel.com 접속
2. GitHub에 프로젝트 푸시
3. Vercel에서 **Import Project**
4. 환경 변수 설정:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Deploy** 클릭

5분 후 전 세계 어디서나 접속 가능! 🌍

---

## 💡 유용한 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# 코드 검사
npm run lint

# 의존성 업데이트
npm update
```

---

## 📞 추가 도움이 필요하신가요?

1. **README.md** - 전체 문서
2. **QUICKSTART.md** - 빠른 시작 가이드
3. **IMPLEMENTATION_GUIDE.md** - 구현 세부사항

문제가 계속되면 브라우저 콘솔(F12)을 확인하고 에러 메시지를 검색해보세요!

---

**제작**: KAH Interview System v2.0  
**라이선스**: MIT  
**지원**: Next.js 14, React 18, Supabase
