import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useUserId } from '../../components/AuthProvider'
import { db } from '../../data/db'
import {
  createNote,
  discardNoteIfEmpty,
  saveNoteContent,
  setNotePinned,
  softDeleteNote,
} from '../../data/repository'
import { plainTextFromDoc } from '../../data/text'
import type { NoteRow } from '../../data/types'

const EMPTY_DOC: Record<string, unknown> = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

export function NoteEditor() {
  const { noteId } = useParams()
  const isNew = !noteId || noteId === 'new'
  const [note, setNote] = useState<NoteRow | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (isNew) return
    let cancel = false
    void db.notes.get(noteId).then((row) => {
      if (cancel) return
      if (!row || row.deleted_at || row.type !== 'note') setMissing(true)
      else setNote(row)
    })
    return () => {
      cancel = true
    }
  }, [isNew, noteId])

  if (!isNew && !note && !missing) return <div className="screen no-tabs" />
  if (missing) {
    return (
      <main className="screen no-tabs">
        <header className="topbar">
          <Link to="/" className="back-link">
            ‹ Notes
          </Link>
        </header>
        <p className="empty">This note is gone.</p>
      </main>
    )
  }

  return <EditorBody initial={note} />
}

function EditorBody({ initial }: { initial: NoteRow | null }) {
  const userId = useUserId()
  const navigate = useNavigate()
  const [pinned, setPinned] = useState(initial?.pinned ?? false)
  const [, setTick] = useState(0)
  const latest = useRef<Record<string, unknown>>(initial?.content ?? EMPTY_DOC)
  const idRef = useRef<string | null>(initial?.id ?? null)
  const pinnedRef = useRef(pinned)
  const timer = useRef<number | null>(null)
  const pending = useRef<Promise<void> | null>(null)
  pinnedRef.current = pinned

  async function flush(replaceUrl: boolean): Promise<void> {
    const previous = pending.current ?? Promise.resolve()
    const next = previous.then(() => write(replaceUrl))
    pending.current = next
    try {
      await next
    } finally {
      if (pending.current === next) pending.current = null
    }
  }

  async function write(replaceUrl: boolean): Promise<void> {
    const content = latest.current
    const text = plainTextFromDoc(content).trim()
    if (!idRef.current) {
      if (!text) return
      const row = await createNote(userId, content, pinnedRef.current)
      idRef.current = row.id
      if (replaceUrl) navigate(`/notes/${row.id}`, { replace: true })
      return
    }
    await saveNoteContent(idRef.current, content, pinnedRef.current)
  }

  function schedule(content: Record<string, unknown>) {
    latest.current = content
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      void flush(true)
    }, 500)
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Start writing' }),
    ],
    content: (initial?.content ?? EMPTY_DOC) as JSONContent,
    editorProps: {
      attributes: { class: 'note-body', spellcheck: 'true' },
    },
    onUpdate: ({ editor: current }) => {
      schedule(current.getJSON() as unknown as Record<string, unknown>)
      setTick((value) => value + 1)
    },
    onSelectionUpdate: () => setTick((value) => value + 1),
  })

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => {
      const overlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      document.documentElement.style.setProperty('--keyboard', `${overlap}px`)
    }
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    update()
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      document.documentElement.style.setProperty('--keyboard', '0px')
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      void flush(false).then(async () => {
        const id = idRef.current
        if (id) await discardNoteIfEmpty(id)
      })
    }
    // Flush once when leaving the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function togglePin() {
    const next = !pinnedRef.current
    setPinned(next)
    pinnedRef.current = next
    const id = idRef.current
    if (id) await setNotePinned(id, next)
  }

  async function remove() {
    if (timer.current) window.clearTimeout(timer.current)
    const id = idRef.current
    if (id) await softDeleteNote(id)
    idRef.current = null
    navigate('/')
  }

  if (!editor) return <div className="screen no-tabs" />

  return (
    <main className="screen no-tabs editor-screen">
      <header className="topbar editor-top">
        <Link to="/" className="back-link">
          ‹ Notes
        </Link>
        <div className="header-actions">
          <button type="button" className={pinned ? 'text-button on' : 'text-button'} onClick={() => void togglePin()}>
            {pinned ? 'Unpin' : 'Pin'}
          </button>
          <button type="button" className="text-button danger" onClick={() => void remove()}>
            Delete
          </button>
        </div>
      </header>
      <EditorContent editor={editor} />
      <div className="format-bar" role="toolbar" aria-label="Formatting">
        <ToolButton
          label="H1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolButton
          label="H2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolButton
          label="•"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolButton
          label="1."
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolButton
          label="☑"
          active={editor.isActive('taskList')}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        />
        <ToolButton
          label="B"
          className="bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolButton
          label="I"
          className="italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
      </div>
    </main>
  )
}

function ToolButton({
  label,
  active,
  onClick,
  className,
}: {
  label: string
  active: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={active ? `tool on ${className ?? ''}` : `tool ${className ?? ''}`}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
