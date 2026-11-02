import { useEffect, useRef, useState } from 'react'
import { AccountButton } from '../../components/AccountButton'
import { useUserId } from '../../components/AuthProvider'
import { useFocusMode } from '../../components/FocusMode'
import { SyncLabel } from '../../components/SyncProvider'
import { useAutosave } from '../../components/useAutosave'
import { getOrCreatePrayer, savePrayerText } from '../../data/repository'
import { prayerText } from '../../data/text'
import { useWakeLock } from './useWakeLock'

export function PrayerPage() {
  const userId = useUserId()
  const { active, setActive } = useFocusMode()
  const [noteId, setNoteId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [ready, setReady] = useState(false)
  const [hint, setHint] = useState(false)
  const taps = useRef<number[]>([])
  const textRef = useRef(text)
  textRef.current = text
  useWakeLock(active)

  useEffect(() => {
    let cancel = false
    void getOrCreatePrayer(userId).then((row) => {
      if (cancel) return
      setNoteId(row.id)
      setText(prayerText(row.content))
      setReady(true)
    })
    return () => {
      cancel = true
      setActive(false)
    }
  }, [setActive, userId])

  useAutosave(text, ready && Boolean(noteId), (value) => {
    if (!noteId) return
    void savePrayerText(noteId, value)
  })

  useEffect(() => {
    if (!noteId) return
    const id = noteId
    const flush = () => {
      void savePrayerText(id, textRef.current)
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [noteId])

  useEffect(() => {
    if (!hint) return
    const timer = window.setTimeout(() => setHint(false), 1800)
    return () => window.clearTimeout(timer)
  }, [hint])

  function exitFocus() {
    taps.current = []
    setActive(false)
  }

  function onTripleTap() {
    const now = performance.now()
    const recent = taps.current.filter((stamp) => now - stamp <= 600)
    recent.push(now)
    taps.current = recent
    if (recent.length >= 3) exitFocus()
  }

  if (active) {
    // iOS home-screen web apps cannot hide the status-bar clock. Apple only
    // allows a true fullscreen viewport for video. The top safe area is painted
    // with the focus background so the clock blends in. Check this on a real
    // iPhone; if the clock disappears, retune --bg on html.focus in index.css.
    return (
      <div className="focus-stage" onPointerUp={onTripleTap}>
        {text || ' '}
        {hint ? <div className="focus-hint">Triple-tap to exit</div> : null}
      </div>
    )
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <h1 className="large-title">Prayer</h1>
          <SyncLabel />
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="text-button on"
            onClick={() => {
              setActive(true)
              setHint(true)
            }}
          >
            Focus
          </button>
          <AccountButton />
        </div>
      </header>
      <p className="muted pad">One line per person. Name - what you’re praying for.</p>
      <textarea
        className="prayer-text"
        value={text}
        placeholder={'Name - what I\'m praying for'}
        aria-label="Prayer list"
        onChange={(event) => setText(event.target.value)}
      />
    </main>
  )
}
