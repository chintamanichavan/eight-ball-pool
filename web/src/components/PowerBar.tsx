import { useRef } from 'react'
import { powerFromPull } from '../game/shot'
import './PowerBar.css'

interface Props {
  /** 0 to 1, from wherever the cue is being pulled. */
  power: number
  disabled: boolean
  onPull: (power: number) => void
  /** The player let go. */
  onRelease: () => void
}

/** Pixels of drag along the bar for a full pull. */
const FULL_DRAG = 220

/**
 * A second way to pull the cue, for touch screens: drag along the bar and let
 * go to shoot. It also shows the power when the cue is pulled on the table.
 */
export function PowerBar({ power, disabled, onPull, onRelease }: Props) {
  const startX = useRef<number | null>(null)

  return (
    <div className="power">
      <div>
        <p className="control__name">Power</p>
        <p className="control__hint">{Math.round(power * 100)}%</p>
      </div>
      <div
        className={`power__track ${disabled ? 'power__track--off' : ''}`}
        role="slider"
        aria-label="Power"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(power * 100)}
        aria-disabled={disabled}
        tabIndex={-1}
        onPointerDown={(event) => {
          if (disabled) return
          event.currentTarget.setPointerCapture(event.pointerId)
          startX.current = event.clientX
        }}
        onPointerMove={(event) => {
          if (startX.current === null) return
          onPull(powerFromPull(event.clientX - startX.current, FULL_DRAG))
        }}
        onPointerUp={() => {
          if (startX.current === null) return
          startX.current = null
          onRelease()
        }}
        onPointerCancel={() => {
          startX.current = null
          onPull(0)
        }}
      >
        <span className="power__fill" style={{ width: `${power * 100}%` }} />
      </div>
    </div>
  )
}
