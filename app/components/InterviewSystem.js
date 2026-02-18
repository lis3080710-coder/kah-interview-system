'use client'

import { useState, useEffect, useRef, useCallback } from "react"
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
const MAX_SCORES = {
  sincerity: 3, cooperation: 3, planning: 3,
  expression: 3, commonsense: 3,
  proactivity: 3, personality: 3,
  q1: 5, q2: 5, comprehension: 5, logic: 5, creativity: 5,
}

const POSITIVE_TAGS = ["논리정연함", "자신감 있음", "준비 철저", "협업 마인드", "아이디어 우수", "높은 직무 이해도", "경청과 소통", "구체적 경험 제시", "성장 지향성"]
const NEGATIVE_TAGS = ["소극적 태도", "동문서답", "근거 부족", "목소리 작음", "긴장함", "협업 우려", "방어적 태도"]

// ─── KAH Logo Component ───────────────────────────────────────────────────────
const KAHLogo = () => (
  <div className="flex items-center gap-2">
    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] flex items-center justify-center shadow-lg">
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
        <div 
          style={{ width: `${pct * 100}%`, backgroundColor: barColor }} 
          className="h-full rounded-full transition-all duration-300"
        />
      </div>
      <input
        type="number"
        min={0}
        max={max}
        value={scores[field] || 0}
        onChange={e => onChange(field, Math.min(max, Math.max(0, Number(e.target.value))))}
        className="w-14 border-[1.5px] border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-center outline-none bg-gray-50 focus:border-blue-600 focus:bg-white"
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
          if (r <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            return 0
          }
          return r - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const start = () => {
    if (remaining === null) setRemaining(minutes * 60 + seconds)
    setRunning(true)
  }
  const pause = () => {
    setRunning(false)
    clearInterval(intervalRef.current)
  }
  const reset = () => {
    setRunning(false)
    clearInterval(intervalRef.current)
    setRemaining(null)
  }

  return (
    <div className="flex items-center gap-4">
      <div className="text-xs font-semibold text-gray-500 tracking-wider">⏱ TIMER</div>
      {remaining === null ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={99}
            value={minutes}
            onChange={e => setMinutes(Number(e.target.value))}
            className="w-12 border-[1.5px] border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none bg-gray-50"
          />
          <span className="text-gray-500">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={seconds}
            onChange={e => setSeconds(Number(e.target.value))}
            className="w-12 border-[1.5px] border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none bg-gray-50"
          />
        </div>
      ) : (
        <div
          className={`text-2xl font-extrabold tracking-wider min-w-20 text-center ${
            isDone ? 'text-green-500' : isWarning ? 'text-red-500' : 'text-[#1e3a5f]'
          }`}
          style={{ animation: isWarning && running ? 'pulse 1s infinite' : 'none' }}
        >
          {String(displayMin).padStart(2, "0")}:{String(displaySec).padStart(2, "0")}
        </div>
      )}
      <div className="flex gap-1.5">
        {!running && (
          <button
            onClick={start}
            className="border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer bg-green-500 text-white hover:bg-green-600 transition-colors"
          >
            ▶ Start
          </button>
        )}
        {running && (
          <button
            onClick={pause}
            className="border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            ⏸ Pause
          </button>
        )}
        <button
          onClick={reset}
          className="border-none rounded-lg px-3.5 py-1.5 text-xs font-bold cursor-pointer bg-gray-400 text-white hover:bg-gray-500 transition-colors"
        >
          ↺ Reset
        </button>
      </div>
      {isDone && <span className="text-xs text-green-500 font-bold">✓ 완료!</span>}
    </div>
  )
}

// ─── Radar Chart Component ────────────────────────────────────────────────────
function CompetencyRadar({ scores }) {
  const data = [
    { subject: "직무적합도", value: Math.round(((scores.sincerity + scores.cooperation + scores.planning) / 9) * 100) },
    { subject: "의사소통", value: Math.round(((scores.expression + scores.commonsense) / 6) * 100) },
    { subject: "인성", value: Math.round(((scores.proactivity + scores.personality) / 6) * 100) },
    { subject: "이해력", value: Math.round((scores.comprehension / 5) * 100) },
    { subject: "논리력", value: Math.round((scores.logic / 5) * 100) },
    { subject: "창의력", value: Math.round((scores.creativity / 5) * 100) },
  ]
  
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} tickCount={5} />
        <Radar name="역량" dataKey="value" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} dot={{ fill: "#2563eb", r: 3 }} />
        <Tooltip formatter={(v) => `${v}%`} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ─── Evaluation Details Modal ─────────────────────────────────────────────────
