import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Category } from '../types'

export type GeneratedModel = {
  url: string
  /** Applied before the mesh is measured, so the thin axis sits on the desk. */
  rotation: [number, number, number]
  /** Extra scale on the vertical axis after the mesh is fitted to the catalog size. */
  thin?: number
}

export const GENERATED_MODELS: Record<string, GeneratedModel> = {
  'mouse-g305': { url: '/models/mouse-g305.glb', rotation: [-Math.PI / 2, 0, 0] },
  'hs-g335': { url: '/models/hs-g335.glb', rotation: [-Math.PI / 2, 0, 0] },
  'case-pop-air': { url: '/models/case-pop-air.glb', rotation: [0, 0, 0] },
  'mon-1440': { url: '/models/mon-1440.glb', rotation: [0, 0, 0] },
  'kb-plain': { url: '/models/kb-plain.glb', rotation: [-Math.PI / 2, 0, 0], thin: 0.5 },
}

export function generatedModel(id: string | undefined): GeneratedModel | undefined {
  if (!id) return undefined
  return GENERATED_MODELS[id]
}

export function GeneratedMesh({
  url,
  rotation,
  size,
  hot,
  thin = 1,
}: {
  url: string
  rotation: [number, number, number]
  size: [number, number, number]
  hot: boolean
  thin?: number
}) {
  const gltf = useGLTF(url)
  const object = useMemo(() => {
    const root = gltf.scene.clone(true)
    const material = new THREE.MeshStandardMaterial({
      color: hot ? '#4a3028' : '#1c1e22',
      metalness: 0.4,
      roughness: 0.42,
      side: THREE.DoubleSide,
      emissive: hot ? '#ff6a2c' : '#000000',
      emissiveIntensity: hot ? 0.18 : 0,
    })
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry = child.geometry.clone()
        child.geometry.computeVertexNormals()
        child.material = material
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    root.rotation.set(rotation[0], rotation[1], rotation[2])
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root)
    const measured = box.getSize(new THREE.Vector3())
    const widthScale = size[0] / Math.max(measured.x, 1e-6)
    const heightScale = size[1] / Math.max(measured.y, 1e-6)
    const depthScale = size[2] / Math.max(measured.z, 1e-6)
    const scale =
      size[1] >= size[0] && size[1] >= size[2]
        ? heightScale
        : size[2] >= size[0] && size[2] >= size[1]
          ? depthScale
          : widthScale
    root.scale.multiplyScalar(scale)
    if (thin !== 1) root.scale.y *= thin
    root.updateMatrixWorld(true)
    const fitted = new THREE.Box3().setFromObject(root)
    const center = fitted.getCenter(new THREE.Vector3())
    root.position.set(-center.x, -fitted.min.y, -center.z)
    return root
  }, [gltf, hot, rotation, size, thin])

  return <primitive object={object} />
}

useGLTF.preload('/models/mouse-g305.glb')
useGLTF.preload('/models/hs-g335.glb')
useGLTF.preload('/models/case-pop-air.glb')
useGLTF.preload('/models/mon-1440.glb')
useGLTF.preload('/models/kb-plain.glb')

export function generatedSize(category: Category, part?: { widthMm?: number; heightMm?: number; depthMm?: number }): [number, number, number] {
  if (category === 'headset') return [0.18, 0.09, 0.2]
  const w = (part?.widthMm ?? 200) / 1000
  const h = (part?.heightMm ?? 40) / 1000
  const d = (part?.depthMm ?? 120) / 1000
  if (category === 'keyboard') return [w, h, d]
  return [w, h, d]
}
