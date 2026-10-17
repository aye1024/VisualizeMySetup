import { Html, OrbitControls, RoundedBox, useCursor } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import * as THREE from 'three'
import { DESK_WIDTH_MM } from '../catalog'
import type { Category, ResolvedPart } from '../types'
import { keyTexture, screenTexture, shadowTexture, woodTexture } from './textures'

const DESK_W = DESK_WIDTH_MM / 1000
const DESK_D = 0.72
const TOP = 0.75
const HOME_POS = new THREE.Vector3(0.42, 1.22, 2.22)
const HOME_TARGET = new THREE.Vector3(0, 0.68, 0)

export type HideKey = 'case' | 'monitor' | 'keyboard' | 'mouse' | 'headset'
export type Hand = 'left' | 'right'
export type SceneHandle = {
  nudge: (action: 'in' | 'out' | 'rot' | 'reset') => void
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
  dragX: number | null
  hand: Hand
  studio: boolean
  preview?: boolean
  reducedMotion?: boolean
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
  onSide?: (side: 'left' | 'right') => void
  onDragX?: (x: number) => void
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

function Hotspot({
  category,
  onSelect,
  onHover,
  children,
}: {
  category: Category
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
  children: ReactNode
}) {
  const [over, setOver] = useState(false)
  useCursor(over && Boolean(onSelect))
  return (
    <group
      onPointerOver={(event) => {
        event.stopPropagation()
        setOver(true)
        onHover?.(category)
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        setOver(false)
        onHover?.(null)
      }}
      onPointerDown={(event) => event.stopPropagation()}
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

const pointerStart = { x: 0, y: 0 }

function rememberPointer(event: ThreeEvent<PointerEvent>) {
  pointerStart.x = event.clientX
  pointerStart.y = event.clientY
}

function dragged(event: ThreeEvent<MouseEvent>) {
  const dx = event.clientX - pointerStart.x
  const dy = event.clientY - pointerStart.y
  return dx * dx + dy * dy > 25
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

function Desk({
  studio,
  interactive,
  onSide,
}: {
  studio: boolean
  interactive: boolean
  onSide?: (side: 'left' | 'right') => void
}) {
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
      <mesh
        position={[0, TOP - 0.016, 0]}
        castShadow
        receiveShadow
        onPointerDown={(event) => {
          rememberPointer(event)
        }}
        onClick={(event) => {
          if (!interactive || !onSide || dragged(event)) return
          event.stopPropagation()
          onSide(event.point.x < 0 ? 'left' : 'right')
        }}
      >
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
  onSelect,
  onHover,
}: {
  part: ResolvedPart
  position: [number, number, number]
  hot: boolean
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
}) {
  const w = (part.widthMm ?? 614) / 1000
  const h = (part.heightMm ?? 350) / 1000
  const stand = 0.078
  return (
    <Hotspot category="monitor" onSelect={onSelect} onHover={onHover}>
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
          <RoundedBox args={[w, h, 0.028]} radius={0.008} smoothness={3} castShadow>
            <meshStandardMaterial
              color={hot ? '#3a2a24' : '#121416'}
              metalness={0.55}
              roughness={0.32}
              emissive={hot ? '#ff6a2c' : '#000'}
              emissiveIntensity={hot ? 0.18 : 0}
            />
          </RoundedBox>
          <mesh position={[0, 0, 0.015]}>
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
          <mesh position={[0, -h / 2 + 0.01, 0.016]}>
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
  position,
  caseHot,
  gpuHot,
  outward,
  interactive,
  controls,
  onSelect,
  onHover,
  onDragX,
}: {
  part: ResolvedPart
  gpu?: ResolvedPart
  position: [number, number, number]
  caseHot: boolean
  gpuHot: boolean
  outward: number
  interactive: boolean
  controls: RefObject<OrbitHandle | null>
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
  onDragX?: (x: number) => void
}) {
  const w = (part.widthMm ?? 210) / 1000
  const h = (part.heightMm ?? 450) / 1000
  const d = (part.depthMm ?? 420) / 1000
  const style = part.scene
  const gl = useThree((state) => state.gl)
  const dragging = useRef(false)
  const moved = useRef(false)
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const [over, setOver] = useState(false)
  useCursor((over || dragging.current) && interactive)
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

  const beginDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!interactive) return
    event.stopPropagation()
    rememberPointer(event)
    moved.current = false
    dragging.current = true
    if (controls.current) controls.current.enabled = false
    try {
      gl.domElement.setPointerCapture(event.pointerId)
    } catch {
      /* pointer already released */
    }
  }

  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    event.stopPropagation()
    const dx = event.clientX - pointerStart.x
    const dy = event.clientY - pointerStart.y
    if (dx * dx + dy * dy > 16) moved.current = true
    if (event.ray.intersectPlane(plane, hit)) onDragX?.(hit.x)
  }

  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    dragging.current = false
    if (controls.current) controls.current.enabled = true
    try {
      if (gl.domElement.hasPointerCapture(event.pointerId)) {
        gl.domElement.releasePointerCapture(event.pointerId)
      }
    } catch {
      /* already released */
    }
    if (!moved.current) onSelect?.('case')
  }

  return (
    <group position={position}>
      <GroundShadow position={[0, 0.003, 0]} width={w * 1.3} depth={d * 1.05} />
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
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
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
  onSelect,
  onHover,
}: {
  part: ResolvedPart
  position: [number, number, number]
  hot: boolean
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
}) {
  const w = (part.widthMm ?? 360) / 1000
  const d = (part.depthMm ?? 145) / 1000
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
    <Hotspot category="keyboard" onSelect={onSelect} onHover={onHover}>
      <group position={position} rotation={[-0.04, 0, 0]}>
        <mesh position={[0, 0.016, 0]} castShadow material={[side, side, top, side, side, side]}>
          <boxGeometry args={[w, 0.028, d]} />
        </mesh>
      </group>
    </Hotspot>
  )
}

