import type { Preferences, Variant } from './types'

export function parseSpecs(text: string): { games: string; prefs: Preferences; variant: Variant } {
  const games = text.trim()
  const lower = games.toLowerCase()
  const small = /\b(mini[-\s]?itx|small|compact|tiny)\b/.test(lower)
  const large = /\b(full[-\s]?tower|large|big)\b/.test(lower)
  const quiet = /\b(quiet|silent|whisper)\b/.test(lower)
  const plain = /\b(no\s+rgb|plain|matte|no\s+lights)\b/.test(lower)
  const rgb = !plain && /\b(rgb|led|lighting)\b/.test(lower)
  const frames = /\b(fps|frames|frame\s*rates?|high\s*refresh)\b/.test(lower)

  let variant: Variant = 'balanced'
  if (quiet) variant = 'quiet'
  else if (frames) variant = 'frames'

  return {
    games,
    prefs: {
      caseSize: small && !large ? 'small' : large && !small ? 'large' : 'normal',
      noise: quiet ? 'quiet' : 'unrestricted',
      look: rgb ? 'rgb' : 'plain',
    },
    variant,
  }
}
