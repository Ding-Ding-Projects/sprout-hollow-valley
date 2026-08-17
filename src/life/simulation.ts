import { rngFor } from '../game/rng'
import { resolveDueLifeEvents } from './events'
import { NPC_DEFINITIONS } from './npcs'
import {
  LIFE_DAYS_PER_SEASON,
  LIFE_DAYS_PER_YEAR,
  LIFE_MINUTES_PER_DAY,
  LIFE_SEASONS,
} from './types'
import type {
  ConversationMemory,
  EmploymentState,
  HouseholdState,
  LifeCalendar,
  LifeEvent,
  LifeEventKind,
  LifeSeason,
  LifeSimulationState,
  LifeWeather,
  NeedEffect,
  NeedState,
  NPCDef,
  NPCState,
  ScheduleActivity,
  ScheduleBlock,
  ScheduleCondition,
  SchedulePlan,
  ScheduleSelectionContext,
  SimulationContext,
  StructureInstance,
} from './types'

const NPC_BY_ID = new Map(NPC_DEFINITIONS.map((definition) => [definition.id, definition]))
const EMPTY_NEARBY_NPCS: ReadonlySet<string> = new Set<string>()

/** Per-minute effects. Hunger is pressure (higher is hungrier); the other needs are wellbeing. */
export const ACTIVITY_NEED_EFFECTS: Readonly<Record<ScheduleActivity, NeedEffect>> = {
  sleep: { energy: 0.13, hunger: 0.018, social: -0.004, hygiene: -0.006 },
  breakfast: { energy: 0.015, hunger: -0.45, social: 0.006, hygiene: -0.004 },
  commute: { energy: -0.035, hunger: 0.025, social: -0.008, hygiene: -0.012 },
  work: { energy: -0.05, hunger: 0.032, social: -0.004, hygiene: -0.018 },
  meal: { energy: 0.012, hunger: -0.4, social: 0.008, hygiene: -0.004 },
  socialize: { energy: -0.02, hunger: 0.022, social: 0.18, hygiene: -0.009 },
  errand: { energy: -0.035, hunger: 0.026, social: -0.004, hygiene: -0.014 },
  leisure: { energy: -0.012, hunger: 0.021, social: 0.025, hygiene: -0.008 },
  toilet: { energy: -0.006, hunger: 0.008, social: 0, hygiene: -0.02 },
  'wash-hands': { energy: -0.004, hunger: 0.006, social: 0, hygiene: 0.08 },
  shower: { energy: 0.008, hunger: 0.008, social: 0, hygiene: 0.1 },
  rest: { energy: 0.055, hunger: 0.018, social: -0.002, hygiene: -0.005 },
}

export const TOILET_NEED_EFFECT: NeedEffect = {
  energy: 0,
  hunger: 0,
  social: 0,
  hygiene: -8,
}

export const WASH_HANDS_NEED_EFFECT: NeedEffect = {
  energy: 0,
  hunger: 0,
  social: 0,
  hygiene: 18,
}

export const SHOWER_NEED_EFFECT: NeedEffect = {
  energy: 3,
  hunger: 0,
  social: 0,
  hygiene: 35,
}

function finiteInteger(value: number, fallback = 0): number {
  return Number.isFinite(value) ? Math.floor(value) : fallback
}

function normalizedNeed(value: number): number {
  const bounded = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return Math.round(bounded * 1_000) / 1_000
}

export function clampNeeds(needs: NeedState): NeedState {
  return {
    energy: normalizedNeed(needs.energy),
    hunger: normalizedNeed(needs.hunger),
    social: normalizedNeed(needs.social),
    hygiene: normalizedNeed(needs.hygiene),
  }
}

export function applyNeedEffect(
  needs: NeedState,
  effect: NeedEffect,
  multiplier = 1,
): NeedState {
  const scale = Number.isFinite(multiplier) ? multiplier : 0
  return clampNeeds({
    energy: needs.energy + effect.energy * scale,
    hunger: needs.hunger + effect.hunger * scale,
    social: needs.social + effect.social * scale,
    hygiene: needs.hygiene + effect.hygiene * scale,
  })
}

