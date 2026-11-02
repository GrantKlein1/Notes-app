import { db } from './db'
import type { TableName } from './types'

export async function markDirty(table: TableName, rowId: string): Promise<void> {
  await db.outbox.put({
    key: `${table}:${rowId}`,
    table,
    rowId,
    attempts: 0,
  })
}
