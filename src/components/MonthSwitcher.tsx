import { addMonths, formatMonth } from '../data/time'

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="month-switch">
      <button type="button" aria-label="Previous month" onClick={() => onChange(addMonths(month, -1))}>
        ‹
      </button>
      <label className="month-label">
        <span>{formatMonth(month)}</span>
        <input
          type="month"
          value={month}
          aria-label="Choose month"
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value)
          }}
        />
      </label>
      <button type="button" aria-label="Next month" onClick={() => onChange(addMonths(month, 1))}>
        ›
      </button>
    </div>
  )
}
