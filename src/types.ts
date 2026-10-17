export type Category =
  | 'gpu'
  | 'cpu'
  | 'cooler'
  | 'motherboard'
  | 'memory'
  | 'storage'
  | 'psu'
  | 'case'
  | 'monitor'
  | 'keyboard'
  | 'mouse'
  | 'headset'

export type Socket = 'AM4' | 'AM5'
export type MemoryType = 'DDR4' | 'DDR5'
export type CaseSize = 'small' | 'normal' | 'large'
export type NoisePref = 'quiet' | 'unrestricted'
export type LookPref = 'plain' | 'rgb'
export type Variant = 'balanced' | 'quiet' | 'frames'
export type Intent = 'competitive' | 'story' | 'cinematic' | 'mixed'
export type CaseStyle = 'air' | 'silent' | 'rgb'
export type GpuBrand = 'nvidia' | 'amd'
export type Resolution = '1080p' | '1440p' | '4k'

export type Part = {
  id: string
  name: string
  category: Category
  price: number
  widthMm?: number
  heightMm?: number
  depthMm?: number
  socket?: Socket
  sockets?: Socket[]
  memoryType?: MemoryType
  formFactor?: 'mATX'
  supportsForm?: Array<'mATX' | 'ATX'>
  gpuClearanceMm?: number
  coolerClearanceMm?: number
  caseSize?: CaseSize
  noise?: 'quiet' | 'moderate' | 'loud'
  wattage?: number
  scene?: CaseStyle | GpuBrand | 'plain' | 'rgb'
  resolution?: Resolution
}

export type Preferences = {
  caseSize: CaseSize
  noise: NoisePref
  look: LookPref
}

export type SetupInput = {
  budget: number
  games: string
  prefs: Preferences
  variant: Variant
}

export type ResolvedPart = Part & {
  reason: string
}

export type RecommendedBuild = {
  variant: Variant
  variantLabel: string
  intent: Intent
  intentLabel: string
  blurb: string
  parts: ResolvedPart[]
  total: number
  remainder: number
  overBudget: boolean
  notes: string[]
  checks: string[]
  deskNote: string
}
