import * as THREE from 'three'

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 512) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('texture')
  draw(ctx, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

let wood: THREE.CanvasTexture | null = null
let screen: THREE.CanvasTexture | null = null
let keysPlain: THREE.CanvasTexture | null = null
let keysRgb: THREE.CanvasTexture | null = null

export function woodTexture() {
  wood ??= canvasTexture((ctx, size) => {
    ctx.fillStyle = '#8d5b38'
    ctx.fillRect(0, 0, size, size)
    for (let y = 0; y < size; y += 1) {
      const band = Math.sin(y * 0.08) * 8 + Math.sin(y * 0.021) * 14
      ctx.fillStyle = `rgba(${90 + band}, ${48 + band * 0.4}, ${24}, 0.18)`
      ctx.fillRect(0, y, size, 1)
    }
    for (let i = 0; i < 28; i += 1) {
      const y = (i * 97) % size
      ctx.strokeStyle = `rgba(40, 18, 8, ${0.05 + (i % 5) * 0.02})`
      ctx.lineWidth = 1 + (i % 3)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(size * 0.3, y + 8, size * 0.6, y - 10, size, y + 4)
      ctx.stroke()
    }
    for (let i = 0; i < 900; i += 1) {
      const x = (i * 47) % size
      const y = (i * 91) % size
      ctx.fillStyle = 'rgba(255, 220, 180, 0.03)'
      ctx.fillRect(x, y, 2, 1)
    }
  })
  return wood
}

export function screenTexture() {
  screen ??= canvasTexture((ctx, size) => {
    const sky = ctx.createLinearGradient(0, 0, 0, size)
    sky.addColorStop(0, '#142033')
    sky.addColorStop(0.55, '#3d6d86')
    sky.addColorStop(1, '#d7a15a')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#f2d7a2'
    ctx.beginPath()
    ctx.arc(size * 0.72, size * 0.62, size * 0.08, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1c2430'
    ctx.beginPath()
    ctx.moveTo(0, size * 0.78)
    ctx.lineTo(size * 0.22, size * 0.62)
    ctx.lineTo(size * 0.4, size * 0.74)
    ctx.lineTo(size * 0.58, size * 0.56)
    ctx.lineTo(size * 0.78, size * 0.7)
    ctx.lineTo(size, size * 0.6)
    ctx.lineTo(size, size)
    ctx.lineTo(0, size)
    ctx.fill()
    ctx.fillStyle = 'rgba(8, 12, 18, 0.55)'
    ctx.fillRect(0, size * 0.9, size, size * 0.1)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillRect(size * 0.06, size * 0.93, size * 0.08, size * 0.025)
  }, 1024)
  screen.wrapS = THREE.ClampToEdgeWrapping
  screen.wrapT = THREE.ClampToEdgeWrapping
  return screen
}

function drawKeys(ctx: CanvasRenderingContext2D, size: number, rgb: boolean) {
  ctx.fillStyle = '#121418'
  ctx.fillRect(0, 0, size, size)
  const cols = 15
  const rows = 6
  const gap = size * 0.012
  const keyW = (size - gap * (cols + 1)) / cols
  const keyH = (size - gap * (rows + 1)) / rows
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = gap + col * (keyW + gap)
      const y = gap + row * (keyH + gap)
      if (rgb) {
        const hue = (col / cols) * 300 + row * 8
        ctx.fillStyle = `hsl(${hue} 62% 46%)`
      } else {
        ctx.fillStyle = row === rows - 1 && col > 3 && col < 11 ? '#2a2e34' : '#23272d'
      }
      roundRect(ctx, x, y, keyW, keyH * 0.86, keyW * 0.18)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      roundRect(ctx, x, y, keyW, keyH * 0.28, keyW * 0.18)
      ctx.fill()
    }
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

let blob: THREE.CanvasTexture | null = null

export function shadowTexture() {
  blob ??= canvasTexture((ctx, size) => {
    const fade = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.48)
    fade.addColorStop(0, 'rgba(0,0,0,0.55)')
    fade.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = fade
    ctx.fillRect(0, 0, size, size)
  })
  blob.wrapS = THREE.ClampToEdgeWrapping
  blob.wrapT = THREE.ClampToEdgeWrapping
  return blob
}

export function keyTexture(rgb: boolean) {
  if (rgb) {
    keysRgb ??= canvasTexture((ctx, size) => drawKeys(ctx, size, true))
    return keysRgb
  }
  keysPlain ??= canvasTexture((ctx, size) => drawKeys(ctx, size, false))
  return keysPlain
}
