import { Html, OrbitControls, RoundedBox, useCursor } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { DESK_WIDTH_MM, referralUrl } from '../catalog'
import { money } from '../recommend'
import type { Category, ResolvedPart } from '../types'
import { keyTexture, screenTexture, shadowTexture, woodTexture } from './textures'
import { GeneratedMesh, generatedModel, generatedSize, type GeneratedModel } from './GeneratedMesh'

const DESK_W = DESK_WIDTH_MM / 1000
const DESK_D = 0.72
const TOP = 0.75
const HOME_POS = new THREE.Vector3(0.42, 1.22, 2.22)
const HOME_TARGET = new THREE.Vector3(0, 0.68, 0)

export type HideKey = 'case' | 'monitor' | 'keyboard' | 'mouse' | 'headset'
export type Hand = 'left' | 'right'
export type DeskSpot = { x: number; z: number }
export type DeskSpots = Partial<Record<HideKey, DeskSpot>>
export type SceneHandle = {
  resetView: () => void
}

type OrbitHandle = {
  object: THREE.Camera
  target: THREE.Vector3
  update: () => void
  enabled: boolean
}

type Props = {
  parts: ResolvedPart[]
  active: Category | null
  hidden: HideKey[]
  side: 'left' | 'right'
  hand: Hand
  spots?: DeskSpots
  studio: boolean
  preview?: boolean
  reducedMotion?: boolean
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
  onPlace?: (key: HideKey, x: number, z: number) => void
}

function partOf(parts: ResolvedPart[], category: Category) {
  return parts.find((part) => part.category === category)
}

function anchorOf(category: Category): HideKey | 'gpu' {
  if (category === 'gpu') return 'gpu'
  if (
    category === 'monitor' ||
    category === 'keyboard' ||
    category === 'mouse' ||
    category === 'headset' ||
    category === 'case'
  ) {
    return category
  }
  return 'case'
}

const pointerStart = { x: 0, y: 0 }
let deskDragging = false
const dragWatchers = new Set<(dragging: boolean) => void>()

function setDeskDragging(dragging: boolean) {
  deskDragging = dragging
  for (const watch of dragWatchers) watch(dragging)
}

function rememberPointer(event: ThreeEvent<PointerEvent>) {
  pointerStart.x = event.clientX
  pointerStart.y = event.clientY
}

function dragged(event: ThreeEvent<MouseEvent>) {
  const dx = event.clientX - pointerStart.x
  const dy = event.clientY - pointerStart.y
  return dx * dx + dy * dy > 25
}

