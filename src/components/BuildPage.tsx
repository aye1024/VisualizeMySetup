import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadPhoto } from '../photo'
import { readSetup, readSwaps, writeSetup } from '../query'
import { referralUrl } from '../catalog'
import { money, recommend } from '../recommend'
import { SetupScene, type Hand, type HideKey, type SceneHandle } from '../scene/SetupScene'
import type { Category, Variant } from '../types'
import { Brand } from './Brand'
import { PartsPanel } from './PartsPanel'

const HIDES: Array<{ key: HideKey; label: string }> = [
  { key: 'case', label: 'Tower' },
  { key: 'monitor', label: 'Monitor' },
  { key: 'keyboard', label: 'Keyboard' },
  { key: 'mouse', label: 'Mouse' },
  { key: 'headset', label: 'Headset' },
]

export function BuildPage() {
  const [params, setParams] = useSearchParams()
  const search = params.toString()
  const input = useMemo(() => readSetup(search), [search])
  const swaps = useMemo(() => readSwaps(search), [search])
  const photo = useMemo(() => loadPhoto(), [])
  const dropped = params.get('photo') === 'dropped'
  const build = useMemo(
    () => recommend(input, swaps, Boolean(photo) && !dropped),
    [input, swaps, photo, dropped],
  )
  const scene = useRef<SceneHandle>(null)
  const links = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<Category>('gpu')
  const [hover, setHover] = useState<Category | null>(null)
  const [hidden, setHidden] = useState<HideKey[]>([])
  const [side, setSide] = useState<'left' | 'right'>('right')
  const [dragX, setDragX] = useState<number | null>(null)
  const [hand, setHand] = useState<Hand>('right')
  const [toast, setToast] = useState('')
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    document.title = `${build.variantLabel} · VisualizeMySetup`
    return () => {
      document.title = 'VisualizeMySetup'
    }
  }, [build.variantLabel])

  useEffect(() => {
    document.getElementById(`part-${selected}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  function setVariant(variant: Variant) {
    const next = writeSetup({ ...input, variant })
    setParams(new URLSearchParams(next), { replace: true })
  }

  function swap(category: Category, id: string) {
    const nextSwaps = { ...swaps, [category]: id }
    setParams(new URLSearchParams(writeSetup(input, nextSwaps)), { replace: true })
    setSelected(category)
  }

  async function share() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setToast(photo ? 'Link copied. The photo stays in this browser.' : 'Link copied.')
    } catch {
      setToast(url)
    }
  }

  function toggleHide(key: HideKey) {
    setHidden((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]))
  }

  const showPhoto = Boolean(photo) && !dropped

  return (
    <div className="build">
      <header className="topbar">
        <Brand />
        <p className="top-meta">
          {money(input.budget)} budget
          <span>{input.games}</span>
        </p>
        <div className="top-actions">
          <button type="button" className="ghost" onClick={() => void share()}>
            Copy link
          </button>
          <Link to="/" className="ghost linkish">
            New setup
          </Link>
        </div>
      </header>

      <div className="workspace">
        <section className={showPhoto ? 'stage has-photo' : 'stage studio'} aria-label="Desk scene">
          {showPhoto && photo && (
            <div className="photo-bg" style={{ backgroundImage: `url(${photo.url})` }} />
          )}
          <div className="scrim" />
          <div className="viewport">
            <SetupScene
              ref={scene}
              parts={build.parts}
              active={hover ?? selected}
              hidden={hidden}
              side={side}
              dragX={dragX}
              hand={hand}
              studio={!showPhoto}
              reducedMotion={reducedMotion}
              onSelect={setSelected}
              onHover={setHover}
              onSide={(next) => {
                setSide(next)
                setDragX(null)
              }}
              onDragX={setDragX}
            />
          </div>
          <div className="stage-ui">
            <p className="desk-note">{dropped ? 'The photo could not be kept in this browser. This is the neutral desk.' : build.deskNote}</p>
            <div className="controls">
              <button type="button" onClick={() => scene.current?.nudge('rot')}>
                Rotate
              </button>
              <button type="button" onClick={() => scene.current?.nudge('in')}>
                Zoom in
              </button>
              <button type="button" onClick={() => scene.current?.nudge('out')}>
                Zoom out
              </button>
              <button type="button" onClick={() => scene.current?.nudge('reset')}>
                Reset view
              </button>
              <button
                type="button"
                onClick={() => {
                  setSide('left')
                  setDragX(null)
                }}
              >
                Tower left
              </button>
              <button
                type="button"
                onClick={() => {
                  setSide('right')
                  setDragX(null)
                }}
              >
                Tower right
              </button>
              <button type="button" onClick={() => setHand((current) => (current === 'right' ? 'left' : 'right'))}>
                Mouse {hand}
              </button>
              {HIDES.map((item) => {
                const off = hidden.includes(item.key)
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={!off}
                    className={off ? 'is-off' : ''}
                    onClick={() => toggleHide(item.key)}
                  >
                    {off ? `Show ${item.label.toLowerCase()}` : item.label}
                  </button>
                )
              })}
            </div>
            <p className="drag-hint">Drag to look. Drag the tower sideways, or click the desk to pick a side.</p>
          </div>
        </section>

        <PartsPanel
          build={build}
          input={input}
          selected={selected}
          onSelect={setSelected}
          onHover={setHover}
          onVariant={setVariant}
          onSwap={swap}
          onOpenLinks={() => links.current?.showModal()}
        />
      </div>

      <dialog
        ref={links}
        className="sheet"
        onClick={(event) => {
          if (event.target === links.current) links.current?.close()
        }}
      >
        <div className="sheet-body">
          <h2>Buy these parts</h2>
          <p>
            Each link opens a demo search. A live affiliate tag is not connected. You pay the store. We
            are paid only if you complete the purchase, and electronics referrals are often only a few
            percent — on a build like this, on the order of a few tens of dollars.
          </p>
          <ul>
            {build.parts.map((part) => (
              <li key={part.id}>
                {part.price > 0 ? (
                  <a href={referralUrl(part)} target="_blank" rel="noreferrer noopener">
                    {part.name}
                  </a>
                ) : (
                  <span>{part.name}</span>
                )}
                <em>{money(part.price)}</em>
              </li>
            ))}
          </ul>
          <p className="sheet-total">
            Total {money(build.total)}
            {build.overBudget
              ? ` · ${money(Math.abs(build.remainder))} over ${money(input.budget)}`
              : ` · ${money(build.remainder)} left of ${money(input.budget)}`}
          </p>
          <button type="button" className="primary" onClick={() => links.current?.close()}>
            Close
          </button>
        </div>
      </dialog>

      {toast && <p className="toast">{toast}</p>}
    </div>
  )
}
