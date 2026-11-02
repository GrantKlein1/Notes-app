import { NavLink } from 'react-router-dom'
import { BudgetIcon, NoteIcon, PrayerIcon } from './Icons'

const TABS = [
  { to: '/', label: 'Notes', icon: <NoteIcon />, end: true },
  { to: '/budget', label: 'Budget', icon: <BudgetIcon />, end: false },
  { to: '/prayer', label: 'Prayer', icon: <PrayerIcon />, end: true },
] as const

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => (isActive ? 'tab on' : 'tab')}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
