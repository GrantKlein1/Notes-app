import { db } from './db'
import { markDirty } from './outbox'
import { clearSeededCategories } from './presets'
import { syncSoon } from './sync'
import { plainTextFromDoc, prayerText, titleFromDoc } from './text'
import { addMonths, currentMonth, isMonth, monthHasPassed, newId, nowIso, roundMoney } from './time'
import type { AllocationRow, CategoryRow, LongTermRow, NoteRow, TransactionRow } from './types'

export async function createNote(
  userId: string,
  content: Record<string, unknown>,
  pinned: boolean,
): Promise<NoteRow> {
  const row: NoteRow = {
    id: newId(),
    user_id: userId,
    type: 'note',
    title: titleFromDoc(content),
    content,
    pinned,
    updated_at: nowIso(),
    deleted_at: null,
  }
  await db.notes.put(row)
  await markDirty('notes', row.id)
  syncSoon()
  return row
}

export async function saveNoteContent(
  id: string,
  content: Record<string, unknown>,
  pinned: boolean,
): Promise<void> {
  const existing = await db.notes.get(id)
  if (!existing || existing.deleted_at) return
  const title = titleFromDoc(content)
  if (
    existing.title === title &&
    existing.pinned === pinned &&
    JSON.stringify(existing.content) === JSON.stringify(content)
  ) {
    return
  }
  const next: NoteRow = { ...existing, title, content, pinned, updated_at: nowIso() }
  await db.notes.put(next)
  await markDirty('notes', id)
  syncSoon()
}

export async function setNotePinned(id: string, pinned: boolean): Promise<void> {
  const existing = await db.notes.get(id)
  if (!existing || existing.deleted_at || existing.pinned === pinned) return
  const next: NoteRow = { ...existing, pinned, updated_at: nowIso() }
  await db.notes.put(next)
  await markDirty('notes', id)
  syncSoon()
}

export async function softDeleteNote(id: string): Promise<void> {
  const existing = await db.notes.get(id)
  if (!existing || existing.deleted_at) return
  const stamp = nowIso()
  const next: NoteRow = { ...existing, deleted_at: stamp, updated_at: stamp }
  await db.notes.put(next)
  await markDirty('notes', id)
  syncSoon()
}

export async function discardNoteIfEmpty(id: string): Promise<void> {
  const existing = await db.notes.get(id)
  if (!existing || existing.deleted_at || existing.pinned) return
  if (plainTextFromDoc(existing.content).trim()) return
  await softDeleteNote(id)
}

export async function getOrCreatePrayer(userId: string): Promise<NoteRow> {
  const rows = await db.notes.where('user_id').equals(userId).toArray()
  const existing = rows
    .filter((row) => row.type === 'prayer' && !row.deleted_at)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))[0]
  if (existing) return existing
  const row: NoteRow = {
    id: newId(),
    user_id: userId,
    type: 'prayer',
    title: 'Prayer',
    content: { text: '' },
    pinned: false,
    updated_at: nowIso(),
    deleted_at: null,
  }
  await db.notes.put(row)
  await markDirty('notes', row.id)
  syncSoon()
  return row
}

export async function savePrayerText(id: string, text: string): Promise<void> {
  const existing = await db.notes.get(id)
  if (!existing || existing.deleted_at) return
  if (prayerText(existing.content) === text) return
  const next: NoteRow = {
    ...existing,
    title: 'Prayer',
    content: { text },
    updated_at: nowIso(),
  }
  await db.notes.put(next)
  await markDirty('notes', id)
  syncSoon()
}

