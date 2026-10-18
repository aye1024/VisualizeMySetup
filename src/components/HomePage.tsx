import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearPhoto, loadPhoto, readDeskPhoto, savePhoto, type DeskPhoto } from '../photo'
import { writeSetup } from '../query'
import { referralUrl } from '../catalog'
import { money, recommend } from '../recommend'
import { parseSpecs } from '../specs'
import { SetupScene } from '../scene/SetupScene'
import type { Category } from '../types'
import { Brand } from './Brand'

export function HomePage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [budget, setBudget] = useState('1200')
  const [specs, setSpecs] = useState('')
  const [photo, setPhoto] = useState<DeskPhoto | null>(() => loadPhoto())
  const [photoError, setPhotoError] = useState('')
  const [formError, setFormError] = useState('')
  const [reading, setReading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [picked, setPicked] = useState<Category | null>(null)
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const budgetNum = Number(budget)
  const budgetOk = Number.isFinite(budgetNum) && budgetNum > 0
  const parsed = useMemo(() => parseSpecs(specs), [specs])
  const described = specs.trim()
  const preview = useMemo(
    () =>
      recommend(
        {
          budget: budgetOk ? budgetNum : 1200,
          games: described || 'Elden Ring',
          prefs: parsed.prefs,
          variant: described ? parsed.variant : 'balanced',
        },
        {},
        Boolean(photo),
      ),
    [budgetNum, budgetOk, described, parsed, photo],
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

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!budgetOk) {
      setFormError('Enter a budget.')
      return
    }
    if (!described) {
      setFormError('Name a game, a resolution, or how you want the build.')
      return
    }
    const dropped = Boolean(photo) && !savePhoto(photo as DeskPhoto)
    const search = writeSetup(
      {
        budget: budgetNum,
        games: described,
        prefs: parsed.prefs,
        variant: parsed.variant,
      },
      {},
      dropped ? { photo: 'dropped' } : undefined,
    )
    navigate(`/build?${search}`)
  }

  const sample = !described
  const pickedPart = picked ? preview.parts.find((part) => part.category === picked) : undefined

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

          <label htmlFor="specs">Specifications</label>
          <textarea
            id="specs"
            value={specs}
            placeholder="Elden Ring, 1440p, quiet, small case, no RGB"
            onChange={(event) => {
              setSpecs(event.target.value)
              setFormError('')
            }}
          />

          {formError && <p className="error">{formError}</p>}
          <button className="primary" type="submit" disabled={reading}>
            Show me the build
          </button>
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
              active={picked}
              hidden={[]}
              side="right"
              hand="right"
              studio={!photo}
              preview
              reducedMotion={reducedMotion}
              onSelect={setPicked}
            />
          </div>
          <p className="preview-foot">
            {pickedPart ? (
              <>
                {pickedPart.name} · {money(pickedPart.price)} ·{' '}
                <a href={referralUrl(pickedPart)} target="_blank" rel="noreferrer">
                  View to buy
                </a>
              </>
            ) : sample ? (
              'A $1,200 story build on the neutral desk. Click a part for its name, price, and buy link.'
            ) : (
              preview.blurb
            )}
          </p>
        </aside>
      </div>
    </div>
  )
}
