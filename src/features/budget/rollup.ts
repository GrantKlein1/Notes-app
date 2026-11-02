import { roundMoney } from '../../data/time'
import type { AllocationRow, CategoryRow, TransactionRow } from '../../data/types'

export interface Rollup {
  category: CategoryRow
  allocated: number
  spent: number
  remaining: number
  progress: number
  over: boolean
}

export function rollups(
  categories: CategoryRow[],
  allocations: AllocationRow[],
  transactions: TransactionRow[],
): Rollup[] {
  return categories
    .filter((category) => !category.deleted_at && !category.archived)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((category) => {
      const allocation = allocations.find((row) => row.category_id === category.id && !row.deleted_at)
      const spent = roundMoney(
        transactions
          .filter((row) => row.category_id === category.id && !row.deleted_at)
          .reduce((sum, row) => sum + row.amount, 0),
      )
      const allocated = allocation?.amount ?? 0
      const remaining = roundMoney(allocated - spent)
      const progress = allocated > 0 ? Math.min(spent / allocated, 1) : spent > 0 ? 1 : 0
      return { category, allocated, spent, remaining, progress, over: remaining < 0 }
    })
}
