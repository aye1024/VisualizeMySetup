import {
  BUILDS,
  CATALOG,
  CATEGORY_ORDER,
  DESK_WIDTH_MM,
  TIER_ORDER,
  getPart,
  partTotal,
  type Tier,
} from './catalog'
import type {
  Category,
  Intent,
  Part,
  RecommendedBuild,
  ResolvedPart,
  SetupInput,
  Variant,
} from './types'

const POWER_HEADROOM_W = 150

export function money(amount: number): string {
  if (amount === 0) return 'Included'
  const sign = amount < 0 ? '-' : ''
  return `${sign}$${Math.abs(Math.round(amount)).toLocaleString('en-US')}`
}

export function interpretGames(games: string): { intent: Intent; label: string } {
  const text = games.trim()
  const lower = text.toLowerCase()
  const wants4k = /\b(4k|2160p|cinematic)\b/.test(lower)
  const wants1440 = /\b1440p?\b/.test(lower)
  const wants1080 = /\b1080p?\b/.test(lower)
  const competitive =
    /\b(valorant|cs2|cs:go|counter[- ]strike|league of legends|\blol\b|fortnite|overwatch|apex|rocket league|rainbow six|\br6\b|warzone|call of duty|\bcod\b|pubg|dota|marvel rivals|competitive|esports?)\b/.test(
      lower,
    )
  const story =
    /\b(elden|cyberpunk|baldur|witcher|hogwarts|starfield|black myth|wukong|god of war|spider-man|spiderman|horizon|zelda|rpg|single[- ]player|story)\b/.test(
      lower,
    )

  let intent: Intent = 'story'
  if (wants4k && !wants1080 && !wants1440) intent = 'cinematic'
  else if (wants1080 && wants1440) intent = 'mixed'
  else if (wants1080) intent = 'competitive'
  else if (wants1440) intent = 'story'
  else if (wants4k && (competitive || story)) intent = 'mixed'
  else if (wants4k) intent = 'cinematic'
  else if (competitive && story) intent = 'mixed'
  else if (competitive) intent = 'competitive'
  else intent = 'story'

  const quoted = text.length > 42 ? `${text.slice(0, 40)}…` : text
  const label =
    intent === 'competitive'
      ? 'Competitive'
      : intent === 'cinematic'
        ? '4K request'
        : intent === 'mixed'
          ? 'Mixed games'
          : 'Story games'

  return { intent, label: quoted ? `${label} · ${quoted}` : label }
}

export function compatibilityIssues(parts: Part[]): string[] {
  const issues: string[] = []
  const cpu = parts.find((part) => part.category === 'cpu')
  const board = parts.find((part) => part.category === 'motherboard')
  const memory = parts.find((part) => part.category === 'memory')
  const cooler = parts.find((part) => part.category === 'cooler')
  const gpu = parts.find((part) => part.category === 'gpu')
  const psu = parts.find((part) => part.category === 'psu')
  const tower = parts.find((part) => part.category === 'case')

  if (cpu && board && cpu.socket !== board.socket) {
    issues.push(`${cpu.name} is ${cpu.socket} and ${board.name} is ${board.socket}.`)
  }
  if (memory && board && memory.memoryType !== board.memoryType) {
    issues.push(`${memory.name} is ${memory.memoryType} and the motherboard wants ${board.memoryType}.`)
  }
  if (cooler && cpu && cooler.sockets && cpu.socket && !cooler.sockets.includes(cpu.socket)) {
    issues.push(`${cooler.name} does not list the ${cpu.socket} socket.`)
  }
  if (tower && board?.formFactor && tower.supportsForm && !tower.supportsForm.includes(board.formFactor)) {
    issues.push(`${tower.name} does not list ${board.formFactor} motherboards.`)
  }
  if (tower && gpu?.depthMm && tower.gpuClearanceMm && gpu.depthMm > tower.gpuClearanceMm) {
    issues.push(
      `${gpu.name} is ${gpu.depthMm} mm long and ${tower.name} lists ${tower.gpuClearanceMm} mm of clearance.`,
    )
  }
  if (tower && cooler?.heightMm && tower.coolerClearanceMm && cooler.heightMm > tower.coolerClearanceMm) {
    issues.push(
      `${cooler.name} is ${cooler.heightMm} mm tall and ${tower.name} lists ${tower.coolerClearanceMm} mm of cooler room.`,
    )
  }
  if (psu && cpu && gpu) {
    const need = (cpu.wattage ?? 0) + (gpu.wattage ?? 0) + POWER_HEADROOM_W
    if ((psu.wattage ?? 0) < need) {
      issues.push(
        `${psu.name} is ${psu.wattage}W. The catalog lists the processor at ${cpu.wattage}W and the card at ${gpu.wattage}W, and this build keeps ${POWER_HEADROOM_W}W on top of that.`,
      )
    }
  }
  return issues
}

