import { useEffect, useRef } from 'react'

export function useAutosave(value: string, enabled: boolean, save: (value: string) => void): void {
  const saveRef = useRef(save)
  saveRef.current = save
  const skip = useRef(true)

  useEffect(() => {
    if (!enabled) return
    if (skip.current) {
      skip.current = false
      return
    }
    const timer = window.setTimeout(() => saveRef.current(value), 500)
    return () => window.clearTimeout(timer)
  }, [enabled, value])
}
