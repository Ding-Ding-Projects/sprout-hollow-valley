import type { Vec3 } from '../../engine3d'
import type { ScheduleActivity, ScheduleDestination } from '../../life/types'
import type {
  NpcPlacementContext,
  NpcPresentationPlacement,
  NpcPresentationSpace,
} from './types'

const TAU = Math.PI * 2
const EXTERIOR_WORLD_ID = 'sprout-hollow-valley'

const COMMUNITY_ANCHORS: Readonly<Record<string, Vec3>> = Object.freeze({
  'civic-hall': Object.freeze({ x: -18, y: 0, z: 22 }),
  'community-garden': Object.freeze({ x: -30, y: 0, z: -14 }),
  'festival-green': Object.freeze({ x: 8, y: 0, z: 26 }),
  'harvest-green': Object.freeze({ x: -8, y: 0, z: -30 }),
  'market-district': Object.freeze({ x: 28, y: 0, z: 10 }),
  'market-square': Object.freeze({ x: 20, y: 0, z: 4 }),
  'riverside-park': Object.freeze({ x: 34, y: 0, z: -24 }),
  'town-square': Object.freeze({ x: 0, y: 0, z: 0 }),
})

function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function normalizedLocationId(locationId: string): string {
  return locationId.startsWith('location:') ? locationId.slice('location:'.length) : locationId
}

function exteriorSpace(): NpcPresentationSpace {
  return { kind: 'exterior', worldId: EXTERIOR_WORLD_ID }
}

function structureExteriorAnchor(key: string): Vec3 {
  const hash = stableHash(key)
  const column = hash % 23
  const row = (hash >>> 8) % 23
  return {
    x: (column - 11) * 11,
    y: 0,
    z: (row - 11) * 11,
  }
}

function communityAnchor(locationId: string): Vec3 {
  const normalized = normalizedLocationId(locationId)
  return COMMUNITY_ANCHORS[normalized] ?? structureExteriorAnchor(`community:${normalized}`)
}

function crowdOffset(seed: number, radius: number): Vec3 {
  const angle = ((seed & 0xffff) / 0xffff) * TAU
  const radial = radius * (0.35 + ((seed >>> 16) & 0xff) / 384)
  return { x: Math.cos(angle) * radial, y: 0, z: Math.sin(angle) * radial }
}

function structureInstanceKey(
  definitionId: string,
  instanceId: string | null | undefined,
): string {
  return instanceId ?? definitionId
}

function homeDefinitionId(context: NpcPlacementContext): string {
  return context.household?.homeStructureDefinitionId ?? context.definition.homeStructureDefinitionId
}

function homeInstanceId(context: NpcPlacementContext): string | null {
  return context.household?.activeStructureInstanceId ?? null
}

function workDefinitionId(context: NpcPlacementContext): string {
  return context.employment?.structureDefinitionId ?? context.definition.initialEmployment.structureDefinitionId
}

function workInstanceId(context: NpcPlacementContext): string | null {
  return context.employment?.structureInstanceId ?? null
}

function fixtureInstanceId(
  context: NpcPlacementContext,
  structureDefinitionId: string,
): string | null {
  if (structureDefinitionId === homeDefinitionId(context)) return homeInstanceId(context)
  if (structureDefinitionId === workDefinitionId(context)) return workInstanceId(context)
  const candidate = context.simulation.structureInstances
    .filter(
      (instance) => instance.enabled && instance.definitionId === structureDefinitionId,
    )
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))[0]
  return candidate?.id ?? null
}

function interiorStructureId(structureDefinitionId: string): string {
  const match = /^shv:structure:(factory|building):(\d+)$/.exec(structureDefinitionId)
  if (match === null) return structureDefinitionId
  const kind = match[1] ?? 'building'
  const serial = String(Number(match[2])).padStart(3, '0')
  return `${kind}-${serial}`
}

function interiorRoomId(
  context: NpcPlacementContext,
  destination: Exclude<ScheduleDestination, { kind: 'community' }>,
): string {
  switch (destination.kind) {
    case 'home':
      return `${interiorStructureId(homeDefinitionId(context))}:room:primary`
    case 'work':
      return `${interiorStructureId(destination.structureDefinitionId)}:room:${
        destination.structureDefinitionId.includes(':factory:') ? 'operations' : 'primary'
      }`
    case 'fixture':
      return `${interiorStructureId(destination.structureDefinitionId)}:room:restroom`
  }
}