function checkLines(parts: Part[]): string[] {
  const cpu = parts.find((part) => part.category === 'cpu')
  const board = parts.find((part) => part.category === 'motherboard')
  const memory = parts.find((part) => part.category === 'memory')
  const gpu = parts.find((part) => part.category === 'gpu')
  const psu = parts.find((part) => part.category === 'psu')
  const tower = parts.find((part) => part.category === 'case')
  const lines = [
    `Socket ${cpu?.socket ?? '—'} matches the motherboard.`,
    `${memory?.memoryType ?? 'Memory'} matches ${board?.name ?? 'the motherboard'}.`,
  ]
  if (gpu && tower) {
    lines.push(
      `The card is ${gpu.depthMm} mm long. ${tower.name} lists ${tower.gpuClearanceMm} mm of clearance.`,
    )
  }
  if (psu && cpu && gpu) {
    lines.push(
      `${psu.wattage}W supply. The catalog lists the processor at ${cpu.wattage}W and the card at ${gpu.wattage}W board power.`,
    )
  }
  return lines
}

function replaceCategory(ids: string[], category: Category, nextId: string): string[] {
  return ids.map((id) => (getPart(id).category === category ? nextId : id))
}

function idFor(ids: string[], category: Category): string | undefined {
  return ids.find((id) => getPart(id).category === category)
}

function trySwap(
  ids: string[],
  category: Category,
  nextId: string,
  budget: number,
  allowOver: boolean,
): { ids: string[]; applied: boolean; total: number } {
  const next = replaceCategory(ids, category, nextId)
  const parts = next.map(getPart)
  const total = partTotal(next)
  const currentTotal = partTotal(ids)
  const priceOk = total <= budget || (allowOver && total <= currentTotal)
  const ok = compatibilityIssues(parts).length === 0 && priceOk
  return ok ? { ids: next, applied: true, total } : { ids, applied: false, total: currentTotal }
}

function pickTier(variant: Variant, budget: number): { tier: Tier; over: boolean } {
  let chosen: Tier = 'low'
  let over = partTotal(BUILDS.low[variant]) > budget
  for (const tier of TIER_ORDER) {
    if (partTotal(BUILDS[tier][variant]) <= budget) chosen = tier
  }
  if (partTotal(BUILDS.low[variant]) > budget) {
    chosen = 'low'
    over = true
  }
  return { tier: chosen, over }
}

function applyIntent(
  ids: string[],
  intent: Intent,
  variant: Variant,
  budget: number,
  over: boolean,
  notes: string[],
): string[] {
  const monitorId = idFor(ids, 'monitor')
  if (!monitorId) return ids
  const monitor = getPart(monitorId)

  if (variant === 'frames') {
    if (intent === 'cinematic') {
      notes.push('This tab keeps the fast 1080p monitor. A 4K screen would spend the money this build puts on the card.')
    }
    return ids
  }

  if (intent === 'competitive') {
    if (monitor.id !== 'mon-1080f') {
      const swapped = trySwap(ids, 'monitor', 'mon-1080f', budget, over)
      if (swapped.applied) return swapped.ids
    }
    return ids
  }

  if (intent === 'cinematic' && monitor.resolution !== '4k') {
    const swapped = trySwap(ids, 'monitor', 'mon-4k', budget, over)
    if (swapped.applied) return swapped.ids
    notes.push(
      `A 4K monitor in the catalog is ${money(getPart('mon-4k').price)}, which would push this build over ${money(budget)}. The monitor stays ${monitor.resolution}.`,
    )
    return ids
  }

  if (monitor.resolution === '1080p') {
    const swapped = trySwap(ids, 'monitor', 'mon-1440', budget, over)
    if (swapped.applied) return swapped.ids
    notes.push('A 1440p monitor would put this build over the budget, so the screen stays 1080p.')
  }
  return ids
}