function MouseMesh({
  position,
  hot,
  flip,
  onSelect,
  onHover,
}: {
  position: [number, number, number]
  hot: boolean
  flip: boolean
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
}) {
  return (
    <Hotspot category="mouse" onSelect={onSelect} onHover={onHover}>
      <group position={position} rotation={[0, flip ? Math.PI : 0, 0]}>
        <mesh position={[0, 0.02, 0]} castShadow scale={[0.62, 0.7, 1]}>
          <sphereGeometry args={[0.028, 24, 16]} />
          <meshStandardMaterial
            color={hot ? '#4a3028' : '#1c1e22'}
            metalness={0.35}
            roughness={0.4}
            emissive={hot ? '#ff6a2c' : '#000'}
            emissiveIntensity={hot ? 0.2 : 0}
          />
        </mesh>
        <mesh position={[0, 0.034, -0.004]}>
          <boxGeometry args={[0.006, 0.008, 0.016]} />
          <meshStandardMaterial color="#8b9098" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </Hotspot>
  )
}

function HeadsetMesh({
  position,
  hot,
  onSelect,
  onHover,
}: {
  position: [number, number, number]
  hot: boolean
  onSelect?: (category: Category) => void
  onHover?: (category: Category | null) => void
}) {
  const band = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.075, 0.02, 0),
      new THREE.Vector3(-0.05, 0.09, 0),
      new THREE.Vector3(0, 0.115, 0),
      new THREE.Vector3(0.05, 0.09, 0),
      new THREE.Vector3(0.075, 0.02, 0),
    ])
    return new THREE.TubeGeometry(curve, 24, 0.008, 8, false)
  }, [])
  const color = hot ? '#4a3028' : '#262a30'
  return (
    <Hotspot category="headset" onSelect={onSelect} onHover={onHover}>
      <group position={position}>
        <GroundShadow position={[0, 0.003, 0]} width={0.2} depth={0.14} />
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
          <group key={side} position={[side * 0.075, 0.02, 0]} rotation={[0, 0, side * 0.15]}>
            <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.038, 0.04, 0.028, 20]} />
              <meshStandardMaterial color={color} metalness={0.35} roughness={0.45} />
            </mesh>
            <mesh position={[side * 0.012, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.026, 0.026, 0.01, 16]} />
              <meshStandardMaterial color="#c45c26" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    </Hotspot>
  )
}

