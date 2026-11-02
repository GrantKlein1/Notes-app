import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { useUserId } from '../../components/AuthProvider'
import { appendDigit, Keypad } from '../../components/Keypad'
import { MonthSwitcher } from '../../components/MonthSwitcher'
import { useMonth } from '../../components/useMonth'
import { db } from '../../data/db'
import { addTransaction } from '../../data/repository'
import { formatCents } from '../../data/time'

export function QuickSpend() {
  const userId = useUserId()
  const navigate = useNavigate()
  const [month, setMonth] = useMonth()
  const [categoryId, setCategoryId] = useState('')
  const [digits, setDigits] = useState('')
  const [memo, setMemo] = useState('')
  const [error, setError] = useState('')
  const categories = useLiveQuery(async () => {
    const rows = await db.budget_categories.where('user_id').equals(userId).toArray()
    return rows
      .filter((row) => !row.deleted_at && !row.archived)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [userId])

  const cents = Number(digits || '0')
  const canSave = Boolean(categoryId) && cents > 0

  async function save() {
    if (!canSave) return
    try {
      await addTransaction(userId, month, categoryId, cents / 100, memo)
      navigate(`/budget?month=${month}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save')
    }
  }

  return (
    <main className="screen no-tabs spend">
      <header className="topbar">
        <Link to={`/budget?month=${month}`} className="back-link">
          ‹ Budget
        </Link>
      </header>
      <h1 className="page-title">Add expense</h1>
      <MonthSwitcher month={month} onChange={setMonth} />
      <div className="chips" role="listbox" aria-label="Category">
        {(categories ?? []).map((category) => (
          <button
            key={category.id}
            type="button"
            role="option"
            aria-selected={category.id === categoryId}
            className={category.id === categoryId ? 'chip on' : 'chip'}
            onClick={() => setCategoryId(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      {categories && categories.length === 0 ? <p className="muted pad">Add a category in Edit amounts first.</p> : null}
      <p className="amount-display">{formatCents(cents)}</p>
      <input
        className="memo-input"
        value={memo}
        onChange={(event) => setMemo(event.target.value)}
        placeholder="Memo (optional)"
        aria-label="Memo"
        maxLength={200}
      />
      <Keypad onDigit={(digit) => setDigits((current) => appendDigit(current, digit))} onBackspace={() => setDigits((current) => current.slice(0, -1))} />
      {error ? <p className="error pad">{error}</p> : null}
      <button type="button" className="primary" disabled={!canSave} onClick={() => void save()}>
        Save
      </button>
    </main>
  )
}