function applyPreferences(ids: string[], input: SetupInput, over: boolean, notes: string[]): string[] {
  let next = ids
  const { prefs, variant, budget } = input
  const quietBuild = variant === 'quiet' || prefs.noise === 'quiet'

  if (prefs.caseSize === 'small') {
    const current = getPart(idFor(next, 'case')!)
    if (current.caseSize !== 'small') {
      const swapped = trySwap(next, 'case', 'case-a3', budget, over)
      if (swapped.applied) {
        next = swapped.ids
        notes.push(
          quietBuild
            ? 'Small keeps the compact case. The small case in the catalog has a mesh front, not a closed one.'
            : 'Small keeps the compact case. Full towers are out.',
        )
      } else {
        notes.push('The small case in the catalog does not clear this card or this budget, so the case stays.')
      }
    }
  } else if (prefs.caseSize === 'large') {
    const current = getPart(idFor(next, 'case')!)
    if (current.caseSize !== 'large' && !quietBuild) {
      const swapped = trySwap(next, 'case', 'case-lancool', budget, over)
      if (swapped.applied) {
        next = swapped.ids
        notes.push('Large allows the full tower.')
      } else {
        notes.push(
          `The large case is ${money(getPart('case-lancool').price)} and would put this list over ${money(budget)}, so the case stays a mid tower.`,
        )
      }
    }
    if (quietBuild && current.noise === 'quiet') {
      notes.push('Quiet keeps the closed case, so the full tower is not swapped in.')
    }
  }

  if (prefs.noise === 'quiet' && variant !== 'quiet') {
    const currentCase = getPart(idFor(next, 'case')!)
    if (currentCase.noise === 'loud' || currentCase.scene !== 'silent') {
      const quietCase = trySwap(next, 'case', 'case-pop-silent', budget, over)
      if (quietCase.applied) {
        next = quietCase.ids
        notes.push('Quiet drops the louder case for a closed front.')
      } else {
        notes.push('The quiet case would put this tab over the budget, so the case stays.')
      }
    }
    const cooler = getPart(idFor(next, 'cooler')!)
    if (cooler.price === 0) {
      const quietCooler = trySwap(next, 'cooler', 'cool-ax120', budget, over)
      if (quietCooler.applied) next = quietCooler.ids
      else notes.push('A tower cooler would put this tab over the budget, so the included cooler stays.')
    }
  }

  if (prefs.look === 'rgb') {
    const tower = getPart(idFor(next, 'case')!)
    const wantRgbCase = prefs.caseSize === 'normal' && !quietBuild && tower.scene !== 'rgb'
    if (wantRgbCase) {
      const rgbCase = trySwap(next, 'case', 'case-montech', budget, over)
      if (rgbCase.applied) next = rgbCase.ids
      else notes.push('The RGB case would put this build over the budget, so the case stays.')
    } else if (quietBuild) {
      notes.push('Quiet keeps the closed case, so the RGB case is not used.')
    } else if (prefs.caseSize === 'small') {
      notes.push('The RGB case is a mid tower, so the small case stays.')
    }

    const rgbBoard = trySwap(next, 'keyboard', 'kb-rgb', budget, over)
    if (rgbBoard.applied) next = rgbBoard.ids
    else notes.push('The RGB keyboard would put this build over the budget, so the keyboard stays plain.')

    const board = getPart(idFor(next, 'motherboard')!)
    if (board.memoryType === 'DDR5') {
      const rgbRam = trySwap(next, 'memory', 'ram-d5rgb', budget, over)
      if (rgbRam.applied) next = rgbRam.ids
    }
  }

  return next
}