function Mat({ x, z, w }: { x: number; z: number; w: number }) {
  return (
    <group position={[x, TOP + 0.001, z]}>
      <mesh receiveShadow raycast={() => null}>
        <boxGeometry args={[w, 0.004, 0.3]} />
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
    dragX,
    hand,
    studio,
    preview,
    onSelect,
    onHover,
    onSide,
    onDragX,
    controls,
  } = props
  const tower = partOf(parts, 'case')
  const gpu = partOf(parts, 'gpu')
  const monitor = partOf(parts, 'monitor')
  const keyboard = partOf(parts, 'keyboard')
  const interactive = !preview
  const hiddenSet = new Set(hidden)

  const towerW = (tower?.widthMm ?? 210) / 1000
  const towerD = (tower?.depthMm ?? 420) / 1000
  const minX = -DESK_W / 2 + towerW / 2 + 0.03
  const maxX = DESK_W / 2 - towerW / 2 - 0.03
  const towerX = THREE.MathUtils.clamp(dragX ?? (side === 'right' ? maxX - 0.01 : minX + 0.01), minX, maxX)
  const towerZ = Math.min(-0.02, DESK_D / 2 - towerD / 2 - 0.04)

  const deskLeft = -DESK_W / 2 + 0.03
  const deskRight = DESK_W / 2 - 0.03
  const zoneLeft = towerX >= 0 ? deskLeft : Math.max(deskLeft, towerX + towerW / 2 + 0.04)
  const zoneRight = towerX >= 0 ? Math.min(deskRight, towerX - towerW / 2 - 0.04) : deskRight
  const monitorW = (monitor?.widthMm ?? 614) / 1000
  const monitorX = THREE.MathUtils.clamp((zoneLeft + zoneRight) / 2, zoneLeft + monitorW / 2, zoneRight - monitorW / 2)
  const kbW = (keyboard?.widthMm ?? 360) / 1000
  const keyboardX = THREE.MathUtils.clamp(monitorX, zoneLeft + kbW / 2, zoneRight - kbW / 2)
  const mouseGap = kbW / 2 + 0.055
  const prefer = hand === 'right' ? 1 : -1
  let mouseX = keyboardX + prefer * mouseGap
  const mouseFits = mouseX > zoneLeft + 0.04 && mouseX < zoneRight - 0.04
  if (!mouseFits) mouseX = keyboardX - prefer * mouseGap
  const headsetX = towerX >= 0 ? deskLeft + 0.08 : deskRight - 0.08
  const focus = active ? anchorOf(active) : null
  const show = (key: HideKey) => !hiddenSet.has(key)

  const label = active ? partOf(parts, active) : undefined
  let labelPos: [number, number, number] | null = null
  if (label && !preview) {
    const anchor = anchorOf(label.category)
    const visible =
      anchor === 'gpu' || anchor === 'case' ? show('case') : show(anchor)
    if (visible) {
      if (anchor === 'monitor') labelPos = [monitorX, TOP + 0.62, -0.2]
      else if (anchor === 'keyboard') labelPos = [keyboardX, TOP + 0.12, 0.16]
      else if (anchor === 'mouse') labelPos = [mouseX, TOP + 0.12, 0.18]
      else if (anchor === 'headset') labelPos = [headsetX, TOP + 0.22, 0.02]
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
      <Desk studio={studio} interactive={interactive} onSide={onSide} />
      {show('keyboard') && keyboard && (
        <Mat x={(keyboardX + mouseX) / 2} z={0.16} w={Math.min(Math.abs(zoneRight - zoneLeft) - 0.04, kbW + 0.22)} />
      )}
      {show('monitor') && monitor && (
        <MonitorMesh
          part={monitor}
          position={[monitorX, TOP, -0.2]}
          hot={focus === 'monitor'}
          onSelect={interactive ? onSelect : undefined}
          onHover={interactive ? onHover : undefined}
        />
      )}
      {show('case') && tower && (
        <TowerMesh
          part={tower}
          gpu={gpu}
          position={[towerX, TOP, towerZ]}
          caseHot={focus === 'case'}
          gpuHot={focus === 'gpu'}
          outward={towerX >= 0 ? -1 : 1}
          interactive={interactive}
          controls={controls}
          onSelect={interactive ? onSelect : undefined}
          onHover={interactive ? onHover : undefined}
          onDragX={onDragX}
        />
      )}
      {show('keyboard') && keyboard && (
        <KeyboardMesh
          part={keyboard}
          position={[keyboardX, TOP, 0.16]}
          hot={focus === 'keyboard'}
          onSelect={interactive ? onSelect : undefined}
          onHover={interactive ? onHover : undefined}
        />
      )}
      {show('mouse') && (
        <MouseMesh
          position={[mouseX, TOP, 0.18]}
          hot={focus === 'mouse'}
          flip={mouseX < keyboardX}
          onSelect={interactive ? onSelect : undefined}
          onHover={interactive ? onHover : undefined}
        />
      )}
      {show('headset') && (
        <HeadsetMesh
          position={[headsetX, TOP, 0.02]}
          hot={focus === 'headset'}
          onSelect={interactive ? onSelect : undefined}
          onHover={interactive ? onHover : undefined}
        />
      )}
      {label && labelPos && (
        <Html position={labelPos} center distanceFactor={1.5} zIndexRange={[8, 0]} style={{ pointerEvents: 'none' }}>
          <div className="float-tag">{label.name}</div>
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
    nudge(action) {
      const orbit = controls.current
      if (!orbit) return
      if (action === 'reset') {
        orbit.object.position.copy(HOME_POS)
        orbit.target.copy(HOME_TARGET)
        orbit.update()
        return
      }
      const offset = orbit.object.position.clone().sub(orbit.target)
      if (action === 'rot') offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.4)
      if (action === 'in') offset.multiplyScalar(0.8)
      if (action === 'out') offset.multiplyScalar(1.22)
      offset.setLength(THREE.MathUtils.clamp(offset.length(), 0.9, 3.2))
      orbit.object.position.copy(orbit.target).add(offset)
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
