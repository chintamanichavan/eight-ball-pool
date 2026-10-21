// The sounds of the table, made in the browser. No audio files.
//
// A knock is a short burst of noise shaped by a filter. Its pitch sets what it
// sounds like (two balls click, a cushion thuds), and its loudness follows how
// hard the knock was.

interface Knock {
  /** Centre pitch of the filter, in hertz. */
  pitch: number
  /** How long the sound rings, in seconds. */
  ring: number
  /** How narrow the filter is: higher is more of a ping, lower more of a thud. */
  sharpness: number
}

const BALL: Knock = { pitch: 2600, ring: 0.035, sharpness: 9 }
const CUSHION: Knock = { pitch: 240, ring: 0.09, sharpness: 1.2 }
const POCKET: Knock = { pitch: 130, ring: 0.22, sharpness: 0.9 }
const CUE: Knock = { pitch: 1300, ring: 0.03, sharpness: 5 }

/** Closing speed, in metres per second, that plays at full volume. */
const LOUDEST = 5

export class Sounds {
  private context: AudioContext | null = null
  private noise: AudioBuffer | null = null
  muted = false

  /** Browsers only allow sound after the player has touched the page. */
  wake(): void {
    if (this.context) {
      void this.context.resume()
      return
    }
    const Context = window.AudioContext
    if (!Context) return
    this.context = new Context()
    const length = this.context.sampleRate / 2
    this.noise = this.context.createBuffer(1, length, this.context.sampleRate)
    const samples = this.noise.getChannelData(0)
    for (let i = 0; i < length; i++) samples[i] = Math.random() * 2 - 1
  }

  ballHit = (speed: number) => this.play(BALL, speed)
  cushionHit = (speed: number) => this.play(CUSHION, speed)
  pocketed = () => this.play(POCKET, LOUDEST * 0.7)
  cueHit = (speed: number) => this.play(CUE, speed)

  private play(knock: Knock, speed: number): void {
    const context = this.context
    if (!context || !this.noise || this.muted) return
    const volume = Math.min(1, Math.pow(speed / LOUDEST, 0.8))
    if (volume < 0.01) return

    const source = context.createBufferSource()
    source.buffer = this.noise
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = knock.pitch * (0.92 + Math.random() * 0.16) // no two knocks quite alike
    filter.Q.value = knock.sharpness
    const gain = context.createGain()
    const now = context.currentTime
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + knock.ring)

    source.connect(filter).connect(gain).connect(context.destination)
    source.start(now, Math.random() * 0.2)
    source.stop(now + knock.ring)
  }
}
