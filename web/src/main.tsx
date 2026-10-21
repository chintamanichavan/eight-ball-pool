import '@fontsource-variable/geist'
import '@fontsource-variable/newsreader'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { loadEngine } from './engine/engine'
import { CUES } from './game/cues'
import { CITIES } from './game/ladder'
import './styles/tokens.css'
import './styles/base.css'

function loadPicture(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const picture = new Image()
    picture.onload = () => resolve(picture)
    picture.onerror = () => reject(new Error(`could not load ${src}`))
    picture.src = src
  })
}

const [engine, tablePictures, cuePictures] = await Promise.all([
  loadEngine(),
  Promise.all(CITIES.map((city) => loadPicture(`/art/table-${city.id}.webp`))),
  Promise.all(CUES.map((cue) => loadPicture(`/art/cue-${cue.id}.webp`))),
])
const tables = Object.fromEntries(CITIES.map((city, i) => [city.id, tablePictures[i]!]))
const cues = Object.fromEntries(CUES.map((cue, i) => [cue.id, cuePictures[i]!]))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App engine={engine} art={{ tables, cues }} />
  </StrictMode>,
)