function applyUserSwaps(
  ids: string[],
  swaps: Partial<Record<Category, string>>,
  budget: number,
  over: boolean,
  notes: string[],
): string[] {
  let next = ids
  for (const [category, partId] of Object.entries(swaps) as Array<[Category, string]>) {
    if (!partId || !CATALOG.some((part) => part.id === partId)) continue
    const swapped = trySwap(next, category, partId, budget, over)
    if (swapped.applied) next = swapped.ids
    else notes.push(`${getPart(partId).name} does not fit this build, so it was left out.`)
  }
  return next
}

function reasonFor(part: Part, parts: Part[], input: SetupInput, intent: Intent): string {
  const monitor = parts.find((item) => item.category === 'monitor')
  const gpu = parts.find((item) => item.category === 'gpu')
  const cpu = parts.find((item) => item.category === 'cpu')
  const tower = parts.find((item) => item.category === 'case')

  switch (part.category) {
    case 'gpu':
      if (input.variant === 'frames') {
        return 'More of this budget sits in the graphics card. The monitor is the part that gives that money up.'
      }
      if (intent === 'competitive' || monitor?.resolution === '1080p') {
        return 'This is the card the catalog pairs with a fast 1080p monitor at this budget.'
      }
      if (intent === 'cinematic' && monitor?.resolution === '4k') {
        return 'This is the strongest card in the catalog that still leaves room for the 4K monitor.'
      }
      return 'The card takes the largest share so the monitor can match it, instead of a cheap card beside a screen it will not fill.'
    case 'monitor':
      if (part.resolution === '1080p' && input.variant === 'frames') {
        return 'A fast 1080p panel, so the graphics card keeps more of the budget than the screen does.'
      }
      if (part.resolution === '1080p' && intent === 'competitive') {
        return 'A fast 1080p panel. A 1440p or 4K screen would move money off the card for games that do not ask for it here.'
      }
      if (part.resolution === '1080p') {
        return 'A 1080p panel. A 1440p monitor in the catalog would put this list over the budget.'
      }
      if (part.resolution === '4k') {
        return 'A 4K panel from the catalog. The card beside it is the one that still fits after this screen.'
      }
      return 'A 1440p panel, matched to this card. A 4K screen would leave too little for the graphics card.'
    case 'cpu':
      return `Socket ${part.socket}, the same socket as the motherboard. The rest of the money stays on the card and the monitor.`
    case 'case':
      if (part.scene === 'silent' || part.noise === 'quiet') {
        return 'A closed front from the quiet side of the catalog. Mesh cases with louder fans are left out.'
      }
      if (part.caseSize === 'small') {
        return `A compact case. The catalog lists ${part.gpuClearanceMm} mm of room for the graphics card.`
      }
      if (part.caseSize === 'large') {
        return 'A full tower, with the most room in this catalog around the graphics card.'
      }
      if (part.scene === 'rgb') {
        return input.prefs.look === 'rgb'
          ? 'A mesh case with RGB fans, because that look was requested.'
          : 'A mesh case with RGB fans. It moves more air, and it is louder than the closed cases.'
      }
      return `A mid tower. The catalog lists ${part.gpuClearanceMm} mm of clearance, and this card is ${gpu?.depthMm} mm long.`
    case 'psu':
      return `${part.wattage}W, above the catalog figures of ${cpu?.wattage}W for the processor and ${gpu?.wattage}W for the graphics card, with room left over.`
    case 'motherboard':
      return `${part.socket} and ${part.memoryType}, which is what this processor and memory kit use.`
    case 'memory':
      return `32GB ${part.memoryType}, the generation this motherboard takes.`
    case 'storage':
      return part.name.includes('2TB')
        ? 'A 2TB drive, the larger option in the catalog, because this budget still had room after the card and monitor.'
        : 'A 1TB drive. Enough for the system and a few games without taking money from the card.'
    case 'cooler':
      if (part.price === 0) {
        return 'The cooler that comes with this processor. A larger cooler is the quieter build, not this one.'
      }
      if (part.name.startsWith('be quiet')) {
        return `A tower cooler listed at ${part.heightMm} mm. ${tower?.name ?? 'The case'} lists ${tower?.coolerClearanceMm} mm of room.`
      }
      return `A dual-tower cooler, ${part.heightMm} mm tall, which fits the ${tower?.coolerClearanceMm} mm listed for this case.`
    case 'keyboard':
      if (part.scene === 'rgb') {
        return input.prefs.look === 'rgb'
          ? 'An RGB board, because that look was requested. It does not change the computer.'
          : 'An RGB board in this version of the list. It does not change the computer.'
      }
      return 'A plain board, so the money stays on the computer.'
    case 'mouse':
      return 'A basic gaming mouse from the catalog. It does not change the rest of the build.'
    case 'headset':
      return 'A stereo headset from the catalog. Swap it if you already own one — the computer does not depend on it.'
    default:
      return 'Included because it is compatible with the rest of this list.'
  }
}

