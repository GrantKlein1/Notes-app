import { db } from './db'
import { ensureSeedCategories } from './seed'
import { requireClient } from './supabase'
import { assertNever, roundMoney } from './time'
import type {
  AllocationRow,
  CategoryRow,
  NoteRow,
  TableName,
  TransactionRow,
} from './types'

type SyncRow = NoteRow | CategoryRow | AllocationRow | TransactionRow

export type SyncStatus = 'offline' | 'syncing' | 'saved' | 'error'

type Listener = (status: SyncStatus, detail: string) => void

const TABLES: TableName[] = [
  'budget_categories',
  'budget_allocations',
  'budget_transactions',
  'notes',
]

const listeners = new Set<Listener>()
let status: SyncStatus = 'saved'
let detail = ''
let flight: Promise<void> | null = null
let queued = false
let timer: number | null = null

export function subscribeSync(listener: Listener): () => void {
  listeners.add(listener)
  listener(status, detail)
  return () => listeners.delete(listener)
}

function publish(next: SyncStatus, message = ''): void {
  status = next
  detail = message
  for (const listener of listeners) listener(status, detail)
}

export function syncSoon(): void {
  if (timer !== null) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    timer = null
    void syncNow()
  }, 300)
}

export function syncNow(): Promise<void> {
  if (flight) {
    queued = true
    return flight
  }
  flight = run().finally(() => {
    flight = null
    if (!queued) return
    queued = false
    void syncNow()
  })
  return flight
}

async function run(): Promise<void> {
  if (!navigator.onLine) {
    publish('offline', 'Changes are saved on this phone.')
    return
  }
  publish('syncing')
  try {
    const client = requireClient()
    const { data, error } = await client.auth.getSession()
    if (error) throw error
    const userId = data.session?.user.id
    if (!userId) {
      publish('error', 'Sign in again to sync.')
      return
    }
    await pullAll(userId)
    await ensureSeedCategories(userId)
    await pushAll(userId)
    publish(navigator.onLine ? 'saved' : 'offline')
  } catch (error) {
    if (!navigator.onLine || isNetworkError(error)) {
      publish('offline', 'Changes are saved on this phone.')
      return
    }
    publish('error', errorMessage(error))
  }
}

async function pullAll(userId: string): Promise<void> {
  for (const table of TABLES) {
    const cursor = (await db.meta.get(`cursor:${table}`))?.value
    const rows = await fetchTable(table, userId, cursor)
    let max = cursor ?? ''
    for (const raw of rows) {
      const remote = normalize(table, raw)
      await mergeRemote(table, remote)
      if (!max || Date.parse(remote.updated_at) > Date.parse(max)) max = remote.updated_at
    }
    if (max) await db.meta.put({ key: `cursor:${table}`, value: max })
  }
}

async function fetchTable(
  table: TableName,
  userId: string,
  cursor: string | undefined,
): Promise<unknown[]> {
  const client = requireClient()
  const pageSize = 1000
  const rows: unknown[] = []
  const since = cursor ?? '1970-01-01T00:00:00.000Z'
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', since)
      .order('updated_at', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

async function mergeRemote(table: TableName, remote: SyncRow): Promise<void> {
  const local = await readRow(table, remote.id)
  const key = `${table}:${remote.id}`
  const dirty = await db.outbox.get(key)
  const localAt = local ? Date.parse(local.updated_at) : Number.NEGATIVE_INFINITY
  const remoteAt = Date.parse(remote.updated_at)
  if (local && localAt > remoteAt) return
  if (local && dirty && localAt === remoteAt) return
  await writeRow(table, remote)
  if (dirty && remoteAt > localAt) await db.outbox.delete(key)
}

async function pushAll(userId: string): Promise<void> {
  const entries = await db.outbox.toArray()
  entries.sort((a, b) => TABLES.indexOf(a.table) - TABLES.indexOf(b.table))
  for (const entry of entries) {
    const row = await readRow(entry.table, entry.rowId)
    if (!row || row.user_id !== userId) {
      await db.outbox.delete(entry.key)
      continue
    }
    await pushRow(entry.table, row, entry.key, entry.attempts)
  }
}

async function pushRow(
  table: TableName,
  row: SyncRow,
  key: string,
  attempts: number,
): Promise<void> {
  const client = requireClient()
  const { data, error } = await client.from(table).select('*').eq('id', row.id).maybeSingle()
  if (error) throw error
  if (data) {
    const remote = normalize(table, data)
    if (Date.parse(remote.updated_at) > Date.parse(row.updated_at)) {
      await writeRow(table, remote)
      await db.outbox.delete(key)
      return
    }
  }
  const { error: upsertError } = await client.from(table).upsert(toPayload(row))
  if (!upsertError) {
    await db.outbox.delete(key)
    return
  }
  if (isNetworkError(upsertError)) throw upsertError
  await db.outbox.put({
    key,
    table,
    rowId: row.id,
    attempts: attempts + 1,
    lastError: upsertError.message,
  })
}

function toPayload(row: SyncRow): Record<string, unknown> {
  return { ...row }
}

async function readRow(table: TableName, id: string): Promise<SyncRow | undefined> {
  switch (table) {
    case 'notes':
      return db.notes.get(id)
    case 'budget_categories':
      return db.budget_categories.get(id)
    case 'budget_allocations':
      return db.budget_allocations.get(id)
    case 'budget_transactions':
      return db.budget_transactions.get(id)
    default:
      return assertNever(table)
  }
}

async function writeRow(table: TableName, row: SyncRow): Promise<void> {
  switch (table) {
    case 'notes':
      await db.notes.put(row as NoteRow)
      return
    case 'budget_categories':
      await db.budget_categories.put(row as CategoryRow)
      return
    case 'budget_allocations':
      await db.budget_allocations.put(row as AllocationRow)
      return
    case 'budget_transactions':
      await db.budget_transactions.put(row as TransactionRow)
      return
    default:
      assertNever(table)
  }
}

function normalize(table: TableName, value: unknown): SyncRow {
  const row = asRecord(value)
  switch (table) {
    case 'notes':
      return {
        id: asString(row.id),
        user_id: asString(row.user_id),
        type: row.type === 'prayer' ? 'prayer' : 'note',
        title: asString(row.title),
        content: asRecord(row.content),
        pinned: Boolean(row.pinned),
        updated_at: asString(row.updated_at),
        deleted_at: asNullableString(row.deleted_at),
      }
    case 'budget_categories':
      return {
        id: asString(row.id),
        user_id: asString(row.user_id),
        name: asString(row.name),
        sort_order: asNumber(row.sort_order),
        archived: Boolean(row.archived),
        updated_at: asString(row.updated_at),
        deleted_at: asNullableString(row.deleted_at),
      }
    case 'budget_allocations':
      return {
        id: asString(row.id),
        user_id: asString(row.user_id),
        month: asString(row.month),
        category_id: asString(row.category_id),
        amount: roundMoney(asNumber(row.amount)),
        updated_at: asString(row.updated_at),
        deleted_at: asNullableString(row.deleted_at),
      }
    case 'budget_transactions':
      return {
        id: asString(row.id),
        user_id: asString(row.user_id),
        month: asString(row.month),
        category_id: asString(row.category_id),
        amount: roundMoney(asNumber(row.amount)),
        memo: asString(row.memo),
        created_at: asString(row.created_at),
        updated_at: asString(row.updated_at),
        deleted_at: asNullableString(row.deleted_at),
      }
    default:
      return assertNever(table)
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true
  const message = errorMessage(error).toLowerCase()
  return message.includes('failed to fetch') || message.includes('network')
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Sync failed'
}
