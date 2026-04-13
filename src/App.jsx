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

const MENU_HIDE_DELAY = 2500

function AdBanner() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (globalThis.__pomodoroMainAdInitialized) {
      return
    }

    try {
      globalThis.adsbygoogle = globalThis.adsbygoogle || []
      globalThis.adsbygoogle.push({})
      globalThis.__pomodoroMainAdInitialized = true
    } catch (error) {
      console.error('AdSense initialization failed:', error)
    }
  }, [])

  return (
    <div className="mx-auto mt-6 w-full max-w-xl rounded-[1.5rem] border border-stone-200 bg-white/80 p-3 shadow-[0_18px_40px_rgba(28,25,23,0.05)]">
      <ins
        className="adsbygoogle"
        style={{ display: 'block', minHeight: '72px', maxHeight: '96px', overflow: 'hidden' }}
        data-ad-client="ca-pub-6651283997191475"
        data-ad-slot="4759075102"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  )
}

function App() {
  const [durations, setDurations] = useState({ focus: 25, break: 5 })
  const [mode, setMode] = useState('focus')
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(true)
  const [alwaysShowMenu, setAlwaysShowMenu] = useState(false)
  const [finalMinuteBurst, setFinalMinuteBurst] = useState(false)

  const audioContextRef = useRef(null)
  const hideMenuTimeoutRef = useRef(null)
  const lastCountdownTickRef = useRef(null)
  const finalMinuteBurstTimeoutRef = useRef(null)
  const finalMinuteBurstSessionRef = useRef(null)

  const totalSeconds = durations[mode] * 60
  const progress = totalSeconds === 0 ? 0 : secondsLeft / totalSeconds
  const circleRadius = 132
  const circumference = 2 * Math.PI * circleRadius
  const strokeOffset = circumference * (1 - progress)
  const activeMode = MODES[mode]
  const menuVisible = alwaysShowMenu || showMenu

  const scheduleMenuHide = useCallback(() => {
    if (alwaysShowMenu) {
      return
    }

    if (hideMenuTimeoutRef.current) {
      window.clearTimeout(hideMenuTimeoutRef.current)
    }

    hideMenuTimeoutRef.current = window.setTimeout(() => {
      if (!settingsOpen) {
        setShowMenu(false)
      }
    }, MENU_HIDE_DELAY)
  }, [alwaysShowMenu, settingsOpen])

  const revealMenu = useCallback(() => {
    setShowMenu(true)
    scheduleMenuHide()
  }, [scheduleMenuHide])

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

  const playCountdownTick = useCallback(async (remainingSeconds) => {
    const audioContext = await ensureAudioContext()

    if (!audioContext) {
      return
    }

    const now = audioContext.currentTime
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    const frequency = remainingSeconds === 1 ? 1046.5 : 880

    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(frequency, now)
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.16, now + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.start(now)
    oscillator.stop(now + 0.13)
  }, [ensureAudioContext])

  const triggerFinalMinuteBurst = useCallback(() => {
    const sessionKey = `${mode}-${totalSeconds}`

    if (finalMinuteBurstSessionRef.current === sessionKey) {
      return
    }

    finalMinuteBurstSessionRef.current = sessionKey
    setFinalMinuteBurst(true)

    if (finalMinuteBurstTimeoutRef.current) {
      window.clearTimeout(finalMinuteBurstTimeoutRef.current)
    }

    finalMinuteBurstTimeoutRef.current = window.setTimeout(() => {
      setFinalMinuteBurst(false)
    }, 2200)
  }, [mode, totalSeconds])

  useEffect(() => {
    if (!isRunning) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setSecondsLeft((currentSeconds) => {
        const nextSeconds = Math.max(currentSeconds - 1, 0)

        if (nextSeconds === 60) {
          triggerFinalMinuteBurst()
        }

        return nextSeconds
      })
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isRunning, triggerFinalMinuteBurst])

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

  useEffect(() => {
    if (!isRunning || secondsLeft > 5 || secondsLeft <= 0) {
      lastCountdownTickRef.current = null
      return
    }

    if (lastCountdownTickRef.current === secondsLeft) {
      return
    }

    lastCountdownTickRef.current = secondsLeft
    playCountdownTick(secondsLeft)
  }, [isRunning, playCountdownTick, secondsLeft])

  useEffect(() => {
    if (!isRunning || secondsLeft > 60) {
      finalMinuteBurstSessionRef.current = null
    }
  }, [isRunning, secondsLeft])

  useEffect(() => {
    if (alwaysShowMenu) {
      if (hideMenuTimeoutRef.current) {
        window.clearTimeout(hideMenuTimeoutRef.current)
      }
      return undefined
    }

    if (settingsOpen) {
      if (hideMenuTimeoutRef.current) {
        window.clearTimeout(hideMenuTimeoutRef.current)
      }
      return undefined
    }

    scheduleMenuHide()

    const events = ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'focusin']
    const handleActivity = () => {
      setShowMenu(true)
      scheduleMenuHide()
    }

    events.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true })
    })

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity)
      })

      if (hideMenuTimeoutRef.current) {
        window.clearTimeout(hideMenuTimeoutRef.current)
      }
    }
  }, [alwaysShowMenu, scheduleMenuHide, settingsOpen])

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
    revealMenu()
    setFinalMinuteBurst(false)
    finalMinuteBurstSessionRef.current = null
    setMode(nextMode)
    setIsRunning(false)
    setSecondsLeft(durations[nextMode] * 60)
  }

  const toggleTimer = async () => {
    await ensureAudioContext()
    revealMenu()
    if (!isRunning && secondsLeft === 60) {
      triggerFinalMinuteBurst()
    }
    setIsRunning((currentValue) => !currentValue)
  }

  const resetTimer = async () => {
    await ensureAudioContext()
    revealMenu()
    setFinalMinuteBurst(false)
    finalMinuteBurstSessionRef.current = null
    setIsRunning(false)
    setMode('focus')
    setSecondsLeft(durations.focus * 60)
    setCompletedSessions(0)
  }

  const skipSession = async () => {
    await ensureAudioContext()
    revealMenu()
    setFinalMinuteBurst(false)
    finalMinuteBurstSessionRef.current = null

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
    <main className={`h-screen overflow-hidden px-6 py-5 text-stone-900 transition-colors duration-700 ${activeMode.background}`}>
      <div className="mx-auto flex h-full max-w-3xl flex-col">
        <header
          className={`flex items-center justify-between transition-all duration-300 ${
            menuVisible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0 pointer-events-none'
          }`}
        >
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
            onClick={() => {
              revealMenu()
              setSettingsOpen((currentValue) => !currentValue)
            }}
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-600 transition hover:border-stone-400 hover:text-stone-900"
          >
            Settings
          </button>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center">
          <div
            className={`mb-10 flex items-center gap-2 rounded-full border border-stone-200 bg-white p-1 transition-all duration-300 ${
              menuVisible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0 pointer-events-none'
            }`}
          >
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

          <div className="relative flex h-[300px] w-[300px] items-center justify-center sm:h-[332px] sm:w-[332px]">
            {finalMinuteBurst ? (
              <div className="cinema-burst" aria-hidden="true">
                <span className="cinema-particle cinema-particle-1" />
                <span className="cinema-particle cinema-particle-2" />
                <span className="cinema-particle cinema-particle-3" />
                <span className="cinema-particle cinema-particle-4" />
                <span className="cinema-particle cinema-particle-5" />
                <span className="cinema-particle cinema-particle-6" />
              </div>
            ) : null}
            <svg className="absolute inset-[-12%] h-[124%] w-[124%] -rotate-90 overflow-visible" viewBox="0 0 320 320" aria-hidden="true">
              <circle cx="160" cy="160" r={circleRadius} fill="none" stroke="#e7e5e4" strokeWidth="12" />
              {finalMinuteBurst ? (
                <>
                  <circle
                    cx="160"
                    cy="160"
                    r="148"
                    fill="none"
                    stroke={activeMode.color}
                    strokeOpacity="0.18"
                    strokeWidth="4"
                    strokeDasharray="2 12"
                    className="cinema-countdown-orbit-burst"
                  />
                  <circle
                    cx="160"
                    cy="160"
                    r="116"
                    fill="none"
                    stroke={activeMode.color}
                    strokeOpacity="0.16"
                    strokeWidth="5"
                    strokeDasharray="28 18"
                    className="cinema-countdown-orbit-reverse-burst"
                  />
                  <circle
                    cx="160"
                    cy="160"
                    r="148"
                    fill="none"
                    stroke={activeMode.color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="64 866"
                    className="cinema-countdown-sweep-burst"
                  />
                </>
              ) : null}
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
                className={`transition-[stroke-dashoffset] duration-700 ${finalMinuteBurst ? 'countdown-ring-burst' : ''}`}
              />
            </svg>

            <div className={`flex h-[220px] w-[220px] flex-col items-center justify-center rounded-full text-center shadow-[0_18px_50px_rgba(28,25,23,0.08)] transition-colors duration-700 sm:h-[244px] sm:w-[244px] ${activeMode.panel}`}>
              <p className="text-sm uppercase tracking-[0.28em] text-stone-400">{activeMode.helper}</p>
              <p className="mt-3 font-['Space_Grotesk',_'Noto_Sans_JP',_sans-serif] text-5xl font-medium tracking-tight tabular-nums sm:text-6xl">
                {formatTime(secondsLeft)}
              </p>
              <p className="mt-3 text-sm text-stone-400">Completed {completedSessions}</p>
            </div>
          </div>

          <div
            className={`mt-7 flex flex-wrap items-center justify-center gap-3 transition-all duration-300 ${
              menuVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none'
            }`}
          >
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
          <section className={`mx-auto mt-6 w-full max-w-xl rounded-[1.5rem] border border-stone-200 p-5 shadow-[0_18px_40px_rgba(28,25,23,0.06)] transition-all duration-300 ${activeMode.panel} ${menuVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 pointer-events-none'}`}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-900">Settings</h2>
              <button
                type="button"
                onClick={() => {
                  revealMenu()
                  setSettingsOpen(false)
                }}
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
                    onChange={(event) => {
                      revealMenu()
                      syncDuration(key, event.target.value)
                    }}
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
                onClick={() => {
                  revealMenu()
                  setAudioEnabled((currentValue) => !currentValue)
                }}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  audioEnabled ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 ring-1 ring-stone-300'
                }`}
              >
                {audioEnabled ? 'On' : 'Off'}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-900">メニュー表示</p>
                <p className="text-sm text-stone-500">自動で隠さず、常に表示したままにします</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  revealMenu()
                  setAlwaysShowMenu((currentValue) => !currentValue)
                }}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  alwaysShowMenu ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 ring-1 ring-stone-300'
                }`}
              >
                {alwaysShowMenu ? 'Always on' : 'Auto hide'}
              </button>
            </div>
          </section>
        ) : null}

        <AdBanner />

        <footer className="pt-3 pb-2 text-center text-xs text-stone-400">
          ©︎ 2026 Himawari Project
        </footer>
      </div>
    </main>
  )
}

export default App
