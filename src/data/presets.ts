import { db } from './db'
import { markDirty } from './outbox'
import { nowIso } from './time'

const PRESET_NAMES = new Set(['Food', 'Gas', 'Random'])

/** Drop unused Food/Gas/Random rows created by the old seed. Runs once per user. */
export async function clearSeededCategories(userId: string): Promise<void> {
  const flag = `presets-cleared:${userId}`
  if (await db.meta.get(flag)) return
  const categories = await db.budget_categories.where('user_id').equals(userId).toArray()
  const transactions = await db.budget_transactions.where('user_id').equals(userId).toArray()
  const stamp = nowIso()
  for (const category of categories) {
    if (category.deleted_at || !PRESET_NAMES.has(category.name)) continue
    const used = transactions.some((row) => row.category_id === category.id && !row.deleted_at)
    if (used) continue
    const next = { ...category, deleted_at: stamp, updated_at: stamp }
    await db.budget_categories.put(next)
    await markDirty('budget_categories', category.id)
  }
  await db.meta.put({ key: flag, value: '1' })
}
