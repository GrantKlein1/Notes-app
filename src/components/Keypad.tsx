const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const

export function Keypad({
  onDigit,
  onBackspace,
}: {
  onDigit: (digit: string) => void
  onBackspace: () => void
}) {
  return (
    <div className="keypad">
      {KEYS.map((key) => {
        if (key === '') return <span key="gap" />
        if (key === 'back') {
          return (
            <button key="back" type="button" className="key" aria-label="Delete digit" onClick={onBackspace}>
              ⌫
            </button>
          )
        }
        return (
          <button key={key} type="button" className="key" onClick={() => onDigit(key)}>
            {key}
          </button>
        )
      })}
    </div>
  )
}

export function appendDigit(current: string, digit: string): string {
  const next = `${current}${digit}`.replace(/^0+(?=\d)/, '')
  return next.length > 8 ? current : next
}
