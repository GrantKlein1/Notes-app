import type { ReactNode } from 'react'

function Glyph({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function NoteIcon() {
  return (
    <Glyph>
      <path d="M7.5 3.75h6.4L18.25 8.1V19.5a1.25 1.25 0 0 1-1.25 1.25h-9.5A1.25 1.25 0 0 1 6.25 19.5v-14.5A1.25 1.25 0 0 1 7.5 3.75z" />
      <path d="M13.75 3.9V8.1h4.2" />
      <path d="M9 12.25h6" />
      <path d="M9 15.75h4" />
    </Glyph>
  )
}

export function BudgetIcon() {
  return (
    <Glyph>
      <rect x="3.5" y="6" width="17" height="12" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M7 14.5h4" />
    </Glyph>
  )
}

export function PrayerIcon() {
  return (
    <Glyph>
      <path d="M12 3.6c.5 2.1-1.1 3.2-1.1 5 0 1.2.7 2 1.1 2.6.4-.6 1.1-1.4 1.1-2.6 0-1.8-1.6-2.9-1.1-5z" />
      <path d="M8.3 11.4c-1.5 1.4-2.3 2.9-2.3 4.4A6 6 0 0 0 12 20.8a6 6 0 0 0 6-5c0-1.5-.8-3-2.3-4.4-1 .8-1.7 1.1-2.2 1.1-.6 0-1.4-.4-2.2-1.1z" />
    </Glyph>
  )
}

export function PlusIcon({ size = 24 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M12 5.25v13.5" />
      <path d="M5.25 12h13.5" />
    </Glyph>
  )
}

export function PersonIcon() {
  return (
    <Glyph>
      <circle cx="12" cy="8" r="3.1" />
      <path d="M5.4 19.2c1.3-3 3.5-4.5 6.6-4.5s5.3 1.5 6.6 4.5" />
    </Glyph>
  )
}

export function SearchIcon() {
  return (
    <Glyph size={18}>
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5 20 20" />
    </Glyph>
  )
}

export function PinIcon() {
  return (
    <Glyph size={14}>
      <path d="M9 4.25h6l-.9 5.6 2.15 1.9H7.75L9.9 9.85 9 4.25z" />
      <path d="M12 11.75V19.5" />
    </Glyph>
  )
}
