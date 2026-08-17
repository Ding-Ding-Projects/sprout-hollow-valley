import { buildingDef } from '../../game/buildings'
import { FARM_W } from '../../game/constants'
import { cropById } from '../../game/crops'
import { doorOf, interiorFor, type Station } from '../../game/interiors'
import { machineDefFor } from '../../game/production'
import { speciesById } from '../../game/species'
import { treeById } from '../../game/trees'
import type { GameState } from '../../game/types'
import {
  farmTileCenter,
  gameplayWorldDistance,
  tileCoordinate,
  worldToFarmTile,
} from './coordinates'
import type {
  FarmWorldTransform,
  GameplayTargetHit,
  GameplayTargetQuery,
  GameplayTargetRef,
  GameplayTargetSubject,
  GameplayWorldPoint,
  ResolvedGameplayTarget,
  StationIdentity,
} from './types'

const SUBJECT_PRIORITY: Readonly<Record<GameplayTargetSubject, number>> = Object.freeze({
  station: 0,
  animal: 1,
  machine: 2,
  building: 3,
  tree: 4,
  crop: 5,
  sprinkler: 6,
  debris: 7,
  ground: 8,
})

function cleanId(id: string): string {
  return id.trim()
}

export function gameplayStationKey(station: Station): string {
  return [
    station.kind,
    station.x,
    station.y,
    station.w,
    station.h,
    station.ref ?? '',
  ].join(':')
}

export function stationIdentity(station: Station): StationIdentity {
  return Object.freeze({ key: gameplayStationKey(station), kind: station.kind })
}

export function gameplayTargetKey(ref: GameplayTargetRef): string {
  switch (ref.kind) {
    case 'tile':
      return `tile:${ref.index}`
    case 'building':
      return `building:${cleanId(ref.buildingId)}`
    case 'machine':
      return `machine:${cleanId(ref.machineId)}`
    case 'animal':
      return `animal:${cleanId(ref.animalId)}`
    case 'station':
      return `station:${cleanId(ref.buildingId)}:${cleanId(ref.stationKey)}`
  }
}

interface TargetDescription {
  readonly subject: GameplayTargetSubject
  readonly label: string
  readonly detail: string
}

function describeTile(state: GameState, index: number): TargetDescription {
  const tile = state.tiles[index]
  if (tile === undefined) return { subject: 'ground', label: 'Beyond the farm', detail: 'No farm tile.' }

  if (tile.machineId !== null) {
    const machine = state.machines.find((entry) => entry.id === tile.machineId)
    const name = machine === undefined ? 'Machine' : (machineDefFor(machine.kind)?.name ?? machine.kind)
    return { subject: 'machine', label: name, detail: 'Production machine.' }
  }
  if (tile.buildingId !== null) {
    const building = state.buildings.find((entry) => entry.id === tile.buildingId)
    const name = building === undefined ? 'Building' : (buildingDef(building.kind)?.name ?? building.kind)
    return { subject: 'building', label: name, detail: 'Enterable farm building.' }
  }
  if (tile.plant !== null) {
    const tree = treeById(tile.plant.cropId)
    if (tree !== undefined) {
      return {
        subject: 'tree',
        label: tree.name,
        detail: tile.plant.dead ? 'Withered tree.' : 'Fruit tree or orchard plant.',
      }
    }
    const crop = cropById(tile.plant.cropId)
    return {
      subject: 'crop',
      label: crop?.name ?? 'Unknown crop',
      detail: tile.plant.dead ? 'Withered crop.' : 'Field crop.',
    }
  }
  if (tile.sprinkler) {
    return { subject: 'sprinkler', label: 'Sprinkler', detail: 'Placed farm object.' }
  }
  if (tile.ground === 'weeds' || tile.ground === 'rock' || tile.ground === 'log') {
    return {
      subject: 'debris',
      label: tile.ground === 'log' ? 'Fallen log' : tile.ground,
      detail: 'Clearable farm debris.',
    }
  }
  return {
    subject: 'ground',
    label: tile.ground === 'soil' ? 'Tilled soil' : tile.ground,
    detail: tile.watered ? 'Watered farm tile.' : 'Farm tile.',
  }
}

function pointForRef(
  state: GameState,
  ref: GameplayTargetRef,
  fallback: GameplayWorldPoint,
  transform: FarmWorldTransform,
): { point: GameplayWorldPoint; index: number | null } | null {
  switch (ref.kind) {
    case 'tile': {
      const tile = tileCoordinate(ref.index)
      return tile === null ? null : { point: farmTileCenter(tile, transform), index: tile.index }
    }
    case 'machine': {
      const machine = state.machines.find((entry) => entry.id === cleanId(ref.machineId))
      const tile = machine === undefined ? null : tileCoordinate(machine.index)
      return tile === null ? null : { point: farmTileCenter(tile, transform), index: tile.index }
    }
    case 'building': {
      const building = state.buildings.find((entry) => entry.id === cleanId(ref.buildingId))
      if (building === undefined) return null
      const door = doorOf(building)
      const index = door.y * FARM_W + door.x
      const coordinate = tileCoordinate(index)
      return coordinate === null ? { point: fallback, index: null } : { point: farmTileCenter(coordinate, transform), index }
    }
    case 'animal': {
      const animal = state.animals.find((entry) => entry.id === cleanId(ref.animalId))
      return animal === undefined ? null : { point: fallback, index: null }
    }
    case 'station': {
      const interior = interiorFor(state, cleanId(ref.buildingId))
      const station = interior?.stations.find((entry) => gameplayStationKey(entry) === cleanId(ref.stationKey))
      return station === undefined ? null : { point: fallback, index: null }
    }
  }
}

