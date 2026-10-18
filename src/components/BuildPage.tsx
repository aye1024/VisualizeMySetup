import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadPhoto } from '../photo'
import { readSetup, readSwaps, writeSetup } from '../query'
import { referralUrl } from '../catalog'
import { money, recommend } from '../recommend'
import { SetupScene, type DeskSpots, type SceneHandle } from '../scene/SetupScene'
import type { Category } from '../types'
import { Brand } from './Brand'
import { PartsPanel } from './PartsPanel'

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
  const [spots, setSpots] = useState<DeskSpots>({})
  const [toast, setToast] = useState('')
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useEffect(() => {
    document.getElementById(`part-${selected}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

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
              hidden={[]}
              side="right"
              hand="right"
              spots={spots}
              studio={!showPhoto}
              reducedMotion={reducedMotion}
              onSelect={setSelected}
              onHover={setHover}
              onPlace={(key, x, z) => setSpots((current) => ({ ...current, [key]: { x, z } }))}
            />
          </div>
          <div className="stage-ui">
            <p className="desk-note">{dropped ? 'The photo could not be kept in this browser. This is the neutral desk.' : build.deskNote}</p>
            <div className="controls">
              <button
                type="button"
                onClick={() => {
                  setSpots({})
                  scene.current?.resetView()
                }}
              >
                Default view
              </button>
            </div>
            <p className="drag-hint">Drag empty space to look. Drag a part to slide it across the desk.</p>
          </div>
        </section>

        <PartsPanel
          build={build}
          input={input}
          selected={selected}
          onSelect={setSelected}
          onHover={setHover}
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
