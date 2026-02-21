'use client'

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts"
import { createClient } from '@supabase/supabase-js'

// ─── Supabase Client ──────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

function getInterviewerId() {
  if (typeof window === 'undefined') return null
  let id = localStorage.getItem('kah_interviewer_id')
  if (!id) {
    id = `interviewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('kah_interviewer_id', id)
  }
  return id
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_EVAL_CATEGORIES = [
  { id: 'job', label: '직무적합도', items: [
    { field: 'sincerity',    label: '성실성', max: 3 },
    { field: 'cooperation',  label: '협조성', max: 3 },
    { field: 'planning',     label: '계획성', max: 3 },
  ]},
  { id: 'communication', label: '의사소통', items: [
    { field: 'expression',   label: '표현력', max: 3 },
    { field: 'commonsense',  label: '상식성', max: 3 },
  ]},
  { id: 'personality_cat', label: '인성', items: [
    { field: 'proactivity',  label: '적극성', max: 3 },
    { field: 'personality',  label: '인성',   max: 3 },
  ]},
  { id: 'surprise_q', label: '돌발질문', items: [
    { field: 'q1',           label: '내용 1', max: 5 },
    { field: 'q2',           label: '내용 2', max: 5 },
    { field: 'comprehension',label: '이해력', max: 5 },
    { field: 'logic',        label: '논리력', max: 5 },
    { field: 'creativity',   label: '창의력', max: 5 },
  ]},
]

const DEFAULT_SURPRISE_TOPICS = [
  { id: 1, text: '조직문화 적응' },
  { id: 2, text: '갈등 해결 경험' },
  { id: 3, text: '리더십 경험' },
  { id: 4, text: '실패 경험과 극복' },
  { id: 5, text: '지원 동기' },
  { id: 6, text: '향후 목표' },
  { id: 7, text: '팀워크 경험' },
  { id: 8, text: '스트레스 관리' },
]

const POSITIVE_TAGS = ["논리정연함", "자신감 있음", "준비 철저", "협업 마인드", "아이디어 우수", "높은 직무 이해도", "경청과 소통", "구체적 경험 제시", "성장 지향성"]
const NEGATIVE_TAGS = ["소극적 태도", "동문서답", "근거 부족", "목소리 작음", "긴장함", "협업 우려", "방어적 태도"]

const DEFAULT_INTERVIEW_QUESTIONS = [
  "간단하게 자기소개를 해주세요.",
  "우리 단체에 지원하게 된 동기가 무엇인가요?",
  "본인의 강점과 약점을 솔직하게 말씀해주세요.",
  "팀 프로젝트에서 어려움이 있었던 경험과 극복 방법을 말씀해주세요.",
  "입단 후 본인이 기여할 수 있는 부분은 무엇인가요?",
  "갈등 상황에서 어떻게 대처하시나요?",
  "마지막으로 하고 싶으신 말씀이 있으시면 해주세요.",
]

// ─── Olympic Scoring Helper ────────────────────────────────────────────────────
function calcDisplayScore(evaluations) {
  const n = evaluations.length
  if (n === 0) return { score: 0, isOlympic: false }
  const scores = evaluations.map(e => e.total_score || 0)
  if (n >= 5) {
    const sum = scores.reduce((a, b) => a + b, 0)
    const max = Math.max(...scores)
    const min = Math.min(...scores)
    return { score: parseFloat(((sum - max - min) / (n - 2)).toFixed(1)), isOlympic: true }
  }
  return { score: parseFloat((scores.reduce((a, b) => a + b, 0) / n).toFixed(1)), isOlympic: false }
}

function toHundred(score, maxTotal) {
  return parseFloat(((score / maxTotal) * 100).toFixed(1))
}

// ─── Supabase Settings Helpers ────────────────────────────────────────────────
async function loadSetting(key) {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single()
    if (error || !data) return null
    return data.value
  } catch { return null }
}

async function saveSetting(key, value) {
  try {
    await supabase
      .from('app_settings')
      .upsert({ key, value }, { onConflict: 'key' })
  } catch { /* silent fail */ }
}

// ─── KAH Logo Component ───────────────────────────────────────────────────────
const KAHLogo = () => (
  <div className="flex items-center gap-2">
    <div className="w-10 h-10 rounded-lg bg-[#800020] flex items-center justify-center shadow-lg">
      <span className="text-white font-black text-sm tracking-tight font-serif">KAH</span>
    </div>
    <div>
      <div className="text-[#1e3a5f] font-extrabold text-[15px] tracking-tight leading-tight">KAH Interview</div>
      <div className="text-[#64748b] text-[10px] tracking-widest uppercase">Evaluation System</div>
    </div>
  </div>
)

// ─── Fake PDF Parser ──────────────────────────────────────────────────────────
function fakeParsePDF(filename) {
  return {
    name: "홍길동", dob: "2002-05-14", available12: "가능",
    phone: "010-1234-5678", email: "hong@kah.ac.kr",
    studentId: "20220001", address: "서울특별시 강남구 역삼동",
    major: "컴퓨터공학과", grade: "3학년 1학기",
    career: "교내 개발 동아리 2년, 외부 해커톤 입상 경험",
    schedule: "2월 17일 14:00",
  }
}

// ─── ScoreInput Component ─────────────────────────────────────────────────────
function ScoreInput({ label, field, scores, max, onChange }) {
  const pct = max > 0 ? scores[field] / max : 0
  const barColor = pct >= 0.8 ? "#22c55e" : pct >= 0.5 ? "#f59e0b" : "#ef4444"
  return (
    <div className="flex items-center py-2.5 border-b border-gray-100 gap-3">
      <div className="flex-1 text-sm text-gray-700 font-medium">{label}</div>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div style={{ width: `${pct * 100}%`, backgroundColor: barColor }} className="h-full rounded-full transition-all duration-300" />
      </div>
      <input
        type="number" min={0} max={max} value={scores[field] || 0}
        onChange={e => onChange(field, Math.min(max, Math.max(0, Number(e.target.value))))}
        className="w-14 border-[1.5px] border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-center outline-none bg-gray-50 focus:border-[#800020] focus:bg-white"
      />
      <span className="text-xs text-gray-400 min-w-[50px]">/ {max}점</span>
    </div>
  )
}

// ─── Timer Component ──────────────────────────────────────────────────────────
function Timer() {
  const [minutes, setMinutes] = useState(10)
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(null)
  const intervalRef = useRef(null)

  const totalSecs = remaining !== null ? remaining : minutes * 60 + seconds
  const displayMin = Math.floor(totalSecs / 60)
  const displaySec = totalSecs % 60
  const isWarning = totalSecs <= 60 && totalSecs > 0
  const isDone = totalSecs === 0 && running === false && remaining === 0

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) { clearInterval(intervalRef.current); setRunning(false); return 0 }
          return r - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const start = () => { if (remaining === null) setRemaining(minutes * 60 + seconds); setRunning(true) }
  const pause = () => { setRunning(false); clearInterval(intervalRef.current) }
  const reset = () => { setRunning(false); clearInterval(intervalRef.current); setRemaining(null) }

  return (
    <div className="flex items-center gap-4">
      <div className="text-xs font-semibold text-gray-500 tracking-wider">⏱ TIMER</div>
      {remaining === null ? (
        <div className="flex items-center gap-1">
          <input type="number" min={0} max={99} value={minutes} onChange={e => setMinutes(Number(e.target.value))} className="w-12 border-[1.5px] border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none bg-gray-50" />
          <span className="text-gray-500">:</span>
          <input type="number" min={0} max={59} value={seconds} onChange={e => setSeconds(Number(e.target.value))} className="w-12 border-[1.5px] border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none bg-gray-50" />
        </div>
      ) : (
        <div className={`text-2xl font-extrabold tracking-wider min-w-20 text-center ${isDone ? 'text-green-500' : isWarning ? 'text-red-500' : 'text-[#1e3a5f]'}`}
          style={{ animation: isWarning && running ? 'pulse 1s infinite' : 'none' }}>
          {String(displayMin).padStart(2, "0")}:{String(displaySec).padStart(2, "0")}
        </div>
      )}
      <div className="flex gap-1.5">
        {!running && <button onClick={start} className="border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer bg-green-500 text-white hover:bg-green-600 transition-colors">▶ Start</button>}
        {running && <button onClick={pause} className="border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer bg-amber-500 text-white hover:bg-amber-600 transition-colors">⏸ Pause</button>}
        <button onClick={reset} className="border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer bg-gray-400 text-white hover:bg-gray-500 transition-colors">↺ Reset</button>
      </div>
      {isDone && <span className="text-xs text-green-500 font-bold">✓ 완료!</span>}
    </div>
  )
}

// ─── Radar Chart Component ────────────────────────────────────────────────────
function CompetencyRadar({ scores, evalCategories }) {
  const data = evalCategories.map(cat => {
    const catScore = cat.items.reduce((sum, item) => sum + (scores[item.field] || 0), 0)
    const catMax   = cat.items.reduce((sum, item) => sum + item.max, 0)
    return { subject: cat.label, value: catMax > 0 ? parseFloat(((catScore / catMax) * 100).toFixed(1)) : 0 }
  })
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickCount={5} />
        <Radar name="역량" dataKey="value" stroke="#800020" fill="#800020" fillOpacity={0.18} strokeWidth={2} dot={{ fill: "#800020", r: 3 }} />
        <Tooltip formatter={(v) => `${v}점`} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ─── Evaluation Details Modal ─────────────────────────────────────────────────
function EvaluationDetailsModal({ candidate, onClose, onUpdate, evalCategories }) {
  if (!candidate || !candidate.evaluations || candidate.evaluations.length === 0) return null

  const maxTotal = evalCategories.reduce((sum, cat) => sum + cat.items.reduce((s, i) => s + i.max, 0), 0)
  const { score: displayScore, isOlympic } = calcDisplayScore(candidate.evaluations)
  const n = candidate.evaluations.length

  const labelMap = {}
  evalCategories.forEach(cat => cat.items.forEach(item => { labelMap[item.field] = item.label }))

  const handleInterviewerIdChange = async (evaluation, newId) => {
    if (!newId.trim() || newId === evaluation.interviewer_id) return
    try {
      const { error } = await supabase.from('evaluations').update({ interviewer_id: newId.trim() }).eq('id', evaluation.id)
      if (error) throw error
      if (onUpdate) onUpdate()
    } catch (err) { console.error('Error updating interviewer_id:', err) }
  }

  const handleDeleteEvaluation = async (evaluation) => {
    if (!confirm(`면접관 "${evaluation.interviewer_id}"의 평가를 삭제하시겠습니까?`)) return
    try {
      const { error } = await supabase.from('evaluations').delete().eq('id', evaluation.id)
      if (error) throw error
      if (onUpdate) onUpdate()
    } catch (err) { console.error('Error deleting evaluation:', err) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-5" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-[#1e3a5f] mb-1">{candidate.name} - 평가 상세</h2>
            <p className="text-sm text-gray-500">총 {n}명의 면접관이 평가했습니다</p>
            {isOlympic && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">🏅 올림픽 스코어링 적용</span>
                <span className="text-[10px] text-gray-400">(최고·최저 제외, {n - 2}명 평균)</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="border-none bg-gray-100 rounded-lg w-8 h-8 cursor-pointer text-lg text-gray-500 hover:bg-gray-200">×</button>
        </div>

        <div className="mb-6">
          <div className="bg-[#800020] rounded-xl p-4 text-white flex justify-between items-center">
            <div>
              <div className="text-xs opacity-80 mb-1">{isOlympic ? '올림픽 평균 점수' : '평균 점수'}</div>
              <div className="text-3xl font-black">{Number(displayScore).toFixed(1)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-80">/ {maxTotal}점</div>
              <div className="text-2xl font-extrabold">{toHundred(displayScore, maxTotal)}점</div>
            </div>
          </div>
        </div>

        <div className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">개별 평가 내역</div>

        {candidate.evaluations.map((evaluation, idx) => (
          <div key={idx} className="bg-gray-50 rounded-xl p-4 mb-3 border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#800020] text-white flex items-center justify-center text-xs font-bold">{idx + 1}</div>
                <div>
                  <div className="text-xs text-gray-400 font-semibold mb-0.5">평가자 이름 (ID)</div>
                  <input
                    className="text-xs text-[#1e3a5f] font-semibold border-[1.5px] border-gray-200 rounded-md px-2 py-1 bg-white outline-none focus:border-[#800020] w-44"
                    defaultValue={evaluation.interviewer_id}
                    onBlur={e => handleInterviewerIdChange(evaluation, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xl font-extrabold text-[#800020]">{Number(evaluation.total_score).toFixed(1)}점</div>
                <button onClick={() => handleDeleteEvaluation(evaluation)} className="border-none bg-red-50 text-red-500 text-xs px-3 py-1.5 rounded-lg cursor-pointer font-semibold hover:bg-red-500 hover:text-white transition-colors">삭제</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {Object.entries(evaluation.scores).map(([key, value]) => (
                <div key={key} className="bg-white rounded-md px-2.5 py-1.5 flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-semibold">{labelMap[key] || key}</span>
                  <span className="text-xs text-[#1e3a5f] font-bold">{value}</span>
                </div>
              ))}
            </div>
            {evaluation.tags && evaluation.tags.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-gray-400 mb-1 font-semibold">태그</div>
                <div className="flex flex-wrap gap-1.5">
                  {evaluation.tags.map((tag, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${tag.type === 'positive' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>{tag.text}</span>
                  ))}
                </div>
              </div>
            )}
            {evaluation.note && (
              <div>
                <div className="text-xs text-gray-400 mb-1 font-semibold">메모</div>
                <div className="text-xs text-gray-600 leading-relaxed bg-white p-2 rounded-md">{evaluation.note}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InterviewSystem() {
  const router = useRouter()

  // ── 기본 상태 ─────────────────────────────────────────────────────────────
  const [selectedCandidateId, setSelectedCandidateId] = useState(null)
  const [currentCandidate, setCurrentCandidate] = useState(null)
  const [currentScores, setCurrentScores] = useState({
    sincerity: 0, cooperation: 0, planning: 0,
    expression: 0, commonsense: 0,
    proactivity: 0, personality: 0,
    q1: 0, q2: 0, comprehension: 0, logic: 0, creativity: 0,
  })
  const [currentTags, setCurrentTags] = useState([])
  const [currentNote, setCurrentNote] = useState('')
  const [candidates, setCandidates] = useState([])
  const [interviewerId, setInterviewerId] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [parseMsg, setParseMsg] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [evaluatorName, setEvaluatorName] = useState(() => {
    try { return localStorage.getItem('kah_evaluator_name') || '' } catch { return '' }
  })
  const [checkedQuestions, setCheckedQuestions] = useState(new Set())
  const fileRef = useRef()

  // ── 평가항목 편집 상태 ────────────────────────────────────────────────────
  const [evalCategories, setEvalCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('kah_eval_categories')
      return saved ? JSON.parse(saved) : DEFAULT_EVAL_CATEGORIES
    } catch { return DEFAULT_EVAL_CATEGORIES }
  })
  const [isEditingEval, setIsEditingEval] = useState(false)
  const [editEvalTemp, setEditEvalTemp] = useState(null)
  const [evalSaving, setEvalSaving] = useState(false)

  // ── 돌발 질문 주제 상태 ───────────────────────────────────────────────────
  const [surpriseTopicsOpen, setSurpriseTopicsOpen] = useState(false)
  const [surpriseTopics, setSurpriseTopics] = useState(() => {
    try {
      const saved = localStorage.getItem('kah_surprise_topics')
      return saved ? JSON.parse(saved) : DEFAULT_SURPRISE_TOPICS
    } catch { return DEFAULT_SURPRISE_TOPICS }
  })
  const [selectedSurpriseTopics, setSelectedSurpriseTopics] = useState([])
  const [isEditingSurpriseTopics, setIsEditingSurpriseTopics] = useState(false)
  const [isAddingSurpriseTopic, setIsAddingSurpriseTopic] = useState(false)
  const [newSurpriseTopicText, setNewSurpriseTopicText] = useState('')
  const [editingSurpriseTopicId, setEditingSurpriseTopicId] = useState(null)
  const [editingSurpriseTopicText, setEditingSurpriseTopicText] = useState('')

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── 점수 계산 ──────────────────────────────────────────────────────────────
  const dynamicMaxScores = {}
  evalCategories.forEach(cat => cat.items.forEach(item => { dynamicMaxScores[item.field] = item.max }))

  const total = Object.entries(currentScores).reduce((sum, [, v]) => sum + (Number(v) || 0), 0)
  const maxTotal = Object.values(dynamicMaxScores).reduce((a, b) => a + b, 0)
  const effectiveInterviewerId = evaluatorName.trim() || interviewerId

  // ── 설정 영속성 ───────────────────────────────────────────────────────────
  const persistEvalCategories = async (cats) => {
    localStorage.setItem('kah_eval_categories', JSON.stringify(cats))
    await saveSetting('eval_categories', cats)
  }

  const persistSurpriseTopics = async (topics) => {
    localStorage.setItem('kah_surprise_topics', JSON.stringify(topics))
    await saveSetting('surprise_topics', topics)
  }

  // 앱 시작 시 Supabase에서 최신 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      const remoteCategories = await loadSetting('eval_categories')
      if (remoteCategories) {
        setEvalCategories(remoteCategories)
        localStorage.setItem('kah_eval_categories', JSON.stringify(remoteCategories))
      }
      const remoteTopics = await loadSetting('surprise_topics')
      if (remoteTopics) {
        setSurpriseTopics(remoteTopics)
        localStorage.setItem('kah_surprise_topics', JSON.stringify(remoteTopics))
      }
    }
    loadSettings()
  }, [])

  // ── 평가항목 편집 핸들러 ──────────────────────────────────────────────────
  const startEvalEdit = () => {
    setEditEvalTemp(JSON.parse(JSON.stringify(evalCategories)))
    setIsEditingEval(true)
  }

  const cancelEvalEdit = () => {
    setEditEvalTemp(null)
    setIsEditingEval(false)
  }

  const saveEvalEdit = async () => {
    setEvalSaving(true)
    setEvalCategories(editEvalTemp)
    await persistEvalCategories(editEvalTemp)
    setEditEvalTemp(null)
    setIsEditingEval(false)
    setEvalSaving(false)
    showToast('✅ 평가항목이 저장되었습니다.')
  }

  const updateEditTempCatLabel = (catId, value) => {
    setEditEvalTemp(prev => prev.map(cat => cat.id === catId ? { ...cat, label: value } : cat))
  }

  const updateEditTempItemLabel = (catId, field, value) => {
    setEditEvalTemp(prev => prev.map(cat =>
      cat.id === catId
        ? { ...cat, items: cat.items.map(item => item.field === field ? { ...item, label: value } : item) }
        : cat
    ))
  }

  const updateEditTempItemMax = (catId, field, value) => {
    setEditEvalTemp(prev => prev.map(cat =>
      cat.id === catId
        ? { ...cat, items: cat.items.map(item => item.field === field ? { ...item, max: Math.max(1, value) } : item) }
        : cat
    ))
  }

  // ── 돌발 질문 핸들러 ──────────────────────────────────────────────────────
  const toggleSurpriseTopic = async (id) => {
    const next = selectedSurpriseTopics.includes(id)
      ? selectedSurpriseTopics.filter(x => x !== id)
      : [...selectedSurpriseTopics, id]
    setSelectedSurpriseTopics(next)

    if (currentCandidate && !currentCandidate.id.toString().startsWith('temp_')) {
      const updatedInfo = { ...currentCandidate.info, surpriseTopics: next }
      setCurrentCandidate(prev => ({ ...prev, info: updatedInfo }))
      try {
        await supabase.from('candidates').update({ info: updatedInfo }).eq('id', currentCandidate.id)
      } catch (e) { console.error('surprise topic save error', e) }
    }
  }

  const addSurpriseTopic = async () => {
    if (!newSurpriseTopicText.trim()) return
    const updated = [...surpriseTopics, { id: Date.now(), text: newSurpriseTopicText.trim() }]
    setSurpriseTopics(updated)
    await persistSurpriseTopics(updated)
    setNewSurpriseTopicText('')
    setIsAddingSurpriseTopic(false)
  }

  const saveSurpriseTopicEdit = async (id) => {
    if (!editingSurpriseTopicText.trim()) return
    const updated = surpriseTopics.map(t => t.id === id ? { ...t, text: editingSurpriseTopicText.trim() } : t)
    setSurpriseTopics(updated)
    await persistSurpriseTopics(updated)
    setEditingSurpriseTopicId(null)
    setEditingSurpriseTopicText('')
  }

  const deleteSurpriseTopic = async (id) => {
    const updated = surpriseTopics.filter(t => t.id !== id)
    setSurpriseTopics(updated)
    await persistSurpriseTopics(updated)
    setSelectedSurpriseTopics(prev => prev.filter(x => x !== id))
  }

  // ── 기타 핸들러 ───────────────────────────────────────────────────────────
  const updateScore = (field, value) => setCurrentScores(prev => ({ ...prev, [field]: value }))

  const toggleTag = (text, type) => {
    setCurrentTags(prev => {
      const exists = prev.find(t => t.text === text)
      return exists ? prev.filter(t => t.text !== text) : [...prev, { text, type }]
    })
  }

  const resetCurrentEvaluation = () => {
    setCurrentCandidate(null)
    setCurrentScores({ sincerity: 0, cooperation: 0, planning: 0, expression: 0, commonsense: 0, proactivity: 0, personality: 0, q1: 0, q2: 0, comprehension: 0, logic: 0, creativity: 0 })
    setCurrentTags([])
    setCurrentNote('')
    setSelectedCandidateId(null)
    setSelectedSurpriseTopics([])
    setCheckedQuestions(new Set())
  }

  const loadEvaluationForCandidate = (candidateId, evalInterviewerId) => {
    const candidate = candidates.find(c => c.id === candidateId)
    if (!candidate) return

    const myEvaluation = candidate.evaluations?.find(e => e.interviewer_id === evalInterviewerId)
    const defaultScores = { sincerity: 0, cooperation: 0, planning: 0, expression: 0, commonsense: 0, proactivity: 0, personality: 0, q1: 0, q2: 0, comprehension: 0, logic: 0, creativity: 0 }

    // 저장된 돌발 질문 선택 복원
    setSelectedSurpriseTopics(candidate.info?.surpriseTopics || [])

    setSelectedCandidateId(candidateId)
    setCurrentCandidate(candidate)
    if (myEvaluation) {
      setCurrentScores(myEvaluation.scores || defaultScores)
      setCurrentTags(myEvaluation.tags || [])
      setCurrentNote(myEvaluation.note || '')
    } else {
      setCurrentScores(defaultScores)
      setCurrentTags([])
      setCurrentNote('')
    }
  }

  useEffect(() => { setInterviewerId(getInterviewerId()) }, [])
  useEffect(() => { fetchCandidates() }, [])

  const fetchCandidates = async () => {
    try {
      setLoading(true)
      const { data: candidatesData, error: candidatesError } = await supabase.from('candidates').select('*').order('created_at', { ascending: false })
      if (candidatesError) throw candidatesError

      const { data: evaluationsData, error: evaluationsError } = await supabase.from('evaluations').select('*').order('created_at', { ascending: false })
      if (evaluationsError) throw evaluationsError

      const candidatesWithScores = candidatesData.map(candidate => {
        const candidateEvaluations = evaluationsData.filter(e => e.candidate_id === candidate.id)
        const { score: avgScore, isOlympic } = calcDisplayScore(candidateEvaluations)
        return { ...candidate, evaluations: candidateEvaluations, avg_score: avgScore, evaluation_count: candidateEvaluations.length, is_olympic: isOlympic }
      })

      candidatesWithScores.sort((a, b) => b.avg_score - a.avg_score)
      setCandidates(candidatesWithScores)
    } catch (error) {
      console.error('Error fetching candidates:', error)
      showToast('데이터를 불러오는데 실패했습니다: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCandidateClick = (candidate) => {
    if (!effectiveInterviewerId) { showToast('면접관 ID가 설정되지 않았습니다.', 'error'); return }
    setCheckedQuestions(new Set())
    loadEvaluationForCandidate(candidate.id, effectiveInterviewerId)
  }

  const saveEvaluation = async () => {
    if (!currentCandidate || !effectiveInterviewerId) { showToast('지원자를 선택해주세요.', 'error'); return }
    if (!currentCandidate.name?.trim()) { showToast('지원자 이름을 입력해주세요.', 'error'); return }

    try {
      setSaving(true)
      let candidateId = currentCandidate.id
      const infoWithSurprise = { ...currentCandidate.info, surpriseTopics: selectedSurpriseTopics }

      if (currentCandidate.id.toString().startsWith('temp_')) {
        const { data: newCandidate, error: createError } = await supabase
          .from('candidates').insert({ name: currentCandidate.name, info: infoWithSurprise }).select().single()
        if (createError) throw createError
        candidateId = newCandidate.id
        setCurrentCandidate({ ...currentCandidate, id: candidateId, info: infoWithSurprise })
        setSelectedCandidateId(candidateId)
      } else {
        await supabase.from('candidates').update({ info: infoWithSurprise }).eq('id', candidateId)
        setCurrentCandidate(prev => ({ ...prev, info: infoWithSurprise }))
      }

      const { error } = await supabase.from('evaluations').upsert({
        candidate_id: candidateId,
        interviewer_id: effectiveInterviewerId,
        scores: currentScores,
        total_score: total,
        tags: currentTags,
        note: currentNote,
      }, { onConflict: 'candidate_id,interviewer_id' })

      if (error) throw error

      showToast('✅ 평가가 저장되었습니다!', 'success')
      await fetchCandidates()
    } catch (error) {
      console.error('Error saving evaluation:', error)
      showToast('평가 저장에 실패했습니다: ' + error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const createCandidate = async (candidateInfo) => {
    try {
      const { data, error } = await supabase.from('candidates').insert({ name: candidateInfo.name, info: candidateInfo }).select().single()
      if (error) throw error
      await fetchCandidates()
      if (data && interviewerId) loadEvaluationForCandidate(data.id, interviewerId)
      return data
    } catch (error) {
      console.error('Error creating candidate:', error)
      showToast('지원자 등록에 실패했습니다: ' + error.message, 'error')
      return null
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer?.files?.[0] || e.target.files?.[0]
    if (!file) return
    setParseMsg("📄 PDF 파싱 중...")
    setTimeout(async () => {
      const parsed = fakeParsePDF(file.name)
      setParseMsg("✅ 정보가 자동으로 입력되었습니다.")
      await createCandidate(parsed)
    }, 1200)
  }, [interviewerId])

  const newCandidate = () => {
    resetCurrentEvaluation()
    setParseMsg("")
    const tempCandidate = {
      id: 'temp_' + Date.now(),
      name: '',
      info: { dob: '', available12: '', phone: '', email: '', studentId: '', address: '', major: '', grade: '', career: '', schedule: '' },
      evaluations: [], avg_score: 0, evaluation_count: 0
    }
    setCurrentCandidate(tempCandidate)
    setSelectedCandidateId(tempCandidate.id)
  }

  const deleteCandidate = async (candidateId) => {
    if (!confirm('이 지원자를 삭제하시겠습니까? 모든 평가 데이터가 함께 삭제됩니다.')) return

    // 낙관적 UI 업데이트 — 삭제 버튼 클릭 즉시 목록에서 제거
    setCandidates(prev => prev.filter(c => c.id !== candidateId))
    if (selectedCandidateId === candidateId) resetCurrentEvaluation()

    try {
      // 1단계: 평가 데이터 먼저 삭제 (외래 키 제약 대비)
      const { error: evalError } = await supabase.from('evaluations').delete().eq('candidate_id', candidateId)
      if (evalError) {
        console.error('Evaluation delete error:', evalError)
        // 평가 삭제 실패해도 지원자 삭제는 시도 (CASCADE 설정 시 DB가 처리)
      }
      // 2단계: 지원자 삭제
      const { error: candError } = await supabase.from('candidates').delete().eq('id', candidateId)
      if (candError) {
        // RLS DELETE 정책이 없는 경우 발생 — Supabase 대시보드에서 정책 추가 필요
        // supabase-schema.sql 참고: "Anyone can delete candidates" 정책
        console.error('Candidate delete error:', candError)
        throw candError
      }
      showToast('지원자가 삭제되었습니다.', 'success')
    } catch (error) {
      console.error('Error deleting candidate:', error)
      const isRlsError = error.message?.includes('row-level security') || error.code === '42501'
      showToast(
        isRlsError
          ? '삭제 권한이 없습니다. Supabase에서 DELETE 정책을 추가해주세요.'
          : '삭제에 실패했습니다: ' + error.message,
        'error'
      )
      // 실패 시 목록 복원
      await fetchCandidates()
    }
  }

  const updateCandidateInfo = async (field, value) => {
    if (!currentCandidate) return
    const updatedInfo = { ...currentCandidate.info, [field]: value }
    const updatedName = field === 'name' ? value : currentCandidate.name
    setCurrentCandidate({ ...currentCandidate, name: updatedName, info: updatedInfo })
    if (!currentCandidate.id.toString().startsWith('temp_')) {
      try {
        const { error } = await supabase.from('candidates').update({ name: updatedName, info: updatedInfo }).eq('id', currentCandidate.id)
        if (error) throw error
      } catch (error) { console.error('Error updating candidate:', error) }
    }
  }

  const inputField = (label, field, span = false) => {
    const value = field === 'name' ? currentCandidate?.name : currentCandidate?.info?.[field]
    return (
      <div className={`flex flex-col gap-1 flex-1 ${span ? 'min-w-full' : 'min-w-[140px]'}`}>
        <label className="text-xs font-semibold text-gray-400 tracking-wide">{label}</label>
        <input
          className="border-[1.5px] border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-800 transition-colors bg-gray-50 w-full focus:border-[#800020] focus:bg-white"
          value={value || ""}
          onChange={e => updateCandidateInfo(field, e.target.value)}
          placeholder={label}
          disabled={!currentCandidate}
        />
      </div>
    )
  }

  const displayCategories = isEditingEval ? editEvalTemp : evalCategories

  return (
    <div className="font-sans bg-gray-50 min-h-screen text-gray-800">
      {/* ── STICKY HEADER ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-6 h-16 flex items-center justify-between shadow-sm">
        <KAHLogo />
        <Timer />
        <div className="flex gap-2 items-center">
          {(evaluatorName || interviewerId) && (
            <div className="text-xs text-gray-400 mr-2">
              평가자: <span className="font-semibold text-[#800020]">{evaluatorName || interviewerId?.slice(-8)}</span>
            </div>
          )}
          <button onClick={newCandidate} className="border-[1.5px] border-gray-200 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer bg-white text-gray-600 hover:border-[#800020] hover:text-[#800020] transition-colors">
            + 신규 지원자
          </button>
          <button onClick={saveEvaluation} className="border-none rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer bg-[#800020] text-white shadow-md hover:opacity-90 transition-all">
            {saving ? '저장 중...' : '✓ 평가 저장'}
          </button>
          <button onClick={() => { sessionStorage.removeItem('kah_auth'); router.push('/') }}
            className="border-[1.5px] border-red-200 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer bg-white text-red-500 hover:bg-red-50 hover:border-red-400 transition-colors">
            로그아웃
          </button>
        </div>
      </header>

      <div className="flex items-start">
        {/* ── STICKY SIDEBAR ────────────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto bg-white border-r border-gray-200 p-5">
          <div className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-4">🏆 실시간 순위 (평균)</div>

          {loading && <div className="text-sm text-gray-400 text-center mt-5">로딩 중...</div>}
          {!loading && candidates.length === 0 && <div className="text-sm text-gray-400 text-center mt-5">지원자를 등록해주세요.</div>}

          {!loading && candidates.map((c, i) => {
            const isActive = c.id === selectedCandidateId
            const rankColors = { 1: 'bg-yellow-500', 2: 'bg-gray-400', 3: 'bg-orange-600' }
            return (
              <div key={c.id}>
                <div
                  className={`flex items-center gap-2 p-3 rounded-lg mb-1.5 cursor-pointer transition-all ${isActive ? 'bg-red-50 border-[1.5px] border-[#800020]/30' : 'bg-gray-50 border-[1.5px] border-transparent hover:bg-red-50/50'}`}
                  onClick={() => handleCandidateClick(c)}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${rankColors[i + 1] || 'bg-gray-200'} ${i + 1 <= 3 ? 'text-white' : 'text-gray-500'}`}>{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      평균: {Number(c.avg_score).toFixed(1)}점 ({c.evaluation_count}명)
                      {c.is_olympic && <span className="text-[9px] font-bold text-amber-500 bg-amber-50 px-1 py-0.5 rounded">올림픽</span>}
                    </div>
                  </div>
                  <div className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-[#800020]">{toHundred(c.avg_score, maxTotal)}점</div>
                  <button onClick={(e) => { e.stopPropagation(); deleteCandidate(c.id) }} className="border-none bg-transparent text-red-400 text-xs px-1 cursor-pointer font-bold hover:text-red-600 flex-shrink-0" title="삭제">✕</button>
                </div>
                {c.evaluation_count > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); setShowDetailsModal(c.id) }} className="border-none bg-transparent text-[#800020] text-xs px-3 py-1 cursor-pointer font-semibold ml-2 mb-1.5 hover:underline">
                    📊 평가 상세보기
                  </button>
                )}
              </div>
            )
          })}

          <div className="mt-5 p-3.5 rounded-lg bg-gray-50 border border-gray-200">
            <div className="text-xs text-gray-400 tracking-wide mb-1 font-semibold">현재 평가 중</div>
            <div className="text-sm font-bold text-[#1e3a5f]">{currentCandidate?.name || "—"}</div>
            <div className="text-xs text-[#800020] font-bold">내 점수: {Number(total).toFixed(1)}점 / {maxTotal}점</div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
        <main className="flex-1 p-6 max-w-4xl">
          {/* PDF Upload */}
          {!currentCandidate && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5 shadow-sm">
              <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">📎 지원서 업로드 (PDF)</div>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragging ? 'border-[#800020] bg-red-50' : 'border-gray-300 bg-gray-50'}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div className="text-3xl mb-2">📄</div>
                <div className="text-sm text-gray-500 font-semibold">PDF 파일을 드래그하거나 클릭하여 업로드하세요</div>
                <div className="text-xs text-gray-400 mt-1">지원서의 정보가 자동으로 입력됩니다</div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleDrop} />
              {parseMsg && (
                <div className={`mt-2.5 text-sm px-3 py-2 rounded-lg font-semibold ${parseMsg.startsWith("✅") ? 'text-green-700 bg-green-100' : 'text-gray-600 bg-gray-100'}`}>
                  {parseMsg}
                </div>
              )}
            </div>
          )}

          {/* Applicant Info */}
          {currentCandidate && (
            <>
              {/* ── 지원자 정보 ───────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5 shadow-sm">
                <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">👤 지원자 정보</div>
                <div className="flex gap-3 mb-3 flex-wrap">
                  {inputField("이름", "name")}
                  {inputField("생년월일", "dob")}
                  {inputField("12개월 참여", "available12")}
                  {inputField("휴대전화", "phone")}
                </div>
                <div className="flex gap-3 mb-3 flex-wrap">
                  {inputField("이메일", "email")}
                  {inputField("학번", "studentId")}
                  {inputField("전공", "major")}
                  {inputField("학년-학기", "grade")}
                </div>
                <div className="flex gap-3 mb-3 flex-wrap">{inputField("주소", "address", true)}</div>
                <div className="flex gap-3 mb-3 flex-wrap">
                  <div className="flex flex-col gap-1 flex-1 min-w-full">
                    <label className="text-xs font-semibold text-gray-400 tracking-wide">경력 및 활동사항</label>
                    <textarea rows={2} value={currentCandidate?.info?.career || ""} onChange={e => updateCandidateInfo("career", e.target.value)}
                      className="border-[1.5px] border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-800 resize-vertical min-h-[52px] leading-relaxed bg-gray-50 focus:border-[#800020] focus:bg-white"
                      placeholder="경력 및 활동사항을 입력하세요" />
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap">{inputField("면접 일정", "schedule")}</div>

                {/* ── 돌발 질문 토글 ─────────────────────────────────── */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    {/* 토글 버튼 */}
                    <button
                      onClick={() => setSurpriseTopicsOpen(v => !v)}
                      className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-sm font-bold text-[#1e3a5f] p-0"
                    >
                      <span className="text-gray-400 text-xs transition-transform duration-200" style={{ display: 'inline-block', transform: surpriseTopicsOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                      💡 돌발 질문 주제
                      {selectedSurpriseTopics.length > 0 && (
                        <span className="bg-[#800020] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{selectedSurpriseTopics.length}개 선택</span>
                      )}
                    </button>

                    {/* 수정 / 추가 버튼 */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setIsEditingSurpriseTopics(v => !v); setEditingSurpriseTopicId(null); if (!surpriseTopicsOpen) setSurpriseTopicsOpen(true) }}
                        className="border-[1.5px] border-gray-200 rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer bg-white text-gray-600 hover:border-[#800020] hover:text-[#800020] transition-colors"
                      >
                        {isEditingSurpriseTopics ? '✓ 완료' : '✏️ 수정'}
                      </button>
                      <button
                        onClick={() => { setSurpriseTopicsOpen(true); setIsAddingSurpriseTopic(true); setNewSurpriseTopicText('') }}
                        className="border-none rounded-md px-2.5 py-1 text-xs font-semibold cursor-pointer bg-[#800020] text-white hover:opacity-85 transition-opacity"
                      >
                        + 추가
                      </button>
                    </div>
                  </div>

                  {/* 주제 목록 */}
                  {surpriseTopicsOpen && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {surpriseTopics.map(topic => (
                          <div key={topic.id} className="inline-flex items-center gap-1">
                            {isEditingSurpriseTopics ? (
                              editingSurpriseTopicId === topic.id ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    value={editingSurpriseTopicText}
                                    onChange={e => setEditingSurpriseTopicText(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveSurpriseTopicEdit(topic.id); if (e.key === 'Escape') setEditingSurpriseTopicId(null) }}
                                    className="border-[1.5px] border-[#800020] rounded-lg px-2 py-1 text-xs outline-none bg-white w-28"
                                    autoFocus
                                  />
                                  <button onClick={() => saveSurpriseTopicEdit(topic.id)} className="border-none bg-[#800020] text-white text-xs px-2 py-1 rounded-md cursor-pointer font-semibold">저장</button>
                                  <button onClick={() => setEditingSurpriseTopicId(null)} className="border-[1.5px] border-gray-200 bg-white text-gray-500 text-xs px-2 py-1 rounded-md cursor-pointer">취소</button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 border border-gray-200 text-gray-600">{topic.text}</span>
                                  <button onClick={() => { setEditingSurpriseTopicId(topic.id); setEditingSurpriseTopicText(topic.text) }} className="border-none bg-indigo-100 text-indigo-700 text-xs px-1.5 py-0.5 rounded cursor-pointer" title="수정">✏️</button>
                                  <button onClick={() => deleteSurpriseTopic(topic.id)} className="border-none bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded cursor-pointer font-bold" title="삭제">×</button>
                                </div>
                              )
                            ) : (
                              <button
                                onClick={() => toggleSurpriseTopic(topic.id)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                                  selectedSurpriseTopics.includes(topic.id)
                                    ? 'border-[#800020] bg-red-50 text-[#800020] shadow-sm'
                                    : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-[#800020]/50'
                                }`}
                              >
                                {selectedSurpriseTopics.includes(topic.id) && '✓ '}{topic.text}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 새 주제 추가 */}
                      {isAddingSurpriseTopic && (
                        <div className="flex gap-1.5 mt-2">
                          <input
                            value={newSurpriseTopicText}
                            onChange={e => setNewSurpriseTopicText(e.target.value)}
                            placeholder="새 돌발 질문 주제 입력..."
                            className="border-[1.5px] border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none bg-gray-50 flex-1 focus:border-[#800020] focus:bg-white"
                            onKeyDown={e => { if (e.key === 'Enter') addSurpriseTopic(); if (e.key === 'Escape') setIsAddingSurpriseTopic(false) }}
                            autoFocus
                          />
                          <button onClick={addSurpriseTopic} className="border-none bg-[#800020] text-white text-xs px-3 py-1.5 rounded-lg cursor-pointer font-semibold hover:opacity-85">추가</button>
                          <button onClick={() => setIsAddingSurpriseTopic(false)} className="border-[1.5px] border-gray-200 bg-white text-gray-500 text-xs px-3 py-1.5 rounded-lg cursor-pointer">취소</button>
                        </div>
                      )}

                      {/* 선택 요약 */}
                      {selectedSurpriseTopics.length > 0 && !isEditingSurpriseTopics && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
                          <span className="text-xs font-bold text-[#800020]">선택된 주제: </span>
                          <span className="text-xs text-[#800020]/80">
                            {surpriseTopics.filter(t => selectedSurpriseTopics.includes(t.id)).map(t => t.text).join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── 평가 항목 + 레이더 ────────────────────────────────── */}
              <div className="flex gap-5 flex-wrap">
                {/* 평가 항목 */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex-1 min-w-[320px]">
                  {/* 헤더 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-bold uppercase tracking-widest text-gray-500">📊 평가 항목</div>
                    <div className="flex gap-1.5">
                      {isEditingEval ? (
                        <>
                          <button onClick={saveEvalEdit} disabled={evalSaving}
                            className="border-none bg-[#800020] text-white text-xs px-3 py-1.5 rounded-lg cursor-pointer font-semibold hover:opacity-85 disabled:opacity-60">
                            {evalSaving ? '저장 중...' : '✓ 저장'}
                          </button>
                          <button onClick={cancelEvalEdit} disabled={evalSaving}
                            className="border-[1.5px] border-gray-200 bg-white text-gray-500 text-xs px-3 py-1.5 rounded-lg cursor-pointer font-semibold hover:border-gray-400">
                            취소
                          </button>
                        </>
                      ) : (
                        <button onClick={startEvalEdit}
                          className="border-[1.5px] border-gray-200 bg-white text-gray-600 text-xs px-3 py-1.5 rounded-lg cursor-pointer font-semibold hover:border-[#800020] hover:text-[#800020] transition-colors">
                          ✏️ 수정
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── 평가자 기입란 ─────────────────────────────────── */}
                  <div className="mb-4 pb-4 border-b border-gray-100">
                    <label className="text-xs font-semibold text-gray-400 tracking-wide block mb-1.5">✍️ 평가자 기입란</label>
                    <input
                      value={evaluatorName}
                      onChange={e => {
                        setEvaluatorName(e.target.value)
                        try { localStorage.setItem('kah_evaluator_name', e.target.value) } catch {}
                      }}
                      placeholder="평가자 이름을 입력하세요 (예: 홍길동)"
                      className="border-[1.5px] border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-800 bg-gray-50 w-full focus:border-[#800020] focus:bg-white transition-colors"
                    />
                    {evaluatorName.trim() && (
                      <div className="text-[11px] text-[#800020] mt-1 font-semibold">
                        이 기기의 평가는 "{evaluatorName.trim()}" 이름으로 저장됩니다.
                      </div>
                    )}
                  </div>

                  {isEditingEval && (
                    <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-semibold">
                      ✏️ 항목명과 만점을 수정한 후 저장 버튼을 누르세요.
                    </div>
                  )}

                  {/* 카테고리별 렌더링 */}
                  {displayCategories.map((cat, catIdx) => {
                    const catMax = cat.items.reduce((s, i) => s + i.max, 0)
                    return (
                      <div key={cat.id}>
                        <div className={`flex items-center gap-2 text-sm font-bold text-[#1e3a5f] mb-1.5 ${catIdx === 0 ? 'pt-1' : 'pt-3'}`}>
                          {isEditingEval ? (
                            <input
                              value={cat.label}
                              onChange={e => updateEditTempCatLabel(cat.id, e.target.value)}
                              className="border-[1.5px] border-gray-200 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:border-[#800020] w-28"
                            />
                          ) : <span>{cat.label}</span>}
                          <span className="text-gray-400 font-medium text-xs">({catMax}점 만점)</span>
                        </div>

                        {cat.items.map(item => (
                          isEditingEval ? (
                            <div key={item.field} className="flex items-center py-2 border-b border-gray-100 gap-2">
                              <input
                                value={item.label}
                                onChange={e => updateEditTempItemLabel(cat.id, item.field, e.target.value)}
                                className="border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none flex-1 focus:border-[#800020] bg-gray-50"
                                placeholder="항목명"
                              />
                              <span className="text-xs text-gray-400 whitespace-nowrap">만점</span>
                              <input
                                type="number" min={1} max={20} value={item.max}
                                onChange={e => updateEditTempItemMax(cat.id, item.field, Number(e.target.value))}
                                className="w-14 border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center outline-none focus:border-[#800020] bg-gray-50"
                              />
                              <span className="text-xs text-gray-400">점</span>
                            </div>
                          ) : (
                            <ScoreInput key={item.field} label={item.label} field={item.field} scores={currentScores} max={item.max} onChange={updateScore} />
                          )
                        ))}
                      </div>
                    )
                  })}

                  {/* Total */}
                  <div className="bg-[#800020] rounded-xl p-4 mt-4 flex items-center justify-between text-white">
                    <div>
                      <div className="text-xs opacity-70 tracking-widest">MY SCORE</div>
                      <div className="text-3xl font-black">{Number(total).toFixed(1)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs opacity-70">/ {maxTotal}점</div>
                      <div className="text-2xl font-extrabold">{toHundred(total, maxTotal)}점</div>
                      <div className="mt-1 h-1.5 w-24 bg-white/20 rounded-full overflow-hidden">
                        <div style={{ width: `${(total / maxTotal) * 100}%` }} className="h-full bg-white rounded-full transition-all duration-300" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 역량 레이더 */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm min-w-[280px] flex-1 flex flex-col">
                  <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">🕸 역량 레이더</div>
                  <CompetencyRadar scores={currentScores} evalCategories={evalCategories} />
                  <div className="flex flex-wrap gap-2 mt-3">
                    {evalCategories.map(cat => {
                      const catScore = cat.items.reduce((sum, item) => sum + (currentScores[item.field] || 0), 0)
                      const catMax   = cat.items.reduce((sum, item) => sum + item.max, 0)
                      return (
                        <div key={cat.id} className="flex-1 min-w-[80px] p-2 rounded-lg bg-gray-50 border border-gray-200 text-center">
                          <div className="text-xs text-gray-400 font-semibold mb-0.5">{cat.label}</div>
                          <div className="text-lg font-extrabold text-[#1e3a5f]">{Number(catScore).toFixed(1)}</div>
                          <div className="text-[9px] text-gray-400">/ {catMax}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ── 면접 질문 리스트 ──────────────────────────────────── */}
              {(() => {
                const surpriseQList = surpriseTopics.filter(t => selectedSurpriseTopics.includes(t.id)).map(t => ({ text: t.text, isSurprise: true }))
                const allQuestions = [
                  ...DEFAULT_INTERVIEW_QUESTIONS.map(q => ({ text: q, isSurprise: false })),
                  ...surpriseQList,
                ]
                const doneCount = allQuestions.filter((_, i) => checkedQuestions.has(i)).length
                return (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-bold uppercase tracking-widest text-gray-500">📋 면접 질문 리스트</div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#800020]/10 text-[#800020]">
                          {doneCount}/{allQuestions.length}
                        </span>
                      </div>
                      <button
                        onClick={() => setCheckedQuestions(new Set())}
                        className="border-[1.5px] border-gray-200 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer bg-white text-gray-500 hover:border-[#800020] hover:text-[#800020] transition-colors"
                      >↺ 초기화</button>
                    </div>
                    <div>
                      {allQuestions.map((q, i) => {
                        const isChecked = checkedQuestions.has(i)
                        return (
                          <div key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
                            <input
                              type="checkbox"
                              id={`q-${i}`}
                              checked={isChecked}
                              onChange={() => setCheckedQuestions(prev => {
                                const next = new Set(prev)
                                if (next.has(i)) next.delete(i)
                                else next.add(i)
                                return next
                              })}
                              className="mt-0.5 w-4 h-4 flex-shrink-0 cursor-pointer accent-[#800020]"
                            />
                            <label
                              htmlFor={`q-${i}`}
                              className="text-sm cursor-pointer flex-1 leading-relaxed"
                              style={isChecked ? { textDecoration: 'line-through', color: '#9ca3af' } : { color: '#374151' }}
                            >
                              {q.isSurprise && (
                                <span className="inline-flex items-center mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#800020]/10 text-[#800020]">돌발</span>
                              )}
                              {q.text}
                            </label>
                          </div>
                        )
                      })}
                    </div>
                    {doneCount === allQuestions.length && allQuestions.length > 0 && (
                      <div className="mt-3 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs font-bold text-green-700">
                        ✅ 모든 질문을 완료했습니다!
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ── 질적 피드백 ───────────────────────────────────────── */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-5 shadow-sm">
                <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">💬 질적 피드백 태그</div>
                <div className="mb-3">
                  <div className="text-xs font-bold text-green-700 mb-2 tracking-wide">✅ POSITIVE</div>
                  {POSITIVE_TAGS.map(t => (
                    <button key={t} onClick={() => toggleTag(t, "positive")}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border-none cursor-pointer bg-green-100 text-green-700 mr-1.5 mb-1.5 transition-all"
                      style={{ opacity: currentTags.find(x => x.text === t) ? 1 : 0.55, transform: currentTags.find(x => x.text === t) ? 'scale(1.04)' : 'scale(1)', boxShadow: currentTags.find(x => x.text === t) ? '0 2px 8px rgba(34,197,94,0.25)' : 'none' }}
                    >{t}</button>
                  ))}
                </div>
                <div className="mb-4">
                  <div className="text-xs font-bold text-red-700 mb-2 tracking-wide">❌ NEGATIVE</div>
                  {NEGATIVE_TAGS.map(t => (
                    <button key={t} onClick={() => toggleTag(t, "negative")}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border-none cursor-pointer bg-red-100 text-red-700 mr-1.5 mb-1.5 transition-all"
                      style={{ opacity: currentTags.find(x => x.text === t) ? 1 : 0.55, transform: currentTags.find(x => x.text === t) ? 'scale(1.04)' : 'scale(1)', boxShadow: currentTags.find(x => x.text === t) ? '0 2px 8px rgba(239,68,68,0.2)' : 'none' }}
                    >{t}</button>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-3.5">
                  <div className="text-xs font-bold text-gray-500 mb-2 tracking-wide">선택된 태그</div>
                  {currentTags.length === 0 && <span className="text-sm text-gray-300">태그를 선택하면 여기에 표시됩니다.</span>}
                  {currentTags.map((t, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold mr-1.5 mb-1.5 ${t.type === 'positive' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                      {t.text}
                      <span onClick={() => toggleTag(t.text, t.type)} className="cursor-pointer text-sm leading-none ml-0.5">×</span>
                    </span>
                  ))}
                </div>
                <div className="mt-3.5">
                  <div className="text-xs font-bold text-gray-500 mb-1.5 tracking-wide">면접 메모</div>
                  <textarea rows={3} value={currentNote} onChange={e => setCurrentNote(e.target.value)}
                    placeholder="추가 메모를 입력하세요..."
                    className="border-[1.5px] border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-800 resize-vertical leading-relaxed w-full bg-gray-50 focus:border-[#800020] focus:bg-white" />
                </div>
              </div>

              {/* Bottom actions */}
              <div className="flex gap-3 justify-end mb-10 mt-5">
                <button onClick={newCandidate} className="border-[1.5px] border-gray-200 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer bg-white text-gray-600 hover:border-[#800020] hover:text-[#800020] transition-colors">새 지원자</button>
                <button onClick={saveEvaluation} className="border-none rounded-lg px-7 py-2.5 text-sm font-semibold cursor-pointer bg-[#800020] text-white shadow-md hover:opacity-90 transition-all">
                  {saving ? '저장 중...' : '✓ 평가 저장 & 순위 반영'}
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Evaluation Details Modal */}
      {showDetailsModal && candidates.find(c => c.id === showDetailsModal)?.evaluations?.length > 0 && (
        <EvaluationDetailsModal
          candidate={candidates.find(c => c.id === showDetailsModal)}
          onClose={() => setShowDetailsModal(null)}
          onUpdate={fetchCandidates}
          evalCategories={evalCategories}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-20 right-5 z-[9999] px-6 py-4 rounded-xl shadow-2xl text-sm font-semibold min-w-[300px] ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
          style={{ animation: 'slideIn 0.3s ease' }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