export function advanceNeeds(
  needs: NeedState,
  activity: ScheduleActivity,
  elapsedMinutes: number,
): NeedState {
  return applyNeedEffect(needs, ACTIVITY_NEED_EFFECTS[activity], Math.max(0, elapsedMinutes))
}

export function useToilet(needs: NeedState): NeedState {
  return applyNeedEffect(needs, TOILET_NEED_EFFECT)
}

export function washHands(needs: NeedState): NeedState {
  return applyNeedEffect(needs, WASH_HANDS_NEED_EFFECT)
}

export function takeShower(needs: NeedState): NeedState {
  return applyNeedEffect(needs, SHOWER_NEED_EFFECT)
}

export function weatherForAbsoluteDay(
  seed: number,
  absoluteDay: number,
  season?: LifeSeason,
): LifeWeather {
  const day = Math.max(0, finiteInteger(absoluteDay))
  const resolvedSeason = season ?? LIFE_SEASONS[Math.floor((day % LIFE_DAYS_PER_YEAR) / LIFE_DAYS_PER_SEASON)]
  const roll = rngFor(seed, `life:weather:${day}`)()

  if (resolvedSeason === 'winter') {
    if (roll < 0.34) return 'snow'
    if (roll < 0.39) return 'storm'
    return 'clear'
  }
  if (resolvedSeason === 'spring') {
    if (roll < 0.3) return 'rain'
    if (roll < 0.36) return 'storm'
    return 'clear'
  }
  if (resolvedSeason === 'summer') {
    if (roll < 0.17) return 'rain'
    if (roll < 0.23) return 'storm'
    return 'clear'
  }
  if (roll < 0.22) return 'rain'
  if (roll < 0.27) return 'storm'
  return 'clear'
}

/** Maps zero-based elapsed days onto four 28-day seasons and one-based display dates. */
export function calendarForAbsoluteDay(
  seed: number,
  absoluteDay: number,
  minute = 0,
): LifeCalendar {
  const requestedDay = Math.max(0, finiteInteger(absoluteDay))
  const requestedMinute = finiteInteger(minute)
  const dayDelta = Math.floor(requestedMinute / LIFE_MINUTES_PER_DAY)
  const wrappedMinute =
    ((requestedMinute % LIFE_MINUTES_PER_DAY) + LIFE_MINUTES_PER_DAY) % LIFE_MINUTES_PER_DAY
  const normalizedDay = Math.max(0, requestedDay + dayDelta)
  const withinYear = normalizedDay % LIFE_DAYS_PER_YEAR
  const seasonIndex = Math.floor(withinYear / LIFE_DAYS_PER_SEASON)
  const season = LIFE_SEASONS[seasonIndex]

  return {
    absoluteDay: normalizedDay,
    year: Math.floor(normalizedDay / LIFE_DAYS_PER_YEAR) + 1,
    season,
    day: (withinYear % LIFE_DAYS_PER_SEASON) + 1,
    minute: wrappedMinute,
    weather: weatherForAbsoluteDay(seed, normalizedDay, season),
  }
}

export function absoluteDayForLifeDate(year: number, season: LifeSeason, day: number): number {
  const normalizedYear = Math.max(1, finiteInteger(year, 1))
  const seasonIndex = LIFE_SEASONS.indexOf(season)
  const normalizedDay = Math.max(1, Math.min(LIFE_DAYS_PER_SEASON, finiteInteger(day, 1)))
  return (
    (normalizedYear - 1) * LIFE_DAYS_PER_YEAR +
    seasonIndex * LIFE_DAYS_PER_SEASON +
    normalizedDay -
    1
  )
}

export function isLifeWeekend(absoluteDay: number): boolean {
  const weekday = Math.max(0, finiteInteger(absoluteDay)) % 7
  return weekday === 5 || weekday === 6
}