function interiorPosition(seed: number, activity: ScheduleActivity, progress: number): Vec3 {
  const offset = crowdOffset(seed, 2.1)
  const moving = activity === 'work' || activity === 'errand' || activity === 'leisure'
  if (!moving) return offset
  const phase = progress * TAU + ((seed >>> 4) & 0xff) / 255
  return {
    x: offset.x + Math.cos(phase) * 0.55,
    y: 0,
    z: offset.z + Math.sin(phase) * 0.55,
  }
}

function stationaryYaw(seed: number): number {
  return ((seed >>> 9) & 0xffff) / 0xffff * TAU
}

function interiorPlacement(
  context: NpcPlacementContext,
  destination: Exclude<ScheduleDestination, { kind: 'community' }>,
): NpcPresentationPlacement {
  let structureDefinitionId: string
  let structureInstanceId: string | null
  switch (destination.kind) {
    case 'home':
      structureDefinitionId = homeDefinitionId(context)
      structureInstanceId = homeInstanceId(context)
      break
    case 'work':
      structureDefinitionId = destination.structureDefinitionId
      structureInstanceId = workInstanceId(context)
      break
    case 'fixture':
      structureDefinitionId = destination.structureDefinitionId
      structureInstanceId = fixtureInstanceId(context, destination.structureDefinitionId)
      break
  }

  const roomId = interiorRoomId(context, destination)
  const moving =
    context.npc.activity === 'work' ||
    context.npc.activity === 'errand' ||
    context.npc.activity === 'leisure'
  const position = interiorPosition(
    context.definition.appearanceSeed,
    context.npc.activity,
    context.npc.presentationProgress,
  )
  const phase = context.npc.presentationProgress * TAU
  return {
    space: {
      kind: 'interior',
      structureDefinitionId,
      structureInstanceId,
      roomId,
    },
    locationId: structureDefinitionId,
    roomId,
    position,
    yawRadians: moving ? phase + Math.PI / 2 : stationaryYaw(context.definition.appearanceSeed),
    moving,
  }
}

function communityPlacement(context: NpcPlacementContext, locationId: string): NpcPresentationPlacement {
  const normalized = normalizedLocationId(locationId)
  const anchor = communityAnchor(normalized)
  const offset = crowdOffset(context.definition.appearanceSeed, 4.5)
  const moving =
    context.npc.activity === 'socialize' ||
    context.npc.activity === 'errand' ||
    context.npc.activity === 'leisure'
  const phase = context.npc.presentationProgress * TAU + stationaryYaw(context.definition.appearanceSeed)
  const travel = moving ? 1.25 : 0
  return {
    space: exteriorSpace(),
    locationId: normalized,
    roomId: null,
    position: {
      x: anchor.x + offset.x + Math.cos(phase) * travel,
      y: anchor.y,
      z: anchor.z + offset.z + Math.sin(phase) * travel,
    },
    yawRadians: moving ? phase + Math.PI / 2 : stationaryYaw(context.definition.appearanceSeed),
    moving,
  }
}

function commutePlacement(context: NpcPlacementContext): NpcPresentationPlacement {
  const homeKey = structureInstanceKey(homeDefinitionId(context), homeInstanceId(context))
  const workKey = structureInstanceKey(workDefinitionId(context), workInstanceId(context))
  const headingHome = context.npc.location.kind === 'home'
  const from = structureExteriorAnchor(headingHome ? workKey : homeKey)
  const to = structureExteriorAnchor(headingHome ? homeKey : workKey)
  const progress = Math.max(0, Math.min(1, context.npc.presentationProgress))
  const side = Math.sin(progress * Math.PI) *
    (((context.definition.appearanceSeed >>> 7) & 1) === 0 ? 2.5 : -2.5)
  const directionX = to.x - from.x
  const directionZ = to.z - from.z
  const length = Math.hypot(directionX, directionZ) || 1
  const perpendicularX = -directionZ / length
  const perpendicularZ = directionX / length
  return {
    space: exteriorSpace(),
    locationId: headingHome ? homeDefinitionId(context) : workDefinitionId(context),
    roomId: null,
    position: {
      x: from.x + directionX * progress + perpendicularX * side,
      y: 0,
      z: from.z + directionZ * progress + perpendicularZ * side,
    },
    yawRadians: Math.atan2(directionX, directionZ),
    moving: true,
  }
}

/**
 * Procedural fallback placement for every authored schedule destination. A live valley may
 * replace this resolver with authored exterior, room, station, and fixture anchors without
 * changing the adapter lifecycle or life-state contract.
 */
export function resolveDeterministicNpcPlacement(
  context: NpcPlacementContext,
): NpcPresentationPlacement {
  if (context.npc.activity === 'commute') return commutePlacement(context)
  if (context.npc.location.kind === 'community') {
    return communityPlacement(context, context.npc.location.locationId)
  }
  return interiorPlacement(context, context.npc.location)
}