function useDeskDrag(
  controls: RefObject<OrbitHandle | null> | undefined,
  onPlace: ((x: number, z: number) => void) | undefined,
  onClick: (() => void) | undefined,
) {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const cleanup = useRef<(() => void) | null>(null)

  useEffect(() => () => cleanup.current?.(), [])

  const onDown = (event: ThreeEvent<PointerEvent>) => {
    rememberPointer(event)
    event.stopPropagation()
    if (!onPlace) return
    let moved = false
    if (controls?.current) controls.current.enabled = false
    setDeskDragging(true)
    try {
      gl.domElement.setPointerCapture(event.pointerId)
    } catch {
      /* pointer already released */
    }
    const move = (native: PointerEvent) => {
      const dx = native.clientX - pointerStart.x
      const dy = native.clientY - pointerStart.y
      if (dx * dx + dy * dy > 16) moved = true
      const rect = gl.domElement.getBoundingClientRect()
      ndc.set(((native.clientX - rect.left) / rect.width) * 2 - 1, -((native.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(plane, hit)) onPlace(hit.x, hit.z)
    }
    const up = (native: PointerEvent) => {
      cleanup.current = null
      gl.domElement.removeEventListener('pointermove', move)
      gl.domElement.removeEventListener('pointerup', up)
      try {
        if (gl.domElement.hasPointerCapture(native.pointerId)) gl.domElement.releasePointerCapture(native.pointerId)
      } catch {
        /* already released */
      }
      if (controls?.current) controls.current.enabled = true
      setDeskDragging(false)
      if (!moved) onClick?.()
    }
    cleanup.current = up
    gl.domElement.addEventListener('pointermove', move)
    gl.domElement.addEventListener('pointerup', up)
  }

  return onDown
}

function Hotspot({
  category,
  onSelect,
  onHover,
  controls,
  onPlace,
  children,
}: {
  category: Category
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
  controls?: RefObject<OrbitHandle | null>
  onPlace?: (x: number, z: number) => void
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  const onDown = useDeskDrag(controls, onPlace, onSelect ? () => onSelect(category) : undefined)
  useCursor(over && Boolean(onSelect))
  return (
    <group
      onPointerOver={(event) => {
        event.stopPropagation()
        if (deskDragging) return
        setOver(true)
        onHover?.(category)
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        if (deskDragging) return
        setOver(false)
        onHover?.(null)
      }}
      onPointerDown={onDown}
      onClick={(event) => {
        if (!onSelect || dragged(event)) return
        event.stopPropagation()
        onSelect(category)
      }}
    >
      {children}
    </group>
  )
}

function GroundShadow({
  position,
  width,
  depth,
}: {
  position: [number, number, number]
  width: number
  depth: number
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} raycast={() => null}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial
        map={shadowTexture()}
        transparent
        depthWrite={false}
        toneMapped={false}
        opacity={0.9}
      />
    </mesh>
  )
}

function Desk({ studio }: { studio: boolean }) {
  const wood = woodTexture()
  return (
    <group>
      {studio && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[8, 8]} />
            <meshStandardMaterial color="#241c18" roughness={1} />
          </mesh>
          <mesh position={[0, 1.7, -1.2]} receiveShadow>
            <planeGeometry args={[8, 4.2]} />
            <meshStandardMaterial color="#3a312b" roughness={1} />
          </mesh>
        </>
      )}
      <mesh position={[0, TOP - 0.016, 0]} castShadow receiveShadow>
        <boxGeometry args={[DESK_W, 0.032, DESK_D]} />
        <meshStandardMaterial map={wood} roughness={0.78} metalness={0.02} color="#f3d2b0" />
      </mesh>
      <mesh position={[0, TOP - 0.004, DESK_D / 2 - 0.008]}>
        <boxGeometry args={[DESK_W, 0.01, 0.016]} />
        <meshStandardMaterial color="#6a4128" roughness={0.8} />
      </mesh>
      {[
        [-DESK_W / 2 + 0.08, -DESK_D / 2 + 0.08],
        [DESK_W / 2 - 0.08, -DESK_D / 2 + 0.08],
        [-DESK_W / 2 + 0.08, DESK_D / 2 - 0.08],
        [DESK_W / 2 - 0.08, DESK_D / 2 - 0.08],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, (TOP - 0.032) / 2, z]} castShadow>
          <cylinderGeometry args={[0.018, 0.02, TOP - 0.032, 12]} />
          <meshStandardMaterial color="#1a1816" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function MonitorMesh({
  part,
  position,
  hot,
  controls,
  onPlace,
  onSelect,
  onHover,
}: {
  part: ResolvedPart
  position: [number, number, number]
  hot: boolean
  controls?: RefObject<OrbitHandle | null>
  onPlace?: (x: number, z: number) => void
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
}) {
  const w = (part.widthMm ?? 614) / 1000
  const h = (part.heightMm ?? 350) / 1000
  const stand = 0.078
  const thick = Math.min(0.04, Math.max(0.022, ((part.depthMm ?? 50) / 1000) * 0.55))
  return (
    <Hotspot category="monitor" onSelect={onSelect} onHover={onHover} controls={controls} onPlace={onPlace}>
      <group position={position}>
        <GroundShadow position={[0, 0.004, 0.02]} width={w * 0.72} depth={0.16} />
        <mesh position={[0, 0.008, 0.01]} receiveShadow>
          <boxGeometry args={[w * 0.36, 0.01, 0.16]} />
          <meshStandardMaterial color="#1b1d20" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[0, stand * 0.45, -0.01]} castShadow>
          <boxGeometry args={[0.045, stand, 0.03]} />
          <meshStandardMaterial color="#23262b" metalness={0.45} roughness={0.4} />
        </mesh>
        <group position={[0, stand + h / 2, 0]} rotation={[-0.07, 0, 0]}>
          <RoundedBox args={[w, h, thick]} radius={0.008} smoothness={3} castShadow>
            <meshStandardMaterial
              color={hot ? '#3a2a24' : '#121416'}
              metalness={0.55}
              roughness={0.32}
              emissive={hot ? '#ff6a2c' : '#000'}
              emissiveIntensity={hot ? 0.18 : 0}
            />
          </RoundedBox>
          <mesh position={[0, 0, thick / 2 + 0.001]}>
            <planeGeometry args={[w - 0.028, h - 0.028]} />
            <meshStandardMaterial
              map={screenTexture()}
              emissive="#9ecfff"
              emissiveMap={screenTexture()}
              emissiveIntensity={0.55}
              roughness={0.35}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, -h / 2 + 0.01, thick / 2 + 0.002]}>
            <sphereGeometry args={[0.004, 12, 12]} />
            <meshStandardMaterial color="#d7ffd0" emissive="#9dff8a" emissiveIntensity={1.4} />
          </mesh>
        </group>
      </group>
    </Hotspot>
  )
}