export async function addCategory(userId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const rows = await db.budget_categories.where('user_id').equals(userId).toArray()
  const sort = rows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1
  const row: CategoryRow = {
    id: newId(),
    user_id: userId,
    name: trimmed,
    sort_order: sort,
    archived: false,
    updated_at: nowIso(),
    deleted_at: null,
  }
  await db.budget_categories.put(row)
  await markDirty('budget_categories', row.id)
  syncSoon()
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<void> {
  const existing = await db.budget_categories.get(id)
  if (!existing || existing.deleted_at || existing.archived === archived) return
  const next: CategoryRow = { ...existing, archived, updated_at: nowIso() }
  await db.budget_categories.put(next)
  await markDirty('budget_categories', id)
  syncSoon()
}

export async function renameCategory(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const existing = await db.budget_categories.get(id)
  if (!existing || existing.deleted_at || existing.name === trimmed) return
  const next: CategoryRow = { ...existing, name: trimmed, updated_at: nowIso() }
  await db.budget_categories.put(next)
  await markDirty('budget_categories', id)
  syncSoon()
}

export async function deleteCategory(id: string): Promise<void> {
  const existing = await db.budget_categories.get(id)
  if (!existing || existing.deleted_at) return
  const stamp = nowIso()
  const next: CategoryRow = { ...existing, deleted_at: stamp, updated_at: stamp }
  await db.budget_categories.put(next)
  await markDirty('budget_categories', id)
  syncSoon()
}

export async function setAllocation(
  userId: string,
  month: string,
  categoryId: string,
  amount: number,
): Promise<void> {
  const rounded = roundMoney(Math.max(0, amount))
  const rows = await db.budget_allocations.where('user_id').equals(userId).toArray()
  const existing = rows.find(
    (row) => row.month === month && row.category_id === categoryId && !row.deleted_at,
  )
  if (existing) {
    if (existing.amount === rounded) return
    const next: AllocationRow = {
      ...existing,
      amount: rounded,
      carry_applied_from: existing.carry_applied_from ?? null,
      updated_at: nowIso(),
    }
    await db.budget_allocations.put(next)
    await markDirty('budget_allocations', next.id)
  } else {
    const created: AllocationRow = {
      id: newId(),
      user_id: userId,
      month,
      category_id: categoryId,
      amount: rounded,
      carry_applied_from: null,
      updated_at: nowIso(),
      deleted_at: null,
    }
    await db.budget_allocations.put(created)
    await markDirty('budget_allocations', created.id)
  }
  syncSoon()
}

export async function copyAllocations(userId: string, month: string, count: number): Promise<void> {
  const safeCount = Math.max(1, Math.min(24, Math.floor(count)))
  const rows = await db.budget_allocations.where('user_id').equals(userId).toArray()
  const source = rows.filter((row) => row.month === month && !row.deleted_at)
  for (let offset = 1; offset <= safeCount; offset += 1) {
    const target = addMonths(month, offset)
    for (const row of source) {
      await setAllocation(userId, target, row.category_id, row.amount)
    }
  }
}

export async function addTransaction(
  userId: string,
  month: string,
  categoryId: string,
  amount: number,
  memo: string,
): Promise<void> {
  const rounded = roundMoney(amount)
  if (rounded <= 0) return
  const stamp = nowIso()
  const row: TransactionRow = {
    id: newId(),
    user_id: userId,
    month,
    category_id: categoryId,
    amount: rounded,
    memo: memo.trim(),
    created_at: stamp,
    updated_at: stamp,
    deleted_at: null,
  }
  await db.budget_transactions.put(row)
  await markDirty('budget_transactions', row.id)
  syncSoon()
}

export async function updateTransaction(
  id: string,
  input: { amount: number; memo: string; categoryId: string },
): Promise<void> {
  const existing = await db.budget_transactions.get(id)
  if (!existing || existing.deleted_at) return
  const rounded = roundMoney(input.amount)
  if (rounded <= 0) return
  const next: TransactionRow = {
    ...existing,
    amount: rounded,
    memo: input.memo.trim(),
    category_id: input.categoryId,
    updated_at: nowIso(),
  }
  await db.budget_transactions.put(next)
  await markDirty('budget_transactions', id)
  syncSoon()
}

export async function undoTransaction(id: string): Promise<void> {
  const existing = await db.budget_transactions.get(id)
  if (!existing || existing.deleted_at) return
  const stamp = nowIso()
  const next: TransactionRow = { ...existing, deleted_at: stamp, updated_at: stamp }
  await db.budget_transactions.put(next)
  await markDirty('budget_transactions', id)
  syncSoon()
}

export async function addLongTerm(userId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const rows = await db.budget_long_term.where('user_id').equals(userId).toArray()
  const sort = rows.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1
  const row: LongTermRow = {
    id: newId(),
    user_id: userId,
    name: trimmed,
    amount: 0,
    sort_order: sort,
    updated_at: nowIso(),
    deleted_at: null,
  }
  await db.budget_long_term.put(row)
  await markDirty('budget_long_term', row.id)
  syncSoon()
}

export async function renameLongTerm(id: string, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const existing = await db.budget_long_term.get(id)
  if (!existing || existing.deleted_at || existing.name === trimmed) return
  const next: LongTermRow = { ...existing, name: trimmed, updated_at: nowIso() }
  await db.budget_long_term.put(next)
  await markDirty('budget_long_term', id)
  syncSoon()
}

export async function setLongTermAmount(id: string, amount: number): Promise<void> {
  const existing = await db.budget_long_term.get(id)
  if (!existing || existing.deleted_at) return
  const rounded = roundMoney(Math.max(0, amount))
  if (existing.amount === rounded) return
  const next: LongTermRow = { ...existing, amount: rounded, updated_at: nowIso() }
  await db.budget_long_term.put(next)
  await markDirty('budget_long_term', id)
  syncSoon()
}

export async function deleteLongTerm(id: string): Promise<void> {
  const existing = await db.budget_long_term.get(id)
  if (!existing || existing.deleted_at) return
  const stamp = nowIso()
  const next: LongTermRow = { ...existing, deleted_at: stamp, updated_at: stamp }
  await db.budget_long_term.put(next)
  await markDirty('budget_long_term', id)
  syncSoon()
}

let carryChain: Promise<void> = Promise.resolve()

/** Add leftover into the next month only after the source month has ended, once per step. */
export function applyCarryForward(userId: string, month: string): Promise<void> {
  const run = carryChain.then(async () => {
    await clearSeededCategories(userId)
    await rollCarry(userId, month)
  })
  carryChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function rollCarry(userId: string, month: string): Promise<void> {
  if (!isMonth(month)) return
  const categories = (await db.budget_categories.where('user_id').equals(userId).toArray()).filter(
    (row) => !row.deleted_at && !row.archived,
  )
  if (categories.length === 0) return
  const allocations = (await db.budget_allocations.where('user_id').equals(userId).toArray()).filter(
    (row) => !row.deleted_at && isMonth(row.month),
  )
  const transactions = (await db.budget_transactions.where('user_id').equals(userId).toArray()).filter(
    (row) => !row.deleted_at && isMonth(row.month),
  )
  const known = new Set<string>([month])
  for (const row of allocations) known.add(row.month)
  for (const row of transactions) known.add(row.month)
  const todayMonth = currentMonth()
  const end = month > todayMonth ? month : todayMonth
  known.add(end)
  const earliest = [...known].sort()[0]
  if (!earliest || earliest >= end) return

  const byKey = new Map<string, AllocationRow>()
  for (const row of allocations) byKey.set(`${row.month}:${row.category_id}`, row)
  let changed = false
  let cursor = earliest
  for (let step = 0; step < 48 && cursor < end; step += 1) {
    if (!monthHasPassed(cursor)) break
    const next = addMonths(cursor, 1)
    for (const category of categories) {
      const wrote = await applyOneCarry(userId, category.id, cursor, next, byKey, transactions)
      changed = changed || wrote
    }
    cursor = next
  }
  if (changed) syncSoon()
}

async function applyOneCarry(
  userId: string,
  categoryId: string,
  from: string,
  to: string,
  byKey: Map<string, AllocationRow>,
  transactions: TransactionRow[],
): Promise<boolean> {
  const key = `${to}:${categoryId}`
  const existing = byKey.get(key)
  if (existing?.carry_applied_from === from) return false
  const base = existing?.amount ?? 0
  const allocated = byKey.get(`${from}:${categoryId}`)?.amount ?? 0
  const spent = roundMoney(
    transactions
      .filter((row) => row.month === from && row.category_id === categoryId)
      .reduce((sum, row) => sum + row.amount, 0),
  )
  const leftover = roundMoney(allocated - spent)
  const amount = roundMoney(Math.max(0, base + leftover))
  const stamp = nowIso()
  const next: AllocationRow = existing
    ? { ...existing, amount, carry_applied_from: from, updated_at: stamp }
    : {
        id: newId(),
        user_id: userId,
        month: to,
        category_id: categoryId,
        amount,
        carry_applied_from: from,
        updated_at: stamp,
        deleted_at: null,
      }
  await db.budget_allocations.put(next)
  await markDirty('budget_allocations', next.id)
  byKey.set(key, next)
  return true
}

export async function restoreTransaction(id: string): Promise<void> {
  const existing = await db.budget_transactions.get(id)
  if (!existing || !existing.deleted_at) return
  const next: TransactionRow = { ...existing, deleted_at: null, updated_at: nowIso() }
  await db.budget_transactions.put(next)
  await markDirty('budget_transactions', id)
  syncSoon()
}
