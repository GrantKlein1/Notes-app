import { useSearchParams } from 'react-router-dom'
import { currentMonth, isMonth } from '../data/time'

export function useMonth(): [string, (month: string) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('month') ?? ''
  const month = isMonth(raw) ? raw : currentMonth()
  const setMonth = (next: string) => {
    const query = new URLSearchParams(params)
    query.set('month', next)
    setParams(query, { replace: true })
  }
  return [month, setMonth]
}
