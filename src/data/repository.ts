import { db } from './db'
import { markDirty } from './outbox'
import { syncSoon } from './sync'
import { plainTextFromDoc, prayerText, titleFromDoc } from './text'
import { addMonths, newId, nowIso, roundMoney } from './time'
import type { AllocationRow, CategoryRow, NoteRow, TransactionRow } from './types'

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
    const next: AllocationRow = { ...existing, amount: rounded, updated_at: nowIso() }
    await db.budget_allocations.put(next)
    await markDirty('budget_allocations', next.id)
  } else {
    const created: AllocationRow = {
      id: newId(),
      user_id: userId,
      month,
      category_id: categoryId,
      amount: rounded,
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

export async function restoreTransaction(id: string): Promise<void> {
  const existing = await db.budget_transactions.get(id)
  if (!existing || !existing.deleted_at) return
  const next: TransactionRow = { ...existing, deleted_at: null, updated_at: nowIso() }
  await db.budget_transactions.put(next)
  await markDirty('budget_transactions', id)
  syncSoon()
}