function TowerMesh({
  part,
  gpu,
  model,
  position,
  caseHot,
  gpuHot,
  outward,
  interactive,
  controls,
  onSelect,
  onHover,
  onPlace,
}: {
  part: ResolvedPart
  gpu?: ResolvedPart
  model?: GeneratedModel
  position: [number, number, number]
  caseHot: boolean
  gpuHot: boolean
  outward: number
  interactive: boolean
  controls: RefObject<OrbitHandle | null>
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
  onPlace?: (x: number, z: number) => void
}) {
  const w = (part.widthMm ?? 210) / 1000
  const h = (part.heightMm ?? 450) / 1000
  const d = (part.depthMm ?? 420) / 1000
  const style = part.scene
  const [over, setOver] = useState(false)
  const onDown = useDeskDrag(controls, onPlace, onSelect ? () => onSelect('case') : undefined)
  useCursor(over && Boolean(onSelect))
  const strip = useRef<THREE.MeshStandardMaterial>(null)
  const led = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const pulse = 0.55 + Math.sin(clock.elapsedTime * 2.2) * 0.35
    if (strip.current) strip.current.emissiveIntensity = pulse
    if (led.current) led.current.emissiveIntensity = 0.8 + pulse
  })

  const gpuL = Math.min((gpu?.depthMm ?? 240) / 1000, d * 0.78)
  const gpuH = Math.min((gpu?.heightMm ?? 110) / 1000, h * 0.38)
  const accent = gpu?.scene === 'amd' ? '#e23b32' : '#7cff4a'
  const body = style === 'silent' ? '#3c4148' : '#171a1f'
  const slots = style !== 'silent'

  return (
    <group position={position}>
      <GroundShadow position={[0, 0.003, 0]} width={w * 1.3} depth={d * 1.05} />
      {model ? (
        <>
          <Suspense fallback={null}>
            <GeneratedMesh url={model.url} rotation={model.rotation} size={[w, h, d]} hot={caseHot} />
          </Suspense>
          <mesh
            position={[0, h / 2, 0]}
            onPointerOver={(event) => {
              event.stopPropagation()
              setOver(true)
              onHover?.('case')
            }}
            onPointerOut={() => {
              setOver(false)
              onHover?.(null)
            }}
            onPointerDown={onDown}
            onClick={(event) => {
              if (interactive || !onSelect || dragged(event)) return
              event.stopPropagation()
              onSelect('case')
            }}
          >
            <boxGeometry args={[w, h, d]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </>
      ) : (
        <>
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz]) => (
        <mesh key={`${sx}-${sz}`} position={[sx * w * 0.36, 0.008, sz * d * 0.36]} raycast={() => null} castShadow>
          <boxGeometry args={[w * 0.22, 0.014, d * 0.14]} />
          <meshStandardMaterial color="#0c0d10" roughness={0.55} metalness={0.35} />
        </mesh>
      ))}
      {(
        [
          [0, 0.016, 0, w, 0.012, d],
          [0, h - 0.004, 0, w, 0.012, d],
          [0, h / 2, d / 2 - 0.006, w - 0.02, h - 0.02, 0.012],
          [0, h / 2, -d / 2 + 0.006, w - 0.02, h - 0.02, 0.012],
          [-outward * (w / 2 - 0.006), h / 2, 0, 0.012, h, d],
        ] as Array<[number, number, number, number, number, number]>
      ).map(([x, y, z, pw, ph, pd], index) => (
        <mesh
          key={index}
          position={[x, y + 0.01, z]}
          castShadow
          receiveShadow
          onPointerOver={(event) => {
            event.stopPropagation()
            setOver(true)
            onHover?.('case')
          }}
          onPointerOut={() => {
            setOver(false)
            onHover?.(null)
          }}
          onPointerDown={onDown}
          onClick={(event) => {
            if (interactive || !onSelect || dragged(event)) return
            event.stopPropagation()
            onSelect('case')
          }}
        >
          <boxGeometry args={[pw, ph, pd]} />
          <meshStandardMaterial
            color={caseHot ? '#4a3028' : body}
            metalness={0.48}
            roughness={0.38}
            emissive={caseHot ? '#ff6a2c' : '#000'}
            emissiveIntensity={caseHot ? 0.16 : 0}
          />
        </mesh>
      ))}
      <mesh position={[0, h * 0.52, d / 2 + 0.001]} raycast={() => null}>
        <boxGeometry args={[w * 0.9, h * 0.86, 0.008]} />
        <meshStandardMaterial color={style === 'silent' ? '#2a2e33' : '#0c0e11'} roughness={0.7} />
      </mesh>
      {slots &&
        Array.from({ length: 8 }, (_, index) => (
          <mesh
            key={index}
            position={[0, h * 0.22 + index * h * 0.08, d / 2 + 0.008]}
            raycast={() => null}
          >
            <boxGeometry args={[w * 0.72, h * 0.018, 0.006]} />
            <meshStandardMaterial color="#070809" roughness={0.5} metalness={0.2} />
          </mesh>
        ))}
      {style === 'rgb' && (
        <mesh position={[0, h * 0.16, d / 2 + 0.012]} raycast={() => null}>
          <boxGeometry args={[w * 0.7, 0.012, 0.006]} />
          <meshStandardMaterial
            ref={strip}
            color="#ff5a2a"
            emissive="#ff4d1c"
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
      )}
      <mesh position={[outward * (w / 2 + 0.003), h * 0.52, 0]} raycast={() => null}>
        <boxGeometry args={[0.006, h * 0.78, d * 0.82]} />
        <meshStandardMaterial
          color="#8eacbf"
          transparent
          opacity={0.16}
          roughness={0.05}
          metalness={0.05}
          depthWrite={false}
        />
      </mesh>
        </>
      )}
      {gpu && (
        <group position={[outward * (w / 2 - 0.02), h * 0.4, 0]}>
          <mesh castShadow raycast={() => null}>
            <boxGeometry args={[0.036, gpuH, gpuL]} />
            <meshStandardMaterial
              color={gpuHot ? '#4a342c' : '#101114'}
              metalness={0.6}
              roughness={0.32}
              emissive={gpuHot ? '#ff6a2c' : '#000'}
              emissiveIntensity={gpuHot ? 0.25 : 0}
            />
          </mesh>
          {[-gpuL * 0.22, gpuL * 0.22].map((z) => (
            <mesh key={z} position={[outward * 0.02, 0, z]} rotation={[0, Math.PI / 2, 0]} raycast={() => null}>
              <cylinderGeometry args={[gpuH * 0.28, gpuH * 0.28, 0.008, 20]} />
              <meshStandardMaterial color="#2a2e33" metalness={0.4} roughness={0.45} />
            </mesh>
          ))}
          <mesh position={[outward * 0.02, -gpuH * 0.38, 0]} raycast={() => null}>
            <boxGeometry args={[0.008, 0.01, gpuL * 0.7]} />
            <meshStandardMaterial
              ref={led}
              color={accent}
              emissive={accent}
              emissiveIntensity={1.2}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
      {gpu && (
        <Hotspot category="gpu" onSelect={onSelect} onHover={onHover}>
          <mesh position={[outward * (w / 2 + 0.02), h * 0.46, 0]}>
            <boxGeometry args={[0.05, h * 0.62, d * 0.72]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </Hotspot>
      )}
      <mesh position={[w * 0.22, h + 0.014, d * 0.28]} raycast={() => null}>
        <cylinderGeometry args={[0.01, 0.01, 0.008, 16]} />
        <meshStandardMaterial color="#0e0e0e" />
      </mesh>
      <mesh position={[w * 0.22, h + 0.02, d * 0.28]} raycast={() => null}>
        <sphereGeometry args={[0.004, 10, 10]} />
        <meshStandardMaterial color="#d9ffe2" emissive="#b6ff9a" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

function KeyboardMesh({
  part,
  position,
  hot,
  controls,
  onPlace,
  onSelect,
  onHover,
}: {
  part: ResolvedPart
  position: [number, number, number]
  hot: boolean
  controls?: RefObject<OrbitHandle | null>
  onPlace?: (x: number, z: number) => void
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
}) {
  const w = (part.widthMm ?? 360) / 1000
  const d = (part.depthMm ?? 145) / 1000
  const h = Math.min((part.heightMm ?? 36) / 1000, 0.02)
  const rgb = part.scene === 'rgb'
  const top = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: keyTexture(rgb),
        roughness: 0.55,
        metalness: 0.1,
        emissive: new THREE.Color(hot ? '#ff6a2c' : rgb ? '#ff5a2a' : '#000000'),
        emissiveIntensity: hot ? 0.2 : rgb ? 0.08 : 0,
      }),
    [rgb, hot],
  )
  const side = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: hot ? '#4a3028' : '#1a1d22',
        roughness: 0.5,
        metalness: 0.3,
      }),
    [hot],
  )
  return (
    <Hotspot category="keyboard" onSelect={onSelect} onHover={onHover} controls={controls} onPlace={onPlace}>
      <group position={position} rotation={[-0.04, 0, 0]}>
        <mesh position={[0, h / 2, 0]} castShadow material={[side, side, top, side, side, side]}>
          <boxGeometry args={[w, h, d]} />
        </mesh>
      </group>
    </Hotspot>
  )
}

