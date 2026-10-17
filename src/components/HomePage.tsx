import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearPhoto, loadPhoto, readDeskPhoto, savePhoto, type DeskPhoto } from '../photo'
import { writeSetup } from '../query'
import { money, recommend } from '../recommend'
import { SetupScene } from '../scene/SetupScene'
import type { CaseSize, LookPref, NoisePref } from '../types'
import { Brand } from './Brand'

const BUDGETS = [800, 1000, 1200, 1500, 2000, 2500]
const GAMES = ['Elden Ring', 'Valorant', 'Cyberpunk 2077', 'Fortnite', '1080p competitive', '4K']

export function HomePage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [budget, setBudget] = useState('1200')
  const [games, setGames] = useState('')
  const [caseSize, setCaseSize] = useState<CaseSize>('normal')
  const [noise, setNoise] = useState<NoisePref>('unrestricted')
  const [look, setLook] = useState<LookPref>('plain')
  const [photo, setPhoto] = useState<DeskPhoto | null>(() => loadPhoto())
  const [photoError, setPhotoError] = useState('')
  const [formError, setFormError] = useState('')
  const [reading, setReading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const budgetNum = Number(budget)
  const budgetOk = Number.isFinite(budgetNum) && budgetNum > 0
  const preview = useMemo(
    () =>
      recommend(
        {
          budget: budgetOk ? budgetNum : 1200,
          games: games.trim() || 'Elden Ring',
          prefs: { caseSize, noise, look },
          variant: noise === 'quiet' ? 'quiet' : 'balanced',
        },
        {},
        Boolean(photo),
      ),
    [budgetNum, budgetOk, games, caseSize, noise, look, photo],
  )

  async function take(file: File) {
    if (!file.type.startsWith('image/')) {
      setPhotoError('Use a photo — JPG, PNG, or WebP.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setPhotoError('That photo is over 20MB. A smaller one works, and you can continue without it.')
      return
    }
    setReading(true)
    setPhotoError('')
    try {
      const url = await readDeskPhoto(file)
      const next = { url, name: file.name }
      setPhoto(next)
      if (!savePhoto(next)) {
        setPhotoError('This browser could not keep the photo. It will still show until you leave the tab.')
      }
    } catch {
      setPhotoError('This photo did not load. The neutral desk still works.')
    } finally {
      setReading(false)
    }
  }

  function addGame(name: string) {
    setGames((current) => {
      if (!current.trim()) return name
      if (current.toLowerCase().includes(name.toLowerCase())) return current
      return `${current.trim()}, ${name}`
    })
    setFormError('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!budgetOk) {
      setFormError('Enter a budget.')
      return
    }
    if (!games.trim()) {
      setFormError('Name a game, or a resolution like 1440p.')
      return
    }
    const dropped = Boolean(photo) && !savePhoto(photo as DeskPhoto)
    const search = writeSetup(
      {
        budget: budgetNum,
        games: games.trim(),
        prefs: { caseSize, noise, look },
        variant: noise === 'quiet' ? 'quiet' : 'balanced',
      },
      {},
      dropped ? { photo: 'dropped' } : undefined,
    )
    navigate(`/build?${search}`)
  }

  const sample = !games.trim()

  return (
    <div className="home">
      <header className="home-bar">
        <Brand />
        <span className="demo-pill">Demo</span>
      </header>

      <p className="eyebrow">For a first gaming PC</p>
      <h1>See it on your desk before you buy the parts.</h1>
      <p className="lede">
        Name a budget and the games. Get a build that fits together, then place the tower, monitor,
        keyboard, mouse, and headset in the space. The photo is the stage. The parts come from a
        checked catalog.
      </p>

      <div className="home-grid">
        <form className="card" onSubmit={submit}>
          <label htmlFor="desk-photo">Photo of the desk</label>
          <div
            className={dragOver ? 'drop is-over' : 'drop'}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              const file = event.dataTransfer.files[0]
              if (file) void take(file)
            }}
          >
            {photo ? (
              <img src={photo.url} alt="" />
            ) : (
              <span className="drop-copy">
                Drop a photo of the empty desk, or skip it. Without a photo, the build sits on a
                neutral desk.
              </span>
            )}
            <div className="drop-actions">
              <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
                {reading ? 'Reading…' : photo ? 'Replace photo' : 'Upload photo'}
              </button>
              {photo && (
                <button
                  type="button"
                  className="texty"
                  onClick={() => {
                    setPhoto(null)
                    clearPhoto()
                    setPhotoError('')
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <input
            id="desk-photo"
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void take(file)
              event.target.value = ''
            }}
          />
          {photoError && <p className="error">{photoError}</p>}
          <p className="hint">The photo stays in this browser. It is the backdrop, not a model of the room.</p>

          <label htmlFor="budget">Budget</label>
          <div className="presets">
            {BUDGETS.map((amount) => (
              <button
                key={amount}
                type="button"
                className={budgetNum === amount ? 'is-on' : ''}
                onClick={() => {
                  setBudget(String(amount))
                  setFormError('')
                }}
              >
                {money(amount)}
              </button>
            ))}
          </div>
          <div className="budget-field">
            <span>$</span>
            <input
              id="budget"
              inputMode="numeric"
              value={budget}
              onChange={(event) => {
                setBudget(event.target.value.replace(/[^\d]/g, ''))
                setFormError('')
              }}
            />
          </div>

          <label htmlFor="games">Games, or resolution</label>
          <input
            id="games"
            value={games}
            placeholder="Elden Ring, or 1440p"
            onChange={(event) => {
              setGames(event.target.value)
              setFormError('')
            }}
          />
          <div className="presets wrap">
            {GAMES.map((game) => (
              <button key={game} type="button" onClick={() => addGame(game)}>
                {game}
              </button>
            ))}
          </div>

          <fieldset>
            <legend>Case</legend>
            <Segment
              value={caseSize}
              options={[
                ['small', 'Small'],
                ['normal', 'Normal'],
                ['large', 'Large'],
              ]}
              onChange={setCaseSize}
            />
          </fieldset>
          <fieldset>
            <legend>Noise</legend>
            <Segment
              value={noise}
              options={[
                ['unrestricted', 'Unrestricted'],
                ['quiet', 'Quiet'],
              ]}
              onChange={setNoise}
            />
          </fieldset>
          <fieldset>
            <legend>Look</legend>
            <Segment
              value={look}
              options={[
                ['plain', 'Plain'],
                ['rgb', 'RGB'],
              ]}
              onChange={setLook}
            />
          </fieldset>

          {formError && <p className="error">{formError}</p>}
          <button className="primary" type="submit" disabled={reading}>
            Show me the build
          </button>
          <p className="hint">You pay nothing here. A part link is a referral.</p>
        </form>

        <aside className="preview-card">
          <div className="preview-top">
            <p>{sample ? 'Sample scene' : 'Preview'}</p>
            <p>
              {preview.variantLabel} · {money(preview.total)}
              {preview.overBudget ? ` · ${money(Math.abs(preview.remainder))} over` : ` · ${money(preview.remainder)} left`}
            </p>
          </div>
          <div
            className={photo ? 'preview-stage has-photo' : 'preview-stage studio'}
            style={photo ? { backgroundImage: `url(${photo.url})` } : undefined}
          >
            <SetupScene
              parts={preview.parts}
              active={null}
              hidden={[]}
              side="right"
              dragX={null}
              hand="right"
              studio={!photo}
              preview
              reducedMotion={reducedMotion}
            />
          </div>
          <p className="preview-foot">
            {sample
              ? 'A $1,200 story build on the neutral desk. Drag to look around. This is not your list until you ask.'
              : preview.blurb}
          </p>
        </aside>
      </div>
    </div>
  )
}

function Segment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<[T, string]>
  onChange: (value: T) => void
}) {
  return (
    <div className="segment" role="radiogroup">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={value === option ? 'is-on' : ''}
          onClick={() => onChange(option)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
