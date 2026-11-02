import { useState } from 'react'
import { Sheet } from '../../components/Sheet'

type Operator = '+' | '−' | '×' | '÷'

function formatResult(value: number): string {
  if (!Number.isFinite(value)) return 'Error'
  const rounded = Math.round(value * 1e8) / 1e8
  return String(rounded)
}

function compute(left: number, operator: Operator, right: number): number | null {
  if (operator === '+') return left + right
  if (operator === '−') return left - right
  if (operator === '×') return left * right
  if (right === 0) return null
  return left / right
}

export function CalculatorButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="text-button" onClick={() => setOpen(true)}>
        Calculator
      </button>
      <Sheet title="Calculator" open={open} onClose={() => setOpen(false)}>
        <Calculator />
      </Sheet>
    </>
  )
}

function Calculator() {
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState<number | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [fresh, setFresh] = useState(true)

  function enterDigit(digit: string) {
    setDisplay((current) => {
      if (fresh || current === 'Error') return digit
      if (current === '0') return digit
      if (current.replace('-', '').replace('.', '').length >= 12) return current
      return `${current}${digit}`
    })
    setFresh(false)
  }

  function enterDot() {
    setDisplay((current) => {
      if (fresh || current === 'Error') return '0.'
      if (current.includes('.')) return current
      return `${current}.`
    })
    setFresh(false)
  }

  function chooseOperator(next: Operator) {
    if (display === 'Error') return
    const value = Number(display)
    if (stored !== null && operator && !fresh) {
      const result = compute(stored, operator, value)
      if (result === null) {
        setDisplay('Error')
        setStored(null)
        setOperator(null)
        setFresh(true)
        return
      }
      setDisplay(formatResult(result))
      setStored(result)
    } else {
      setStored(value)
    }
    setOperator(next)
    setFresh(true)
  }

  function equals() {
    if (stored === null || !operator || display === 'Error') return
    const result = compute(stored, operator, Number(display))
    if (result === null) {
      setDisplay('Error')
      setStored(null)
      setOperator(null)
      setFresh(true)
      return
    }
    setDisplay(formatResult(result))
    setStored(null)
    setOperator(null)
    setFresh(true)
  }

  function clear() {
    setDisplay('0')
    setStored(null)
    setOperator(null)
    setFresh(true)
  }

  const keys: Array<{ label: string; onPress: () => void; tone?: 'op' | 'go' }> = [
    { label: 'C', onPress: clear },
    { label: '÷', onPress: () => chooseOperator('÷'), tone: 'op' },
    { label: '×', onPress: () => chooseOperator('×'), tone: 'op' },
    { label: '−', onPress: () => chooseOperator('−'), tone: 'op' },
    { label: '7', onPress: () => enterDigit('7') },
    { label: '8', onPress: () => enterDigit('8') },
    { label: '9', onPress: () => enterDigit('9') },
    { label: '+', onPress: () => chooseOperator('+'), tone: 'op' },
    { label: '4', onPress: () => enterDigit('4') },
    { label: '5', onPress: () => enterDigit('5') },
    { label: '6', onPress: () => enterDigit('6') },
    { label: '=', onPress: equals, tone: 'go' },
    { label: '1', onPress: () => enterDigit('1') },
    { label: '2', onPress: () => enterDigit('2') },
    { label: '3', onPress: () => enterDigit('3') },
    { label: '0', onPress: () => enterDigit('0') },
    { label: '.', onPress: enterDot },
  ]

  return (
    <div className="calc">
      <p className="calc-display" aria-live="polite">
        {display}
      </p>
      <div className="calc-keys">
        {keys.map((key) => (
          <button
            key={key.label}
            type="button"
            className={['calc-key', key.tone ?? '', key.label === '0' ? 'wide' : ''].filter(Boolean).join(' ')}
            onClick={key.onPress}
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  )
}