function blurbFor(input: SetupInput, intent: Intent, parts: Part[], over: boolean, total: number): string {
  const monitor = parts.find((part) => part.category === 'monitor')
  const games = input.games.trim()
  const named = games ? `For “${games.length > 48 ? `${games.slice(0, 46)}…` : games}”, ` : ''
  if (over) {
    return `The lowest checked ${input.variant === 'balanced' ? 'build' : 'version'} in the catalog is ${money(total)}, which is over ${money(input.budget)}.`
  }
  if (input.variant === 'frames') {
    return `${named}this one puts more of the ${money(input.budget)} on the graphics card and keeps a 1080p monitor.`
  }
  if (input.variant === 'quiet') {
    return `${named}this is the closed case and quieter cooler that still fit inside ${money(input.budget)}.`
  }
  if (intent === 'cinematic' && monitor?.resolution === '4k') {
    return `${named}the budget covers a 4K monitor and the strongest card that still fits beside it.`
  }
  if (intent === 'cinematic') {
    return `${named}4K did not fit, so the screen stays ${monitor?.resolution === '1080p' ? '1080p' : '1440p'} and the card keeps the rest.`
  }
  if (intent === 'competitive') {
    return `${named}the split stays at 1080p: a fast panel, and a card chosen for that screen.`
  }
  if (intent === 'mixed') {
    return `${named}you named more than one kind of game. The monitor stays ${monitor?.resolution} so the list is not built for only half of them.`
  }
  return `${named}the money leans toward the graphics card and a ${monitor?.resolution} monitor.`
}

export function recommend(
  input: SetupInput,
  swaps: Partial<Record<Category, string>> = {},
  hasPhoto = false,
): RecommendedBuild {
  const { intent, label } = interpretGames(input.games)
  const { tier, over } = pickTier(input.variant, input.budget)
  const notes: string[] = []
  let ids = [...BUILDS[tier][input.variant]]
  ids = applyIntent(ids, intent, input.variant, input.budget, over, notes)
  ids = applyPreferences(ids, input, over, notes)
  ids = applyUserSwaps(ids, swaps, input.budget, over, notes)

  const baseParts = ids.map(getPart)
  const issues = compatibilityIssues(baseParts)
  if (issues.length) {
    notes.push(...issues.map((issue) => `Check failed: ${issue}`))
  }

  const parts: ResolvedPart[] = CATEGORY_ORDER.map((category) => {
    const part = baseParts.find((item) => item.category === category)
    if (!part) throw new Error(`Build is missing ${category}`)
    return { ...part, reason: reasonFor(part, baseParts, input, intent) }
  })

  const total = parts.reduce((sum, part) => sum + part.price, 0)
  const casePart = parts.find((part) => part.category === 'case')
  const deskNote = hasPhoto
    ? `Your photo is the stage. Scale is approximate: this case is ${casePart?.widthMm ?? '—'} mm wide on a desk shown as ${DESK_WIDTH_MM / 10} cm. This is not a measured fit.`
    : `Neutral desk, ${DESK_WIDTH_MM / 10} cm wide in the model. A fit check needs a photo. Scale is approximate, from catalog sizes.`

  return {
    variant: input.variant,
    variantLabel: input.variant === 'balanced' ? 'Balanced' : input.variant === 'quiet' ? 'Quieter' : 'Higher frame rate',
    intent,
    intentLabel: label,
    blurb: blurbFor(input, intent, parts, over, total),
    parts,
    total,
    remainder: input.budget - total,
    overBudget: total > input.budget,
    notes,
    checks: checkLines(parts),
    deskNote,
  }
}

