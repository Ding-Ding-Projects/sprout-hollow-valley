import { NPC_DEFINITIONS } from './npcs'
import type {
  DialogueCondition,
  DialogueContext,
  DialogueLine,
  DialogueTopic,
  EmploymentStatus,
  LifeWeather,
  NPCDef,
} from './types'

export const DIALOGUE_TOPICS = [
  'introduction',
  'routine',
  'work',
  'home',
  'season',
  'weather',
  'festival',
  'relationship',
  'conflict',
  'reconciliation',
  'request',
  'community-event',
] as const satisfies readonly DialogueTopic[]

const WEATHER_ROTATION = ['clear', 'rain', 'storm', 'snow'] as const satisfies readonly LifeWeather[]

const EMPLOYMENT_STATUS_ROTATION = [
  'active',
  'leave',
  'resigned',
  'between-jobs',
] as const satisfies readonly EmploymentStatus[]

type DialogueTextAuthor = (npc: NPCDef, neighborName: string) => string

function compareStableText(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function primaryRequestId(npc: NPCDef): string {
  return npc.requestIds[0] ?? `request.${npc.id}.community-help`
}

const SORTED_NPC_DEFINITIONS = [...NPC_DEFINITIONS].sort((left, right) =>
  compareStableText(left.id, right.id),
)

const FALLBACK_TEXT: Readonly<Record<DialogueTopic, DialogueTextAuthor>> = {
  introduction: (npc) =>
    `I'm ${npc.identity.displayName}. If you ever need a ${npc.traits[0]} neighbor, come say hello.`,
  routine: (npc) =>
    `${npc.identity.displayName}'s rule for a cozy day is simple: leave a little room for kindness.`,
  work: (npc) =>
    `I'm ${npc.identity.displayName}, and I take my ${npc.initialEmployment.roleId} work one careful step at a time.`,
  home: (npc) =>
    `At home, everyone knows ${npc.identity.displayName} will always make room for one more warm cup.`,
  season: (npc) =>
    `${npc.identity.birthday.season} always brings out ${npc.identity.displayName}'s ${npc.traits[1]} side.`,
  weather: (npc) =>
    `${npc.identity.displayName}'s weather advice is to dress comfortably and notice what the valley is saying.`,
  festival: (npc) =>
    `If there's music and lantern light, ${npc.identity.displayName} will save you a place at the festival.`,
  relationship: (npc) =>
    `Trust grows gently; ${npc.identity.displayName} would rather share an honest moment than rush one.`,
  conflict: (npc) =>
    `${npc.identity.displayName} needs a little breathing room, but this disagreement does not have to last.`,
  reconciliation: (npc) =>
    `${npc.identity.displayName} is ready to listen, apologize, and find a kinder way forward.`,
  request: (npc) =>
    `${npc.identity.displayName} has a small favor in mind, with plenty of time and no pressure.`,
  'community-event': (npc) =>
    `${npc.identity.displayName} says every pair of helping hands can make today's gathering brighter.`,
}

const CONTEXT_TEXT: Readonly<Record<DialogueTopic, DialogueTextAuthor>> = {
  introduction: (npc) =>
    `I'm ${npc.identity.displayName}. The town square is my favorite place to meet a new valley neighbor.`,
  routine: (npc) =>
    `${npc.identity.displayName}'s morning rhythm is errands first, then a quiet moment to enjoy the view.`,
  work: (npc) =>
    `${npc.identity.displayName} is tending the ${npc.initialEmployment.roleId} station today; careful work keeps it cozy.`,
  home: (npc) =>
    `${npc.identity.displayName} keeps a welcoming chair ready in the ${npc.householdId} common room.`,
  season: (npc) =>
    `Birthday season has arrived, and ${npc.identity.displayName} is feeling especially ${npc.traits[2]}.`,
  weather: (npc) =>
    `${npc.identity.displayName} has a favorite little ritual for weather like this: pause, listen, and breathe.`,
  festival: (npc, neighborName) =>
    `${npc.identity.displayName} and ${neighborName} are hanging festival ribbons; there is room for one more helper.`,
  relationship: (npc) =>
    `${npc.identity.displayName} remembers the trust you've built and is glad this friendship has grown at its own pace.`,
  conflict: (npc) =>
    `${npc.identity.displayName} remembers what went wrong and wants a calm pause before talking it through.`,
  reconciliation: (npc, neighborName) =>
    `${npc.identity.displayName} is glad ${neighborName} came too; making amends feels easier with patient company.`,
  request: (npc) =>
    `${npc.identity.displayName} could use help with ${primaryRequestId(npc)}, and a ${npc.preferences.favoriteGiftTag} touch would be lovely.`,
  'community-event': (npc, neighborName) =>
    `${npc.identity.displayName} and ${neighborName} are organizing the town-square celebration together.`,
}

function contextualCondition(
  npc: NPCDef,
  npcIndex: number,
  neighborId: string,
  topic: DialogueTopic,
): DialogueCondition {
  switch (topic) {
    case 'introduction':
      return {
        locations: ['town-square'],
        friendship: ['stranger', 'acquaintance'],
      }
    case 'routine':
      return {
        activities: ['errand', 'leisure'],
        minuteRange: [360, 720],
      }
    case 'work':
      return {
        locations: [npc.initialEmployment.structureDefinitionId],
        activities: ['work'],
        employmentStatuses: [
          EMPLOYMENT_STATUS_ROTATION[npcIndex % EMPLOYMENT_STATUS_ROTATION.length] ?? 'active',
        ],
      }
    case 'home':
      return {
        locations: [npc.homeStructureDefinitionId],
        rooms: [`${npc.homeStructureDefinitionId}.common-room`],
        householdIds: [npc.householdId],
      }
    case 'season':
      return {
        seasons: [npc.identity.birthday.season],
      }
    case 'weather':
      return {
        weather: [WEATHER_ROTATION[npcIndex % WEATHER_ROTATION.length] ?? 'clear'],
      }
    case 'festival':
      return {
        recentEventKinds: ['community-celebration'],
        nearbyNPCIds: [neighborId],
      }
    case 'relationship':
      return {
        friendship: ['friend', 'close-friend'],
        memoryKeys: [`friendship.${npc.id}`],
      }
    case 'conflict':
      return {
        recentEventKinds: ['argument'],
        memoryKeys: [`conflict.${npc.id}`],
      }
    case 'reconciliation':
      return {
        recentEventKinds: ['reconciliation'],
        nearbyNPCIds: [neighborId],
        memoryKeys: [`reconciled.${npc.id}`],
      }
    case 'request':
      return {
        activities: ['errand'],
        giftTags: [npc.preferences.favoriteGiftTag],
        questIds: [primaryRequestId(npc)],
      }
    case 'community-event':
      return {
        locations: ['town-square'],
        minuteRange: [720, 1320],
        recentEventKinds: ['community-celebration'],
        nearbyNPCIds: [neighborId],
      }
  }
}

function authoredLinesForNPC(npc: NPCDef, npcIndex: number): readonly DialogueLine[] {
  const neighbor =
    SORTED_NPC_DEFINITIONS[(npcIndex + 1) % SORTED_NPC_DEFINITIONS.length] ?? npc

  return DIALOGUE_TOPICS.flatMap((topic): readonly DialogueLine[] => [
    {
      id: `dialogue.${npc.id}.${topic}.context`,
      speakerId: npc.id,
      topic,
      text: CONTEXT_TEXT[topic](npc, neighbor.identity.displayName),
      conditions: contextualCondition(npc, npcIndex, neighbor.id, topic),
      priority: 100,
    },
    {
      id: `dialogue.${npc.id}.${topic}.fallback`,
      speakerId: npc.id,
      topic,
      text: FALLBACK_TEXT[topic](npc, neighbor.identity.displayName),
      conditions: {},
      priority: 0,
    },
  ])
}

/**
 * Entirely local authored dialogue. Every NPC/topic pair has a contextual line and
 * an unconditional fallback, so known speakers never depend on an online service.
 */
export const NPC_DIALOGUE_LINES: readonly DialogueLine[] =
  SORTED_NPC_DEFINITIONS.flatMap(authoredLinesForNPC)

function includesValue<T>(allowed: readonly T[] | undefined, actual: T): boolean {
  return allowed === undefined || allowed.includes(actual)
}

function overlaps<T>(required: readonly T[] | undefined, actual: readonly T[]): boolean {
  return required === undefined || required.some((value) => actual.includes(value))
}

function matchesMinuteRange(range: readonly [number, number] | undefined, minute: number): boolean {
  if (range === undefined) return true

  const [startMinute, endMinute] = range
  if (startMinute <= endMinute) {
    return minute >= startMinute && minute <= endMinute
  }

  const minuteOfDay = ((minute % 1440) + 1440) % 1440
  const startOfDay = ((startMinute % 1440) + 1440) % 1440
  const endOfDay = ((endMinute % 1440) + 1440) % 1440
  return minuteOfDay >= startOfDay || minuteOfDay <= endOfDay
}

export function matchesDialogueCondition(
  condition: DialogueCondition,
  context: DialogueContext,
): boolean {
  return (
    includesValue(condition.locations, context.locationId) &&
    (condition.rooms === undefined ||
      (context.roomId !== null && condition.rooms.includes(context.roomId))) &&
    includesValue(condition.activities, context.activity) &&
    matchesMinuteRange(condition.minuteRange, context.minute) &&
    includesValue(condition.seasons, context.season) &&
    includesValue(condition.weather, context.weather) &&
    includesValue(condition.friendship, context.friendship) &&
    includesValue(condition.householdIds, context.householdId) &&
    includesValue(condition.employmentStatuses, context.employmentStatus) &&
    overlaps(condition.recentEventKinds, context.recentEventKinds) &&
    overlaps(condition.giftTags, context.giftTags) &&
    overlaps(condition.questIds, context.questIds) &&
    overlaps(condition.nearbyNPCIds, context.nearbyNPCIds) &&
    overlaps(condition.memoryKeys, context.memoryKeys)
  )
}

function compareDialogueLines(left: DialogueLine, right: DialogueLine): number {
  const priorityOrder = right.priority - left.priority
  if (priorityOrder !== 0) return priorityOrder
  return compareStableText(left.id, right.id)
}

export function selectDialogue(
  speakerId: string,
  topic: DialogueTopic,
  context: DialogueContext,
  lines: readonly DialogueLine[] = NPC_DIALOGUE_LINES,
): DialogueLine | null {
  const eligible = lines.filter(
    (line) =>
      line.speakerId === speakerId &&
      line.topic === topic &&
      matchesDialogueCondition(line.conditions, context),
  )

  eligible.sort(compareDialogueLines)
  return eligible[0] ?? null
}
