import { Component, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthProvider'
import { AuthScreen } from './components/AuthScreen'
import { FocusProvider, useFocusMode } from './components/FocusMode'
import { SyncProvider } from './components/SyncProvider'
import { TabBar } from './components/TabBar'
import { BudgetPage } from './features/budget/BudgetPage'
import { BudgetSetup } from './features/budget/BudgetSetup'
import { CategoryHistory } from './features/budget/CategoryHistory'
import { QuickSpend } from './features/budget/QuickSpend'
import { NoteEditor } from './features/notes/NoteEditor'
import { NotesPage } from './features/notes/NotesPage'
import { PrayerPage } from './features/prayer/PrayerPage'

interface BoundaryState {
  message: string | null
}

class ErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { message: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { message: error instanceof Error ? error.message : 'Something went wrong' }
  }

  render() {
    if (this.state.message) {
      return (
        <div className="boot">
          <p>{this.state.message}</p>
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function Shell() {
  const { active } = useFocusMode()
  const location = useLocation()
  const hideTabs =
    active ||
    location.pathname.startsWith('/notes/') ||
    location.pathname.startsWith('/budget/spend') ||
    location.pathname.startsWith('/budget/category/')
  return (
    <>
      <div className="statusbar-blend" />
      <Outlet />
      {hideTabs ? null : <TabBar />}
    </>
  )
}

function SignedIn() {
  const auth = useAuth()
  if (auth.loading) return <div className="boot">Notes</div>
  if (!auth.configured || !auth.session) return <AuthScreen />
  return (
    <SyncProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<NotesPage />} />
          <Route path="/notes/new" element={<NoteEditor />} />
          <Route path="/notes/:noteId" element={<NoteEditor />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/budget/setup" element={<BudgetSetup />} />
          <Route path="/budget/spend" element={<QuickSpend />} />
          <Route path="/budget/category/:categoryId" element={<CategoryHistory />} />
          <Route path="/prayer" element={<PrayerPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SyncProvider>
  )
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <FocusProvider>
          <AuthProvider>
            <SignedIn />
          </AuthProvider>
        </FocusProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
