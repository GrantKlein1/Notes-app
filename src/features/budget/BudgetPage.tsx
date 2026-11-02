import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { AccountButton } from '../../components/AccountButton'
import { useUserId } from '../../components/AuthProvider'
import { PlusIcon } from '../../components/Icons'
import { MonthSwitcher } from '../../components/MonthSwitcher'
import { SyncLabel } from '../../components/SyncProvider'
import { useMonth } from '../../components/useMonth'
import { db } from '../../data/db'
import { applyCarryForward } from '../../data/repository'
import { formatMoney, roundMoney } from '../../data/time'
import { CalculatorButton } from './Calculator'
import { rollups } from './rollup'

export function BudgetPage() {
  const userId = useUserId()
  const navigate = useNavigate()
  const [month, setMonth] = useMonth()
  useEffect(() => {
    void applyCarryForward(userId, month)
  }, [userId, month])
  const categories = useLiveQuery(async () => {
    const rows = await db.budget_categories.where('user_id').equals(userId).toArray()
    return rows.filter((row) => !row.deleted_at)
  }, [userId])
  const allocations = useLiveQuery(async () => {
    const rows = await db.budget_allocations.where('user_id').equals(userId).toArray()
    return rows.filter((row) => row.month === month && !row.deleted_at)
  }, [userId, month])
  const transactions = useLiveQuery(async () => {
    const rows = await db.budget_transactions.where('user_id').equals(userId).toArray()
    return rows.filter((row) => row.month === month && !row.deleted_at)
  }, [userId, month])

  const items =
    categories && allocations && transactions ? rollups(categories, allocations, transactions) : undefined
  const allocated = roundMoney(items?.reduce((sum, item) => sum + item.allocated, 0) ?? 0)
  const spent = roundMoney(items?.reduce((sum, item) => sum + item.spent, 0) ?? 0)
  const remaining = roundMoney(allocated - spent)
  const longTerm = useLiveQuery(async () => {
    const rows = await db.budget_long_term.where('user_id').equals(userId).toArray()
    return rows.filter((row) => !row.deleted_at).sort((a, b) => a.sort_order - b.sort_order)
  }, [userId])
  const longTotal = roundMoney((longTerm ?? []).reduce((sum, row) => sum + row.amount, 0))

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <h1 className="large-title">Budget</h1>
          <SyncLabel />
        </div>
        <div className="header-actions">
          <CalculatorButton />
          <AccountButton />
        </div>
      </header>
      <MonthSwitcher month={month} onChange={setMonth} />
      <div className="budget-actions">
        <Link to={`/budget/setup?month=${month}`} className="text-link">
          Edit areas
        </Link>
      </div>
      <section className="totals">
        <div>
          <span>Allocated</span>
          <strong>{formatMoney(allocated)}</strong>
        </div>
        <div>
          <span>Spent</span>
          <strong>{formatMoney(spent)}</strong>
        </div>
        <div>
          <span>Left</span>
          <strong className={remaining < 0 ? 'negative' : ''}>{formatMoney(remaining)}</strong>
        </div>
      </section>
      {items === undefined ? null : items.length === 0 ? (
        <p className="empty">No areas yet. Add your own in Edit areas.</p>
      ) : (
        <div className="group">
          {items.map((item) => (
            <button
              key={item.category.id}
              type="button"
              className="group-row"
              onClick={() => navigate(`/budget/category/${item.category.id}?month=${month}`)}
            >
              <div className="row-top">
                <span className="row-name">{item.category.name}</span>
                <span className={item.over ? 'negative' : ''}>{formatMoney(item.remaining)}</span>
              </div>
              <div className="row-sub">
                {formatMoney(item.spent)} of {formatMoney(item.allocated)}
              </div>
              <div className={item.over ? 'bar over' : 'bar'}>
                <span style={{ width: `${Math.round(item.progress * 100)}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}
      <h2 className="section-label">Long term</h2>
      {longTerm === undefined ? null : longTerm.length === 0 ? (
        <p className="empty">No long-term areas yet.</p>
      ) : (
        <div className="group">
          {longTerm.map((row) => (
            <div key={row.id} className="group-row">
              <div className="row-top">
                <span className="row-name">{row.name}</span>
                <span>{formatMoney(row.amount)}</span>
              </div>
            </div>
          ))}
          <div className="group-row row-sub">Together {formatMoney(longTotal)}</div>
        </div>
      )}
      <button
        type="button"
        className="fab"
        aria-label="Add expense"
        onClick={() => navigate(`/budget/spend?month=${month}`)}
      >
        <PlusIcon size={32} />
      </button>
    </main>
  )
}
