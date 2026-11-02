import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { AccountButton } from '../../components/AccountButton'
import { useUserId } from '../../components/AuthProvider'
import { PinIcon, PlusIcon, SearchIcon } from '../../components/Icons'
import { SyncLabel } from '../../components/SyncProvider'
import { db } from '../../data/db'
import { softDeleteNote } from '../../data/repository'
import { previewFromDoc } from '../../data/text'
import { formatWhen } from '../../data/time'
import type { NoteRow } from '../../data/types'

export function NotesPage() {
  const userId = useUserId()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const notes = useLiveQuery(async () => {
    const rows = await db.notes.where('user_id').equals(userId).toArray()
    return rows.filter((row) => row.type === 'note' && !row.deleted_at)
  }, [userId])

  const needle = query.trim().toLowerCase()
  const matched = (notes ?? []).filter((note) => {
    if (!needle) return true
    const preview = previewFromDoc(note.content, note.title)
    return `${note.title} ${preview}`.toLowerCase().includes(needle)
  })
  const pinned = needle ? [] : matched.filter((note) => note.pinned).sort(byRecent)
  const rest = (needle ? matched : matched.filter((note) => !note.pinned)).sort(byRecent)

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <h1 className="large-title">Notes</h1>
          <SyncLabel />
        </div>
        <div className="header-actions">
          <button type="button" className="icon-button" aria-label="New note" onClick={() => navigate('/notes/new')}>
            <PlusIcon />
          </button>
          <AccountButton />
        </div>
      </header>
      <label className="search">
        <SearchIcon />
        <input
          type="search"
          placeholder="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {notes === undefined ? null : matched.length === 0 ? (
        <p className="empty">{needle ? 'No matches' : 'No notes yet. Tap + to start one.'}</p>
      ) : (
        <>
          {pinned.length > 0 ? (
            <section>
              <h2 className="section-label">Pinned</h2>
              <NoteList notes={pinned} onOpen={(id) => navigate(`/notes/${id}`)} />
            </section>
          ) : null}
          {rest.length > 0 ? (
            <section>
              {pinned.length > 0 ? <h2 className="section-label">Notes</h2> : null}
              <NoteList notes={rest} onOpen={(id) => navigate(`/notes/${id}`)} />
            </section>
          ) : null}
        </>
      )}
    </main>
  )
}

function byRecent(a: NoteRow, b: NoteRow): number {
  return Date.parse(b.updated_at) - Date.parse(a.updated_at)
}

function NoteList({ notes, onOpen }: { notes: NoteRow[]; onOpen: (id: string) => void }) {
  return (
    <div className="note-list">
      {notes.map((note) => (
        <SwipeRow key={note.id} onOpen={() => onOpen(note.id)} onDelete={() => void softDeleteNote(note.id)}>
          <div className="note-title-line">
            <h2>{note.title || 'New note'}</h2>
            <time dateTime={note.updated_at}>{formatWhen(note.updated_at)}</time>
          </div>
          <p>
            {note.pinned ? <PinIcon /> : null}
            {previewFromDoc(note.content, note.title) || 'No additional text'}
          </p>
        </SwipeRow>
      ))}
    </div>
  )
}

function SwipeRow({
  children,
  onOpen,
  onDelete,
}: {
  children: ReactNode
  onOpen: () => void
  onDelete: () => void
}) {
  const [offset, setOffset] = useState(0)
  const start = useRef({ x: 0, y: 0, offset: 0 })
  const axis = useRef<'x' | 'y' | null>(null)

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    axis.current = null
    start.current = { x: event.clientX, y: event.clientY, offset }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const dx = event.clientX - start.current.x
    const dy = event.clientY - start.current.y
    if (!axis.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (axis.current !== 'x') return
    setOffset(Math.min(0, Math.max(-88, start.current.offset + dx)))
  }

  function onPointerUp() {
    if (axis.current === 'x') {
      setOffset((value) => (value < -44 ? -88 : 0))
      return
    }
    if (offset < -40) {
      setOffset(0)
      return
    }
    onOpen()
  }

  return (
    <div className="note-row">
      <button type="button" className="swipe-delete" onClick={onDelete}>
        Delete
      </button>
      <div
        className="note-row-main"
        role="button"
        tabIndex={0}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setOffset(0)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen()
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