function EvaluationDetailsModal({ candidate, onClose, onUpdate }) {
  if (!candidate || !candidate.evaluations || candidate.evaluations.length === 0) return null

  const maxTotal = Object.values(MAX_SCORES).reduce((a, b) => a + b, 0)

  const fieldNames = {
    sincerity: '성실성', cooperation: '협조성', planning: '계획성',
    expression: '표현력', commonsense: '상식성',
    proactivity: '적극성', personality: '인성',
    q1: '내용1', q2: '내용2',
    comprehension: '이해력', logic: '논리력', creativity: '창의력'
  }

  const handleInterviewerIdChange = async (evaluation, newId) => {
    if (!newId.trim() || newId === evaluation.interviewer_id) return
    try {
      const { error } = await supabase
        .from('evaluations')
        .update({ interviewer_id: newId.trim() })
        .eq('id', evaluation.id)
      if (error) throw error
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Error updating interviewer_id:', err)
    }
  }

  const handleDeleteEvaluation = async (evaluation) => {
    if (!confirm(`면접관 "${evaluation.interviewer_id}"의 평가를 삭제하시겠습니까?`)) return
    try {
      const { error } = await supabase
        .from('evaluations')
        .delete()
        .eq('id', evaluation.id)
      if (error) throw error
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Error deleting evaluation:', err)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-[#1e3a5f] mb-1">
              {candidate.name} - 평가 상세
            </h2>
            <p className="text-sm text-gray-500">
              총 {candidate.evaluations.length}명의 면접관이 평가했습니다
            </p>
          </div>
          <button
            onClick={onClose}
            className="border-none bg-gray-100 rounded-lg w-8 h-8 cursor-pointer text-lg text-gray-500 hover:bg-gray-200"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] rounded-xl p-4 text-white flex justify-between items-center">
            <div>
              <div className="text-xs opacity-80 mb-1">평균 점수</div>
              <div className="text-3xl font-black">{candidate.avg_score}</div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-80">/ {maxTotal}점</div>
              <div className="text-2xl font-extrabold">
                {Math.round((candidate.avg_score / maxTotal) * 100)}%
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">
          개별 평가 내역
        </div>

        {candidate.evaluations.map((evaluation, idx) => (
          <div key={idx} className="bg-gray-50 rounded-xl p-4 mb-3 border border-gray-200">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-semibold mb-0.5">면접관 ID</div>
                  <input
                    className="text-xs text-[#1e3a5f] font-semibold font-mono border-[1.5px] border-gray-200 rounded-md px-2 py-1 bg-white outline-none focus:border-blue-500 w-44"
                    defaultValue={evaluation.interviewer_id}
                    onBlur={e => handleInterviewerIdChange(evaluation, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xl font-extrabold text-blue-600">
                  {evaluation.total_score}점
                </div>
                <button
                  onClick={() => handleDeleteEvaluation(evaluation)}
                  className="border-none bg-red-50 text-red-500 text-xs px-3 py-1.5 rounded-lg cursor-pointer font-semibold hover:bg-red-500 hover:text-white transition-colors"
                  title="이 평가 삭제"
                >
                  삭제
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {Object.entries(evaluation.scores).map(([key, value]) => (
                <div key={key} className="bg-white rounded-md px-2.5 py-1.5 flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-semibold">
                    {fieldNames[key] || key}
                  </span>
                  <span className="text-xs text-[#1e3a5f] font-bold">{value}</span>
                </div>
              ))}
            </div>

            {evaluation.tags && evaluation.tags.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-gray-400 mb-1 font-semibold">태그</div>
                <div className="flex flex-wrap gap-1.5">
                  {evaluation.tags.map((tag, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        tag.type === 'positive' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}
                    >
                      {tag.text}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {evaluation.note && (
              <div>
                <div className="text-xs text-gray-400 mb-1 font-semibold">메모</div>
                <div className="text-xs text-gray-600 leading-relaxed bg-white p-2 rounded-md">
                  {evaluation.note}
                </div>
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
  // State management
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
  const fileRef = useRef()

  // Show toast message
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const updateScore = (field, value) => {
    setCurrentScores(prev => ({ ...prev, [field]: value }))
  }

  const toggleTag = (text, type) => {
    setCurrentTags(prev => {
      const exists = prev.find(t => t.text === text)
      if (exists) {
        return prev.filter(t => t.text !== text)
      }
      return [...prev, { text, type }]
    })
  }

  const resetCurrentEvaluation = () => {
    setCurrentCandidate(null)
    setCurrentScores({
      sincerity: 0, cooperation: 0, planning: 0,
      expression: 0, commonsense: 0,
      proactivity: 0, personality: 0,
      q1: 0, q2: 0, comprehension: 0, logic: 0, creativity: 0,
    })
    setCurrentTags([])
    setCurrentNote('')
    setSelectedCandidateId(null)
  }

  const loadEvaluationForCandidate = (candidateId, evalInterviewerId) => {
    const candidate = candidates.find(c => c.id === candidateId)
    if (!candidate) {
      console.error('Candidate not found:', candidateId)
      return
    }

    const myEvaluation = candidate.evaluations?.find(
      e => e.interviewer_id === evalInterviewerId
    )

    const defaultScores = {
      sincerity: 0, cooperation: 0, planning: 0,
      expression: 0, commonsense: 0,
      proactivity: 0, personality: 0,
      q1: 0, q2: 0, comprehension: 0, logic: 0, creativity: 0,
    }

    if (myEvaluation) {
      setSelectedCandidateId(candidateId)
      setCurrentCandidate(candidate)
      setCurrentScores(myEvaluation.scores || defaultScores)
      setCurrentTags(myEvaluation.tags || [])
      setCurrentNote(myEvaluation.note || '')
    } else {
      setSelectedCandidateId(candidateId)
      setCurrentCandidate(candidate)
      setCurrentScores(defaultScores)
      setCurrentTags([])
      setCurrentNote('')
    }
  }

  // Calculate total
  const total = Object.entries(currentScores).reduce((sum, [k, v]) => sum + (Number(v) || 0), 0)
  const maxTotal = Object.values(MAX_SCORES).reduce((a, b) => a + b, 0)

  // Initialize interviewer ID
  useEffect(() => {
    const id = getInterviewerId()
    setInterviewerId(id)
  }, [])

  // Fetch candidates on mount
  useEffect(() => {
    fetchCandidates()
  }, [])

  // Fetch all candidates with rankings
  const fetchCandidates = async () => {
    try {
      setLoading(true)
      
      const { data: candidatesData, error: candidatesError } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false })

      if (candidatesError) throw candidatesError

      const { data: evaluationsData, error: evaluationsError } = await supabase
        .from('evaluations')
        .select('*')
        .order('created_at', { ascending: false })

      if (evaluationsError) throw evaluationsError

      // Calculate average scores for each candidate
      const candidatesWithScores = candidatesData.map(candidate => {
        const candidateEvaluations = evaluationsData.filter(
          e => e.candidate_id === candidate.id
        )

        const avgScore = candidateEvaluations.length > 0
          ? Math.round(
              candidateEvaluations.reduce((sum, e) => sum + (e.total_score || 0), 0) / 
              candidateEvaluations.length
            )
          : 0

        return {
          ...candidate,
          evaluations: candidateEvaluations,
          avg_score: avgScore,
          evaluation_count: candidateEvaluations.length,
        }
      })

      // Sort by average score descending
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
    if (!interviewerId) {
      showToast('면접관 ID가 설정되지 않았습니다.', 'error')
      return
    }
    loadEvaluationForCandidate(candidate.id, interviewerId)
  }

  const saveEvaluation = async () => {
    console.log('Save evaluation called')
    
    if (!currentCandidate || !interviewerId) {
      showToast('지원자를 선택해주세요.', 'error')
      return
    }

    if (!currentCandidate.name || !currentCandidate.name.trim()) {
      showToast('지원자 이름을 입력해주세요.', 'error')
      return
    }

    try {
      setSaving(true)

      let candidateId = currentCandidate.id

      // If this is a temp candidate, create it first
      if (currentCandidate.id.toString().startsWith('temp_')) {
        const { data: newCandidate, error: createError } = await supabase
          .from('candidates')
          .insert({
            name: currentCandidate.name,
            info: currentCandidate.info,
          })
          .select()
          .single()

        if (createError) throw createError
        candidateId = newCandidate.id

        // Update current candidate with real ID
        setCurrentCandidate({ ...currentCandidate, id: candidateId })
        setSelectedCandidateId(candidateId)
      }

      // Now save the evaluation
      const { error } = await supabase
        .from('evaluations')
        .upsert({
          candidate_id: candidateId,
          interviewer_id: interviewerId,
          scores: currentScores,
          total_score: total,
          tags: currentTags,
          note: currentNote,
        }, {
          onConflict: 'candidate_id,interviewer_id'
        })

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
      const { data, error } = await supabase
        .from('candidates')
        .insert({
          name: candidateInfo.name,
          info: candidateInfo,
        })
        .select()
        .single()

      if (error) throw error

      await fetchCandidates()
      
      if (data && interviewerId) {
        loadEvaluationForCandidate(data.id, interviewerId)
      }

      return data
    } catch (error) {
      console.error('Error creating candidate:', error)
      showToast('지원자 등록에 실패했습니다: ' + error.message, 'error')
      return null
    }
  }

  // PDF Drop handler
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

  // New candidate button
  const newCandidate = () => {
    resetCurrentEvaluation()
    setParseMsg("")
    // Create a temporary new candidate object for editing
    const tempCandidate = {
      id: 'temp_' + Date.now(),
      name: '',
      info: {
        dob: '', available12: '', phone: '', email: '',
        studentId: '', address: '', major: '', grade: '',
        career: '', schedule: ''
      },
      evaluations: [],
      avg_score: 0,
      evaluation_count: 0
    }
    setCurrentCandidate(tempCandidate)
    setSelectedCandidateId(tempCandidate.id)
  }

  const deleteCandidate = async (candidateId) => {
    if (!confirm('이 지원자를 삭제하시겠습니까? 모든 평가 데이터가 함께 삭제됩니다.')) return
    try {
      const { error: evalError } = await supabase
        .from('evaluations')
        .delete()
        .eq('candidate_id', candidateId)
      if (evalError) throw evalError

      const { error: candError } = await supabase
        .from('candidates')
        .delete()
        .eq('id', candidateId)
      if (candError) throw candError

      if (selectedCandidateId === candidateId) resetCurrentEvaluation()
      showToast('지원자가 삭제되었습니다.', 'success')
      await fetchCandidates()
    } catch (error) {
      console.error('Error deleting candidate:', error)
      showToast('삭제에 실패했습니다: ' + error.message, 'error')
    }
  }

  const updateCandidateInfo = async (field, value) => {
    if (!currentCandidate) return

    const updatedInfo = { ...currentCandidate.info, [field]: value }
    const updatedName = field === 'name' ? value : currentCandidate.name
    
    // Update local state immediately
    setCurrentCandidate({
      ...currentCandidate,
      name: updatedName,
      info: updatedInfo,
    })

    // Only sync to DB if it's not a temp candidate
    if (!currentCandidate.id.toString().startsWith('temp_')) {
      try {
        const { error } = await supabase
          .from('candidates')
          .update({ name: updatedName, info: updatedInfo })
          .eq('id', currentCandidate.id)

        if (error) throw error
      } catch (error) {
        console.error('Error updating candidate:', error)
      }
    }
  }

  // Input field renderer
  const inputField = (label, field, span = false) => {
    const value = field === 'name' ? currentCandidate?.name : currentCandidate?.info?.[field]

    return (
      <div className={`flex flex-col gap-1 flex-1 ${span ? 'min-w-full' : 'min-w-[140px]'}`}>
        <label className="text-xs font-semibold text-gray-400 tracking-wide">{label}</label>
        <input
          className="border-[1.5px] border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-800 transition-colors bg-gray-50 w-full focus:border-blue-600 focus:bg-white"
          value={value || ""}
          onChange={e => updateCandidateInfo(field, e.target.value)}
          placeholder={label}
          disabled={!currentCandidate}
        />
      </div>
    )
  }

  return (
    <div className="font-sans bg-gray-50 min-h-screen text-gray-800">
      {/* ── STICKY HEADER ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-6 h-16 flex items-center justify-between shadow-sm">
        <KAHLogo />
        <Timer />
        <div className="flex gap-2 items-center">
          {interviewerId && (
            <div className="text-xs text-gray-400 mr-2">
              ID: {interviewerId.slice(-8)}
            </div>
          )}
          <button
            onClick={newCandidate}
            className="border-none rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer bg-white border-[1.5px] border-gray-200 text-gray-600 hover:border-blue-600 hover:text-blue-600 transition-colors"
          >
            + 신규 지원자
          </button>
          <button
            onClick={() => {
              console.log('Button clicked!')
              saveEvaluation()
            }}
            className="border-none rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] text-white shadow-md hover:opacity-90 hover:-translate-y-0.5 transition-all"
          >
            {saving ? '저장 중...' : '✓ 평가 저장'}
          </button>
        </div>
      </header>

      <div className="flex items-start">
        {/* ── STICKY SIDEBAR ────────────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto bg-white border-r border-gray-200 p-5">
          <div className="text-xs font-bold text-gray-500 tracking-widest uppercase mb-4">
            🏆 실시간 순위 (평균)
          </div>
          
          {loading && (
            <div className="text-sm text-gray-400 text-center mt-5">
              로딩 중...
            </div>
          )}

          {!loading && candidates.length === 0 && (
            <div className="text-sm text-gray-400 text-center mt-5">
              지원자를 등록해주세요.
            </div>
          )}

          {!loading && candidates.map((c, i) => {
            const isActive = c.id === selectedCandidateId
            const rankColors = {
              1: 'bg-yellow-500',
              2: 'bg-gray-400',
              3: 'bg-orange-600',
            }

            return (
              <div key={c.id}>
                <div
                  className={`rank-item flex items-center gap-2 p-3 rounded-lg mb-1.5 cursor-pointer transition-all ${
                    isActive ? 'bg-blue-50 border-[1.5px] border-blue-200' : 'bg-gray-50 border-[1.5px] border-transparent'
                  }`}
                  onClick={() => handleCandidateClick(c)}
                >
                  <div
                    className={`w-5.5 h-5.5 rounded-md flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${
                      rankColors[i + 1] || 'bg-gray-200'
                    } ${i + 1 <= 3 ? 'text-white' : 'text-gray-500'}`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      평균: {c.avg_score}점 ({c.evaluation_count}명)
                    </div>
                  </div>
                  <div className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    {Math.round((c.avg_score / maxTotal) * 100)}%
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteCandidate(c.id)
                    }}
                    className="border-none bg-transparent text-red-400 text-xs px-1 py-0.5 cursor-pointer font-bold hover:text-red-600 transition-colors flex-shrink-0"
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
                {c.evaluation_count > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDetailsModal(c.id)
                    }}
                    className="border-none bg-transparent text-blue-600 text-xs px-3 py-1 cursor-pointer font-semibold ml-2 mb-1.5 hover:underline"
                  >
                    📊 평가 상세보기
                  </button>
                )}
              </div>
            )
          })}

          <div className="mt-5 p-3.5 rounded-lg bg-gray-50 border border-gray-200">
            <div className="text-xs text-gray-400 tracking-wide mb-1 font-semibold">현재 평가 중</div>
            <div className="text-sm font-bold text-[#1e3a5f]">
              {currentCandidate?.name || "—"}
            </div>
            <div className="text-xs text-blue-600 font-bold">
              내 점수: {total}점 / {maxTotal}점
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
        <main className="flex-1 p-6 max-w-4xl">
          {/* PDF Upload */}
          {!currentCandidate && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5 shadow-sm">
              <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                📎 지원서 업로드 (PDF)
              </div>
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragging ? 'border-blue-600 bg-blue-50' : 'border-gray-300 bg-gray-50'
                }`}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div className="text-3xl mb-2">📄</div>
                <div className="text-sm text-gray-500 font-semibold">
                  PDF 파일을 드래그하거나 클릭하여 업로드하세요
                </div>
                <div className="text-xs text-gray-400 mt-1">지원서의 정보가 자동으로 입력됩니다</div>
              </div>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleDrop} />
              {parseMsg && (
                <div
                  className={`mt-2.5 text-sm px-3 py-2 rounded-lg font-semibold ${
                    parseMsg.startsWith("✅") ? 'text-green-700 bg-green-100' : 'text-gray-600 bg-gray-100'
                  }`}
                >
                  {parseMsg}
                </div>
              )}
            </div>
          )}

          {/* Applicant Info */}
          {currentCandidate && (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5 shadow-sm">
                <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  👤 지원자 정보
                </div>
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
                <div className="flex gap-3 mb-3 flex-wrap">
                  {inputField("주소", "address", true)}
                </div>
                <div className="flex gap-3 mb-3 flex-wrap">
                  <div className="flex flex-col gap-1 flex-1 min-w-full">
                    <label className="text-xs font-semibold text-gray-400 tracking-wide">경력 및 활동사항</label>
                    <textarea
                      rows={2}
                      value={currentCandidate?.info?.career || ""}
                      onChange={e => updateCandidateInfo("career", e.target.value)}
                      className="border-[1.5px] border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-800 resize-vertical min-h-[52px] leading-relaxed bg-gray-50 focus:border-blue-600 focus:bg-white"
                      placeholder="경력 및 활동사항을 입력하세요"
                    />
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {inputField("면접 일정", "schedule")}
                </div>
              </div>

              {/* Two-column: Scoring + Radar */}
              <div className="flex gap-5 flex-wrap">
                {/* Scoring */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex-1 min-w-[320px]">
                  <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                    📊 평가 항목
                  </div>

                  <div className="text-sm font-bold text-[#1e3a5f] mb-1.5 pt-1">
                    직무적합도 <span className="text-gray-400 font-medium">(9점 만점)</span>
                  </div>
                  <ScoreInput label="성실성" field="sincerity" scores={currentScores} max={MAX_SCORES.sincerity} onChange={updateScore} />
                  <ScoreInput label="협조성" field="cooperation" scores={currentScores} max={MAX_SCORES.cooperation} onChange={updateScore} />
                  <ScoreInput label="계획성" field="planning" scores={currentScores} max={MAX_SCORES.planning} onChange={updateScore} />

                  <div className="text-sm font-bold text-[#1e3a5f] mb-1.5 pt-3">
                    의사소통 <span className="text-gray-400 font-medium">(6점 만점)</span>
                  </div>
                  <ScoreInput label="표현력" field="expression" scores={currentScores} max={MAX_SCORES.expression} onChange={updateScore} />
                  <ScoreInput label="상식성" field="commonsense" scores={currentScores} max={MAX_SCORES.commonsense} onChange={updateScore} />

                  <div className="text-sm font-bold text-[#1e3a5f] mb-1.5 pt-3">
                    인성 <span className="text-gray-400 font-medium">(6점 만점)</span>
                  </div>
                  <ScoreInput label="적극성" field="proactivity" scores={currentScores} max={MAX_SCORES.proactivity} onChange={updateScore} />
                  <ScoreInput label="인성" field="personality" scores={currentScores} max={MAX_SCORES.personality} onChange={updateScore} />

                  <div className="text-sm font-bold text-[#1e3a5f] mb-1.5 pt-3">
                    돌발질문 <span className="text-gray-400 font-medium">(각 5점 만점)</span>
                  </div>
                  <ScoreInput label="내용 1" field="q1" scores={currentScores} max={MAX_SCORES.q1} onChange={updateScore} />
                  <ScoreInput label="내용 2" field="q2" scores={currentScores} max={MAX_SCORES.q2} onChange={updateScore} />
                  <ScoreInput label="이해력" field="comprehension" scores={currentScores} max={MAX_SCORES.comprehension} onChange={updateScore} />
                  <ScoreInput label="논리력" field="logic" scores={currentScores} max={MAX_SCORES.logic} onChange={updateScore} />
                  <ScoreInput label="창의력" field="creativity" scores={currentScores} max={MAX_SCORES.creativity} onChange={updateScore} />

                  {/* Total */}
                  <div className="bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] rounded-xl p-4 mt-4 flex items-center justify-between text-white">
                    <div>
                      <div className="text-xs opacity-70 tracking-widest">MY SCORE</div>
                      <div className="text-3xl font-black">{total}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs opacity-70">/ {maxTotal}점</div>
                      <div className="text-2xl font-extrabold">{Math.round((total / maxTotal) * 100)}%</div>
                      <div className="mt-1 h-1.5 w-24 bg-white/20 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${(total / maxTotal) * 100}%` }}
                          className="h-full bg-white rounded-full transition-all duration-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Radar */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm min-w-[280px] flex-1 flex flex-col">
                  <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                    🕸 역량 레이더
                  </div>
                  <CompetencyRadar scores={currentScores} />
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[
                      { label: "직무적합도", val: (currentScores.sincerity || 0) + (currentScores.cooperation || 0) + (currentScores.planning || 0), max: 9 },
                      { label: "의사소통", val: (currentScores.expression || 0) + (currentScores.commonsense || 0), max: 6 },
                      { label: "인성", val: (currentScores.proactivity || 0) + (currentScores.personality || 0), max: 6 },
                      { label: "이해력", val: currentScores.comprehension || 0, max: 5 },
                      { label: "논리력", val: currentScores.logic || 0, max: 5 },
                      { label: "창의력", val: currentScores.creativity || 0, max: 5 },
                    ].map(d => (
                      <div key={d.label} className="flex-1 min-w-[80px] p-2 rounded-lg bg-gray-50 border border-gray-200 text-center">
                        <div className="text-xs text-gray-400 font-semibold mb-0.5">{d.label}</div>
                        <div className="text-lg font-extrabold text-[#1e3a5f]">{d.val}</div>
                        <div className="text-[9px] text-gray-400">/ {d.max}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Qualitative Feedback */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mt-5 shadow-sm">
                <div className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                  💬 질적 피드백 태그
                </div>
                <div className="mb-3">
                  <div className="text-xs font-bold text-green-700 mb-2 tracking-wide">✅ POSITIVE</div>
                  {POSITIVE_TAGS.map(t => (
                    <button
                      key={t}
                      className="tag-btn inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border-none cursor-pointer bg-green-100 text-green-700 mr-1.5 mb-1.5 transition-all hover:scale-95"
                      onClick={() => toggleTag(t, "positive")}
                      style={{
                        opacity: currentTags.find(x => x.text === t) ? 1 : 0.55,
                        transform: currentTags.find(x => x.text === t) ? 'scale(1.04)' : 'scale(1)',
                        boxShadow: currentTags.find(x => x.text === t) ? '0 2px 8px rgba(34,197,94,0.25)' : 'none',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="mb-4">
                  <div className="text-xs font-bold text-red-700 mb-2 tracking-wide">❌ NEGATIVE</div>
                  {NEGATIVE_TAGS.map(t => (
                    <button
                      key={t}
                      className="tag-btn inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border-none cursor-pointer bg-red-100 text-red-700 mr-1.5 mb-1.5 transition-all hover:scale-95"
                      onClick={() => toggleTag(t, "negative")}
                      style={{
                        opacity: currentTags.find(x => x.text === t) ? 1 : 0.55,
                        transform: currentTags.find(x => x.text === t) ? 'scale(1.04)' : 'scale(1)',
                        boxShadow: currentTags.find(x => x.text === t) ? '0 2px 8px rgba(239,68,68,0.2)' : 'none',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-3.5">
                  <div className="text-xs font-bold text-gray-500 mb-2 tracking-wide">선택된 태그</div>
                  {currentTags.length === 0 && <span className="text-sm text-gray-300">태그를 선택하면 여기에 표시됩니다.</span>}
                  {currentTags.map((t, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold mr-1.5 mb-1.5 ${
                        t.type === 'positive' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}
                    >
                      {t.text}
                      <span
                        onClick={() => toggleTag(t.text, t.type)}
                        className="cursor-pointer text-sm leading-none ml-0.5"
                      >
                        ×
                      </span>
                    </span>
                  ))}
                </div>

                <div className="mt-3.5">
                  <div className="text-xs font-bold text-gray-500 mb-1.5 tracking-wide">면접 메모</div>
                  <textarea
                    rows={3}
                    value={currentNote}
                    onChange={e => setCurrentNote(e.target.value)}
                    placeholder="추가 메모를 입력하세요..."
                    className="border-[1.5px] border-gray-200 rounded-lg px-3 py-2 text-sm outline-none text-gray-800 resize-vertical leading-relaxed w-full bg-gray-50 focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </div>

              {/* Bottom actions */}
              <div className="flex gap-3 justify-end mb-10 mt-5">
                <button
                  onClick={newCandidate}
                  className="border-none rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer bg-white border-[1.5px] border-gray-200 text-gray-600 hover:border-blue-600 hover:text-blue-600 transition-colors"
                >
                  새 지원자
                </button>
                <button
                  onClick={() => {
                    console.log('Bottom button clicked!')
                    saveEvaluation()
                  }}
                  className="border-none rounded-lg px-7 py-2.5 text-sm font-semibold cursor-pointer bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] text-white shadow-md hover:opacity-90 hover:-translate-y-0.5 transition-all"
                >
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
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-5 z-[9999] px-6 py-4 rounded-xl shadow-2xl text-sm font-semibold min-w-[300px] ${
            toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}
          style={{ animation: 'slideIn 0.3s ease' }}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
