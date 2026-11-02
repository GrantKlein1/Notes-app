import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db } from '../data/db'
import { isSupabaseConfigured, supabase } from '../data/supabase'

interface AuthValue {
  configured: boolean
  loading: boolean
  session: Session | null
  email: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(configured)

  useEffect(() => {
    if (!configured || !supabase) {
      setLoading(false)
      return
    }
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [configured])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return
    void (async () => {
      const previous = await db.meta.get('activeUser')
      if (previous && previous.value !== userId) {
        await db.notes.clear()
        await db.budget_categories.clear()
        await db.budget_allocations.clear()
        await db.budget_transactions.clear()
        await db.outbox.clear()
        await db.meta.clear()
      }
      await db.meta.put({ key: 'activeUser', value: userId })
    })()
  }, [session?.user.id])

  const value = useMemo<AuthValue>(
    () => ({
      configured,
      loading,
      session,
      email: session?.user.email ?? null,
      signOut: async () => {
        await supabase?.auth.signOut()
      },
    }),
    [configured, loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('Auth is unavailable')
  return value
}

export function useUserId(): string {
  const { session } = useAuth()
  if (!session) throw new Error('Sign in required')
  return session.user.id
}
