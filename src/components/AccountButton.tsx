import { useState } from 'react'
import { useAuth } from './AuthProvider'
import { PersonIcon } from './Icons'
import { Sheet } from './Sheet'

export function AccountButton() {
  const { email, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="icon-button" aria-label="Account" onClick={() => setOpen(true)}>
        <PersonIcon />
      </button>
      <Sheet title="Account" open={open} onClose={() => setOpen(false)}>
        <p className="muted">{email}</p>
        <button type="button" className="primary danger" onClick={() => void signOut()}>
          Sign out
        </button>
      </Sheet>
    </>
  )
}
