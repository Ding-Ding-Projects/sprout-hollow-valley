import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'
import type { BufferGeometry, Material } from 'three'
import type { NPCDef, NPCState } from '../../life/types'
import type { NpcPresentationPlacement } from './types'

const TAU = Math.PI * 2

function colorFromSeed(seed: number, offset: number): number {
  const hue = ((seed >>> offset) & 0xff) / 255
  const band = Math.floor(hue * 6)
  const fraction = hue * 6 - band
  const high = 0xc8
  const low = 0x48
  const middle = Math.round(low + (high - low) * fraction)
  const colors = [
    [high, middle, low],
    [middle, high, low],
    [low, high, middle],
    [low, middle, high],
    [middle, low, high],
    [high, low, middle],
  ] as const
  const [red, green, blue] = colors[band % colors.length] ?? colors[0]
  return (red << 16) | (green << 8) | blue
}

function skinColor(seed: number): number {
  const palette = [0xf2c9a5, 0xd9a679, 0xb9784f, 0x8a563b, 0x68402f] as const
  return palette[(seed >>> 19) % palette.length] ?? palette[0]
}

function avatarHeight(definition: NPCDef): number {
  switch (definition.identity.lifeStage) {
    case 'young-adult':
      return 1.68
    case 'adult':
      return 1.76
    case 'older-adult':
      return 1.72
    case 'elder':
      return 1.64
  }
}

function configureMesh(mesh: Mesh): void {
  mesh.castShadow = true
  mesh.receiveShadow = true
}

export interface ProceduralNpcAvatar {
  readonly root: Group
  readonly radius: number
  readonly height: number
  update(placement: NpcPresentationPlacement, state: NPCState): void
  dispose(): void
}

/** Creates a bundled low-poly avatar without image, model, font, or network dependencies. */
export function createProceduralNpcAvatar(definition: NPCDef): ProceduralNpcAvatar {
  const height = avatarHeight(definition)
  const radius = 0.34
  const root = new Group()
  root.name = `npc-avatar:${definition.id}`
  root.userData.npcId = definition.id
  root.userData.displayName = definition.identity.displayName
  root.userData.interactive = true

  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const material = (color: number, roughness = 0.84): MeshStandardMaterial => {
    const result = new MeshStandardMaterial({ color, roughness, flatShading: true })
    materials.push(result)
    return result
  }

  const clothing = material(colorFromSeed(definition.appearanceSeed, 0))
  const accent = material(colorFromSeed(definition.appearanceSeed, 8), 0.78)
  const skin = material(skinColor(definition.appearanceSeed), 0.9)
  const hair = material(0x2e241f + ((definition.appearanceSeed >>> 24) & 0x0f0f0f), 0.96)
  const boot = material(0x302c2a, 0.98)

  const bodyGeometry = new CylinderGeometry(0.28, 0.34, height * 0.47, 6)
  const headGeometry = new SphereGeometry(height * 0.115, 8, 5)
  const hairGeometry = new SphereGeometry(height * 0.121, 8, 4, 0, TAU, 0, Math.PI * 0.58)
  const limbGeometry = new BoxGeometry(0.12, height * 0.34, 0.13)
  const bootGeometry = new BoxGeometry(0.15, 0.16, 0.23)
  geometries.push(bodyGeometry, headGeometry, hairGeometry, limbGeometry, bootGeometry)

  const body = new Mesh(bodyGeometry, clothing)
  body.name = 'body'
  body.position.y = height * 0.56
  configureMesh(body)
  root.add(body)

  const head = new Mesh(headGeometry, skin)
  head.name = 'head'
  head.position.y = height * 0.88
  configureMesh(head)
  root.add(head)

  const hairMesh = new Mesh(hairGeometry, hair)
  hairMesh.name = 'hair'
  hairMesh.position.y = height * 0.91
  configureMesh(hairMesh)
  root.add(hairMesh)

  const leftArm = new Mesh(limbGeometry, accent)
  const rightArm = new Mesh(limbGeometry, accent)
  leftArm.name = 'left-arm'
  rightArm.name = 'right-arm'
  leftArm.position.set(-0.35, height * 0.58, 0)
  rightArm.position.set(0.35, height * 0.58, 0)
  configureMesh(leftArm)
  configureMesh(rightArm)
  root.add(leftArm, rightArm)

  const leftLeg = new Mesh(limbGeometry, clothing)
  const rightLeg = new Mesh(limbGeometry, clothing)
  leftLeg.name = 'left-leg'
  rightLeg.name = 'right-leg'
  leftLeg.position.set(-0.13, height * 0.23, 0)
  rightLeg.position.set(0.13, height * 0.23, 0)
  configureMesh(leftLeg)
  configureMesh(rightLeg)
  root.add(leftLeg, rightLeg)

  const leftBoot = new Mesh(bootGeometry, boot)
  const rightBoot = new Mesh(bootGeometry, boot)
  leftBoot.name = 'left-boot'
  rightBoot.name = 'right-boot'
  leftBoot.position.set(-0.13, 0.08, 0.045)
  rightBoot.position.set(0.13, 0.08, 0.045)
  configureMesh(leftBoot)
  configureMesh(rightBoot)
  root.add(leftBoot, rightBoot)

  return {
    root,
    radius,
    height,
    update: (placement, state) => {
      root.position.set(placement.position.x, placement.position.y, placement.position.z)
      root.rotation.y = placement.yawRadians
      const seedPhase = ((definition.appearanceSeed >>> 12) & 0xff) / 255 * TAU
      const phase = state.presentationProgress * TAU * 4 + seedPhase
      const gait = placement.moving ? Math.sin(phase) * 0.55 : 0
      const work = state.activity === 'work' ? Math.sin(phase * 0.5) * 0.36 : 0
      leftArm.rotation.x = -gait + work
      rightArm.rotation.x = gait + work
      leftLeg.rotation.x = gait
      rightLeg.rotation.x = -gait
      leftBoot.rotation.x = gait * 0.4
      rightBoot.rotation.x = -gait * 0.4
      body.position.y = height * 0.56 + (placement.moving ? Math.abs(Math.sin(phase)) * 0.025 : 0)
      head.rotation.y = state.activity === 'socialize' ? Math.sin(seedPhase + phase * 0.2) * 0.22 : 0
      root.userData.activity = state.activity
      root.userData.scheduleBlockId = state.scheduleBlockId
      root.userData.location = state.location
    },
    dispose: () => {
      root.removeFromParent()
      for (const geometry of geometries) geometry.dispose()
      for (const ownedMaterial of materials) ownedMaterial.dispose()
    },
  }
}