export function alternatives(
  current: RecommendedBuild,
  category: Category,
  input: SetupInput,
): Part[] {
  const selected = current.parts.find((part) => part.category === category)
  if (!selected) return []

  const candidates = CATALOG.filter((part) => {
    if (part.category !== category || part.id === selected.id) return false
    if (category === 'case') {
      if (input.prefs.noise === 'quiet' && part.noise === 'loud') return false
      if (input.prefs.caseSize === 'small' && part.caseSize === 'large') return false
      if (input.prefs.caseSize === 'large' && part.caseSize === 'small') return false
      if (input.variant === 'quiet' && part.noise === 'loud') return false
    }
    const ids = current.parts.map((item) => (item.category === category ? part.id : item.id))
    const parts = ids.map(getPart)
    return compatibilityIssues(parts).length === 0
  })

  candidates.sort((a, b) => a.price - b.price)
  return candidates
}

export function compatibilityText(part: Part, parts: Part[]): string {
  const board = parts.find((item) => item.category === 'motherboard')
  const tower = parts.find((item) => item.category === 'case')
  const cpu = parts.find((item) => item.category === 'cpu')
  const gpu = parts.find((item) => item.category === 'gpu')

  switch (part.category) {
    case 'cpu':
      return `Works with ${part.socket} motherboards. This build uses ${board?.name}.`
    case 'motherboard':
      return `${part.socket}, ${part.memoryType}, ${part.formFactor}. The processor and memory in this list match those.`
    case 'memory':
      return `${part.memoryType}. ${board?.name ?? 'The motherboard'} takes that generation.`
    case 'gpu':
      return `${part.depthMm} mm long, catalog board power ${part.wattage}W. ${tower?.name ?? 'The case'} lists ${tower?.gpuClearanceMm} mm of clearance.`
    case 'case':
      return `${part.widthMm} × ${part.heightMm} × ${part.depthMm} mm. Clears a ${part.gpuClearanceMm} mm card and a ${part.coolerClearanceMm} mm cooler. This card is ${gpu?.depthMm} mm.`
    case 'cooler':
      return part.price === 0
        ? `Included with the ${cpu?.name}. Listed height ${part.heightMm} mm.`
        : `Fits ${part.sockets?.join(' and ')}. Listed height ${part.heightMm} mm. The case lists ${tower?.coolerClearanceMm} mm.`
    case 'psu':
      return `${part.wattage}W. Catalog draw used for the check: ${cpu?.wattage}W processor + ${gpu?.wattage}W graphics card + ${POWER_HEADROOM_W}W headroom.`
    case 'monitor':
      return `${part.resolution} panel, about ${part.widthMm} mm wide in the catalog. The scene uses that width.`
    case 'keyboard':
      return `About ${part.widthMm} mm wide. ${part.scene === 'rgb' ? 'RGB.' : 'Plain.'}`
    case 'storage':
      return 'An M.2 drive. Both motherboards in the catalog take one.'
    case 'mouse':
    case 'headset':
      return 'A desk part. It does not change socket, memory, or power.'
    default:
      return 'Included because it is compatible with the rest of this list.'
  }
}

export function sizeText(part: Part): string | null {
  if (part.widthMm && part.heightMm && part.depthMm && part.category !== 'gpu') {
    return `${part.widthMm} × ${part.heightMm} × ${part.depthMm} mm`
  }
  if (part.category === 'gpu' && part.depthMm) return `${part.depthMm} mm long`
  if (part.category === 'cooler' && part.heightMm) return `${part.heightMm} mm tall`
  return null
}
