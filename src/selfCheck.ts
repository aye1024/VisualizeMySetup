import { BUILDS, CATALOG, TIER_ORDER, getPart, partTotal } from './catalog'
import { compatibilityIssues, recommend } from './recommend'
import type { Preferences, Variant } from './types'

const variants: Variant[] = ['balanced', 'quiet', 'frames']

function prefs(over: Partial<Preferences> = {}): Preferences {
  return { caseSize: 'normal', noise: 'unrestricted', look: 'plain', ...over }
}

export function assertDemo(): void {
  const errors: string[] = []
  const fail = (message: string) => errors.push(message)

  if (CATALOG.length < 30) fail(`catalog has ${CATALOG.length} parts`)

  const seen = new Set<string>()
  for (const part of CATALOG) {
    if (seen.has(part.id)) fail(`duplicate id ${part.id}`)
    seen.add(part.id)
    if (part.price < 0) fail(`negative price ${part.id}`)
  }

  for (const tier of TIER_ORDER) {
    for (const variant of variants) {
      const list = BUILDS[tier][variant]
      const parts = list.map((id) => getPart(id))
      const issues = compatibilityIssues(parts)
      if (issues.length) fail(`${tier} ${variant}: ${issues.join(' ')}`)
      if (new Set(parts.map((part) => part.category)).size !== parts.length) {
        fail(`${tier} ${variant} has a duplicate category`)
      }
    }
  }

  const demo = recommend({
    budget: 1200,
    games: 'Elden Ring',
    prefs: prefs(),
    variant: 'balanced',
  })
  if (demo.total > 1200) fail(`$1200 balanced is ${demo.total}`)
  if (demo.parts.find((part) => part.category === 'monitor')?.resolution !== '1440p') {
    fail('$1200 balanced monitor is not 1440p')
  }

  const quiet = recommend({
    budget: 1200,
    games: 'Elden Ring',
    prefs: prefs(),
    variant: 'quiet',
  })
  if (quiet.total > 1200) fail(`$1200 quiet is ${quiet.total}`)
  if (quiet.parts.find((part) => part.category === 'case')?.scene !== 'silent') {
    fail('quiet build did not use a closed case')
  }
  if (
    quiet.parts.find((part) => part.category === 'case')?.id ===
    demo.parts.find((part) => part.category === 'case')?.id
  ) {
    fail('quiet case matches the balanced case')
  }

  const frames = recommend({
    budget: 1200,
    games: 'Elden Ring',
    prefs: prefs(),
    variant: 'frames',
  })
  if (frames.total > 1200) fail(`$1200 frames is ${frames.total}`)
  if (frames.parts.find((part) => part.category === 'monitor')?.resolution !== '1080p') {
    fail('frames monitor is not 1080p')
  }
  if (frames.parts.find((part) => part.category === 'gpu')?.id === demo.parts.find((part) => part.category === 'gpu')?.id) {
    fail('frames card matches the balanced card')
  }

  const valorant = recommend({
    budget: 1200,
    games: 'Valorant',
    prefs: prefs(),
    variant: 'balanced',
  })
  if (valorant.parts.find((part) => part.category === 'monitor')?.resolution !== '1080p') {
    fail('Valorant did not stay at 1080p')
  }

  const fourK = recommend({ budget: 1200, games: '4K', prefs: prefs(), variant: 'balanced' })
  if (fourK.parts.find((part) => part.category === 'monitor')?.resolution === '4k') {
    fail('4K monitor fit inside $1200')
  }
  if (!fourK.notes.some((note) => note.includes('4K'))) fail('missing 4K note')

  const fourKRoom = recommend({
    budget: 2500,
    games: '4K',
    prefs: prefs(),
    variant: 'balanced',
  })
  if (fourKRoom.parts.find((part) => part.category === 'monitor')?.resolution !== '4k') {
    fail(`$2500 4K monitor missing, total ${fourKRoom.total}`)
  }
  if (fourKRoom.total > 2500) fail(`$2500 4K over at ${fourKRoom.total}`)

  const small = recommend({
    budget: 1200,
    games: 'Elden Ring',
    prefs: prefs({ caseSize: 'small' }),
    variant: 'balanced',
  })
  if (small.parts.find((part) => part.category === 'case')?.caseSize !== 'small') fail('small case missing')
  if (small.total > 1200) fail(`small build is ${small.total}`)

  const tight = recommend({ budget: 500, games: 'Minecraft', prefs: prefs(), variant: 'balanced' })
  if (!tight.overBudget) fail('$500 should be over the catalog')

  for (const budget of [1000, 1200, 1500, 2000, 2500]) {
    for (const variant of variants) {
      const build = recommend({ budget, games: 'Elden Ring', prefs: prefs(), variant })
      if (build.total > budget) fail(`$${budget} ${variant} is ${build.total}`)
      const issues = compatibilityIssues(build.parts)
      if (issues.length) fail(`$${budget} ${variant}: ${issues.join(' ')}`)
    }
  }

  if (errors.length) {
    throw new Error(errors.join('\n'))
  }
}

export function demoTotals(): string[] {
  return TIER_ORDER.flatMap((tier) =>
    variants.map((variant) => `${tier} ${variant} ${partTotal(BUILDS[tier][variant])}`),
  )
}
