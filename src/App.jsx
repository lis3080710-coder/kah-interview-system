import { useState, useEffect, useRef, useCallback } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import * as XLSX from "xlsx";

// ─── Supabase Client (Inline) ────────────────────────────────────────────────
const SUPABASE_URL = "https://kldmiyyjjlsysjevmblz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsZG1peXlqamxzeXNqZXZtYmx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNDIyOTYsImV4cCI6MjA4NjkxODI5Nn0.kwB8sZMHqncZbNKNCpMy7DpE0mUy2CPTlYDaEOEFAww";

const createSupabaseClient = (url, key) => {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const from = (table) => ({
    select: (columns = '*') => ({
      order: (column, options = {}) => ({
        execute: async () => {
          const order = options.ascending ? 'asc' : 'desc';
          const res = await fetch(`${url}/rest/v1/${table}?select=${columns}&order=${column}.${order}`, { headers });
          return { data: await res.json(), error: res.ok ? null : new Error('Failed to fetch') };
        }
      }),
      eq: (column, value) => ({
        execute: async () => {
          const res = await fetch(`${url}/rest/v1/${table}?select=${columns}&${column}=eq.${value}`, { headers });
          return { data: await res.json(), error: res.ok ? null : new Error('Failed to fetch') };
        }
      }),
    }),
    insert: (data) => ({
      select: () => ({
        single: async () => {
          const res = await fetch(`${url}/rest/v1/${table}`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=representation' },
            body: JSON.stringify(data)
          });
          const json = await res.json();
          return { data: Array.isArray(json) ? json[0] : json, error: res.ok ? null : new Error('Failed to insert') };
        }
      })
    }),
    update: (data) => ({
      eq: (column, value) => ({
        execute: async () => {
          const res = await fetch(`${url}/rest/v1/${table}?${column}=eq.${value}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(data)
          });
          const text = await res.text();
          const json = text ? JSON.parse(text) : null;
          return { data: json, error: res.ok ? null : new Error('Failed to update') };
        }
      })
    }),
    upsert: (data) => ({
      execute: async () => {
        const res = await fetch(`${url}/rest/v1/${table}`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
          body: JSON.stringify(data)
        });
        return { data: await res.json(), error: res.ok ? null : new Error('Failed to upsert') };
      }
    }),
  });

  const settings = {
    get: async (key) => {
      try {
        const res = await fetch(`${url}/rest/v1/app_settings_gen6?key=eq.${encodeURIComponent(key)}&select=value`, { headers });
        if (!res.ok) return null;
        const json = await res.json();
        return json?.[0]?.value ?? null;
      } catch { return null; }
    },
    set: async (key, value) => {
      try {
        await fetch(`${url}/rest/v1/app_settings_gen6`, {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ key, value }),
        });
      } catch { /* silent fail */ }
    },
  };

  return { from, settings };
};

const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getInterviewerId() {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem('kah_interviewer_id');
  if (!id) {
    id = `interviewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('kah_interviewer_id', id);
  }
  return id;
}

// ─── KAH Logo Component ───────────────────────────────────────────────────────
const KAHLogo = () => (
  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 12px rgba(220,38,38,0.4)",
      flexShrink: 0
    }}>
      <span style={{ color: "#fff", fontWeight: 900, fontSize: 14, letterSpacing: -0.5, fontFamily: "'Georgia', serif" }}>KAH</span>
    </div>
    <div>
      <div style={{ color: "#7f1d1d", fontWeight: 800, fontSize: 15, letterSpacing: -0.3, lineHeight: 1.1 }}>KAH Interview</div>
      <div style={{ color: "#64748b", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Evaluation System</div>
    </div>
  </div>
);

// ─── Constants ─────────────────────────────────────────────────────────────
const POSITIVE_TAGS = ["논리정연함", "자신감 있음", "준비 철저", "협업 마인드", "아이디어 우수", "높은 직무 이해도", "경청과 소통", "구체적 경험 제시", "성장 지향성"];
const NEGATIVE_TAGS = ["소극적 태도", "동문서답", "근거 부족", "목소리 작음", "긴장함", "협업 우려", "방어적 태도"];

const DEFAULT_EVAL_CATEGORIES = [
  { id: 'job', label: '직무적합도', items: [
    { field: 'sincerity', label: '성실성', max: 3 },
    { field: 'cooperation', label: '협조성', max: 3 },
    { field: 'planning', label: '계획성', max: 3 },
  ]},
  { id: 'communication', label: '의사소통', items: [
    { field: 'expression', label: '표현력', max: 3 },
    { field: 'commonsense', label: '상식성', max: 3 },
  ]},
  { id: 'personality_cat', label: '인성', items: [
    { field: 'proactivity', label: '적극성', max: 3 },
    { field: 'personality', label: '인성', max: 3 },
  ]},
  { id: 'surprise_q', label: '돌발질문', items: [
    { field: 'q1', label: '내용 1', max: 5 },
    { field: 'q2', label: '내용 2', max: 5 },
    { field: 'comprehension', label: '이해력', max: 5 },
    { field: 'logic', label: '논리력', max: 5 },
    { field: 'creativity', label: '창의력', max: 5 },
  ]},
];

const DEFAULT_SURPRISE_TOPICS = [
  { id: 1, text: '조직문화 적응' },
  { id: 2, text: '갈등 해결 경험' },
  { id: 3, text: '리더십 경험' },
  { id: 4, text: '실패 경험과 극복' },
  { id: 5, text: '지원 동기' },
  { id: 6, text: '향후 목표' },
  { id: 7, text: '팀워크 경험' },
  { id: 8, text: '스트레스 관리' },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  wrap: {
    fontFamily: "'DM Sans', 'Pretendard', 'Noto Sans KR', sans-serif",
    background: "#f0f4f8",
    minHeight: "100vh",
    color: "#1e293b",
  },
  header: {
    position: "sticky", top: 0, zIndex: 50,
    background: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid #e2e8f0",
    padding: "0 24px",
    height: 64,
    display: "flex", alignItems: "center", justifyContent: "space-between",
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  },
  body: { display: "flex", alignItems: "flex-start" },
  sidebar: {
    width: 260, flexShrink: 0,
    position: "sticky", top: 64,
    height: "calc(100vh - 64px)",
    overflowY: "auto",
    background: "#fff",
    borderRight: "1px solid #e2e8f0",
    padding: "20px 16px",
  },
  main: { flex: 1, padding: "24px", maxWidth: 900 },
  card: {
    background: "#fff",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    padding: "24px",
    marginBottom: 20,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  sectionTitle: {
    fontSize: 13, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: 1.2, color: "#64748b", marginBottom: 16,
    display: "flex", alignItems: "center", gap: 8,
  },
  inputRow: { display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  inputGroup: { display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 140 },
  label: { fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: 0.5 },
  input: {
    border: "1.5px solid #e2e8f0",
    borderRadius: 8, padding: "8px 12px", fontSize: 13,
    outline: "none", color: "#1e293b",
    transition: "border-color 0.15s",
    background: "#fafbfc",
    width: "100%", boxSizing: "border-box",
  },
  scoreRow: {
    display: "flex", alignItems: "center",
    padding: "10px 0", borderBottom: "1px solid #f1f5f9",
    gap: 12,
  },
  scoreLabel: { flex: 1, fontSize: 13, color: "#334155", fontWeight: 500 },
  scoreInput: {
    width: 60, border: "1.5px solid #e2e8f0",
    borderRadius: 8, padding: "6px 10px",
    fontSize: 13, textAlign: "center",
    outline: "none", color: "#1e293b",
    background: "#fafbfc",
  },
  maxLabel: { fontSize: 11, color: "#94a3b8", minWidth: 50 },
  totalBox: {
    background: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)",
    borderRadius: 12, padding: "16px 20px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    color: "#fff", marginTop: 16,
  },
  btn: {
    border: "none", borderRadius: 8, padding: "8px 16px",
    fontSize: 13, fontWeight: 600, cursor: "pointer",
    transition: "all 0.15s",
  },
  primaryBtn: {
    background: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)",
    color: "#fff", boxShadow: "0 2px 8px rgba(220,38,38,0.3)",
  },
  rankItem: (isActive) => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "10px 12px", borderRadius: 10, marginBottom: 6,
    background: isActive ? "#fef2f2" : "#f8fafc",
    border: isActive ? "1.5px solid #fecaca" : "1.5px solid transparent",
    cursor: "pointer", transition: "all 0.15s",
  }),
  rankBadge: (rank) => ({
    width: 22, height: 22, borderRadius: 6,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 10, fontWeight: 800, flexShrink: 0,
    background: rank === 1 ? "#fbbf24" : rank === 2 ? "#94a3b8" : rank === 3 ? "#cd7c3a" : "#e2e8f0",
    color: rank <= 3 ? "#fff" : "#64748b",
  }),
  tag: (type) => ({
    display: "inline-flex", alignItems: "center",
    padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    border: "none", cursor: "pointer",
    background: type === "positive" ? "#dcfce7" : "#fee2e2",
    color: type === "positive" ? "#166534" : "#991b1b",
    marginRight: 6, marginBottom: 6,
    transition: "all 0.15s",
  }),
  badge: (type) => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: type === "positive" ? "#22c55e" : "#ef4444",
    color: "#fff", marginRight: 6, marginBottom: 6,
  }),
  timerBtn: (variant) => ({
    border: "none", borderRadius: 8, padding: "6px 14px",
    fontSize: 12, fontWeight: 700, cursor: "pointer",
    background: variant === "start" ? "#22c55e" : variant === "pause" ? "#f59e0b" : "#94a3b8",
    color: "#fff",
    transition: "all 0.15s",
  }),
  dropZone: (dragging) => ({
    border: `2px dashed ${dragging ? "#dc2626" : "#cbd5e1"}`,
    borderRadius: 12,
    padding: "32px",
    textAlign: "center",
    background: dragging ? "#fef2f2" : "#f8fafc",
    cursor: "pointer",
    transition: "all 0.2s",
  }),
  smallBtn: {
    border: "1.5px solid #e2e8f0", borderRadius: 6, padding: "4px 10px",
    fontSize: 11, fontWeight: 600, cursor: "pointer",
    background: "#fff", color: "#64748b", transition: "all 0.15s",
  },
  smallPrimaryBtn: {
    border: "none", borderRadius: 6, padding: "4px 10px",
    fontSize: 11, fontWeight: 600, cursor: "pointer",
    background: "#dc2626", color: "#fff", transition: "all 0.15s",
  },
  smallDangerBtn: {
    border: "none", borderRadius: 6, padding: "4px 8px",
    fontSize: 11, fontWeight: 600, cursor: "pointer",
    background: "#fee2e2", color: "#991b1b", transition: "all 0.15s",
  },
};

// ─── Excel Parser ─────────────────────────────────────────────────────────────
function cellStr(v) { return String(v ?? '').trim(); }

const EMPTY_CAREERS = () => [
  { type: '', content: '', period: '', org: '' },
  { type: '', content: '', period: '', org: '' },
  { type: '', content: '', period: '', org: '' },
  { type: '', content: '', period: '', org: '' },
];

// KAH 폼 형식 파싱 (레이블-값 쌍 구조)
function parseKAHForm(rows, selfIntroRows) {
  const info = {};

  // ── 1) 인적사항: 각 행에서 레이블-값 쌍 스캔 ──────────────────────────
  const PERSONAL_MAP = {
    '이름(한글)': 'name', '이름': 'name', '성명': 'name',
    '생년월일': 'dob',
    '학번': 'studentId',
    '12개월 참여 가능': 'available12', '12개월참여가능': 'available12',
    '휴대전화': 'phone', '전화번호': 'phone',
    'E-mail': 'email', 'e-mail': 'email', '이메일': 'email',
    '주소': 'address',
    '전공': 'major', '학과': 'major',
    '학년-학기': 'grade',
    '작성일': 'writtenDate',
  };
  for (const row of rows) {
    for (let i = 0; i < row.length - 1; i++) {
      const label = cellStr(row[i]);
      if (!label) continue;
      const field = PERSONAL_MAP[label];
      if (field && !info[field]) {
        for (let j = i + 1; j < row.length; j++) {
          const val = cellStr(row[j]);
          if (val) { info[field] = val; break; }
        }
      }
    }
  }

  // ── 2) 관심분야 ───────────────────────────────────────────────────────
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    if (row.some(c => cellStr(c) === '관심 직무')) {
      const hdr = row;
      const dat = rows[ri + 1] || [];
      hdr.forEach((h, ci) => {
        const hs = cellStr(h); const ds = cellStr(dat[ci]);
        if (hs === '1지망') info.jobPref1 = ds;
        if (hs === '2지망') info.jobPref2 = ds;
        if (hs === '3지망') info.jobPref3 = ds;
        if (hs === 'HRM') info.hrmRank = ds;
        if (hs === 'HRD') info.hrdRank = ds;
        if (hs === '노사') info.laborRank = ds;
      });
      break;
    }
  }

  // ── 3) 경력 및 활동사항 (4칸 테이블) ────────────────────────────────
  let inCareer = false;
  let careerColMap = {};
  const careers = [];
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const rt = row.map(cellStr).join('');
    if (rt.includes('경력 및 활동사항') || rt.includes('경력및활동사항')) { inCareer = true; continue; }
    if (inCareer && row.some(c => cellStr(c) === '구분')) {
      careerColMap = {};
      row.forEach((c, ci) => {
        const v = cellStr(c);
        if (v === '구분') careerColMap[ci] = 'type';
        if (v === '활동 내용' || v === '활동내용') careerColMap[ci] = 'content';
        if (v === '활동 기간' || v === '활동기간') careerColMap[ci] = 'period';
        if (v === '기관 및 단체명' || v === '기관및단체명') careerColMap[ci] = 'org';
      });
      continue;
    }
    if (inCareer && Object.keys(careerColMap).length > 0) {
      if (/^\d+\.\s/.test(cellStr(row[0]))) { inCareer = false; continue; }
      const entry = { type: '', content: '', period: '', org: '' };
      Object.entries(careerColMap).forEach(([ci, field]) => {
        const val = cellStr(row[ci]);
        if (val) entry[field] = val;
      });
      if (Object.values(entry).some(v => v)) careers.push(entry);
    }
  }
  while (careers.length < 4) careers.push({ type: '', content: '', period: '', org: '' });
  info.careers = careers.slice(0, 4);

  // ── 4) KAH를 알게 된 경로 ────────────────────────────────────────────
  let inHowFound = false;
  let howFoundOptions = [];
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const rt = row.map(cellStr).join('');
    if (rt.includes('알게 된 경로') || rt.includes('알게된경로')) { inHowFound = true; continue; }
    if (inHowFound && howFoundOptions.length === 0 && row.some(c => cellStr(c))) {
      howFoundOptions = row.map(cellStr); continue;
    }
    if (inHowFound && howFoundOptions.length > 0) {
      const selected = [];
      row.forEach((cell, ci) => {
        if (cellStr(cell) === '○' || cellStr(cell) === 'O') {
          if (howFoundOptions[ci]) selected.push(howFoundOptions[ci]);
        }
      });
      if (selected.length > 0) info.howFound = selected.join(', ');
      inHowFound = false;
    }
  }

  // ── 5) 선호하는 팀 ───────────────────────────────────────────────────
  let inTeam = false;
  let teamOptions = [];
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const rt = row.map(cellStr).join('');
    if (rt.includes('선호하는 팀') || rt.includes('선호하는팀')) { inTeam = true; continue; }
    if (inTeam && teamOptions.length === 0 && row.some(c => cellStr(c).includes('팀'))) {
      teamOptions = row.map((c, ci) => ({ ci, name: cellStr(c) })).filter(x => x.name.includes('팀'));
      continue;
    }
    if (inTeam && teamOptions.length > 0) {
      for (let lookAhead = 0; lookAhead <= 3 && ri + lookAhead < rows.length; lookAhead++) {
        const r = rows[ri + lookAhead];
        for (const opt of teamOptions) {
          const v = cellStr(r[opt.ci]);
          if (v.includes('○') || v === 'O') { info.preferredTeam = opt.name; break; }
        }
        if (info.preferredTeam) break;
      }
      inTeam = false;
    }
  }

  // ── 6) 면접 일정 ─────────────────────────────────────────────────────
  let inSchedule = false;
  let timeHeaders = [];
  const scheduleParts = [];
  for (const row of rows) {
    const rt = row.map(cellStr).join('');
    if (rt.includes('면접 일정') || rt.includes('면접일정')) { inSchedule = true; continue; }
    if (inSchedule) {
      if (cellStr(row[0]) === '날짜') { timeHeaders = row.map(cellStr); continue; }
      const date = cellStr(row[0]);
      if (date && /\d/.test(date) && timeHeaders.length > 0) {
        for (let ci = 1; ci < row.length && ci < timeHeaders.length; ci++) {
          const mark = cellStr(row[ci]);
          if (mark === '○' || mark === 'O' || mark === 'o' || mark === '●') {
            scheduleParts.push(`${date} ${timeHeaders[ci]}`);
          }
        }
      }
    }
  }
  if (scheduleParts.length > 0) info.schedule = scheduleParts.join(', ');

  // ── 7) 자기소개서 (Sheet 2) ──────────────────────────────────────────
  const selfIntro = [];
  if (selfIntroRows) {
    for (let ri = 0; ri < selfIntroRows.length; ri++) {
      const row = selfIntroRows[ri];
      if (cellStr(row[0]) === '질문') {
        const question = cellStr(row[1]);
        const answerRow = selfIntroRows[ri + 1] || [];
        const answer = cellStr(answerRow[1]);
        if (question) { selfIntro.push({ question, answer }); ri++; }
      }
    }
  }
  info.selfIntro = selfIntro;

  return info.name ? [info] : [];
}

