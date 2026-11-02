import { db } from './db'
import { newId, nowIso } from './time'
import type { CategoryRow } from './types'

const SEED_NAMES = ['Food', 'Gas', 'Random']

export async function ensureSeedCategories(userId: string): Promise<void> {
  const existing = await db.budget_categories.where('user_id').equals(userId).count()
  if (existing > 0) return
  const stamp = nowIso()
  await db.transaction('rw', db.budget_categories, db.outbox, async () => {
    const again = await db.budget_categories.where('user_id').equals(userId).count()
    if (again > 0) return
    for (const [index, name] of SEED_NAMES.entries()) {
      const row: CategoryRow = {
        id: newId(),
        user_id: userId,
        name,
        sort_order: index,
        archived: false,
        updated_at: stamp,
        deleted_at: null,
      }
      await db.budget_categories.put(row)
      await db.outbox.put({
        key: `budget_categories:${row.id}`,
        table: 'budget_categories',
        rowId: row.id,
        attempts: 0,
      })
    }
  })
}