function MouseMesh({
  part,
  position,
  hot,
  flip,
  controls,
  onPlace,
  onSelect,
  onHover,
}: {
  part?: ResolvedPart
  position: [number, number, number]
  hot: boolean
  flip: boolean
  controls?: RefObject<OrbitHandle | null>
  onPlace?: (x: number, z: number) => void
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
}) {
  const w = (part?.widthMm ?? 65) / 1000
  const h = (part?.heightMm ?? 40) / 1000
  const d = (part?.depthMm ?? 120) / 1000
  return (
    <Hotspot category="mouse" onSelect={onSelect} onHover={onHover} controls={controls} onPlace={onPlace}>
      <group position={position} rotation={[0, flip ? Math.PI : 0, 0]}>
        <mesh position={[0, h / 2, 0]} castShadow scale={[w / 0.056, h / 0.056, d / 0.056]}>
          <sphereGeometry args={[0.028, 24, 16]} />
          <meshStandardMaterial
            color={hot ? '#4a3028' : '#1c1e22'}
            metalness={0.35}
            roughness={0.4}
            emissive={hot ? '#ff6a2c' : '#000'}
            emissiveIntensity={hot ? 0.2 : 0}
          />
        </mesh>
        <mesh position={[0, h * 0.72, -d * 0.12]}>
          <boxGeometry args={[0.008, h * 0.22, d * 0.16]} />
          <meshStandardMaterial color="#8b9098" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </Hotspot>
  )
}

