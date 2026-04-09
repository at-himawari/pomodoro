import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import logo from './assets/pomodoro-logo.svg'

const MODES = {
  focus: {
    label: 'Focus',
    helper: '作業中',
    color: '#f97316',
    background: 'bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.12),_transparent_32%),linear-gradient(180deg,_#fafaf9_0%,_#f5f5f4_100%)]',
    panel: 'bg-white/92',
  },
  break: {
    label: 'Break',
    helper: '休憩中',
    color: '#14b8a6',
    background: 'bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.14),_transparent_34%),linear-gradient(180deg,_#f0fdfa_0%,_#ecfeff_100%)]',
    panel: 'bg-white/82',
  },
}

const clampMinutes = (value, fallback) => {
  const nextValue = Number(value)

  if (!Number.isFinite(nextValue)) {
    return fallback
  }

  return Math.min(90, Math.max(1, Math.round(nextValue)))
}

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function App() {
  const [durations, setDurations] = useState({ focus: 25, break: 5 })
  const [mode, setMode] = useState('focus')
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const audioContextRef = useRef(null)

  const totalSeconds = durations[mode] * 60
  const progress = totalSeconds === 0 ? 0 : secondsLeft / totalSeconds
  const circleRadius = 132
  const circumference = 2 * Math.PI * circleRadius
  const strokeOffset = circumference * (1 - progress)
  const activeMode = MODES[mode]

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined' || !audioEnabled) {
      return null
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext

    if (!AudioContextClass) {
      return null
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass()
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }

    return audioContextRef.current
  }, [audioEnabled])

  const playTransitionSound = useCallback(async (nextMode) => {
    const audioContext = await ensureAudioContext()

    if (!audioContext) {
      return
    }

    const now = audioContext.currentTime
    const notes =
      nextMode === 'break' ? [523.25, 659.25, 783.99] : [392.0, 493.88, 659.25]

    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, now)
      gainNode.gain.setValueAtTime(0.0001, now)
      gainNode.gain.exponentialRampToValueAtTime(0.14, now + 0.03 + index * 0.12)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18 + index * 0.12)

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.start(now + index * 0.12)
      oscillator.stop(now + 0.22 + index * 0.12)
    })
  }, [ensureAudioContext])

  useEffect(() => {
    if (!isRunning) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setSecondsLeft((currentSeconds) => Math.max(currentSeconds - 1, 0))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isRunning])

  useEffect(() => {
    if (secondsLeft !== 0) {
      return
    }

    const nextMode = mode === 'focus' ? 'break' : 'focus'

    startTransition(() => {
      setMode(nextMode)
      setSecondsLeft(durations[nextMode] * 60)
      setIsRunning(true)
      playTransitionSound(nextMode)

      if (nextMode === 'break') {
        setCompletedSessions((currentCount) => currentCount + 1)
      }
    })
  }, [durations, mode, playTransitionSound, secondsLeft])

  const syncDuration = (targetMode, rawValue) => {
    const nextMinutes = clampMinutes(rawValue, durations[targetMode])

    setDurations((currentDurations) => ({
      ...currentDurations,
      [targetMode]: nextMinutes,
    }))

    if (mode === targetMode) {
      setSecondsLeft(nextMinutes * 60)
    }
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setIsRunning(false)
    setSecondsLeft(durations[nextMode] * 60)
  }

  const toggleTimer = async () => {
    await ensureAudioContext()
    setIsRunning((currentValue) => !currentValue)
  }

  const resetTimer = async () => {
    await ensureAudioContext()
    setIsRunning(false)
    setMode('focus')
    setSecondsLeft(durations.focus * 60)
    setCompletedSessions(0)
  }

  const skipSession = async () => {
    await ensureAudioContext()

    const nextMode = mode === 'focus' ? 'break' : 'focus'

    setMode(nextMode)
    setSecondsLeft(durations[nextMode] * 60)
    setIsRunning(false)
    playTransitionSound(nextMode)

    if (nextMode === 'break') {
      setCompletedSessions((currentCount) => currentCount + 1)
    }
  }

  return (
    <main className={`min-h-screen px-6 py-8 text-stone-900 transition-colors duration-700 ${activeMode.background}`}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Pomodoro logo" className="h-11 w-11 rounded-2xl" />
            <div className="flex flex-col justify-center">
              <p className="text-xs uppercase tracking-[0.3em] leading-none text-stone-400">Pomodoro</p>
              <h1 className="mt-1 font-['Space_Grotesk',_'Noto_Sans_JP',_sans-serif] text-2xl leading-none font-medium">
                ポモドーロタイマー
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen((currentValue) => !currentValue)}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-600 transition hover:border-stone-400 hover:text-stone-900"
          >
            Settings
          </button>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center">
          <div className="mb-10 flex items-center gap-2 rounded-full border border-stone-200 bg-white p-1">
            {Object.entries(MODES).map(([key, value]) => {
              const isActive = mode === key

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchMode(key)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    isActive ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {value.label}
                </button>
              )
            })}
          </div>

          <div className="relative flex h-[340px] w-[340px] items-center justify-center sm:h-[380px] sm:w-[380px]">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 320 320" aria-hidden="true">
              <circle cx="160" cy="160" r={circleRadius} fill="none" stroke="#e7e5e4" strokeWidth="12" />
              <circle
                cx="160"
                cy="160"
                r={circleRadius}
                fill="none"
                stroke={MODES[mode].color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                className="transition-[stroke-dashoffset] duration-700"
              />
            </svg>

            <div className={`flex h-[250px] w-[250px] flex-col items-center justify-center rounded-full text-center shadow-[0_18px_50px_rgba(28,25,23,0.08)] transition-colors duration-700 sm:h-[280px] sm:w-[280px] ${activeMode.panel}`}>
              <p className="text-sm uppercase tracking-[0.28em] text-stone-400">{activeMode.helper}</p>
              <p className="mt-4 font-['Space_Grotesk',_'Noto_Sans_JP',_sans-serif] text-6xl font-medium tracking-tight tabular-nums sm:text-7xl">
                {formatTime(secondsLeft)}
              </p>
              <p className="mt-4 text-sm text-stone-400">Completed {completedSessions}</p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={toggleTimer}
              className="min-w-28 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button
              type="button"
              onClick={skipSession}
              className="rounded-full border border-stone-300 bg-white px-6 py-3 text-sm text-stone-600 transition hover:border-stone-400 hover:text-stone-900"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={resetTimer}
              className="rounded-full border border-stone-300 bg-white px-6 py-3 text-sm text-stone-600 transition hover:border-stone-400 hover:text-stone-900"
            >
              Reset
            </button>
          </div>
        </section>

        {settingsOpen ? (
          <section className={`mx-auto mt-6 w-full max-w-xl rounded-[1.5rem] border border-stone-200 p-5 shadow-[0_18px_40px_rgba(28,25,23,0.06)] transition-colors duration-700 ${activeMode.panel}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-900">Settings</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="text-sm text-stone-400 transition hover:text-stone-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {Object.entries(MODES).map(([key, value]) => (
                <label key={key} className="space-y-2 text-sm text-stone-500">
                  <span>{value.label} minutes</span>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={durations[key]}
                    onChange={(event) => syncDuration(key, event.target.value)}
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-stone-900 outline-none transition focus:border-stone-400"
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-900">通知音</p>
                <p className="text-sm text-stone-500">作業と休憩の切り替え時に再生</p>
              </div>
              <button
                type="button"
                onClick={() => setAudioEnabled((currentValue) => !currentValue)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  audioEnabled ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 ring-1 ring-stone-300'
                }`}
              >
                {audioEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}

export default App