function conditionIncludes<T>(allowed: readonly T[] | undefined, value: T): boolean {
  return allowed === undefined || allowed.length === 0 || allowed.includes(value)
}

export function matchesScheduleCondition(
  condition: ScheduleCondition | undefined,
  context: ScheduleSelectionContext,
): boolean {
  if (condition === undefined) return true
  if (!conditionIncludes(condition.seasons, context.calendar.season)) return false
  if (!conditionIncludes(condition.weather, context.calendar.weather)) return false
  if (!conditionIncludes(condition.employmentStatus, context.employmentStatus)) return false
  if (
    condition.eventKinds !== undefined &&
    condition.eventKinds.length > 0 &&
    !condition.eventKinds.some((kind) => context.activeEventKinds.includes(kind))
  ) {
    return false
  }
  return true
}

export function scheduleBlockContainsMinute(block: ScheduleBlock, minute: number): boolean {
  const at = ((finiteInteger(minute) % LIFE_MINUTES_PER_DAY) + LIFE_MINUTES_PER_DAY) % LIFE_MINUTES_PER_DAY
  const start = Math.max(0, Math.min(LIFE_MINUTES_PER_DAY, finiteInteger(block.startMinute)))
  const end = Math.max(0, Math.min(LIFE_MINUTES_PER_DAY, finiteInteger(block.endMinute)))
  if (start === end) return true
  if (start < end) return at >= start && at < end
  return at >= start || at < end
}

function eligibleScheduleTiers(
  schedule: SchedulePlan,
  context: ScheduleSelectionContext,
): readonly (readonly ScheduleBlock[])[] {
  const eligibleEvent = schedule.event.filter((block) => matchesScheduleCondition(block.condition, context))
  const eligibleSeasonal = schedule.seasonal.filter((block) =>
    matchesScheduleCondition(block.condition, context),
  )
  const base = isLifeWeekend(context.calendar.absoluteDay) ? schedule.weekend : schedule.weekday
  const eligibleBase = base.filter((block) => matchesScheduleCondition(block.condition, context))
  return [eligibleEvent, eligibleSeasonal, eligibleBase]
}

/** Event variants override seasonal variants, which override the ordinary weekday/weekend plan. */
export function selectScheduleBlock(
  schedule: SchedulePlan,
  context: ScheduleSelectionContext,
): ScheduleBlock | null {
  for (const tier of eligibleScheduleTiers(schedule, context)) {
    const block = tier.find((candidate) =>
      scheduleBlockContainsMinute(candidate, context.calendar.minute),
    )
    if (block !== undefined) return block
  }
  return null
}

export function selectNPCScheduleBlock(
  definition: NPCDef,
  context: ScheduleSelectionContext,
): ScheduleBlock | null {
  return selectScheduleBlock(definition.schedule, context)
}

function scheduleBoundaries(schedule: SchedulePlan, context: ScheduleSelectionContext): number[] {
  const boundaries = new Set<number>([0, LIFE_MINUTES_PER_DAY])
  for (const tier of eligibleScheduleTiers(schedule, context)) {
    for (const block of tier) {
      boundaries.add(Math.max(0, Math.min(LIFE_MINUTES_PER_DAY, finiteInteger(block.startMinute))))
      boundaries.add(Math.max(0, Math.min(LIFE_MINUTES_PER_DAY, finiteInteger(block.endMinute))))
    }
  }
  return [...boundaries].sort((a, b) => a - b)
}

function nextScheduleBoundary(
  schedule: SchedulePlan,
  context: ScheduleSelectionContext,
  minute: number,
): number {
  return (
    scheduleBoundaries(schedule, context).find((boundary) => boundary > minute) ??
    LIFE_MINUTES_PER_DAY
  )
}

function activeEventKindsForNPC(events: readonly LifeEvent[], npcId: string): LifeEventKind[] {
  return events
    .filter((event) => event.status === 'active' && event.participantIds.includes(npcId))
    .map((event) => event.kind)
}

