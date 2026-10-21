import type { Cue } from '../game/cues'
import type { Tip } from '../game/shot'
import { clampTip } from '../game/shot'
import './SpinPicker.css'

interface Props {
  tip: Tip
  cue: Cue
  onChange: (tip: Tip) => void
}

/** A picture of the cue ball. Press or drag on it to choose where the tip strikes. */
export function SpinPicker({ tip, cue, onChange }: Props) {
  const pick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.type !== 'pointerdown' && event.buttons === 0) return
    const box = event.currentTarget.getBoundingClientRect()
    const side = ((event.clientX - box.left) / box.width) * 2 - 1
    const height = 1 - ((event.clientY - box.top) / box.height) * 2
    onChange(clampTip(side, height, cue))
  }

  return (
    <div className="spin">
      <div
        className="spin__ball"
        role="img"
        aria-label={describe(tip)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          pick(event)
        }}
        onPointerMove={pick}
        onDoubleClick={() => onChange({ side: 0, height: 0 })}
      >
        <span className="spin__reach" style={{ inset: `${(1 - cue.maxTip) * 50}%` }} />
        <span className="spin__tip" style={{ left: `${50 + tip.side * 50}%`, top: `${50 - tip.height * 50}%` }} />
      </div>
      <div>
        <p className="control__name">Spin</p>
        <p className="control__hint">{describe(tip)}</p>
      </div>
    </div>
  )
}

/** The strike point in a player's words. */
export function describe(tip: Tip): string {
  const near = 0.08
  const high = tip.height > near ? 'follow' : tip.height < -near ? 'draw' : ''
  const side = tip.side > near ? 'right' : tip.side < -near ? 'left' : ''
  if (!high && !side) return 'Centre ball'
  return [high && (high === 'follow' ? 'High: follow' : 'Low: draw'), side && `${side} side`].filter(Boolean).join(', ')
}
