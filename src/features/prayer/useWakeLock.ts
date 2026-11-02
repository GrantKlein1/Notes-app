import { useEffect } from 'react'

export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let released = false
    let sentinel: WakeLockSentinel | null = null

    const request = () => {
      void navigator.wakeLock
        .request('screen')
        .then((lock) => {
          if (released) {
            void lock.release()
            return
          }
          sentinel = lock
        })
        .catch(() => {
          sentinel = null
        })
    }

    request()
    const onVisible = () => {
      if (document.visibilityState === 'visible') request()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [enabled])
}