async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet1 = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet1, { header: 1, defval: '' });

        // Sheet 2 (자기소개서) 읽기
        let selfIntroRows = null;
        if (workbook.SheetNames.length > 1) {
          const sheet2 = workbook.Sheets[workbook.SheetNames[1]];
          selfIntroRows = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: '' });
        }

        // 첫 행이 헤더 테이블인지 판별
        const firstRowText = (rows[0] || []).map(cellStr).join('');
        const isTable = ['이름', '성명', 'name'].some(k => firstRowText.includes(k))
          && rows.length > 1 && cellStr(rows[1]?.[0]) !== '';

        const result = isTable
          ? rows.slice(1).map(row => {
              const info = {};
              ['이름','생년월일','학번','12개월참여','휴대전화','이메일','주소','전공','학년-학기','면접일정'].forEach((label, li) => {
                const idx = (rows[0] || []).findIndex(h => cellStr(h) === label);
                if (idx >= 0 && cellStr(row[idx])) info[['name','dob','studentId','available12','phone','email','address','major','grade','schedule'][li]] = cellStr(row[idx]);
              });
              info.careers = EMPTY_CAREERS();
              info.selfIntro = [];
              return info;
            }).filter(i => i.name)
          : parseKAHForm(rows, selfIntroRows);

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function downloadExcelTemplate() {
  const headers = ['이름(한글)', '생년월일', '학번', '12개월참여', '휴대전화', 'E-mail', '주소', '전공', '학년-학기', '작성일'];
  const example = ['홍길동', '2002-05-14', '20220001', '가능', '010-1234-5678', 'hong@kah.ac.kr', '서울시 강남구', '경영학과', '3학년 1학기', '2025년 03월 05일'];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '지원서');
  XLSX.writeFile(wb, 'KAH_지원서_양식.xlsx');
}

