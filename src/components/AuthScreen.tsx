import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../data/supabase'
import { useAuth } from './AuthProvider'

export function AuthScreen() {
  const { configured } = useAuth()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentAt, setSentAt] = useState(0)
  const lastTried = useRef('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (step !== 'code') return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [step])

  async function sendCode(event?: FormEvent) {
    event?.preventDefault()
    if (!supabase) return
    const nextEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setError('Enter a valid email address.')
      return
    }
    setBusy(true)
    setError('')
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: nextEmail,
      options: { shouldCreateUser: true },
    })
    setBusy(false)
    if (sendError) {
      setError(sendError.message)
      return
    }
    setEmail(nextEmail)
    setStep('code')
    setCode('')
    lastTried.current = ''
    setSentAt(Date.now())
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function verify(token: string) {
    if (!supabase) return
    setBusy(true)
    setError('')
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })
    setBusy(false)
    if (verifyError) setError(verifyError.message)
  }

  const secondsLeft = Math.max(0, 30 - Math.floor((now - sentAt) / 1000))
  const canResend = sentAt === 0 || now - sentAt > 30000

  return (
    <main className="auth">
      <img className="auth-mark" src="/icons/apple-touch-icon.png" alt="" width={72} height={72} />
      <h1>Notes</h1>
      <p className="lede">
        Notes, budget, and prayer on this phone. Sign in with a 6-digit code so it stays in the app.
      </p>
      {!configured ? (
        <p className="error">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before signing in.</p>
      ) : null}
      {step === 'email' ? (
        <form onSubmit={(event) => void sendCode(event)}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="primary" disabled={busy || !configured}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (code.length === 6) void verify(code)
          }}
        >
          <p className="muted">
            Enter the code sent to {email}. Don’t tap a link in the email — that opens Safari.
          </p>
          <div className="code-wrap" onClick={() => inputRef.current?.focus()}>
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className={code.length === index ? 'code-box on' : 'code-box'}>
                {code[index] ?? ''}
              </span>
            ))}
            <input
              ref={inputRef}
              className="code-capture"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              aria-label="6-digit code"
              onChange={(event) => {
                const next = event.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(next)
                if (next.length === 6 && next !== lastTried.current) {
                  lastTried.current = next
                  void verify(next)
                }
              }}
            />
          </div>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="primary" disabled={busy || code.length < 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" className="text-button" disabled={!canResend || busy} onClick={() => void sendCode()}>
            {canResend ? 'Resend code' : `Resend in ${secondsLeft}s`}
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setStep('email')
              setCode('')
              setError('')
            }}
          >
            Use a different email
          </button>
        </form>
      )}
    </main>
  )
}
