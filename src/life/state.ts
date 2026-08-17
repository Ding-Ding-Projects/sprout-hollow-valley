import { HOUSEHOLD_BLUEPRINTS, INITIAL_RELATIONSHIP_EDGES, NPC_DEFINITIONS } from './npcs'
import {
  bindEmploymentInstances,
  bindHouseholdInstances,
  calendarForAbsoluteDay,
  selectScheduleBlock,
} from './simulation'
import type {
  ConversationMemory,
  EmploymentState,
  HouseholdState,
  LifeCalendar,
  LifeSimulationState,
  NPCDef,
  NPCState,
  PlayerRelationshipState,
  RelationshipEdge,
  ScheduleBlock,
  ScheduleDestination,
  StructureInstance,
  StructureOwner,
} from './types'

const INITIAL_ABSOLUTE_DAY = 0
const INITIAL_MINUTE = 360

const INITIAL_NEEDS = {
  energy: 80,
  hunger: 20,
  social: 70,
  hygiene: 80,
} as const

interface HouseholdBlueprintShape {
  id: string
  memberIds: readonly string[]
  homeStructureDefinitionId: string
}

function cloneMemory(memory: ConversationMemory): ConversationMemory {
  return { ...memory }
}

function cloneDestination(destination: ScheduleDestination): ScheduleDestination {
  switch (destination.kind) {
    case 'home':
      return { kind: 'home', householdId: destination.householdId }
    case 'work':
      return {
        kind: 'work',
        structureDefinitionId: destination.structureDefinitionId,
        stationRoleId: destination.stationRoleId,
      }
    case 'community':
      return { kind: 'community', locationId: destination.locationId }
    case 'fixture':
      return {
        kind: 'fixture',
        fixture: destination.fixture,
        structureDefinitionId: destination.structureDefinitionId,
      }
  }
}

function cloneOwner(owner: StructureOwner): StructureOwner {
  switch (owner.kind) {
    case 'valley':
      return { kind: 'valley' }
    case 'household':
      return { kind: 'household', householdId: owner.householdId }
    case 'player':
      return { kind: 'player' }
  }
}

function cloneStructureInstance(instance: StructureInstance): StructureInstance {
  return {
    ...instance,
    owner: cloneOwner(instance.owner),
    stationIds: [...instance.stationIds],
  }
}

function cloneRelationship(edge: RelationshipEdge): RelationshipEdge {
  return {
    ...edge,
    kinds: [...edge.kinds],
    memories: edge.memories.map(cloneMemory),
  }
}

function initialScheduleBlock(npc: NPCDef, calendar: LifeCalendar): ScheduleBlock {
  const block =
    selectScheduleBlock(npc.schedule, {
      calendar,
      employmentStatus: 'active',
      activeEventKinds: [],
    }) ??
    npc.schedule.weekday[0]

  if (!block) {
    throw new Error(`NPC ${npc.id} has no weekday schedule block for initialization`)
  }
  return block
}

function createInitialEmployment(npc: NPCDef): EmploymentState {
  return {
    npcId: npc.id,
    roleId: npc.initialEmployment.roleId,
    structureDefinitionId: npc.initialEmployment.structureDefinitionId,
    stationRoleId: npc.initialEmployment.stationRoleId,
    structureInstanceId: npc.initialEmployment.structureInstanceId,
    status: 'active',
    sinceDay: INITIAL_ABSOLUTE_DAY,
    level: 1,
  }
}

function createInitialNPCState(npc: NPCDef, calendar: LifeCalendar): NPCState {
  const block = initialScheduleBlock(npc, calendar)
  return {
    npcId: npc.id,
    householdId: npc.householdId,
    simulationTier: 'distant',
    needs: { ...INITIAL_NEEDS },
    activity: block.activity,
    scheduleBlockId: block.id,
    location: cloneDestination(block.destination),
    employmentStatus: 'active',
    memories: [],
    unavailableUntilDay: null,
    presentationProgress: 0,
  }
}

function createInitialHousehold(blueprint: HouseholdBlueprintShape): HouseholdState {
  return {
    id: blueprint.id,
    memberIds: [...blueprint.memberIds],
    homeStructureDefinitionId: blueprint.homeStructureDefinitionId,
    activeStructureInstanceId: null,
    sharedFunds: 1_000,
    temporaryMoveUntilDay: null,
  }
}

function createInitialPlayerRelationship(npc: NPCDef): PlayerRelationshipState {
  return {
    npcId: npc.id,
    friendship: 'stranger',
    romance: 'none',
    sharedHome: false,
    adoption: 'none',
    affinity: 0,
    trust: 0,
    consentHistory: [],
  }
}

/**
 * Creates the complete mutable runtime state without retaining mutable references to
 * authored definitions or caller-owned sparse structure instances.
 */
export function createLifeSimulation(
  seed: number,
  structureInstances: readonly StructureInstance[] = [],
): LifeSimulationState {
  const normalizedSeed = seed >>> 0
  const instances = structureInstances.map(cloneStructureInstance)
  const calendar = { ...calendarForAbsoluteDay(normalizedSeed, INITIAL_ABSOLUTE_DAY, INITIAL_MINUTE) }
  const households = bindHouseholdInstances(
    normalizedSeed,
    HOUSEHOLD_BLUEPRINTS.map(createInitialHousehold),
    instances,
  )
  const employments = bindEmploymentInstances(
    normalizedSeed,
    NPC_DEFINITIONS.map(createInitialEmployment),
    instances,
  )

  return {
    seed: normalizedSeed,
    calendar,
    npcs: NPC_DEFINITIONS.map((npc) => createInitialNPCState(npc, calendar)),
    households,
    employments,
    relationships: INITIAL_RELATIONSHIP_EDGES.map(cloneRelationship),
    playerRelationships: NPC_DEFINITIONS.map(createInitialPlayerRelationship),
    structureInstances: instances,
    activeEvents: [],
    eventHistory: [],
  }
}
