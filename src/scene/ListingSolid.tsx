import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'

type Solid = {
  geometry: THREE.BufferGeometry
  map: THREE.CanvasTexture
  height: number
  side: string
}

const cache = new Map<string, Solid>()

function prepare(image: HTMLImageElement) {
  const max = 420
  const scale = Math.min(max / image.width, max / image.height, 1)
  const w = Math.max(2, Math.round(image.width * scale))
  const h = Math.max(2, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('listing')
  ctx.drawImage(image, 0, 0, w, h)
  const imageData = ctx.getImageData(0, 0, w, h)
  const px = imageData.data
  const at = (x: number, y: number) => {
    const i = (y * w + x) * 4
    return [px[i], px[i + 1], px[i + 2]] as const
  }
  const corners = [at(1, 1), at(w - 2, 1), at(1, h - 2), at(w - 2, h - 2)]
  const br = corners.reduce((sum, c) => sum + c[0], 0) / 4
  const bg = corners.reduce((sum, c) => sum + c[1], 0) / 4
  const bb = corners.reduce((sum, c) => sum + c[2], 0) / 4
  const alpha = new Uint8Array(w * h)
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4
      const dr = px[i] - br
      const dg = px[i + 1] - bg
      const db = px[i + 2] - bb
      const dist = Math.sqrt(dr * dr + dg * dg + db * db)
      const white = px[i] > 236 && px[i + 1] > 236 && px[i + 2] > 236
      let a = 255
      if (white || dist < 22) a = 0
      else if (dist < 46) a = Math.round(((dist - 22) / 24) * 255)
      px[i + 3] = a
      alpha[y * w + x] = a
      if (a > 48) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX <= minX || maxY <= minY) {
    minX = 0
    minY = 0
    maxX = w - 1
    maxY = h - 1
  }
  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  let sr = 0
  let sg = 0
  let sb = 0
  let sn = 0
  const ring = Math.max(2, Math.round(Math.min(cw, ch) * 0.08))
  for (let y = minY; y <= maxY; y += 2) {
    for (let x = minX; x <= maxX; x += 2) {
      const edge = x < minX + ring || x > maxX - ring || y < minY + ring || y > maxY - ring
      if (!edge || alpha[y * w + x] < 180) continue
      const i = (y * w + x) * 4
      sr += px[i]
      sg += px[i + 1]
      sb += px[i + 2]
      sn += 1
    }
  }
  ctx.putImageData(imageData, 0, 0)
  const cropped = document.createElement('canvas')
  cropped.width = cw
  cropped.height = ch
  const out = cropped.getContext('2d')
  if (!out) throw new Error('listing')
  out.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch)
  const mask = new Uint8Array(cw * ch)
  for (let y = 0; y < ch; y += 1) {
    for (let x = 0; x < cw; x += 1) mask[y * cw + x] = alpha[(y + minY) * w + (x + minX)]
  }
  const side =
    sn > 0
      ? `rgb(${Math.round(sr / sn)}, ${Math.round(sg / sn)}, ${Math.round(sb / sn)})`
      : '#1a1c20'
  const texture = new THREE.CanvasTexture(cropped)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true
  return { texture, mask, cw, ch, side }
}

