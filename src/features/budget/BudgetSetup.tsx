import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useUserId } from '../../components/AuthProvider'
import { MonthSwitcher } from '../../components/MonthSwitcher'
import { Sheet } from '../../components/Sheet'
import { useMonth } from '../../components/useMonth'
import { db } from '../../data/db'
import { addCategory, copyAllocations, setAllocation, setCategoryArchived } from '../../data/repository'
import { addMonths, formatMonth } from '../../data/time'

export function BudgetSetup() {
  const userId = useUserId()
  const [month, setMonth] = useMonth()
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [count, setCount] = useState(1)
  const [copyOpen, setCopyOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const timers = useRef<Record<string, number>>({})

  const categories = useLiveQuery(async () => {
    const rows = await db.budget_categories.where('user_id').equals(userId).toArray()
    return rows.filter((row) => !row.deleted_at).sort((a, b) => a.sort_order - b.sort_order)
  }, [userId])

  useEffect(() => {
    let cancel = false
    void db.budget_allocations
      .where('user_id')
      .equals(userId)
      .toArray()
      .then((rows) => {
        if (cancel) return
        const next: Record<string, string> = {}
        for (const row of rows) {
          if (row.month === month && !row.deleted_at && row.amount) next[row.category_id] = String(row.amount)
        }
        setAmounts(next)
      })
    return () => {
      cancel = true
    }
  }, [month, userId])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of Object.values(pending)) window.clearTimeout(timer)
    }
  }, [])

  function onAmount(categoryId: string, value: string) {
    const cleaned = value.replace(/[^0-9.]/g, '')
    setAmounts((current) => ({ ...current, [categoryId]: cleaned }))
    const amount = cleaned.trim() === '' ? 0 : Number(cleaned)
    if (!Number.isFinite(amount) || amount < 0) return
    const existing = timers.current[categoryId]
    if (existing) window.clearTimeout(existing)
    timers.current[categoryId] = window.setTimeout(() => {
      void setAllocation(userId, month, categoryId, amount)
    }, 400)
  }

  async function flushAmounts() {
    const active = (categories ?? []).filter((category) => !category.archived)
    await Promise.all(
      active.map(async (category) => {
        const timer = timers.current[category.id]
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

  const active = (categories ?? []).filter((category) => !category.archived)
  const hidden = (categories ?? []).filter((category) => category.archived)
  const targets = Array.from({ length: count }, (_, index) => formatMonth(addMonths(month, index + 1)))

  return (
    <main className="screen">
      <header className="topbar">
        <Link to={`/budget?month=${month}`} className="back-link">
          ‹ Budget
        </Link>
      </header>
      <h1 className="page-title">Monthly setup</h1>
      <MonthSwitcher month={month} onChange={setMonth} />
      <p className="muted pad">Enter what you want to spend in {formatMonth(month)}.</p>
      <div className="group">
        {active.map((category) => (
          <div key={category.id} className="group-row setup-row">
            <div>
              <span className="row-name">{category.name}</span>
              <button type="button" className="text-button" onClick={() => void setCategoryArchived(category.id, true)}>
                Hide
              </button>
            </div>
            <input
              className="money-input"
              inputMode="decimal"
              aria-label={`${category.name} amount`}
              placeholder="0"
              value={amounts[category.id] ?? ''}
              onChange={(event) => onAmount(category.id, event.target.value)}
            />
          </div>
        ))}
      </div>
      <form
        className="add-row"
        onSubmit={(event) => {
          event.preventDefault()
          const next = name.trim()
          if (!next) return
          void addCategory(userId, next)
          setName('')
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New category"
          aria-label="New category"
        />
        <button type="submit" className="text-button on">
          Add
        </button>
      </form>
      <button type="button" className="primary" onClick={() => setCopyOpen(true)}>
        Copy to next months
      </button>
      {notice ? <p className="muted pad">{notice}</p> : null}
      {hidden.length > 0 ? (
        <section>
          <h2 className="section-label">Hidden</h2>
          <div className="group">
            {hidden.map((category) => (
              <div key={category.id} className="group-row setup-row">
                <span className="row-name">{category.name}</span>
                <button type="button" className="text-button" onClick={() => void setCategoryArchived(category.id, false)}>
                  Show
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
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
        <p className="muted">{targets.slice(0, 4).join(', ')}{targets.length > 4 ? `, and ${targets.length - 4} more` : ''}</p>
        <button type="button" className="primary" onClick={() => void onCopy()}>
          Copy
        </button>
      </Sheet>
    </main>
  )
}
