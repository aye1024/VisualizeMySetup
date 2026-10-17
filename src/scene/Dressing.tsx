import { useMemo } from 'react'
import * as THREE from 'three'

const TOP = 0.75

export function Dressing() {
  const leaf = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3e6b45', roughness: 0.7 }), [])
  const pot = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c8b49a', roughness: 0.55 }), [])
  const lamp = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d7d2cb', metalness: 0.7, roughness: 0.28 }), [])
  const shade = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#f2efe8', roughness: 0.8, emissive: '#ffb56a', emissiveIntensity: 0.18, side: THREE.DoubleSide }),
    [],
  )
  const mug = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4f1ec', roughness: 0.4 }), [])
  const book = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c1e22', roughness: 0.7 }), [])

  return (
    <group
      raycast={() => null}
      onUpdate={(group) => {
        group.traverse((obj) => {
          obj.raycast = () => null
        })
      }}
    >
      <group position={[-0.58, TOP, -0.26]}>
        <mesh raycast={() => null} position={[0, 0.035, 0]} castShadow material={pot}>
          <cylinderGeometry args={[0.038, 0.032, 0.07, 16]} />
        </mesh>
        <mesh position={[0, 0.09, 0]} material={leaf} castShadow>
          <sphereGeometry args={[0.045, 16, 12]} />
        </mesh>
        <mesh position={[0.03, 0.12, 0.01]} material={leaf} castShadow>
          <sphereGeometry args={[0.034, 14, 10]} />
        </mesh>
        <mesh position={[-0.025, 0.115, -0.01]} material={leaf} castShadow>
          <sphereGeometry args={[0.03, 14, 10]} />
        </mesh>
      </group>

      <group position={[-0.42, TOP, -0.28]}>
        <mesh position={[0, 0.008, 0]} material={lamp} castShadow>
          <cylinderGeometry args={[0.045, 0.05, 0.012, 20]} />
        </mesh>
        <mesh position={[0, 0.16, 0]} material={lamp} castShadow>
          <cylinderGeometry args={[0.008, 0.008, 0.3, 10]} />
        </mesh>
        <mesh position={[0.07, 0.3, 0.02]} rotation={[0, 0, -0.7]} material={lamp}>
          <cylinderGeometry args={[0.007, 0.007, 0.16, 8]} />
        </mesh>
        <mesh position={[0.12, 0.25, 0.03]} material={shade}>
          <coneGeometry args={[0.055, 0.07, 16, 1, true]} />
        </mesh>
      </group>

      <group position={[-0.5, TOP, 0.26]}>
        <mesh position={[0, 0.032, 0]} material={mug} castShadow>
          <cylinderGeometry args={[0.028, 0.024, 0.06, 18]} />
        </mesh>
        <mesh position={[0.03, 0.034, 0]} rotation={[Math.PI / 2, 0, 0]} material={mug}>
          <torusGeometry args={[0.014, 0.004, 8, 14]} />
        </mesh>
      </group>

      <group position={[0.22, TOP + 0.004, 0.28]} rotation={[0, -0.4, 0]}>
        <mesh material={book} castShadow>
          <boxGeometry args={[0.16, 0.008, 0.11]} />
        </mesh>
        <mesh position={[0.05, 0.008, 0.01]} rotation={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.12, 8]} />
          <meshStandardMaterial color="#c4552a" roughness={0.45} />
        </mesh>
      </group>
    </group>
  )
}