function describeRef(state: GameState, ref: GameplayTargetRef, tileIndex: number | null): TargetDescription | null {
  switch (ref.kind) {
    case 'tile':
      return tileIndex === null ? null : describeTile(state, tileIndex)
    case 'building': {
      const building = state.buildings.find((entry) => entry.id === cleanId(ref.buildingId))
      if (building === undefined) return null
      return {
        subject: 'building',
        label: buildingDef(building.kind)?.name ?? building.kind,
        detail: 'Enterable farm building.',
      }
    }
    case 'machine': {
      const machine = state.machines.find((entry) => entry.id === cleanId(ref.machineId))
      if (machine === undefined) return null
      const def = machineDefFor(machine.kind)
      const waiting = machine.ready.reduce((sum, row) => sum + Math.max(0, row.count), 0)
      const work = machine.queue.length === 0 ? 'Idle' : `${machine.queue.length} queued`
      return {
        subject: 'machine',
        label: def?.name ?? machine.kind,
        detail: waiting > 0 ? `${waiting} output ready. ${work}.` : `${work}.`,
      }
    }
    case 'animal': {
      const animal = state.animals.find((entry) => entry.id === cleanId(ref.animalId))
      if (animal === undefined) return null
      const species = speciesById(animal.species)
      const name = animal.name.trim() || species?.name || animal.species
      const care = [animal.fedToday ? 'fed' : 'hungry', animal.pettedToday ? 'petted' : 'not petted']
      return { subject: 'animal', label: name, detail: `${care.join(', ')}.` }
    }
    case 'station': {
      const interior = interiorFor(state, cleanId(ref.buildingId))
      const station = interior?.stations.find((entry) => gameplayStationKey(entry) === cleanId(ref.stationKey))
      if (station === undefined) return null
      return { subject: 'station', label: station.label, detail: `${station.kind} station.` }
    }
  }
}

function candidateFromHit(
  state: GameState,
  hit: GameplayTargetHit,
  actorPosition: GameplayWorldPoint,
  transform: FarmWorldTransform,
): ResolvedGameplayTarget | null {
  if (!Number.isFinite(hit.distance) || hit.distance < 0) return null
  const located = pointForRef(state, hit.ref, hit.point, transform)
  if (located === null) return null
  const description = describeRef(state, hit.ref, located.index)
  if (description === null) return null
  const tile = located.index === null ? null : tileCoordinate(located.index)
  const actorDistance = gameplayWorldDistance(actorPosition, located.point)
  return Object.freeze({
    key: gameplayTargetKey(hit.ref),
    ref: hit.ref,
    subject: description.subject,
    label: description.label,
    detail: description.detail,
    point: located.point,
    tile,
    rayDistance: hit.distance,
    actorDistance,
    reachable: actorDistance <= transform.maxInteractionDistance,
  })
}

/** Resolves only references still present in the supplied state, then applies stable tie-breaking. */
export function resolveGameplayTarget(
  state: GameState,
  query: GameplayTargetQuery,
  transform: FarmWorldTransform,
): ResolvedGameplayTarget | null {
  const candidates: ResolvedGameplayTarget[] = []
  for (const hit of query.hits ?? []) {
    const candidate = candidateFromHit(state, hit, query.actorPosition, transform)
    if (candidate !== null) candidates.push(candidate)
  }

  if (query.groundPoint !== undefined) {
    const tile = worldToFarmTile(query.groundPoint, transform)
    if (tile !== null) {
      const fallback: GameplayTargetHit = {
        ref: { kind: 'tile', index: tile.index },
        point: query.groundPoint,
        distance: gameplayWorldDistance(query.actorPosition, query.groundPoint),
      }
      const candidate = candidateFromHit(state, fallback, query.actorPosition, transform)
      if (candidate !== null) candidates.push(candidate)
    }
  }

  candidates.sort((a, b) => {
    const ray = a.rayDistance - b.rayDistance
    if (ray !== 0) return ray
    const subject = SUBJECT_PRIORITY[a.subject] - SUBJECT_PRIORITY[b.subject]
    if (subject !== 0) return subject
    return a.key.localeCompare(b.key)
  })
  return candidates[0] ?? null
}