function HeadsetMesh({
  position,
  hot,
  controls,
  onPlace,
  onSelect,
  onHover,
}: {
  position: [number, number, number]
  hot: boolean
  controls?: RefObject<OrbitHandle | null>
  onPlace?: (x: number, z: number) => void
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
}) {
  const band = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.07, 0.04, 0),
      new THREE.Vector3(-0.035, 0.045, 0.055),
      new THREE.Vector3(0, 0.048, 0.08),
      new THREE.Vector3(0.035, 0.045, 0.055),
      new THREE.Vector3(0.07, 0.04, 0),
    ])
    return new THREE.TubeGeometry(curve, 24, 0.007, 8, false)
  }, [])
  const color = hot ? '#4a3028' : '#262a30'
  return (
    <Hotspot category="headset" onSelect={onSelect} onHover={onHover} controls={controls} onPlace={onPlace}>
      <group position={position} rotation={[0, 0.4, 0]}>
        <GroundShadow position={[0, 0.002, 0.03]} width={0.22} depth={0.16} />
        <mesh geometry={band} castShadow>
          <meshStandardMaterial
            color={color}
            metalness={0.4}
            roughness={0.4}
            emissive={hot ? '#ff6a2c' : '#000'}
            emissiveIntensity={hot ? 0.16 : 0}
          />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.07, 0.04, 0]}>
            <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.04, 0.042, 0.028, 20]} />
              <meshStandardMaterial color={color} metalness={0.35} roughness={0.45} />
            </mesh>
            <mesh position={[side * -0.012, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.026, 0.026, 0.008, 16]} />
              <meshStandardMaterial color="#c45c26" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    </Hotspot>
  )
}

