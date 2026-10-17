import type { Category, Preferences, SetupInput, Variant } from './types'

const categories: Category[] = [
  'gpu',
  'cpu',
  'cooler',
  'motherboard',
  'memory',
  'storage',
  'psu',
  'case',
  'monitor',
  'keyboard',
  'mouse',
  'headset',
]

function isCategory(value: string): value is Category {
  return categories.includes(value as Category)
}

export function readSetup(search: string): SetupInput {
  const params = new URLSearchParams(search)
  const budget = Number(params.get('budget'))
  const variant = params.get('variant')
  const size = params.get('size')
  const noise = params.get('noise')
  const look = params.get('look')
  const prefs: Preferences = {
    caseSize: size === 'small' || size === 'large' ? size : 'normal',
    noise: noise === 'quiet' ? 'quiet' : 'unrestricted',
    look: look === 'rgb' ? 'rgb' : 'plain',
  }
  const chosen: Variant = variant === 'quiet' || variant === 'frames' ? variant : 'balanced'
  return {
    budget: Number.isFinite(budget) && budget > 0 ? budget : 1200,
    games: params.get('games')?.trim() || 'Elden Ring',
    prefs,
    variant: chosen,
  }
}

export function readSwaps(search: string): Partial<Record<Category, string>> {
  const raw = new URLSearchParams(search).get('swaps')
  if (!raw) return {}
  const swaps: Partial<Record<Category, string>> = {}
  for (const pair of raw.split(',')) {
    const [category, id] = pair.split(':')
    if (category && id && isCategory(category)) swaps[category] = id
  }
  return swaps
}

export function writeSetup(
  input: SetupInput,
  swaps: Partial<Record<Category, string>> = {},
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams()
  params.set('budget', String(input.budget))
  params.set('games', input.games)
  params.set('variant', input.variant)
  params.set('size', input.prefs.caseSize)
  params.set('noise', input.prefs.noise)
  params.set('look', input.prefs.look)
  const encoded = Object.entries(swaps)
    .filter((entry): entry is [Category, string] => Boolean(entry[1]))
    .map(([category, id]) => `${category}:${id}`)
    .join(',')
  if (encoded) params.set('swaps', encoded)
  if (extra) {
    for (const [key, value] of Object.entries(extra)) params.set(key, value)
  }
  return params.toString()
}
