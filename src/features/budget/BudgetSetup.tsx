import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useUserId } from '../../components/AuthProvider'
import { MonthSwitcher } from '../../components/MonthSwitcher'
import { Sheet } from '../../components/Sheet'
import { useMonth } from '../../components/useMonth'
import { db } from '../../data/db'
import {
  addCategory,
  addLongTerm,
  applyCarryForward,
  copyAllocations,
  deleteCategory,
  deleteLongTerm,
  renameCategory,
  renameLongTerm,
  setAllocation,
  setLongTermAmount,
} from '../../data/repository'
import { addMonths, formatMonth } from '../../data/time'
import type { CategoryRow, LongTermRow } from '../../data/types'
import { CalculatorButton } from './Calculator'

type PendingDelete = { id: string; name: string; kind: 'month' | 'long' }

export function BudgetSetup() {
  const userId = useUserId()
  const [month, setMonth] = useMonth()
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [longAmounts, setLongAmounts] = useState<Record<string, string>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const [areaName, setAreaName] = useState('')
  const [longName, setLongName] = useState('')
  const [count, setCount] = useState(1)
  const [copyOpen, setCopyOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const timers = useRef<Record<string, number>>({})

  const categories = useLiveQuery(async () => {
    const rows = await db.budget_categories.where('user_id').equals(userId).toArray()
    return rows.filter((row) => !row.deleted_at && !row.archived).sort((a, b) => a.sort_order - b.sort_order)
  }, [userId])
  const longTerm = useLiveQuery(async () => {
    const rows = await db.budget_long_term.where('user_id').equals(userId).toArray()
    return rows.filter((row) => !row.deleted_at).sort((a, b) => a.sort_order - b.sort_order)
  }, [userId])

  useEffect(() => {
    let cancel = false
    void (async () => {
      await applyCarryForward(userId, month)
      const rows = await db.budget_allocations.where('user_id').equals(userId).toArray()
      if (cancel) return
      const next: Record<string, string> = {}
      for (const row of rows) {
        if (row.month === month && !row.deleted_at && row.amount) next[row.category_id] = String(row.amount)
      }
      setAmounts(next)
    })()
    return () => {
      cancel = true
    }
  }, [month, userId])

  useEffect(() => {
    let cancel = false
    void db.budget_long_term
      .where('user_id')
      .equals(userId)
      .toArray()
      .then((rows) => {
        if (cancel) return
        const next: Record<string, string> = {}
        for (const row of rows) {
          if (!row.deleted_at && row.amount) next[row.id] = String(row.amount)
        }
        setLongAmounts(next)
      })
    return () => {
      cancel = true
    }
  }, [userId])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of Object.values(pending)) window.clearTimeout(timer)
    }
  }, [])

  function schedule(key: string, save: () => void) {
    const existing = timers.current[key]
    if (existing) window.clearTimeout(existing)
    timers.current[key] = window.setTimeout(save, 400)
  }

  function onAmount(categoryId: string, value: string) {
    const cleaned = value.replace(/[^0-9.]/g, '')
    setAmounts((current) => ({ ...current, [categoryId]: cleaned }))
    const amount = cleaned.trim() === '' ? 0 : Number(cleaned)
    if (!Number.isFinite(amount) || amount < 0) return
    schedule(`amount:${categoryId}`, () => {
      void setAllocation(userId, month, categoryId, amount)
    })
  }

  function onLongAmount(id: string, value: string) {
    const cleaned = value.replace(/[^0-9.]/g, '')
    setLongAmounts((current) => ({ ...current, [id]: cleaned }))
    const amount = cleaned.trim() === '' ? 0 : Number(cleaned)
    if (!Number.isFinite(amount) || amount < 0) return
    schedule(`long:${id}`, () => {
      void setLongTermAmount(id, amount)
    })
  }

  function onRename(category: CategoryRow, value: string) {
    setNames((current) => ({ ...current, [category.id]: value }))
    schedule(`name:${category.id}`, () => {
      void renameCategory(category.id, value)
    })
  }

  function onRenameLong(row: LongTermRow, value: string) {
    setNames((current) => ({ ...current, [row.id]: value }))
    schedule(`long-name:${row.id}`, () => {
      void renameLongTerm(row.id, value)
    })
  }

  async function flushAmounts() {
    await Promise.all(
      (categories ?? []).map(async (category) => {
        const timer = timers.current[`amount:${category.id}`]
        if (timer) window.clearTimeout(timer)
        const raw = amounts[category.id] ?? ''
        const amount = raw.trim() === '' ? 0 : Number(raw)
        if (!Number.isFinite(amount) || amount < 0) return
        await setAllocation(userId, month, category.id, amount)
      }),
    )
  }

  async function onCopy() {
    await flushAmounts()
    await copyAllocations(userId, month, count)
    setCopyOpen(false)
    setNotice(`Copied to the next ${count} ${count === 1 ? 'month' : 'months'}.`)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    if (pendingDelete.kind === 'month') await deleteCategory(pendingDelete.id)
    else await deleteLongTerm(pendingDelete.id)
    setPendingDelete(null)
  }

  const monthly = categories ?? []
  const standing = longTerm ?? []
  const targets = Array.from({ length: count }, (_, index) => formatMonth(addMonths(month, index + 1)))

  return (
    <main className="screen">
      <header className="topbar">
        <Link to={`/budget?month=${month}`} className="back-link">
          ‹ Budget
        </Link>
        <CalculatorButton />
      </header>
      <h1 className="page-title">Areas</h1>
      <h2 className="section-label">This month</h2>
      <MonthSwitcher month={month} onChange={setMonth} />
      <p className="muted pad">
        Amounts for {formatMonth(month)}. Leftover moves to the next month on the 1st, after this month has ended.
      </p>
      {monthly.length === 0 ? (
        <p className="empty">No areas yet. Add the ones you want.</p>
      ) : (
        <div className="group">
          {monthly.map((category) => (
            <div key={category.id} className="group-row area-row">
              <input
                className="name-input"
                aria-label="Area name"
                value={names[category.id] ?? category.name}
                onChange={(event) => onRename(category, event.target.value)}
              />
              <input
                className="money-input"
                inputMode="decimal"
                aria-label={`${category.name} amount`}
                placeholder="0"
                value={amounts[category.id] ?? ''}
                onChange={(event) => onAmount(category.id, event.target.value)}
              />
              <button type="button" className="text-button danger" onClick={() => setPendingDelete({ id: category.id, name: category.name, kind: 'month' })}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        className="add-row"
        onSubmit={(event) => {
          event.preventDefault()
          const next = areaName.trim()
          if (!next) return
          void addCategory(userId, next)
          setAreaName('')
        }}
      >
        <input value={areaName} onChange={(event) => setAreaName(event.target.value)} placeholder="New area" aria-label="New area" />
        <button type="submit" className="text-button on">
          Add
        </button>
      </form>
      {monthly.length > 0 ? (
        <button type="button" className="primary" onClick={() => setCopyOpen(true)}>
          Copy to next months
        </button>
      ) : null}
      {notice ? <p className="muted pad">{notice}</p> : null}

      <h2 className="section-label">Long term</h2>
      <p className="muted pad">Not tied to a month. Change the amount whenever you want. Leftover does not carry here.</p>
      {standing.length === 0 ? (
        <p className="empty">No long-term areas yet.</p>
      ) : (
        <div className="group">
          {standing.map((row) => (
            <div key={row.id} className="group-row area-row">
              <input
                className="name-input"
                aria-label="Long-term area name"
                value={names[row.id] ?? row.name}
                onChange={(event) => onRenameLong(row, event.target.value)}
              />
              <input
                className="money-input"
                inputMode="decimal"
                aria-label={`${row.name} amount`}
                placeholder="0"
                value={longAmounts[row.id] ?? ''}
                onChange={(event) => onLongAmount(row.id, event.target.value)}
              />
              <button type="button" className="text-button danger" onClick={() => setPendingDelete({ id: row.id, name: row.name, kind: 'long' })}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
      <form
        className="add-row"
        onSubmit={(event) => {
          event.preventDefault()
          const next = longName.trim()
          if (!next) return
          void addLongTerm(userId, next)
          setLongName('')
        }}
      >
        <input
          value={longName}
          onChange={(event) => setLongName(event.target.value)}
          placeholder="New long-term area"
          aria-label="New long-term area"
        />
        <button type="submit" className="text-button on">
          Add
        </button>
      </form>

      <Sheet title="Copy to next months" open={copyOpen} onClose={() => setCopyOpen(false)}>
        <p className="muted">Copy {formatMonth(month)} onto:</p>
        <div className="stepper">
          <button type="button" aria-label="Fewer months" onClick={() => setCount((value) => Math.max(1, value - 1))}>
            −
          </button>
          <span>{count}</span>
          <button type="button" aria-label="More months" onClick={() => setCount((value) => Math.min(24, value + 1))}>
            +
          </button>
        </div>
        <p className="muted">
          {targets.slice(0, 4).join(', ')}
          {targets.length > 4 ? `, and ${targets.length - 4} more` : ''}
        </p>
        <button type="button" className="primary" onClick={() => void onCopy()}>
          Copy
        </button>
      </Sheet>
      <Sheet title="Delete area" open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <p className="muted">Delete {pendingDelete?.name}? This removes it from the budget.</p>
        <button type="button" className="primary danger" onClick={() => void confirmDelete()}>
          Delete
        </button>
      </Sheet>
    </main>
  )
}
