import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

interface FocusValue {
  active: boolean
  setActive: (active: boolean) => void
}

const FocusContext = createContext<FocusValue | null>(null)

export function FocusProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('focus', active)
    const metas = document.querySelectorAll('meta[name="theme-color"]')
    if (!active) {
      return () => document.documentElement.classList.remove('focus')
    }
    const previous = Array.from(metas).map((meta) => meta.getAttribute('content'))
    metas.forEach((meta) => meta.setAttribute('content', '#111111'))
    return () => {
      document.documentElement.classList.remove('focus')
      metas.forEach((meta, index) => {
        const value = previous[index]
        if (value) meta.setAttribute('content', value)
      })
    }
  }, [active])

  const value = useMemo(() => ({ active, setActive }), [active])
  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
}

export function useFocusMode(): FocusValue {
  const value = useContext(FocusContext)
  if (!value) throw new Error('Focus mode is unavailable')
  return value
}