function routineMemory(activity: ScheduleActivity, absoluteDay: number): ConversationMemory | null {
  if (activity !== 'toilet' && activity !== 'wash-hands' && activity !== 'shower') return null
  return {
    key: `routine:${activity}`,
    value: 'completed',
    day: absoluteDay,
    expiresDay: absoluteDay + 7,
  }
}

function appendMemory(
  memories: readonly ConversationMemory[],
  memory: ConversationMemory | null,
  absoluteDay: number,
): ConversationMemory[] {
  const current = memories.filter(
    (candidate) => candidate.expiresDay === null || candidate.expiresDay >= absoluteDay,
  )
  if (memory === null) return current.map((candidate) => ({ ...candidate }))
  if (current.some((candidate) => candidate.key === memory.key && candidate.day === memory.day)) {
    return current.map((candidate) => ({ ...candidate }))
  }
  return [...current.map((candidate) => ({ ...candidate })), memory]
}

function enterActivity(needs: NeedState, activity: ScheduleActivity): NeedState {
  if (activity === 'toilet') return useToilet(needs)
  if (activity === 'wash-hands') return washHands(needs)
  if (activity === 'shower') return takeShower(needs)
  return needs
}

function transitionToBlock(
  npc: NPCState,
  block: ScheduleBlock,
  absoluteDay: number,
): NPCState {
  if (npc.scheduleBlockId === block.id) {
    return {
      ...npc,
      activity: block.activity,
      location: { ...block.destination },
    }
  }
  return {
    ...npc,
    needs: enterActivity(npc.needs, block.activity),
    activity: block.activity,
    scheduleBlockId: block.id,
    location: { ...block.destination },
    memories: appendMemory(npc.memories, routineMemory(block.activity, absoluteDay), absoluteDay),
  }
}

function presentationProgress(block: ScheduleBlock | null, minute: number): number {
  if (block === null) return 0
  const start = Math.max(0, Math.min(LIFE_MINUTES_PER_DAY, finiteInteger(block.startMinute)))
  const end = Math.max(0, Math.min(LIFE_MINUTES_PER_DAY, finiteInteger(block.endMinute)))
  const duration = start === end ? LIFE_MINUTES_PER_DAY : end > start ? end - start : LIFE_MINUTES_PER_DAY - start + end
  const elapsed = minute >= start ? minute - start : LIFE_MINUTES_PER_DAY - start + minute
  return Math.max(0, Math.min(1, Math.round((elapsed / duration) * 1_000_000) / 1_000_000))
}

function scheduleContext(
  calendar: LifeCalendar,
  npc: NPCState,
  activeEvents: readonly LifeEvent[],
): ScheduleSelectionContext {
  return {
    calendar,
    employmentStatus: npc.employmentStatus,
    activeEventKinds: activeEventKindsForNPC(activeEvents, npc.npcId),
  }
}

function refreshNPCPresentation(
  npc: NPCState,
  definition: NPCDef,
  calendar: LifeCalendar,
  activeEvents: readonly LifeEvent[],
  nearbyNPCIds: ReadonlySet<string>,
): NPCState {
  const context = scheduleContext(calendar, npc, activeEvents)
  const block = selectNPCScheduleBlock(definition, context)
  const tier = nearbyNPCIds.has(npc.npcId) ? 'near' : 'distant'
  const scheduled = block === null ? npc : transitionToBlock(npc, block, calendar.absoluteDay)
  return {
    ...scheduled,
    simulationTier: tier,
    presentationProgress: tier === 'near' ? presentationProgress(block, calendar.minute) : 0,
  }
}

