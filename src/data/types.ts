export type NoteType = 'note' | 'prayer'

export type TableName =
  | 'notes'
  | 'budget_categories'
  | 'budget_allocations'
  | 'budget_transactions'

export interface NoteRow {
  id: string
  user_id: string
  type: NoteType
  title: string
  content: Record<string, unknown>
  pinned: boolean
  updated_at: string
  deleted_at: string | null
}

export interface CategoryRow {
  id: string
  user_id: string
  name: string
  sort_order: number
  archived: boolean
  updated_at: string
  deleted_at: string | null
}

export interface AllocationRow {
  id: string
  user_id: string
  month: string
  category_id: string
  amount: number
  updated_at: string
  deleted_at: string | null
}

export interface TransactionRow {
  id: string
  user_id: string
  month: string
  category_id: string
  amount: number
  memo: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface OutboxRow {
  key: string
  table: TableName
  rowId: string
  attempts: number
  lastError?: string
}

export interface MetaRow {
  key: string
  value: string
}