// ─── ScoreInput Component ─────────────────────────────────────────────────────
function ScoreInput({ label, field, scores, max, onChange }) {
  const pct = max > 0 ? scores[field] / max : 0;
  const barColor = pct >= 0.8 ? "#22c55e" : pct >= 0.5 ? "#f59e0b" : "#ef4444";
  return (
    <div style={S.scoreRow}>
      <div style={S.scoreLabel}>{label}</div>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct * 100}%`, background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <input
        type="number" min={0} max={max} value={scores[field] || 0}
        onChange={e => onChange(field, Math.min(max, Math.max(0, Number(e.target.value))))}
        style={S.scoreInput}
      />
      <span style={S.maxLabel}>/ {max}점</span>
    </div>
  );
}

// ─── Timer Component ──────────────────────────────────────────────────────────
function Timer() {
  const [minutes, setMinutes] = useState(10);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const intervalRef = useRef(null);

  const totalSecs = remaining !== null ? remaining : minutes * 60 + seconds;
  const displayMin = Math.floor(totalSecs / 60);
  const displaySec = totalSecs % 60;
  const isWarning = totalSecs <= 60 && totalSecs > 0;
  const isDone = totalSecs === 0 && running === false && remaining === 0;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) { clearInterval(intervalRef.current); setRunning(false); return 0; }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const start = () => {
    if (remaining === null) setRemaining(minutes * 60 + seconds);
    setRunning(true);
  };
  const pause = () => { setRunning(false); clearInterval(intervalRef.current); };
  const reset = () => {
    setRunning(false); clearInterval(intervalRef.current);
    setRemaining(null);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: 1 }}>⏱ TIMER</div>
      {remaining === null ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input type="number" min={0} max={99} value={minutes}
            onChange={e => setMinutes(Number(e.target.value))}
            style={{ ...S.scoreInput, width: 48 }} />
          <span style={{ color: "#64748b" }}>:</span>
          <input type="number" min={0} max={59} value={seconds}
            onChange={e => setSeconds(Number(e.target.value))}
            style={{ ...S.scoreInput, width: 48 }} />
        </div>
      ) : (
        <div style={{
          fontSize: 22, fontWeight: 800, letterSpacing: 2, minWidth: 80, textAlign: "center",
          color: isDone ? "#22c55e" : isWarning ? "#ef4444" : "#7f1d1d",
          animation: isWarning && running ? "pulse 1s infinite" : "none",
        }}>
          {String(displayMin).padStart(2, "0")}:{String(displaySec).padStart(2, "0")}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        {!running && <button onClick={start} style={S.timerBtn("start")}>▶ Start</button>}
        {running && <button onClick={pause} style={S.timerBtn("pause")}>⏸ Pause</button>}
        <button onClick={reset} style={S.timerBtn("reset")}>↺ Reset</button>
      </div>
      {isDone && <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 700 }}>✓ 완료!</span>}
    </div>
  );
}

// ─── Radar Chart Component ────────────────────────────────────────────────────
function CompetencyRadar({ scores, evalCategories }) {
  const data = evalCategories.map(cat => {
    const catScore = cat.items.reduce((sum, item) => sum + (scores[item.field] || 0), 0);
    const catMax = cat.items.reduce((sum, item) => sum + item.max, 0);
    return {
      subject: cat.label,
      value: catMax > 0 ? Math.round((catScore / catMax) * 100) : 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickCount={5} />
        <Radar name="역량" dataKey="value" stroke="#dc2626" fill="#ef4444" fillOpacity={0.25} strokeWidth={2} dot={{ fill: "#dc2626", r: 3 }} />
        <Tooltip formatter={(v) => `${v}%`} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── Evaluation Details Modal ─────────────────────────────────────────────────
function EvaluationDetailsModal({ candidate, onClose, evalCategories }) {
  if (!candidate || !candidate.evaluations || candidate.evaluations.length === 0) return null;

  const labelMap = {};
  evalCategories.forEach(cat => {
    cat.items.forEach(item => {
      labelMap[item.field] = item.label;
    });
  });

  const maxTotal = evalCategories.reduce((sum, cat) =>
    sum + cat.items.reduce((s, item) => s + item.max, 0), 0);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: 32,
        maxWidth: 700, width: "100%", maxHeight: "80vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#7f1d1d", marginBottom: 4 }}>
              {candidate.name} - 평가 상세
            </h2>
            <p style={{ fontSize: 13, color: "#64748b" }}>
              총 {candidate.evaluations.length}명의 면접관이 평가했습니다
            </p>
          </div>
          <button onClick={onClose} style={{
            border: "none", background: "#f1f5f9", borderRadius: 8,
            width: 32, height: 32, cursor: "pointer", fontSize: 18, color: "#64748b",
          }}>×</button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{
            background: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)",
            borderRadius: 12, padding: "16px 20px", color: "#fff",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>평균 점수</div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{candidate.avg_score}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, opacity: 0.8 }}>/ {maxTotal}점</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {Math.round((candidate.avg_score / maxTotal) * 100)}%
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
          개별 평가 내역
        </div>

        {candidate.evaluations.map((evaluation, idx) => (
          <div key={idx} style={{
            background: "#f8fafc", borderRadius: 12, padding: 16, marginBottom: 12,
            border: "1px solid #e2e8f0",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "#dc2626", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                }}>
                  {idx + 1}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>면접관</div>
                  <div style={{ fontSize: 12, color: "#7f1d1d", fontWeight: 600 }}>
                    {evaluation.interviewer_name || evaluation.interviewer_id.slice(-12)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#dc2626" }}>
                {evaluation.total_score}점
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              {Object.entries(evaluation.scores).map(([key, value]) => (
                <div key={key} style={{
                  background: "#fff", borderRadius: 6, padding: "6px 10px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>
                    {labelMap[key] || key}
                  </span>
                  <span style={{ fontSize: 12, color: "#7f1d1d", fontWeight: 700 }}>{value}</span>
                </div>
              ))}
            </div>

            {evaluation.tags && evaluation.tags.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>태그</div>
                {evaluation.tags.map((tag, i) => (
                  <span key={i} style={S.badge(tag.type)}>{tag.text}</span>
                ))}
              </div>
            )}

            {evaluation.note && (
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4, fontWeight: 600 }}>메모</div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, background: "#fff", padding: 8, borderRadius: 6 }}>
                  {evaluation.note}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 기수별 테이블명 헬퍼 ──────────────────────────────────────────────────────
const cohortTable = (cohort, type) => `${type}_gen${cohort}`;

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // ─── 화면 / 기수 상태 ───────────────────────────────────────────────────────
  const [view, setView] = useState('login');
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginError, setLoginError] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');
  const [interviewerName, setInterviewerName] = useState('');
  const [selectedCohort, setSelectedCohort] = useState(null);
  const [cohorts, setCohorts] = useState([6, 7, 8]);

  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [currentCandidate, setCurrentCandidate] = useState(null);
  const [currentScores, setCurrentScores] = useState({
    sincerity: 0, cooperation: 0, planning: 0,
    expression: 0, commonsense: 0,
    proactivity: 0, personality: 0,
    q1: 0, q2: 0, comprehension: 0, logic: 0, creativity: 0,
  });
  const [currentTags, setCurrentTags] = useState([]);
  const [currentNote, setCurrentNote] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [interviewerId, setInterviewerId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [parseMsg, setParseMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(null);
  const fileRef = useRef();

  // ─── 평가항목 편집 상태 ────────────────────────────────────────────────────
  const [evalCategories, setEvalCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('kah_eval_categories');
      return saved ? JSON.parse(saved) : DEFAULT_EVAL_CATEGORIES;
    } catch { return DEFAULT_EVAL_CATEGORIES; }
  });
  const [isEditingEval, setIsEditingEval] = useState(false);
  const [editEvalTemp, setEditEvalTemp] = useState(null);

  // ─── 돌발 질문 주제 상태 ──────────────────────────────────────────────────
  const [surpriseTopicsOpen, setSurpriseTopicsOpen] = useState(false);
  const [surpriseTopics, setSurpriseTopics] = useState(() => {
    try {
      const saved = localStorage.getItem('kah_surprise_topics');
      return saved ? JSON.parse(saved) : DEFAULT_SURPRISE_TOPICS;
    } catch { return DEFAULT_SURPRISE_TOPICS; }
  });
  const [selectedSurpriseTopics, setSelectedSurpriseTopics] = useState([]);
  const [isEditingSurpriseTopics, setIsEditingSurpriseTopics] = useState(false);
  const [isAddingSurpriseTopic, setIsAddingSurpriseTopic] = useState(false);
  const [newSurpriseTopicText, setNewSurpriseTopicText] = useState('');
  const [editingSurpriseTopicId, setEditingSurpriseTopicId] = useState(null);
  const [editingSurpriseTopicText, setEditingSurpriseTopicText] = useState('');
  const [settingsSyncing, setSettingsSyncing] = useState(false);

  // ─── 설정 영속성 (localStorage + Supabase) ────────────────────────────────
  const persistEvalCategories = async (categories) => {
    localStorage.setItem('kah_eval_categories', JSON.stringify(categories));
    await supabase.settings.set('eval_categories', categories);
  };

  const persistSurpriseTopics = async (topics) => {
    localStorage.setItem('kah_surprise_topics', JSON.stringify(topics));
    await supabase.settings.set('surprise_topics', topics);
  };

  useEffect(() => {
    const loadSettings = async () => {
      const remoteCategories = await supabase.settings.get('eval_categories');
      if (remoteCategories) {
        setEvalCategories(remoteCategories);
        localStorage.setItem('kah_eval_categories', JSON.stringify(remoteCategories));
      }
      const remoteTopics = await supabase.settings.get('surprise_topics');
      if (remoteTopics) {
        setSurpriseTopics(remoteTopics);
        localStorage.setItem('kah_surprise_topics', JSON.stringify(remoteTopics));
      }
      const remoteCohorts = await supabase.settings.get('cohorts');
      if (remoteCohorts && Array.isArray(remoteCohorts) && remoteCohorts.length > 0) {
        setCohorts(remoteCohorts);
      }
    };
    loadSettings();
  }, []);

  // ─── 평가항목 편집 핸들러 ─────────────────────────────────────────────────
  const startEvalEdit = () => {
    setEditEvalTemp(JSON.parse(JSON.stringify(evalCategories)));
    setIsEditingEval(true);
  };

  const cancelEvalEdit = () => {
    setEditEvalTemp(null);
    setIsEditingEval(false);
  };

  const saveEvalEdit = async () => {
    setSettingsSyncing(true);
    setEvalCategories(editEvalTemp);
    await persistEvalCategories(editEvalTemp);
    setEditEvalTemp(null);
    setIsEditingEval(false);
    setSettingsSyncing(false);
  };

  const updateEditTempCatLabel = (catId, value) => {
    setEditEvalTemp(prev => prev.map(cat =>
      cat.id === catId ? { ...cat, label: value } : cat
    ));
  };

  const updateEditTempItemLabel = (catId, field, value) => {
    setEditEvalTemp(prev => prev.map(cat =>
      cat.id === catId
        ? { ...cat, items: cat.items.map(item => item.field === field ? { ...item, label: value } : item) }
        : cat
    ));
  };

  const updateEditTempItemMax = (catId, field, value) => {
    setEditEvalTemp(prev => prev.map(cat =>
      cat.id === catId
        ? { ...cat, items: cat.items.map(item => item.field === field ? { ...item, max: Math.max(1, value) } : item) }
        : cat
    ));
  };

  // ─── 돌발 질문 핸들러 ─────────────────────────────────────────────────────
  const toggleSurpriseTopic = async (id) => {
    const next = selectedSurpriseTopics.includes(id)
      ? selectedSurpriseTopics.filter(x => x !== id)
      : [...selectedSurpriseTopics, id];
    setSelectedSurpriseTopics(next);

    if (currentCandidate && !currentCandidate.id.toString().startsWith('temp_')) {
      const updatedInfo = { ...currentCandidate.info, surpriseTopics: next };
      setCurrentCandidate(prev => ({ ...prev, info: updatedInfo }));
      try {
        await supabase.from(cohortTable(selectedCohort, 'candidates')).update({ info: updatedInfo }).eq('id', currentCandidate.id).execute();
      } catch (e) { console.error('surprise topic save error', e); }
    }
  };

  const addSurpriseTopic = async () => {
    if (!newSurpriseTopicText.trim()) return;
    const newId = Date.now();
    const updated = [...surpriseTopics, { id: newId, text: newSurpriseTopicText.trim() }];
    setSurpriseTopics(updated);
    await persistSurpriseTopics(updated);
    setNewSurpriseTopicText('');
    setIsAddingSurpriseTopic(false);
  };

  const saveSurpriseTopicEdit = async (id) => {
    if (!editingSurpriseTopicText.trim()) return;
    const updated = surpriseTopics.map(t => t.id === id ? { ...t, text: editingSurpriseTopicText.trim() } : t);
    setSurpriseTopics(updated);
    await persistSurpriseTopics(updated);
    setEditingSurpriseTopicId(null);
    setEditingSurpriseTopicText('');
  };

  const deleteSurpriseTopic = async (id) => {
    const updated = surpriseTopics.filter(t => t.id !== id);
    setSurpriseTopics(updated);
    await persistSurpriseTopics(updated);
    setSelectedSurpriseTopics(prev => prev.filter(x => x !== id));
  };

  // ─── 점수 계산 ────────────────────────────────────────────────────────────
  const dynamicMaxScores = {};
  evalCategories.forEach(cat => {
    cat.items.forEach(item => { dynamicMaxScores[item.field] = item.max; });
  });

  const total = Object.entries(currentScores).reduce((sum, [k, v]) => sum + (Number(v) || 0), 0);
  const maxTotal = Object.values(dynamicMaxScores).reduce((a, b) => a + b, 0);

  const updateScore = (field, value) => {
    setCurrentScores(prev => ({ ...prev, [field]: value }));
  };

  const toggleTag = (text, type) => {
    setCurrentTags(prev => {
      const exists = prev.find(t => t.text === text);
      if (exists) return prev.filter(t => t.text !== text);
      return [...prev, { text, type }];
    });
  };

  const resetCurrentEvaluation = () => {
    setCurrentCandidate(null);
    setCurrentScores({
      sincerity: 0, cooperation: 0, planning: 0,
      expression: 0, commonsense: 0,
      proactivity: 0, personality: 0,
      q1: 0, q2: 0, comprehension: 0, logic: 0, creativity: 0,
    });
    setCurrentTags([]);
    setCurrentNote('');
    setSelectedCandidateId(null);
    setSelectedSurpriseTopics([]);
  };

  const loadEvaluationForCandidate = (candidateId, evalInterviewerId) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    const myEvaluation = candidate.evaluations?.find(e => e.interviewer_id === evalInterviewerId);

    const defaultScores = {
      sincerity: 0, cooperation: 0, planning: 0,
      expression: 0, commonsense: 0,
      proactivity: 0, personality: 0,
      q1: 0, q2: 0, comprehension: 0, logic: 0, creativity: 0,
    };

    const savedSurpriseTopics = candidate.info?.surpriseTopics || [];
    setSelectedSurpriseTopics(savedSurpriseTopics);

    if (myEvaluation) {
      setSelectedCandidateId(candidateId);
      setCurrentCandidate(candidate);
      setCurrentScores(myEvaluation.scores || defaultScores);
      setCurrentTags(myEvaluation.tags || []);
      setCurrentNote(myEvaluation.note || '');
    } else {
      setSelectedCandidateId(candidateId);
      setCurrentCandidate(candidate);
      setCurrentScores(defaultScores);
      setCurrentTags([]);
      setCurrentNote('');
    }
  };

  useEffect(() => {
    const id = getInterviewerId();
    setInterviewerId(id);
  }, []);

  useEffect(() => {
    if (selectedCohort !== null) fetchCandidates();
  }, [selectedCohort]);

  // 탭 포커스 복귀 시 자동 리페치
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && selectedCohort !== null) {
        fetchCandidates();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [selectedCohort]);

  // 30초마다 자동 리페치 (인터뷰 화면)
  useEffect(() => {
    if (view !== 'interview' || selectedCohort === null) return;
    const interval = setInterval(() => fetchCandidates(), 30000);
    return () => clearInterval(interval);
  }, [view, selectedCohort]);

  const fetchCandidates = async () => {
    try {
      setLoading(true);

      const { data: candidatesData, error: candidatesError } = await supabase.from(cohortTable(selectedCohort, 'candidates')).select().order('created_at', { ascending: false }).execute();
      if (candidatesError) throw candidatesError;

      const { data: evaluationsData, error: evaluationsError } = await supabase.from(cohortTable(selectedCohort, 'evaluations')).select().order('created_at', { ascending: false }).execute();
      if (evaluationsError) throw evaluationsError;

      const candidatesWithScores = candidatesData.map(candidate => {
        const candidateEvaluations = evaluationsData.filter(e => e.candidate_id === candidate.id);
        const avgScore = candidateEvaluations.length > 0
          ? Math.round(candidateEvaluations.reduce((sum, e) => sum + (e.total_score || 0), 0) / candidateEvaluations.length)
          : 0;

        return {
          ...candidate,
          evaluations: candidateEvaluations,
          avg_score: avgScore,
          evaluation_count: candidateEvaluations.length,
        };
      });

      candidatesWithScores.sort((a, b) => b.avg_score - a.avg_score);
      setCandidates(candidatesWithScores);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      alert('데이터를 불러오는데 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCandidateClick = (candidate) => {
    if (!interviewerId) {
      alert('면접관 ID가 설정되지 않았습니다.');
      return;
    }
    loadEvaluationForCandidate(candidate.id, interviewerId);
  };

  const deleteCandidate = async (candidate) => {
    if (!window.confirm(`'${candidate.name}' 지원자를 삭제하시겠습니까?\n평가 데이터도 함께 삭제됩니다.`)) return;
    try {
      await supabase.from(cohortTable(selectedCohort, 'evaluations')).update({ candidate_id: null }).eq('candidate_id', candidate.id).execute();
      await fetch(`${SUPABASE_URL}/rest/v1/${cohortTable(selectedCohort, 'evaluations')}?candidate_id=eq.${candidate.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      });
      await fetch(`${SUPABASE_URL}/rest/v1/${cohortTable(selectedCohort, 'candidates')}?id=eq.${candidate.id}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        }
      });
      if (currentCandidate?.id === candidate.id) {
        setCurrentCandidate(null);
        setSelectedCandidateId(null);
        resetCurrentEvaluation();
      }
      await fetchCandidates();
    } catch (error) {
      console.error('Error deleting candidate:', error);
      alert('삭제에 실패했습니다: ' + error.message);
    }
  };

  const saveEvaluation = async () => {
    if (!currentCandidate || !interviewerId) {
      alert('지원자를 선택해주세요.');
      return;
    }

    if (!currentCandidate.name || !currentCandidate.name.trim()) {
      alert('지원자 이름을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);

      let candidateId = currentCandidate.id;

      const infoWithSurprise = { ...currentCandidate.info, surpriseTopics: selectedSurpriseTopics };

      if (currentCandidate.id.toString().startsWith('temp_')) {
        const { data: newCandidate, error: createError } = await supabase
          .from(cohortTable(selectedCohort, 'candidates'))
          .insert({ name: currentCandidate.name, info: { ...infoWithSurprise, cohort: selectedCohort } })
          .select()
          .single();

        if (createError) throw createError;
        candidateId = newCandidate.id;

        setCurrentCandidate({ ...currentCandidate, id: candidateId, info: infoWithSurprise });
        setSelectedCandidateId(candidateId);
      } else {
        await supabase.from(cohortTable(selectedCohort, 'candidates')).update({ info: infoWithSurprise }).eq('id', candidateId).execute();
        setCurrentCandidate(prev => ({ ...prev, info: infoWithSurprise }));
      }

      const { error } = await supabase
        .from(cohortTable(selectedCohort, 'evaluations'))
        .upsert({
          candidate_id: candidateId,
          interviewer_id: interviewerId,
          interviewer_name: interviewerName,
          scores: currentScores,
          total_score: total,
          tags: currentTags,
          note: currentNote,
        })
        .execute();

      if (error) throw error;

      alert('✅ 평가가 저장되었습니다!');
      await fetchCandidates();
    } catch (error) {
      console.error('Error saving evaluation:', error);
      alert('평가 저장에 실패했습니다: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const createCandidate = async (candidateInfo) => {
    try {
      const { data, error } = await supabase
        .from(cohortTable(selectedCohort, 'candidates'))
        .insert({ name: candidateInfo.name, info: candidateInfo })
        .select()
        .single();

      if (error) throw error;

      await fetchCandidates();

      if (data && interviewerId) {
        loadEvaluationForCandidate(data.id, interviewerId);
      }

      return data;
    } catch (error) {
      console.error('Error creating candidate:', error);
      alert('지원자 등록에 실패했습니다: ' + error.message);
      return null;
    }
  };

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0] || e.target.files?.[0];
    if (!file) return;

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setParseMsg("⚠️ Excel 파일(.xlsx, .xls)만 지원합니다.");
      return;
    }

    setParseMsg("📊 Excel 파일 분석 중...");
    try {
      const parsed = await parseExcelFile(file);
      if (parsed.length === 0) {
        setParseMsg("⚠️ 인식된 지원자가 없습니다. 헤더 행과 데이터를 확인해주세요.");
        return;
      }
      setParseMsg(`⏳ ${parsed.length}명 등록 중...`);
      let count = 0;
      for (const info of parsed) {
        const result = await createCandidate(info);
        if (result) count++;
      }
      setParseMsg(`✅ ${count}명의 지원자가 자동으로 등록되었습니다.`);
    } catch (err) {
      console.error(err);
      setParseMsg("❌ 파일 읽기 실패. 올바른 Excel 파일인지 확인해주세요.");
    }
    if (fileRef.current) fileRef.current.value = '';
  }, [interviewerId, selectedCohort]);

  const newCandidate = () => {
    resetCurrentEvaluation();
    setParseMsg("");
    const tempCandidate = {
      id: 'temp_' + Date.now(),
      name: '',
      info: {
        dob: '', available12: '', phone: '', email: '',
        studentId: '', address: '', major: '', grade: '', writtenDate: '',
        jobPref1: '', jobPref2: '', jobPref3: '',
        hrmRank: '', hrdRank: '', laborRank: '',
        careers: EMPTY_CAREERS(),
        howFound: '', preferredTeam: '',
        schedule: '',
        selfIntro: [],
        cohort: selectedCohort
      },
      evaluations: [],
      avg_score: 0,
      evaluation_count: 0
    };
    setCurrentCandidate(tempCandidate);
    setSelectedCandidateId(tempCandidate.id);
  };

  const updateCandidateInfo = async (field, value) => {
    if (!currentCandidate) return;

    const updatedInfo = { ...currentCandidate.info, [field]: value };
    const updatedName = field === 'name' ? value : currentCandidate.name;

    setCurrentCandidate({ ...currentCandidate, name: updatedName, info: updatedInfo });

    if (!currentCandidate.id.toString().startsWith('temp_')) {
      try {
        const { error } = await supabase
          .from(cohortTable(selectedCohort, 'candidates'))
          .update({ name: updatedName, info: updatedInfo })
          .eq('id', currentCandidate.id)
          .execute();

        if (error) throw error;
      } catch (error) {
        console.error('Error updating candidate:', error);
      }
    }
  };

  const updateCareerInfo = async (rowIdx, field, value) => {
    if (!currentCandidate) return;
    const careers = [...(currentCandidate.info?.careers || EMPTY_CAREERS())];
    careers[rowIdx] = { ...careers[rowIdx], [field]: value };
    await updateCandidateInfo('careers', careers);
  };

  const inputField = (label, field, span = false) => {
    const value = field === 'name' ? currentCandidate?.name : currentCandidate?.info?.[field];

    return (
      <div style={{ ...S.inputGroup, ...(span ? { flex: "0 0 100%", minWidth: "100%" } : {}) }}>
        <label style={S.label}>{label}</label>
        <input
          style={S.input}
          value={value || ""}
          onChange={e => updateCandidateInfo(field, e.target.value)}
          placeholder={label}
          disabled={!currentCandidate}
          onFocus={e => { e.target.style.borderColor = "#dc2626"; e.target.style.background = "#fff"; }}
          onBlur={e => { e.target.style.borderColor = "#e2e8f0"; e.target.style.background = "#fafbfc"; }}
        />
      </div>
    );
  };

  const displayCategories = isEditingEval ? editEvalTemp : evalCategories;

  // ─── 로그인 / 기수 선택 핸들러 ───────────────────────────────────────────
  const handleLogin = () => {
    if (loginId === 'kgukah' && loginPw === 'kah2026') {
      setLoginError('');
      setView('interviewerName');
    } else {
      setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  };

  const handleNameSubmit = () => {
    if (!nameInput.trim()) { setNameError('이름을 입력해주세요.'); return; }
    const name = nameInput.trim();
    localStorage.setItem('kah_interviewer_name', name);
    setInterviewerName(name);
    setNameError('');
    setView('cohortSelect');
  };

  const handleLogout = () => {
    localStorage.removeItem('kah_interviewer_name');
    setInterviewerName('');
    setLoginId('');
    setLoginPw('');
    setNameInput('');
    setSelectedCohort(null);
    resetCurrentEvaluation();
    setCandidates([]);
    setView('login');
  };

  const handleCohortSelect = (cohort) => {
    setSelectedCohort(cohort);
    resetCurrentEvaluation();
    setView('interview');
  };

  const handleBackToCohortSelect = () => {
    setSelectedCohort(null);
    resetCurrentEvaluation();
    setCandidates([]);
    setView('cohortSelect');
  };

  const addCohort = async () => {
    const maxCohort = cohorts.length > 0 ? Math.max(...cohorts) : 5;
    const next = maxCohort + 1;
    const updated = [...cohorts, next].sort((a, b) => a - b);
    setCohorts(updated);
    await supabase.settings.set('cohorts', updated);
  };

  return (
    <div style={S.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
        ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .tag-btn:hover { filter: brightness(0.92); transform: scale(0.97); }
        .rank-item:hover { background: #fee2e2 !important; }
        .finalize-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .new-btn:hover { border-color: #dc2626; color: #dc2626; }
        .small-btn:hover { border-color: #dc2626; color: #dc2626; }
        .small-primary-btn:hover { opacity: 0.85; }
        .topic-chip:hover { filter: brightness(0.95); }
        .cohort-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(220,38,38,0.18) !important; border-color: #dc2626 !important; }
        .cohort-card:active { transform: translateY(-1px); }
        .login-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .add-cohort-btn:hover { border-color: #dc2626; color: #dc2626; background: #fef2f2 !important; }
        .logout-btn:hover { color: #dc2626; border-color: #dc2626; }
        .back-btn:hover { background: #f1f5f9 !important; }
        .refresh-btn:hover { background: #fef2f2 !important; border-color: #dc2626 !important; color: #dc2626 !important; }
      `}</style>

      {/* ─── 로그인 화면 ───────────────────────────────────────────────────── */}
      {view === 'login' && (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          background: '#fff',
        }}>
          {/* Left branding panel */}
          <div style={{
            width: '44%',
            background: 'linear-gradient(160deg, #7f1d1d 0%, #dc2626 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 48px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -100, right: -100,
              width: 360, height: 360, borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: -80, left: -80,
              width: 280, height: 280, borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 22,
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                border: '1.5px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 28px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 24, fontFamily: "'Georgia', serif" }}>KAH</span>
              </div>
              <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 900, marginBottom: 10, letterSpacing: -0.5 }}>
                KAH Interview
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 48 }}>
                Evaluation System
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
                {['실시간 평균 점수 집계', '다중 평가자 지원', '기수별 평가 관리'].map(text => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 7,
                      background: 'rgba(255,255,255,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: 500 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right form panel */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px',
            background: '#fafafa',
          }}>
            <div style={{ width: '100%', maxWidth: 380, animation: 'fadeIn 0.4s ease' }}>
              <div style={{ marginBottom: 36 }}>
                <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 8, letterSpacing: -0.3 }}>
                  로그인
                </h2>
                <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>
                  아이디와 비밀번호를 입력해주세요
                </p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  fontSize: 12, fontWeight: 700, color: '#374151',
                  display: 'block', marginBottom: 8, letterSpacing: 0.3,
                }}>
                  아이디
                </label>
                <input
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 12,
                    border: loginError ? '2px solid #dc2626' : '2px solid #e5e7eb',
                    fontSize: 15, outline: 'none', color: '#111827',
                    background: '#fff', boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                  placeholder="아이디 입력"
                  value={loginId}
                  onChange={e => { setLoginId(e.target.value); setLoginError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  onFocus={e => { e.target.style.borderColor = '#dc2626'; e.target.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.12)'; }}
                  onBlur={e => { if (!loginError) e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; }}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{
                  fontSize: 12, fontWeight: 700, color: '#374151',
                  display: 'block', marginBottom: 8, letterSpacing: 0.3,
                }}>
                  비밀번호
                </label>
                <input
                  type="password"
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 12,
                    border: loginError ? '2px solid #dc2626' : '2px solid #e5e7eb',
                    fontSize: 15, outline: 'none', color: '#111827',
                    background: '#fff', boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                  placeholder="비밀번호 입력"
                  value={loginPw}
                  onChange={e => { setLoginPw(e.target.value); setLoginError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  onFocus={e => { e.target.style.borderColor = '#dc2626'; e.target.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.12)'; }}
                  onBlur={e => { if (!loginError) e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; }}
                />
                {loginError && (
                  <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6, fontWeight: 600 }}>
                    ⚠ {loginError}
                  </p>
                )}
              </div>

              <button
                className="login-btn"
                onClick={handleLogin}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)',
                  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(220,38,38,0.35)',
                  transition: 'all 0.15s',
                  letterSpacing: 0.3,
                }}
              >
                로그인 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 면접관 이름 입력 화면 ─────────────────────────────────────────── */}
      {view === 'interviewerName' && (
        <div style={{ minHeight: '100vh', display: 'flex', background: '#fff' }}>
          <div style={{
            width: '44%',
            background: 'linear-gradient(160deg, #7f1d1d 0%, #dc2626 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 48px',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: -100, right: -100, width: 360, height: 360, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -80, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 22,
                background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
                border: '1.5px solid rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 28px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 24, fontFamily: "'Georgia', serif" }}>KAH</span>
              </div>
              <h1 style={{ color: '#fff', fontSize: 30, fontWeight: 900, marginBottom: 10, letterSpacing: -0.5 }}>KAH Interview</h1>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase' }}>Evaluation System</p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', background: '#fafafa' }}>
            <div style={{ width: '100%', maxWidth: 380, animation: 'fadeIn 0.4s ease' }}>
              <div style={{ marginBottom: 36 }}>
                <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 8, letterSpacing: -0.3 }}>
                  면접관 이름 입력
                </h2>
                <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>
                  평가 기록에 사용될 이름을 입력하세요
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 8, letterSpacing: 0.3 }}>
                  면접관 이름
                </label>
                <input
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 12,
                    border: nameError ? '2px solid #dc2626' : '2px solid #e5e7eb',
                    fontSize: 15, outline: 'none', color: '#111827',
                    background: '#fff', boxSizing: 'border-box',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                  placeholder="예: 홍길동"
                  value={nameInput}
                  onChange={e => { setNameInput(e.target.value); setNameError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
                  onFocus={e => { e.target.style.borderColor = '#dc2626'; e.target.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.12)'; }}
                  onBlur={e => { if (!nameError) e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'; }}
                  autoFocus
                />
                {nameError && (
                  <p style={{ fontSize: 12, color: '#dc2626', marginTop: 6, fontWeight: 600 }}>⚠ {nameError}</p>
                )}
              </div>

              <button
                className="login-btn"
                onClick={handleNameSubmit}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)',
                  color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(220,38,38,0.35)',
                  transition: 'all 0.15s', letterSpacing: 0.3,
                }}
              >
                입장하기 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 기수 선택 화면 ────────────────────────────────────────────────── */}
      {view === 'cohortSelect' && (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f4f8 0%, #e8eef7 100%)' }}>
          <header style={S.header}>
            <KAHLogo />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#7f1d1d' }}>
              안녕하세요, <span style={{ color: '#dc2626' }}>{interviewerName}</span> 면접관님
            </div>
            <button
              className="logout-btn"
              onClick={handleLogout}
              style={{
                padding: '7px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0',
                background: '#fff', color: '#94a3b8', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              로그아웃
            </button>
          </header>

          <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#7f1d1d', marginBottom: 8 }}>
              면접 평가
            </h1>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 40 }}>
              평가를 진행할 기수를 선택하세요
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 20,
            }}>
              {cohorts.map(cohort => (
                <div
                  key={cohort}
                  className="cohort-card"
                  onClick={() => handleCohortSelect(cohort)}
                  style={{
                    background: '#fff', borderRadius: 18, border: '1.5px solid #e2e8f0',
                    padding: '32px 24px', cursor: 'pointer', textAlign: 'center',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
                    background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
                  }}>
                    <span style={{ fontSize: 24 }}>📋</span>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#7f1d1d', marginBottom: 4 }}>
                    {cohort}기
                  </div>
                  <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
                    면접 평가
                  </div>
                </div>
              ))}

              <div
                className="add-cohort-btn"
                onClick={addCohort}
                style={{
                  background: '#f8fafc', borderRadius: 18, border: '1.5px dashed #cbd5e1',
                  padding: '32px 24px', cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
                  background: '#f1f5f9', display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 28, color: '#94a3b8' }}>+</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
                  기수 추가
                </div>
                <div style={{ fontSize: 12, color: '#b0bec5', fontWeight: 500 }}>
                  {cohorts.length > 0 ? `${Math.max(...cohorts) + 1}기 추가` : '새 기수'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 평가 시스템 화면 ──────────────────────────────────────────────── */}
      {view === 'interview' && (
      <div>

      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            className="back-btn"
            onClick={handleBackToCohortSelect}
            style={{
              padding: '7px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0',
              background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s', display: 'flex',
              alignItems: 'center', gap: 6,
            }}
          >
            ← 목록
          </button>
          <KAHLogo />
          <div style={{
            padding: '4px 12px', borderRadius: 20,
            background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)',
            color: '#fff', fontSize: 12, fontWeight: 700,
          }}>
            {selectedCohort}기 면접 평가
          </div>
        </div>
        <Timer />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {interviewerName && (
            <div style={{ fontSize: 12, color: "#64748b", marginRight: 4, fontWeight: 600 }}>
              {interviewerName}
            </div>
          )}
          <button className="new-btn" onClick={newCandidate} style={{
            borderRadius: 8, padding: "8px 16px",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            background: "#fff", border: "1.5px solid #e2e8f0", color: "#64748b"
          }}>+ 신규 지원자</button>
          <button
            onClick={saveEvaluation}
            style={{
              border: "none", borderRadius: 8, padding: "8px 16px",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)",
              color: "#fff", boxShadow: "0 2px 8px rgba(220,38,38,0.3)",
            }}
          >
            {saving ? '저장 중...' : '✓ 평가 저장'}
          </button>
        </div>
      </header>

      <div style={S.body}>
        <aside style={S.sidebar}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" }}>
              🏆 실시간 순위 (평균)
            </div>
            <button
              className="refresh-btn"
              onClick={fetchCandidates}
              title="새로고침"
              style={{
                border: "1.5px solid #e2e8f0", borderRadius: 6, padding: "3px 8px",
                fontSize: 12, cursor: "pointer", background: "#fff", color: "#94a3b8",
                transition: "all 0.15s", fontWeight: 600,
              }}
            >
              ↻
            </button>
          </div>

          {loading && (
            <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 20 }}>
              로딩 중...
            </div>
          )}

          {!loading && candidates.length === 0 && (
            <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 20 }}>
              지원자를 등록해주세요.
            </div>
          )}

          {!loading && candidates.map((c, i) => (
            <div key={c.id}>
              <div
                className="rank-item"
                style={S.rankItem(c.id === selectedCandidateId)}
                onClick={() => handleCandidateClick(c)}
              >
                <div style={S.rankBadge(i + 1)}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    평균: {c.avg_score}점 ({c.evaluation_count}명)
                  </div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                  background: "#fef2f2", color: "#dc2626"
                }}>
                  {Math.round((c.avg_score / maxTotal) * 100)}%
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCandidate(c); }}
                  title="지원자 삭제"
                  style={{
                    marginLeft: 6, border: "none", background: "transparent",
                    color: "#94a3b8", fontSize: 14, cursor: "pointer", padding: "2px 4px",
                    lineHeight: 1, borderRadius: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                  onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                >✕</button>
              </div>
              {c.evaluation_count > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDetailsModal(c); }}
                  style={{
                    border: "none", background: "transparent", color: "#dc2626",
                    fontSize: 11, padding: "4px 12px", cursor: "pointer",
                    fontWeight: 600, marginBottom: 6, marginLeft: 8,
                  }}
                >
                  📊 평가 상세보기
                </button>
              )}
            </div>
          ))}

          <div style={{ marginTop: 20, padding: "14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: 0.5, marginBottom: 4, fontWeight: 600 }}>현재 평가 중</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7f1d1d" }}>
              {currentCandidate?.name || "—"}
            </div>
            <div style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>
              내 점수: {total}점 / {maxTotal}점
            </div>
          </div>
        </aside>

        <main style={S.main}>
          {!currentCandidate && (
            <div style={S.card}>
              <div style={{ ...S.sectionTitle, justifyContent: "space-between" }}>
                <span>📎 지원서 Excel 업로드</span>
                <button
                  onClick={downloadExcelTemplate}
                  style={S.smallBtn}
                  title="양식 다운로드"
                >
                  ⬇ 양식 다운로드
                </button>
              </div>
              <div
                style={S.dropZone(dragging)}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
                <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
                  Excel 파일(.xlsx, .xls)을 드래그하거나 클릭하여 업로드하세요
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  지원서의 정보가 자동으로 입력됩니다 · 여러 명을 한 번에 등록할 수 있습니다
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleDrop} />
              {parseMsg && (
                <div style={{
                  marginTop: 10, fontSize: 12,
                  color: parseMsg.startsWith("✅") ? "#166534" : parseMsg.startsWith("❌") || parseMsg.startsWith("⚠️") ? "#991b1b" : "#64748b",
                  background: parseMsg.startsWith("✅") ? "#dcfce7" : parseMsg.startsWith("❌") || parseMsg.startsWith("⚠️") ? "#fee2e2" : "#f8fafc",
                  padding: "8px 12px", borderRadius: 8, fontWeight: 600,
                }}>
                  {parseMsg}
                </div>
              )}
            </div>
          )}

          {currentCandidate && (
            <>
              {/* ─── 지원자 정보 카드 ─────────────────────────────────────── */}
              <div style={S.card}>
                {/* 1. 인적사항 */}
                <div style={S.sectionTitle}>👤 1. 인적사항</div>
                <div style={S.inputRow}>
                  {inputField("이름(한글)", "name")}
                  {inputField("생년월일", "dob")}
                  {inputField("학번", "studentId")}
                  {inputField("12개월 참여 가능", "available12")}
                </div>
                <div style={S.inputRow}>
                  {inputField("휴대전화", "phone")}
                  {inputField("E-mail", "email")}
                  {inputField("주소", "address")}
                </div>
                <div style={S.inputRow}>
                  {inputField("전공", "major")}
                  {inputField("학년-학기", "grade")}
                  {inputField("작성일", "writtenDate")}
                </div>

                {/* 2. 관심분야 */}
                <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 12, paddingTop: 16 }}>
                  <div style={S.sectionTitle}>🎯 2. 관심분야</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#7f1d1d", marginBottom: 6 }}>관심 직무</div>
                  <div style={S.inputRow}>
                    {inputField("1지망", "jobPref1")}
                    {inputField("2지망", "jobPref2")}
                    {inputField("3지망", "jobPref3")}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#7f1d1d", marginBottom: 6 }}>관심 인사 분야 순위</div>
                  <div style={S.inputRow}>
                    {inputField("HRM 순위", "hrmRank")}
                    {inputField("HRD 순위", "hrdRank")}
                    {inputField("노사 순위", "laborRank")}
                  </div>
                </div>

                {/* 3. 경력 및 활동사항 */}
                <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 12, paddingTop: 16 }}>
                  <div style={S.sectionTitle}>📋 3. 경력 및 활동사항</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["구분", "활동 내용", "활동 기간", "기관 및 단체명"].map(h => (
                            <th key={h} style={{
                              padding: "8px 10px", border: "1px solid #e2e8f0",
                              fontWeight: 700, color: "#7f1d1d", textAlign: "left",
                              whiteSpace: "nowrap",
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(currentCandidate?.info?.careers || EMPTY_CAREERS())
                          .filter(row => Object.values(row).some(v => v))
                          .map((row, ri) => (
                          <tr key={ri}>
                            {[
                              { field: "type", width: "16%" },
                              { field: "content", width: "40%" },
                              { field: "period", width: "22%" },
                              { field: "org", width: "22%" },
                            ].map(({ field, width }) => (
                              <td key={field} style={{ border: "1px solid #e2e8f0", padding: 4, width }}>
                                <input
                                  style={{ ...S.input, border: "none", background: "transparent", padding: "4px 6px" }}
                                  value={row[field] || ""}
                                  onChange={e => updateCareerInfo(ri, field, e.target.value)}
                                  disabled={!currentCandidate}
                                  onFocus={e => e.target.style.background = "#fff9f9"}
                                  onBlur={e => e.target.style.background = "transparent"}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. KAH를 알게 된 경로 + 선호하는 팀 */}
                <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 12, paddingTop: 16 }}>
                  <div style={S.sectionTitle}>🔍 4. 기타 정보</div>
                  <div style={S.inputRow}>
                    {inputField("KAH를 알게 된 경로", "howFound")}
                    {inputField("선호하는 팀", "preferredTeam")}
                  </div>
                </div>

                {/* 5. 면접 일정 */}
                <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 12, paddingTop: 16 }}>
                  <div style={S.sectionTitle}>📅 5. 면접 일정</div>
                  <div style={S.inputRow}>
                    {inputField("가능한 일정", "schedule", true)}
                  </div>
                </div>

                {/* 6. 자기소개서 */}
                {(currentCandidate?.info?.selfIntro?.length > 0) && (
                  <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 12, paddingTop: 16 }}>
                    <div style={S.sectionTitle}>✍ 6. 자기소개서</div>
                    {currentCandidate.info.selfIntro.map((qa, qi) => (
                      <div key={qi} style={{ marginBottom: 16 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700, color: "#7f1d1d",
                          marginBottom: 6, lineHeight: 1.4,
                        }}>
                          {qa.question}
                        </div>
                        <div style={{
                          background: "#f8fafc", border: "1px solid #e2e8f0",
                          borderRadius: 8, padding: "10px 12px",
                          fontSize: 12, color: "#334155", lineHeight: 1.7,
                          whiteSpace: "pre-wrap", maxHeight: 160, overflowY: "auto",
                        }}>
                          {qa.answer || <span style={{ color: "#94a3b8" }}>작성된 내용 없음</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ─── 돌발 질문 토글 섹션 ──────────────────────────────── */}
                <div style={{ marginTop: 8, borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <button
                      onClick={() => setSurpriseTopicsOpen(v => !v)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 13, fontWeight: 700, color: "#7f1d1d", padding: 0,
                      }}
                    >
                      <span style={{
                        display: "inline-block",
                        transition: "transform 0.2s",
                        transform: surpriseTopicsOpen ? "rotate(90deg)" : "rotate(0deg)",
                        fontSize: 10, color: "#64748b",
                      }}>▶</span>
                      💡 돌발 질문 주제
                      {selectedSurpriseTopics.length > 0 && (
                        <span style={{
                          background: "#dc2626", color: "#fff",
                          borderRadius: 12, padding: "1px 8px",
                          fontSize: 11, fontWeight: 700,
                        }}>
                          {selectedSurpriseTopics.length}개 선택
                        </span>
                      )}
                    </button>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="small-btn"
                        onClick={() => {
                          setIsEditingSurpriseTopics(v => !v);
                          setEditingSurpriseTopicId(null);
                          if (!surpriseTopicsOpen) setSurpriseTopicsOpen(true);
                        }}
                        style={S.smallBtn}
                      >
                        {isEditingSurpriseTopics ? "✓ 편집 완료" : "✏️ 수정"}
                      </button>
                      <button
                        className="small-primary-btn"
                        onClick={() => {
                          setSurpriseTopicsOpen(true);
                          setIsAddingSurpriseTopic(true);
                          setNewSurpriseTopicText('');
                        }}
                        style={S.smallPrimaryBtn}
                      >
                        + 추가
                      </button>
                    </div>
                  </div>

                  {surpriseTopicsOpen && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {surpriseTopics.map(topic => (
                          <div key={topic.id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                            {isEditingSurpriseTopics ? (
                              editingSurpriseTopicId === topic.id ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <input
                                    value={editingSurpriseTopicText}
                                    onChange={e => setEditingSurpriseTopicText(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveSurpriseTopicEdit(topic.id); if (e.key === 'Escape') setEditingSurpriseTopicId(null); }}
                                    style={{ ...S.input, width: 120, padding: "4px 8px", fontSize: 12 }}
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => saveSurpriseTopicEdit(topic.id)}
                                    style={{ ...S.smallPrimaryBtn, padding: "4px 8px" }}
                                  >저장</button>
                                  <button
                                    onClick={() => setEditingSurpriseTopicId(null)}
                                    style={{ ...S.smallBtn, padding: "4px 8px" }}
                                  >취소</button>
                                </div>
                              ) : (
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                                  <span style={{
                                    padding: "4px 10px", borderRadius: 16, fontSize: 12, fontWeight: 500,
                                    background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569",
                                    cursor: "default",
                                  }}>{topic.text}</span>
                                  <button
                                    onClick={() => { setEditingSurpriseTopicId(topic.id); setEditingSurpriseTopicText(topic.text); }}
                                    title="수정"
                                    style={{
                                      border: "none", background: "#fef2f2", borderRadius: 6,
                                      padding: "3px 6px", cursor: "pointer", fontSize: 11, color: "#991b1b",
                                    }}
                                  >✏️</button>
                                  <button
                                    onClick={() => deleteSurpriseTopic(topic.id)}
                                    title="삭제"
                                    style={{
                                      border: "none", background: "#fee2e2", borderRadius: 6,
                                      padding: "3px 6px", cursor: "pointer", fontSize: 11, color: "#991b1b",
                                    }}
                                  >×</button>
                                </div>
                              )
                            ) : (
                              <button
                                className="topic-chip"
                                onClick={() => toggleSurpriseTopic(topic.id)}
                                style={{
                                  padding: "5px 12px", borderRadius: 16, fontSize: 12, fontWeight: 600,
                                  border: selectedSurpriseTopics.includes(topic.id) ? "1.5px solid #dc2626" : "1.5px solid #e2e8f0",
                                  background: selectedSurpriseTopics.includes(topic.id) ? "#fef2f2" : "#f8fafc",
                                  color: selectedSurpriseTopics.includes(topic.id) ? "#b91c1c" : "#64748b",
                                  cursor: "pointer", transition: "all 0.15s",
                                  boxShadow: selectedSurpriseTopics.includes(topic.id) ? "0 1px 6px rgba(220,38,38,0.2)" : "none",
                                }}
                              >
                                {selectedSurpriseTopics.includes(topic.id) && "✓ "}
                                {topic.text}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {isAddingSurpriseTopic && (
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <input
                            value={newSurpriseTopicText}
                            onChange={e => setNewSurpriseTopicText(e.target.value)}
                            placeholder="새 돌발 질문 주제 입력..."
                            style={{ ...S.input, flex: 1, padding: "6px 10px", fontSize: 12 }}
                            onKeyDown={e => { if (e.key === 'Enter') addSurpriseTopic(); if (e.key === 'Escape') setIsAddingSurpriseTopic(false); }}
                            autoFocus
                          />
                          <button onClick={addSurpriseTopic} style={S.smallPrimaryBtn}>추가</button>
                          <button onClick={() => setIsAddingSurpriseTopic(false)} style={S.smallBtn}>취소</button>
                        </div>
                      )}

                      {selectedSurpriseTopics.length > 0 && !isEditingSurpriseTopics && (
                        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c" }}>선택된 주제: </span>
                          <span style={{ fontSize: 12, color: "#991b1b" }}>
                            {surpriseTopics.filter(t => selectedSurpriseTopics.includes(t.id)).map(t => t.text).join(" · ")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                {/* ─── 평가 항목 카드 ─────────────────────────────────────── */}
                <div style={{ ...S.card, flex: 1, minWidth: 320 }}>
                  <div style={{ ...S.sectionTitle, justifyContent: "space-between" }}>
                    <span>📊 평가 항목</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {isEditingEval ? (
                        <>
                          <button className="small-primary-btn" onClick={saveEvalEdit} style={S.smallPrimaryBtn} disabled={settingsSyncing}>
                            {settingsSyncing ? '저장 중...' : '✓ 저장'}
                          </button>
                          <button className="small-btn" onClick={cancelEvalEdit} style={S.smallBtn} disabled={settingsSyncing}>취소</button>
                        </>
                      ) : (
                        <button className="small-btn" onClick={startEvalEdit} style={S.smallBtn}>✏️ 수정</button>
                      )}
                    </div>
                  </div>

                  {isEditingEval && (
                    <div style={{
                      background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
                      padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#92400e", fontWeight: 600,
                    }}>
                      ✏️ 항목명과 만점을 수정한 후 저장 버튼을 누르세요.
                    </div>
                  )}

                  {displayCategories.map((cat, catIdx) => {
                    const catMax = cat.items.reduce((s, i) => s + i.max, 0);
                    return (
                      <div key={cat.id}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#7f1d1d", marginBottom: 6, padding: catIdx === 0 ? "4px 0" : "12px 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
                          {isEditingEval ? (
                            <input
                              value={cat.label}
                              onChange={e => updateEditTempCatLabel(cat.id, e.target.value)}
                              style={{ ...S.input, width: 110, padding: "4px 8px", fontSize: 12, fontWeight: 700 }}
                            />
                          ) : (
                            <span>{cat.label}</span>
                          )}
                          <span style={{ color: "#94a3b8", fontWeight: 500 }}>({catMax}점 만점)</span>
                        </div>

                        {cat.items.map(item => (
                          isEditingEval ? (
                            <div key={item.field} style={{ ...S.scoreRow, gap: 8 }}>
                              <input
                                value={item.label}
                                onChange={e => updateEditTempItemLabel(cat.id, item.field, e.target.value)}
                                style={{ ...S.input, flex: 1, padding: "5px 8px", fontSize: 12 }}
                                placeholder="항목명"
                              />
                              <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>만점</span>
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={item.max}
                                onChange={e => updateEditTempItemMax(cat.id, item.field, Number(e.target.value))}
                                style={{ ...S.scoreInput, width: 52 }}
                              />
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>점</span>
                            </div>
                          ) : (
                            <ScoreInput
                              key={item.field}
                              label={item.label}
                              field={item.field}
                              scores={currentScores}
                              max={item.max}
                              onChange={updateScore}
                            />
                          )
                        ))}
                      </div>
                    );
                  })}

                  <div style={S.totalBox}>
                    <div>
                      <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 1 }}>MY SCORE</div>
                      <div style={{ fontSize: 28, fontWeight: 900 }}>{total}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>/ {maxTotal}점</div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{Math.round((total / maxTotal) * 100)}%</div>
                      <div style={{ marginTop: 4, height: 6, width: 100, background: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(total / maxTotal) * 100}%`, background: "#fff", borderRadius: 3, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ─── 역량 레이더 카드 ─────────────────────────────────── */}
                <div style={{ ...S.card, minWidth: 280, flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={S.sectionTitle}>🕸 역량 레이더</div>
                  <CompetencyRadar scores={currentScores} evalCategories={evalCategories} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {evalCategories.map(cat => {
                      const catScore = cat.items.reduce((sum, item) => sum + (currentScores[item.field] || 0), 0);
                      const catMax = cat.items.reduce((sum, item) => sum + item.max, 0);
                      return (
                        <div key={cat.id} style={{
                          flex: 1, minWidth: 80, padding: "8px 10px", borderRadius: 8,
                          background: "#f8fafc", border: "1px solid #e2e8f0", textAlign: "center"
                        }}>
                          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>{cat.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#7f1d1d" }}>{catScore}</div>
                          <div style={{ fontSize: 9, color: "#94a3b8" }}>/ {catMax}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ─── 질적 피드백 카드 ─────────────────────────────────────── */}
              <div style={S.card}>
                <div style={S.sectionTitle}>💬 질적 피드백 태그</div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", marginBottom: 8, letterSpacing: 0.5 }}>✅ POSITIVE</div>
                  {POSITIVE_TAGS.map(t => (
                    <button key={t} className="tag-btn" onClick={() => toggleTag(t, "positive")} style={{
                      ...S.tag("positive"),
                      opacity: currentTags.find(x => x.text === t) ? 1 : 0.55,
                      transform: currentTags.find(x => x.text === t) ? "scale(1.04)" : "scale(1)",
                      boxShadow: currentTags.find(x => x.text === t) ? "0 2px 8px rgba(34,197,94,0.25)" : "none",
                    }}>{t}</button>
                  ))}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", marginBottom: 8, letterSpacing: 0.5 }}>❌ NEGATIVE</div>
                  {NEGATIVE_TAGS.map(t => (
                    <button key={t} className="tag-btn" onClick={() => toggleTag(t, "negative")} style={{
                      ...S.tag("negative"),
                      opacity: currentTags.find(x => x.text === t) ? 1 : 0.55,
                      transform: currentTags.find(x => x.text === t) ? "scale(1.04)" : "scale(1)",
                      boxShadow: currentTags.find(x => x.text === t) ? "0 2px 8px rgba(239,68,68,0.2)" : "none",
                    }}>{t}</button>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8, letterSpacing: 0.5 }}>선택된 태그</div>
                  {currentTags.length === 0 && <span style={{ fontSize: 12, color: "#cbd5e1" }}>태그를 선택하면 여기에 표시됩니다.</span>}
                  {currentTags.map((t, i) => (
                    <span key={i} style={S.badge(t.type)}>
                      {t.text}
                      <span onClick={() => toggleTag(t.text, t.type)}
                        style={{ cursor: "pointer", fontSize: 14, lineHeight: 1, marginLeft: 2 }}>×</span>
                    </span>
                  ))}
                </div>

                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, letterSpacing: 0.5 }}>면접 메모</div>
                  <textarea
                    rows={3}
                    value={currentNote}
                    onChange={e => setCurrentNote(e.target.value)}
                    placeholder="추가 메모를 입력하세요..."
                    style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginBottom: 40 }}>
                <button onClick={newCandidate} style={{
                  borderRadius: 8, padding: "8px 16px",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: "#fff", border: "1.5px solid #e2e8f0", color: "#64748b"
                }}>새 지원자</button>
                <button
                  onClick={saveEvaluation}
                  style={{
                    border: "none", borderRadius: 8, padding: "10px 28px",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)",
                    color: "#fff", boxShadow: "0 2px 8px rgba(220,38,38,0.3)",
                  }}>
                  {saving ? '저장 중...' : '✓ 평가 저장 & 순위 반영'}
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      {showDetailsModal && (
        <EvaluationDetailsModal
          candidate={showDetailsModal}
          onClose={() => setShowDetailsModal(null)}
          evalCategories={evalCategories}
        />
      )}
      </div>
      )}

    </div>
  );
}