function buildSolid(image: HTMLImageElement, width: number, depth: number): Solid {
  const { texture, mask, cw, ch, side } = prepare(image)
  const height = width * (ch / cw)
  const cols = Math.min(cw, 110)
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const front: number[] = []
  const rest: number[] = []

  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number) => {
    const index = positions.length / 3
    positions.push(x, y, z)
    normals.push(nx, ny, nz)
    uvs.push(u, v)
    return index
  }

  const quad = (
    into: number[],
    a: number,
    b: number,
    c: number,
    d: number,
  ) => {
    into.push(a, b, c, a, c, d)
  }

  for (let c = 0; c < cols; c += 1) {
    const x0px = Math.floor((c / cols) * cw)
    const x1px = Math.max(x0px + 1, Math.floor(((c + 1) / cols) * cw) - 1)
    const runs: Array<[number, number]> = []
    let start = -1
    for (let y = 0; y <= ch; y += 1) {
      let on = false
      if (y < ch) {
        for (let x = x0px; x <= x1px; x += 1) {
          if (mask[y * cw + x] > 96) {
            on = true
            break
          }
        }
      }
      if (on && start < 0) start = y
      if (!on && start >= 0) {
        runs.push([start, y - 1])
        start = -1
      }
    }
    const pad = (width / cols) * 0.035
    const x0 = (c / cols - 0.5) * width - pad
    const x1 = ((c + 1) / cols - 0.5) * width + pad
    for (const [y0px, y1px] of runs) {
      const yTop = (0.5 - y0px / ch) * height
      const yBot = (0.5 - (y1px + 1) / ch) * height
      const u0 = x0px / cw
      const u1 = (x1px + 1) / cw
      const vTop = 1 - y0px / ch
      const vBot = 1 - (y1px + 1) / ch
      const z0 = -depth / 2
      const z1 = depth / 2
      const f00 = push(x0, yBot, z1, 0, 0, 1, u0, vBot)
      const f10 = push(x1, yBot, z1, 0, 0, 1, u1, vBot)
      const f11 = push(x1, yTop, z1, 0, 0, 1, u1, vTop)
      const f01 = push(x0, yTop, z1, 0, 0, 1, u0, vTop)
      quad(front, f00, f10, f11, f01)
      const b00 = push(x0, yBot, z0, 0, 0, -1, u0, vBot)
      const b10 = push(x1, yBot, z0, 0, 0, -1, u1, vBot)
      const b11 = push(x1, yTop, z0, 0, 0, -1, u1, vTop)
      const b01 = push(x0, yTop, z0, 0, 0, -1, u0, vTop)
      quad(rest, b00, b01, b11, b10)
      const t00 = push(x0, yTop, z0, 0, 1, 0, u0, vTop)
      const t10 = push(x1, yTop, z0, 0, 1, 0, u1, vTop)
      const t11 = push(x1, yTop, z1, 0, 1, 0, u1, vTop)
      const t01 = push(x0, yTop, z1, 0, 1, 0, u0, vTop)
      quad(rest, t00, t10, t11, t01)
      const d00 = push(x0, yBot, z0, 0, -1, 0, u0, vBot)
      const d10 = push(x1, yBot, z0, 0, -1, 0, u1, vBot)
      const d11 = push(x1, yBot, z1, 0, -1, 0, u1, vBot)
      const d01 = push(x0, yBot, z1, 0, -1, 0, u0, vBot)
      quad(rest, d00, d01, d11, d10)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  const indices = front.concat(rest)
  geometry.setIndex(indices)
  if (front.length) geometry.addGroup(0, front.length, 0)
  if (rest.length) geometry.addGroup(front.length, rest.length, 1)
  geometry.computeBoundingSphere()
  return { geometry, map: texture, height, side }
}

function loadSolid(src: string, width: number, depth: number): Promise<Solid> {
  const key = `${src}|${width.toFixed(4)}|${depth.toFixed(4)}`
  const hit = cache.get(key)
  if (hit) return Promise.resolve(hit)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const solid = buildSolid(image, width, depth)
      cache.set(key, solid)
      resolve(solid)
    }
    image.onerror = () => reject(new Error(src))
    image.src = src
  })
}

export function ListingSolid({
  src,
  width,
  depth,
  lay,
  hot,
  maxHeight,
}: {
  src: string
  width: number
  depth: number
  lay: 'stand' | 'flat'
  hot?: boolean
  maxHeight?: number
}) {
  const [solid, setSolid] = useState<Solid | null>(null)
  useEffect(() => {
    let live = true
    loadSolid(src, width, depth).then(
      (next) => {
        if (live) setSolid(next)
      },
      () => {
        if (live) setSolid(null)
      },
    )
    return () => {
      live = false
    }
  }, [src, width, depth])

  const materials = useMemo(() => {
    if (!solid) return null
    return [
      new THREE.MeshStandardMaterial({
        map: solid.map,
        roughness: 0.48,
        metalness: 0.06,
        transparent: true,
        alphaTest: 0.35,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        emissive: hot ? '#ff6a2c' : '#000000',
        emissiveIntensity: hot ? 0.18 : 0,
      }),
      new THREE.MeshStandardMaterial({
        color: solid.side,
        roughness: 0.62,
        metalness: 0.18,
        emissive: hot ? '#ff6a2c' : '#000000',
        emissiveIntensity: hot ? 0.12 : 0,
      }),
    ]
  }, [solid, hot])

  if (!solid || !materials) {
    return (
      <mesh position={lay === 'stand' ? [0, width * 0.62, 0] : [0, depth / 2, 0]} castShadow>
        <boxGeometry args={lay === 'stand' ? [width, width * 0.62, depth] : [width, depth, width * 0.4]} />
        <meshStandardMaterial color="#16181c" roughness={0.55} metalness={0.2} />
      </mesh>
    )
  }

  const fit = maxHeight && solid.height > maxHeight ? maxHeight / solid.height : 1
  const shownH = solid.height * fit
  const pose =
    lay === 'stand'
      ? { position: [0, shownH / 2, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] }
      : { position: [0, (depth * fit) / 2, 0] as [number, number, number], rotation: [-Math.PI / 2, 0, 0] as [number, number, number] }

  return (
    <group position={pose.position} rotation={pose.rotation} scale={fit}>
      <mesh geometry={solid.geometry} material={materials} castShadow receiveShadow />
      {lay === 'stand' && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -solid.height / 2 + 0.004, 0.02]} raycast={() => null}>
          <planeGeometry args={[width * 0.7, 0.12]} />
          <meshBasicMaterial color="#000" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