function Mat({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  return (
    <group position={[x, TOP + 0.001, z]}>
      <mesh receiveShadow raycast={() => null}>
        <boxGeometry args={[w, 0.004, d]} />
        <meshStandardMaterial color="#2a241e" roughness={0.92} />
      </mesh>
    </group>
  )
}

function Rig({
  controls,
  spin,
}: {
  controls: RefObject<OrbitHandle | null>
  spin: boolean
}) {
  return (
    <OrbitControls
      ref={controls as never}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      autoRotate={spin}
      autoRotateSpeed={0.65}
      minPolarAngle={0.55}
      maxPolarAngle={Math.PI / 2.04}
      minDistance={0.85}
      maxDistance={3.3}
      target={HOME_TARGET}
    />
  )
}

function Stage(props: Props & { controls: RefObject<OrbitHandle | null>; spinning: boolean }) {
  const {
    parts,
    active,
    hidden,
    side,
    hand,
    spots,
    studio,
    preview,
    onSelect,
    onHover,
    onPlace,
    controls,
  } = props
  const tower = partOf(parts, 'case')
  const gpu = partOf(parts, 'gpu')
  const monitor = partOf(parts, 'monitor')
  const keyboard = partOf(parts, 'keyboard')
  const mouse = partOf(parts, 'mouse')
  const headset = partOf(parts, 'headset')
  const mouseModel = generatedModel(mouse?.id)
  const headsetModel = generatedModel(headset?.id)
  const monitorModel = generatedModel(monitor?.id)
  const caseModel = generatedModel(tower?.id)
  const keyboardModel = generatedModel(keyboard?.id)
  const interactive = !preview
  const hiddenSet = new Set(hidden)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    dragWatchers.add(setDragging)
    return () => {
      dragWatchers.delete(setDragging)
    }
  }, [])

  const towerW = (tower?.widthMm ?? 210) / 1000
  const towerD = (tower?.depthMm ?? 420) / 1000
  const minX = -DESK_W / 2 + towerW / 2 + 0.03
  const maxX = DESK_W / 2 - towerW / 2 - 0.03
  const towerX0 = side === 'right' ? maxX - 0.01 : minX + 0.01
  const towerZ0 = Math.min(-0.02, DESK_D / 2 - towerD / 2 - 0.04)

  const deskLeft = -DESK_W / 2 + 0.03
  const deskRight = DESK_W / 2 - 0.03
  const zoneLeft = towerX0 >= 0 ? deskLeft : Math.max(deskLeft, towerX0 + towerW / 2 + 0.04)
  const zoneRight = towerX0 >= 0 ? Math.min(deskRight, towerX0 - towerW / 2 - 0.04) : deskRight
  const monitorW = (monitor?.widthMm ?? 614) / 1000
  const monitorD = Math.max((monitor?.depthMm ?? 80) / 1000, 0.2)
  const monitorX0 = THREE.MathUtils.clamp((zoneLeft + zoneRight) / 2, zoneLeft + monitorW / 2, zoneRight - monitorW / 2)
  const kbW = (keyboard?.widthMm ?? 360) / 1000
  const kbD = (keyboard?.depthMm ?? 145) / 1000
  const keyboardX0 = THREE.MathUtils.clamp(monitorX0, zoneLeft + kbW / 2, zoneRight - kbW / 2)
  const mouseW = (mouse?.widthMm ?? 65) / 1000
  const mouseD = (mouse?.depthMm ?? 120) / 1000
  const mouseGap = kbW / 2 + mouseW / 2 + 0.03
  const prefer = hand === 'right' ? 1 : -1
  let mouseX0 = keyboardX0 + prefer * mouseGap
  const mouseFits = mouseX0 > zoneLeft + 0.04 && mouseX0 < zoneRight - 0.04
  if (!mouseFits) mouseX0 = keyboardX0 - prefer * mouseGap
  const headsetX0 = towerX0 >= 0 ? deskLeft + 0.12 : deskRight - 0.12

  const settle = (key: HideKey, x: number, z: number, halfW: number, halfD: number): [number, number] => {
    const spot = spots?.[key]
    return [
      THREE.MathUtils.clamp(spot?.x ?? x, -DESK_W / 2 + halfW + 0.02, DESK_W / 2 - halfW - 0.02),
      THREE.MathUtils.clamp(spot?.z ?? z, -DESK_D / 2 + halfD + 0.02, DESK_D / 2 - halfD - 0.02),
    ]
  }
  const [towerX, towerZ] = settle('case', towerX0, towerZ0, towerW / 2, towerD / 2)
  const [monitorX, monitorZ] = settle('monitor', monitorX0, -0.2, monitorW / 2, monitorD / 2)
  const [keyboardX, keyboardZ] = settle('keyboard', keyboardX0, 0.16, kbW / 2, kbD / 2)
  const [mouseX, mouseZ] = settle('mouse', mouseX0, 0.18, mouseW / 2, mouseD / 2)
  const [headsetX, headsetZ] = settle('headset', headsetX0, 0.02, 0.1, 0.1)
  const slide = (key: HideKey, x: number, z: number, halfW: number, halfD: number) => {
    onPlace?.(
      key,
      THREE.MathUtils.clamp(x, -DESK_W / 2 + halfW + 0.02, DESK_W / 2 - halfW - 0.02),
      THREE.MathUtils.clamp(z, -DESK_D / 2 + halfD + 0.02, DESK_D / 2 - halfD - 0.02),
    )
  }
  const focus = active ? anchorOf(active) : null
  const show = (key: HideKey) => !hiddenSet.has(key)

  const label = active ? partOf(parts, active) : undefined
  let labelPos: [number, number, number] | null = null
  if (label) {
    const anchor = anchorOf(label.category)
    const visible =
      anchor === 'gpu' || anchor === 'case' ? show('case') : show(anchor)
    if (visible) {
      if (anchor === 'monitor') labelPos = [monitorX, TOP + 0.078 + (monitor?.heightMm ?? 350) / 1000 + 0.06, monitorZ]
      else if (anchor === 'keyboard') labelPos = [keyboardX, TOP + 0.1, keyboardZ]
      else if (anchor === 'mouse') labelPos = [mouseX, TOP + (mouse?.heightMm ?? 40) / 1000 + 0.08, mouseZ]
      else if (anchor === 'headset') labelPos = [headsetX, TOP + 0.12, headsetZ]
      else labelPos = [towerX, TOP + (tower?.heightMm ?? 450) / 1000 + 0.08, towerZ]
    }
  }

  return (
    <>
      <hemisphereLight args={['#fff6ec', '#3a2c22', 0.95]} />
      <directionalLight
        position={[2.6, 4.2, 2.4]}
        intensity={2.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00035}
        shadow-normalBias={0.03}
        shadow-camera-near={0.4}
        shadow-camera-far={9}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
      />
      <directionalLight position={[-2.4, 1.8, -1.4]} intensity={0.55} color="#c5d4ff" />
      <pointLight position={[0.1, 1.7, 0.5]} intensity={6} distance={5} decay={2} color="#ffe0bf" />
      <Desk studio={studio} />
      {show('keyboard') && keyboard && (() => {
        const spanLeft = Math.min(keyboardX - kbW / 2, mouseX - mouseW / 2)
        const spanRight = Math.max(keyboardX + kbW / 2, mouseX + mouseW / 2)
        const spanBack = Math.min(keyboardZ - kbD / 2, mouseZ - mouseD / 2)
        const spanFront = Math.max(keyboardZ + kbD / 2, mouseZ + mouseD / 2)
        const margin = 0.03
        return (
          <Mat
            x={(spanLeft + spanRight) / 2}
            z={(spanBack + spanFront) / 2}
            w={spanRight - spanLeft + margin * 2}
            d={spanFront - spanBack + margin * 2}
          />
        )
      })()}
      {show('monitor') && monitor && (
        monitorModel ? (
          <Hotspot
            category="monitor"
            onSelect={onSelect}
            onHover={onHover}
            controls={controls}
            onPlace={interactive ? (x, z) => slide('monitor', x, z, monitorW / 2, monitorD / 2) : undefined}
          >
            <group position={[monitorX, TOP, monitorZ]}>
              <Suspense fallback={null}>
                <GeneratedMesh
                  url={monitorModel.url}
                  rotation={monitorModel.rotation}
                  size={generatedSize('monitor', monitor)}
                  hot={focus === 'monitor'}
                />
              </Suspense>
            </group>
          </Hotspot>
        ) : (
          <MonitorMesh
            part={monitor}
            position={[monitorX, TOP, monitorZ]}
            hot={focus === 'monitor'}
            controls={controls}
            onPlace={interactive ? (x, z) => slide('monitor', x, z, monitorW / 2, monitorD / 2) : undefined}
            onSelect={onSelect}
            onHover={onHover}
          />
        )
      )}
      {show('case') && tower && (
        <TowerMesh
          part={tower}
          gpu={gpu}
          model={caseModel}
          position={[towerX, TOP, towerZ]}
          caseHot={focus === 'case'}
          gpuHot={focus === 'gpu'}
          outward={towerX >= 0 ? -1 : 1}
          interactive={interactive}
          controls={controls}
          onSelect={onSelect}
          onHover={onHover}
          onPlace={interactive ? (x, z) => slide('case', x, z, towerW / 2, towerD / 2) : undefined}
        />
      )}
      {show('keyboard') && keyboard && (
        keyboardModel ? (
          <Hotspot
            category="keyboard"
            onSelect={onSelect}
            onHover={onHover}
            controls={controls}
            onPlace={interactive ? (x, z) => slide('keyboard', x, z, kbW / 2, kbD / 2) : undefined}
          >
            <group position={[keyboardX, TOP, keyboardZ]}>
              <Suspense fallback={null}>
                <GeneratedMesh
                  url={keyboardModel.url}
                  rotation={keyboardModel.rotation}
                  size={generatedSize('keyboard', keyboard)}
                  thin={keyboardModel.thin}
                  hot={focus === 'keyboard'}
                />
              </Suspense>
            </group>
          </Hotspot>
        ) : (
          <KeyboardMesh
            part={keyboard}
            position={[keyboardX, TOP, keyboardZ]}
            hot={focus === 'keyboard'}
            controls={controls}
            onPlace={interactive ? (x, z) => slide('keyboard', x, z, kbW / 2, kbD / 2) : undefined}
            onSelect={onSelect}
            onHover={onHover}
          />
        )
      )}
      {show('mouse') &&
        (mouseModel && mouse ? (
          <Hotspot
            category="mouse"
            onSelect={onSelect}
            onHover={onHover}
            controls={controls}
            onPlace={interactive ? (x, z) => slide('mouse', x, z, mouseW / 2, mouseD / 2) : undefined}
          >
            <group position={[mouseX, TOP, mouseZ]} rotation={[0, mouseX < keyboardX ? Math.PI : 0, 0]}>
              <Suspense fallback={null}>
                <GeneratedMesh
                  url={mouseModel.url}
                  rotation={mouseModel.rotation}
                  size={generatedSize('mouse', mouse)}
                  hot={focus === 'mouse'}
                />
              </Suspense>
            </group>
          </Hotspot>
        ) : (
          <MouseMesh
            part={mouse}
            position={[mouseX, TOP, mouseZ]}
            hot={focus === 'mouse'}
            flip={mouseX < keyboardX}
            controls={controls}
            onPlace={interactive ? (x, z) => slide('mouse', x, z, mouseW / 2, mouseD / 2) : undefined}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      {show('headset') &&
        (headsetModel ? (
          <Hotspot
            category="headset"
            onSelect={onSelect}
            onHover={onHover}
            controls={controls}
            onPlace={interactive ? (x, z) => slide('headset', x, z, 0.1, 0.1) : undefined}
          >
            <group position={[headsetX, TOP, headsetZ]} rotation={[0, 0.6, 0]}>
              <Suspense fallback={null}>
                <GeneratedMesh
                  url={headsetModel.url}
                  rotation={headsetModel.rotation}
                  size={generatedSize('headset', headset)}
                  hot={focus === 'headset'}
                />
              </Suspense>
            </group>
          </Hotspot>
        ) : (
          <HeadsetMesh
            position={[headsetX, TOP, headsetZ]}
            hot={focus === 'headset'}
            controls={controls}
            onPlace={interactive ? (x, z) => slide('headset', x, z, 0.1, 0.1) : undefined}
            onSelect={onSelect}
            onHover={onHover}
          />
        ))}
      {label && labelPos && !dragging && (
        <Html key={`${label.id}:${labelPos.join(',')}`} position={labelPos} center style={{ pointerEvents: 'none' }}>
          <div className="part-card">
            <strong>{label.name}</strong>
            <span>{money(label.price)}</span>
            <a href={referralUrl(label)} target="_blank" rel="noreferrer">
              View to buy
            </a>
          </div>
        </Html>
      )}
      <Rig controls={controls} spin={props.spinning} />
    </>
  )
}

export const SetupScene = forwardRef<SceneHandle, Props>(function SetupScene(props, ref) {
  const controls = useRef<OrbitHandle | null>(null)
  const [ready, setReady] = useState(false)
  const [spinning, setSpinning] = useState(Boolean(props.preview) && !props.reducedMotion)

  useImperativeHandle(ref, () => ({
    resetView() {
      const orbit = controls.current
      if (!orbit) return
      orbit.object.position.copy(HOME_POS)
      orbit.target.copy(HOME_TARGET)
      orbit.update()
    },
  }))

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [HOME_POS.x, HOME_POS.y, HOME_POS.z], fov: 42, near: 0.05, far: 30 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0)
        gl.toneMappingExposure = 1.08
        gl.domElement.addEventListener('pointerdown', () => setSpinning(false), { once: true })
        setReady(true)
      }}
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 280ms ease' }}
    >
      <Stage {...props} controls={controls} spinning={spinning} />
    </Canvas>
  )
})
