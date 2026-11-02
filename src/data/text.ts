export function prayerText(content: Record<string, unknown>): string {
  return typeof content.text === 'string' ? content.text : ''
}

function appendNode(node: unknown, chunks: string[]): void {
  if (!node || typeof node !== 'object') return
  const record = node as Record<string, unknown>
  if (typeof record.text === 'string') chunks.push(record.text)
  if (!Array.isArray(record.content)) return
  for (const child of record.content) appendNode(child, chunks)
}

export function plainTextFromDoc(content: Record<string, unknown>): string {
  const chunks: string[] = []
  if (Array.isArray(content.content)) {
    for (const block of content.content) {
      appendNode(block, chunks)
      chunks.push('\n')
    }
  } else {
    appendNode(content, chunks)
  }
  return chunks.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function titleFromDoc(content: Record<string, unknown>): string {
  const line = plainTextFromDoc(content)
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean)
  return (line ?? '').slice(0, 80) || 'New note'
}

export function previewFromDoc(content: Record<string, unknown>, title: string): string {
  const lines = plainTextFromDoc(content)
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
  const body = (lines[0] === title ? lines.slice(1) : lines).join(' ')
  return body.slice(0, 160)
}
