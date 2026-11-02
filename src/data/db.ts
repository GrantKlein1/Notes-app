import Dexie, { type Table } from 'dexie'
import type { AllocationRow, CategoryRow, MetaRow, NoteRow, OutboxRow, TransactionRow } from './types'

export class NotesDB extends Dexie {
  notes!: Table<NoteRow, string>
  budget_categories!: Table<CategoryRow, string>
  budget_allocations!: Table<AllocationRow, string>
  budget_transactions!: Table<TransactionRow, string>
  outbox!: Table<OutboxRow, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('notes-app')
    this.version(1).stores({
      notes: 'id, user_id, type, updated_at',
      budget_categories: 'id, user_id, sort_order',
      budget_allocations: 'id, user_id, month, category_id',
      budget_transactions: 'id, user_id, month, category_id, created_at',
      outbox: 'key, table, rowId',
      meta: 'key',
    })
  }
}

export const db = new NotesDB()
