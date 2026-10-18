import { CATEGORY_LABEL, referralUrl } from '../catalog'
import { alternatives, compatibilityText, money, sizeText } from '../recommend'
import type { Category, RecommendedBuild, SetupInput } from '../types'

const inside = new Set<Category>(['cpu', 'cooler', 'motherboard', 'memory', 'storage', 'psu'])

type Props = {
  build: RecommendedBuild
  input: SetupInput
  selected: Category
  onSelect: (category: Category) => void
  onHover: (category: Category | null) => void
  onSwap: (category: Category, id: string) => void
  onOpenLinks: () => void
}

export function PartsPanel({
  build,
  input,
  selected,
  onSelect,
  onHover,
  onSwap,
  onOpenLinks,
}: Props) {
  const leftLabel = build.overBudget ? 'Over budget' : 'Left'
  const leftValue = Math.abs(build.remainder)

  return (
    <aside className="panel">
      <div className="panel-head">
        <p className="intent">{build.intentLabel}</p>
        <p className="blurb">{build.blurb}</p>
        {build.notes.length > 0 && (
          <ul className="notes">
            {build.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="parts">
        {build.parts.map((part) => {
          const on = part.category === selected
          const options = alternatives(build, part.category, input)
          const dims = sizeText(part)
          return (
            <details
              key={part.category}
              id={`part-${part.category}`}
              className={on ? 'part is-on' : 'part'}
              onMouseEnter={() => onHover(part.category)}
              onMouseLeave={() => onHover(null)}
              onToggle={(event) => {
                if (event.currentTarget.open) onSelect(part.category)
              }}
            >
              <summary className="part-main">
                <span className="part-kicker">{CATEGORY_LABEL[part.category]}</span>
                <span className="part-price">{money(part.price)}</span>
                <span className="part-name">{part.name}</span>
                <span className="part-why">{part.reason}</span>
              </summary>
              <div className="part-actions">
                {part.price > 0 ? (
                  <a href={referralUrl(part)} target="_blank" rel="noreferrer noopener">
                    View to buy
                  </a>
                ) : (
                  <span className="included">Comes with the processor</span>
                )}
                {inside.has(part.category) && (
                  <p className="inside">Inside the tower. The case is highlighted in the scene.</p>
                )}
                <p className="compat">{compatibilityText(part, build.parts)}</p>
                {dims && <p className="dims">{dims}</p>}
                {options.length > 0 && (
                  <div className="alts">
                    <span>Switch to</span>
                    {options.map((option) => (
                      <button key={option.id} type="button" onClick={() => onSwap(part.category, option.id)}>
                        {option.name}
                        <em>{money(option.price)}</em>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )
        })}
      </div>

      <footer className="settle">
        <div className="totals">
          <p>
            <span>Total</span>
            <strong>{money(build.total)}</strong>
          </p>
          <p>
            <span>{leftLabel}</span>
            <strong className={build.overBudget ? 'bad' : 'good'}>{money(leftValue)}</strong>
          </p>
        </div>
        <p className="pay">
          We are paid only if you buy. A referral is often a few percent, and only when the purchase is completed.
        </p>
        <button type="button" className="ghost" onClick={onOpenLinks}>
          All part links
        </button>
      </footer>
    </aside>
  )
}
