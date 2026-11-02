import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useParams } from 'react-router-dom'
import { useUserId } from '../../components/AuthProvider'
import { appendDigit, Keypad } from '../../components/Keypad'
import { Sheet } from '../../components/Sheet'
import { useMonth } from '../../components/useMonth'
import { db } from '../../data/db'
import { restoreTransaction, undoTransaction, updateTransaction } from '../../data/repository'
import { formatMoney, formatWhen } from '../../data/time'
import type { TransactionRow } from '../../data/types'

export function CategoryHistory() {
  const userId = useUserId()
  const { categoryId = '' } = useParams()
  const [month] = useMonth()
  const [editing, setEditing] = useState<TransactionRow | null>(null)
  const [digits, setDigits] = useState('')
  const [memo, setMemo] = useState('')
  const [nextCategory, setNextCategory] = useState('')

  const category = useLiveQuery(() => db.budget_categories.get(categoryId), [categoryId])
  const categories = useLiveQuery(async () => {
    const rows = await db.budget_categories.where('user_id').equals(userId).toArray()
    return rows
      .filter((row) => !row.deleted_at && !row.archived)
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [userId])
  const transactions = useLiveQuery(async () => {
    const rows = await db.budget_transactions.where('user_id').equals(userId).toArray()
    return rows
      .filter((row) => row.category_id === categoryId && row.month === month)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  }, [userId, categoryId, month])

  const active = (transactions ?? []).filter((row) => !row.deleted_at)
  const removed = (transactions ?? []).filter((row) => row.deleted_at)

  function openEdit(row: TransactionRow) {
    const cents = Math.round(row.amount * 100)
    setEditing(row)
    setDigits(cents > 0 ? String(cents) : '')
    setMemo(row.memo)
    setNextCategory(row.category_id)
  }

  async function saveEdit() {
    if (!editing) return
    await updateTransaction(editing.id, {
      amount: Number(digits || '0') / 100,
      memo,
      categoryId: nextCategory,
    })
    setEditing(null)
  }

  return (
    <main className="screen no-tabs">
      <header className="topbar">
        <Link to={`/budget?month=${month}`} className="back-link">
          ‹ Budget
        </Link>
      </header>
      <h1 className="page-title">{category?.name ?? 'Category'}</h1>
      <p className="muted pad">{month}</p>
      {active.length === 0 ? <p className="empty">No expenses this month.</p> : null}
      <div className="group">
        {active.map((row) => (
          <div key={row.id} className="group-row tx">
            <div>
              <strong>{formatMoney(row.amount)}</strong>
              <span>{row.memo || 'Expense'}</span>
            </div>
            <time dateTime={row.created_at}>{formatWhen(row.created_at)}</time>
            <div className="tx-actions">
              <button type="button" className="text-button" onClick={() => openEdit(row)}>
                Edit
              </button>
              <button type="button" className="text-button danger" onClick={() => void undoTransaction(row.id)}>
                Undo
              </button>
            </div>
          </div>
        ))}
      </div>
      {removed.length > 0 ? (
        <section>
          <h2 className="section-label">Removed</h2>
          <div className="group">
            {removed.map((row) => (
              <button
                key={row.id}
                type="button"
                className="group-row"
                onClick={() => void restoreTransaction(row.id)}
              >
                Restore {formatMoney(row.amount)}
                {row.memo ? ` · ${row.memo}` : ''}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <Sheet title="Edit expense" open={Boolean(editing)} onClose={() => setEditing(null)}>
        <div className="chips">
          {(categories ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === nextCategory ? 'chip on' : 'chip'}
              onClick={() => setNextCategory(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <p className="amount-display">{formatMoney(Number(digits || '0') / 100)}</p>
        <input
          className="memo-input"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="Memo"
          aria-label="Memo"
          maxLength={200}
        />
        <Keypad
          onDigit={(digit) => setDigits((current) => appendDigit(current, digit))}
          onBackspace={() => setDigits((current) => current.slice(0, -1))}
        />
        <button type="button" className="primary" disabled={Number(digits || '0') <= 0} onClick={() => void saveEdit()}>
          Save
        </button>
      </Sheet>
    </main>
  )
}
