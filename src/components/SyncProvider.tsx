import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { subscribeSync, syncNow, type SyncStatus } from '../data/sync'
import { useAuth } from './AuthProvider'

interface SyncValue {
  status: SyncStatus
  detail: string
}

const SyncContext = createContext<SyncValue>({ status: 'saved', detail: '' })

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const [value, setValue] = useState<SyncValue>({ status: 'saved', detail: '' })

  useEffect(() => subscribeSync((status, detail) => setValue({ status, detail })), [])

  useEffect(() => {
    if (!userId) return
    void syncNow()
    const onOnline = () => void syncNow()
    const onOffline = () => setValue({ status: 'offline', detail: 'Changes are saved on this phone.' })
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => void syncNow(), 20000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [userId])

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncValue {
  return useContext(SyncContext)
}

export function SyncLabel() {
  const { status, detail } = useSync()
  const label =
    status === 'syncing' ? 'Syncing' : status === 'offline' ? 'Saved on this phone' : status === 'error' ? 'Could not sync' : ''
  if (!label) return null
  return (
    <p className={`sync-label ${status}`} title={detail}>
      {label}
    </p>
  )
}