function advanceNPCWithinDay(
  npc: NPCState,
  definition: NPCDef,
  calendar: LifeCalendar,
  elapsedMinutes: number,
  activeEvents: readonly LifeEvent[],
  nearbyNPCIds: ReadonlySet<string>,
): NPCState {
  const endMinute = Math.min(LIFE_MINUTES_PER_DAY, calendar.minute + elapsedMinutes)
  let cursor = calendar.minute
  let next: NPCState = {
    ...npc,
    needs: clampNeeds(npc.needs),
    memories: appendMemory(npc.memories, null, calendar.absoluteDay),
  }

  while (cursor < endMinute) {
    const at = { ...calendar, minute: cursor }
    const context = scheduleContext(at, next, activeEvents)
    const block = selectNPCScheduleBlock(definition, context)
    const boundary = Math.min(endMinute, nextScheduleBoundary(definition.schedule, context, cursor))
    const segmentMinutes = Math.max(1, boundary - cursor)
    if (block !== null) {
      next = transitionToBlock(next, block, calendar.absoluteDay)
    }
    next = {
      ...next,
      needs: advanceNeeds(next.needs, next.activity, segmentMinutes),
    }
    cursor = Math.min(endMinute, cursor + segmentMinutes)
  }

  if (endMinute < LIFE_MINUTES_PER_DAY) {
    next = refreshNPCPresentation(
      next,
      definition,
      { ...calendar, minute: endMinute },
      activeEvents,
      nearbyNPCIds,
    )
  } else {
    const tier = nearbyNPCIds.has(next.npcId) ? 'near' : 'distant'
    next = { ...next, simulationTier: tier, presentationProgress: tier === 'near' ? 1 : 0 }
  }
  return next
}

function deterministicInstance(
  seed: number,
  salt: string,
  currentId: string | null,
  definitionId: string,
  instances: readonly StructureInstance[],
): string | null {
  const candidates = instances
    .filter((instance) => instance.enabled && instance.definitionId === definitionId)
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
  if (candidates.length === 0) return null
  if (currentId !== null && candidates.some((candidate) => candidate.id === currentId)) return currentId
  const roll = rngFor(seed, `life:structure-binding:${salt}:${definitionId}`)()
  return candidates[Math.min(candidates.length - 1, Math.floor(roll * candidates.length))].id
}

export function bindEmploymentInstances(
  seed: number,
  employments: readonly EmploymentState[],
  instances: readonly StructureInstance[],
): EmploymentState[] {
  return employments.map((employment) => ({
    ...employment,
    structureInstanceId: deterministicInstance(
      seed,
      `employment:${employment.npcId}:${employment.roleId}:${employment.stationRoleId}`,
      employment.structureInstanceId,
      employment.structureDefinitionId,
      instances,
    ),
  }))
}

export function bindHouseholdInstances(
  seed: number,
  households: readonly HouseholdState[],
  instances: readonly StructureInstance[],
): HouseholdState[] {
  return households.map((household) => {
    const ownedCandidates = instances.filter(
      (instance) =>
        instance.enabled &&
        instance.definitionId === household.homeStructureDefinitionId &&
        instance.owner.kind === 'household' &&
        instance.owner.householdId === household.id,
    )
    const available = ownedCandidates.length > 0 ? ownedCandidates : instances
    return {
      ...household,
      memberIds: [...household.memberIds],
      activeStructureInstanceId: deterministicInstance(
        seed,
        `household:${household.id}`,
        household.activeStructureInstanceId,
        household.homeStructureDefinitionId,
        available,
      ),
    }
  })
}

export function rebindSimulationStructures(
  state: LifeSimulationState,
  instances: readonly StructureInstance[],
): LifeSimulationState {
  const copiedInstances = instances.map((instance) => ({
    ...instance,
    owner: { ...instance.owner },
    stationIds: [...instance.stationIds],
  }))
  const employments = bindEmploymentInstances(state.seed, state.employments, copiedInstances)
  const employmentStatus = new Map(
    employments.map((employment) => [employment.npcId, employment.status]),
  )
  return {
    ...state,
    structureInstances: copiedInstances,
    npcs: state.npcs.map((npc) => ({
      ...npc,
      employmentStatus: employmentStatus.get(npc.npcId) ?? npc.employmentStatus,
    })),
    employments,
    households: bindHouseholdInstances(state.seed, state.households, copiedInstances),
  }
}

function refreshAllNPCs(
  state: LifeSimulationState,
  nearbyNPCIds: ReadonlySet<string>,
): LifeSimulationState {
  return {
    ...state,
    npcs: state.npcs.map((npc) => {
      const definition = NPC_BY_ID.get(npc.npcId)
      return definition === undefined
        ? {
            ...npc,
            simulationTier: nearbyNPCIds.has(npc.npcId) ? 'near' : 'distant',
            presentationProgress: 0,
          }
        : refreshNPCPresentation(
            npc,
            definition,
            state.calendar,
            state.activeEvents,
            nearbyNPCIds,
          )
    }),
  }
}

/**
 * Advances logical simulation in schedule-sized segments rather than frames. Near and distant
 * NPCs take the same logical path; only tier metadata and presentation progress differ.
 */
export function advanceLifeSimulation(
  state: LifeSimulationState,
  elapsedMinutes: number,
  context?: Partial<SimulationContext>,
): LifeSimulationState {
  const totalMinutes = Math.max(0, finiteInteger(elapsedMinutes))
  const nearbyNPCIds = context?.nearbyNPCIds ?? EMPTY_NEARBY_NPCS
  const instances = context?.structureInstances ?? state.structureInstances
  let next = rebindSimulationStructures(state, instances)

  if (totalMinutes === 0) return refreshAllNPCs(next, nearbyNPCIds)

  let remaining = totalMinutes
  while (remaining > 0) {
    const untilMidnight = LIFE_MINUTES_PER_DAY - next.calendar.minute
    const segmentMinutes = Math.min(remaining, untilMidnight)
    next = {
      ...next,
      npcs: next.npcs.map((npc) => {
        const definition = NPC_BY_ID.get(npc.npcId)
        return definition === undefined
          ? { ...npc, needs: clampNeeds(npc.needs) }
          : advanceNPCWithinDay(
              npc,
              definition,
              next.calendar,
              segmentMinutes,
              next.activeEvents,
              nearbyNPCIds,
            )
      }),
    }
    remaining -= segmentMinutes

    if (segmentMinutes === untilMidnight) {
      const nextDay = next.calendar.absoluteDay + 1
      next = {
        ...next,
        calendar: calendarForAbsoluteDay(next.seed, nextDay, 0),
      }
      next = resolveDueLifeEvents(next, nextDay).state
      next = refreshAllNPCs(next, nearbyNPCIds)
    } else {
      next = {
        ...next,
        calendar: calendarForAbsoluteDay(
          next.seed,
          next.calendar.absoluteDay,
          next.calendar.minute + segmentMinutes,
        ),
      }
    }
  }
  return next
}

export function advanceSimulationMinute(
  state: LifeSimulationState,
  context?: Partial<SimulationContext>,
): LifeSimulationState {
  return advanceLifeSimulation(state, 1, context)
}

export function advanceSimulationMinutes(
  state: LifeSimulationState,
  elapsedMinutes: number,
  context?: Partial<SimulationContext>,
): LifeSimulationState {
  return advanceLifeSimulation(state, elapsedMinutes, context)
}

export function advanceMinute(
  state: LifeSimulationState,
  context?: Partial<SimulationContext>,
): LifeSimulationState {
  return advanceLifeSimulation(state, 1, context)
}

export function advanceMinutes(
  state: LifeSimulationState,
  elapsedMinutes: number,
  context?: Partial<SimulationContext>,
): LifeSimulationState {
  return advanceLifeSimulation(state, elapsedMinutes, context)
}

export function advanceDay(
  state: LifeSimulationState,
  context?: Partial<SimulationContext>,
): LifeSimulationState {
  return advanceLifeSimulation(state, LIFE_MINUTES_PER_DAY, context)
}

/** Efficient enough for deterministic multi-year focused simulations. */
export function simulateDays(
  state: LifeSimulationState,
  days: number,
  context?: Partial<SimulationContext>,
): LifeSimulationState {
  const wholeDays = Math.max(0, finiteInteger(days))
  return advanceLifeSimulation(state, wholeDays * LIFE_MINUTES_PER_DAY, context)
}
