import type {
  ContentCategory,
  EmploymentRoleDef,
  NonNPCDefinition,
  ScheduleActivity,
  StationRoleDef,
  StructureDefinition,
  StructureInstance,
  StructureKind,
  ValidationResult,
} from './types'

const CONTENT_ID_WIDTH = 4
const STRUCTURE_ID_WIDTH = 4

export const CONTENT_CATEGORY_COUNTS = Object.freeze({
  'field-crop': 500,
  'perennial-plant': 250,
  'animal-species': 150,
  factory: 400,
  building: 300,
  product: 1_500,
  recipe: 1_200,
  'raw-material': 300,
  'world-object': 400,
}) satisfies Readonly<Record<ContentCategory, number>>

const CONTENT_CATEGORIES = Object.freeze(
  Object.keys(CONTENT_CATEGORY_COUNTS) as ContentCategory[],
)

const CONTENT_CATEGORY_LABELS = Object.freeze({
  'field-crop': 'Field Crop',
  'perennial-plant': 'Perennial Plant',
  'animal-species': 'Animal Species',
  factory: 'Factory Blueprint',
  building: 'Building Blueprint',
  product: 'Valley Product',
  recipe: 'Production Recipe',
  'raw-material': 'Raw Material',
  'world-object': 'World Object',
}) satisfies Readonly<Record<ContentCategory, string>>

const CONTENT_RULE_TAGS = Object.freeze({
  'field-crop': Object.freeze(['growable', 'seasonal', 'harvestable']),
  'perennial-plant': Object.freeze(['growable', 'perennial', 'harvestable']),
  'animal-species': Object.freeze(['animal-care', 'produce', 'husbandry']),
  factory: Object.freeze(['placeable', 'enterable', 'production-facility']),
  building: Object.freeze(['placeable', 'enterable', 'service-building']),
  product: Object.freeze(['sellable', 'storable', 'quality-graded']),
  recipe: Object.freeze(['production-rule', 'input-output', 'queueable']),
  'raw-material': Object.freeze(['resource', 'storable', 'recipe-input']),
  'world-object': Object.freeze(['placeable', 'interactive', 'world-detail']),
}) satisfies Readonly<Record<ContentCategory, readonly string[]>>

function positiveDefinitionIndex(index: number, label: string): number {
  if (!Number.isSafeInteger(index) || index < 1) {
    throw new RangeError(`${label} index must be a positive safe integer; received ${String(index)}`)
  }
  return index
}

function paddedIndex(index: number, width: number, label: string): string {
  return String(positiveDefinitionIndex(index, label)).padStart(width, '0')
}

/** Stable, one-based ID for a non-NPC definition. */
export function contentDefinitionId(category: ContentCategory, index: number): string {
  return `shv:content:${category}:${paddedIndex(index, CONTENT_ID_WIDTH, 'content definition')}`
}

/** Stable, one-based ID for a structure definition. */
export function structureDefinitionId(kind: StructureKind, index: number): string {
  return `shv:structure:${kind}:${paddedIndex(index, STRUCTURE_ID_WIDTH, 'structure definition')}`
}

function createNonNPCDefinition(category: ContentCategory, index: number): NonNPCDefinition {
  const serial = paddedIndex(index, CONTENT_ID_WIDTH, 'content definition')
  return Object.freeze({
    id: contentDefinitionId(category, index),
    category,
    name: `${CONTENT_CATEGORY_LABELS[category]} ${serial}`,
    registryKey: `life.content.${category}.${serial}`,
    localizationKey: `life.content.${category}.${serial}.name`,
    assetKey: `life/${category}/${serial}`,
    documentationKey: `life-content-${category}-${serial}`,
    ruleTags: CONTENT_RULE_TAGS[category],
  })
}

function createNonNPCDefinitions(): readonly NonNPCDefinition[] {
  const definitions: NonNPCDefinition[] = []
  for (const category of CONTENT_CATEGORIES) {
    for (let index = 1; index <= CONTENT_CATEGORY_COUNTS[category]; index += 1) {
      definitions.push(createNonNPCDefinition(category, index))
    }
  }
  return Object.freeze(definitions)
}

/** The complete deterministic catalog: exactly 5,000 non-NPC definitions. */
export const NON_NPC_DEFINITIONS: readonly NonNPCDefinition[] = createNonNPCDefinitions()

function stationRole(
  id: string,
  name: string,
  activities: readonly ScheduleActivity[],
  hygieneRequired: boolean,
): StationRoleDef {
  return Object.freeze({
    id,
    name,
    activities: Object.freeze([...activities]),
    hygieneRequired,
  })
}

export const STATION_ROLE_DEFS: readonly StationRoleDef[] = Object.freeze([
  stationRole('shv:station-role:sanitation', 'Sanitation', ['toilet'], false),
  stationRole('shv:station-role:hand-washing', 'Hand Washing', ['wash-hands'], false),
  stationRole('shv:station-role:cleaning', 'Cleaning', ['work', 'wash-hands'], true),
  stationRole('shv:station-role:intake', 'Material Intake', ['work'], true),
  stationRole('shv:station-role:inspection', 'Intake Inspection', ['work'], true),
  stationRole('shv:station-role:storage', 'Material Storage', ['work'], false),
  stationRole('shv:station-role:preparation', 'Production Preparation', ['work'], true),
  stationRole('shv:station-role:washing', 'Production Washing', ['work', 'wash-hands'], true),
  stationRole('shv:station-role:production', 'Production', ['work'], true),
  stationRole('shv:station-role:quality-control', 'Quality Control', ['work'], true),
  stationRole('shv:station-role:packaging', 'Packaging', ['work'], true),
  stationRole('shv:station-role:finished-goods-storage', 'Finished Goods Storage', ['work'], false),
  stationRole('shv:station-role:shipping', 'Shipping', ['work'], false),
  stationRole('shv:station-role:maintenance', 'Maintenance', ['work'], false),
  stationRole('shv:station-role:waste', 'Waste Handling', ['work', 'wash-hands'], true),
  stationRole('shv:station-role:recycling', 'Recycling', ['work', 'wash-hands'], true),
  stationRole('shv:station-role:staff-facilities', 'Staff Facilities', ['meal', 'rest'], false),
  stationRole('shv:station-role:office', 'Office', ['work'], false),
  stationRole('shv:station-role:first-aid', 'First Aid', ['work'], true),
  stationRole('shv:station-role:safety-equipment', 'Safety Equipment', ['work'], false),
  stationRole('shv:station-role:agriculture', 'Agriculture', ['work'], true),
  stationRole('shv:station-role:animal-care', 'Animal Care', ['work', 'wash-hands'], true),
  stationRole('shv:station-role:customer-service', 'Customer Service', ['work', 'socialize'], false),
  stationRole('shv:station-role:cooking', 'Cooking', ['work', 'meal'], true),
  stationRole('shv:station-role:research', 'Research', ['work'], true),
])

function employmentRole(
  id: string,
  name: string,
  stationRoleIds: readonly string[],
  allowedStructureKinds: readonly StructureKind[],
  defaultShift: readonly [startMinute: number, endMinute: number],
): EmploymentRoleDef {
  return Object.freeze({
    id,
    name,
    stationRoleIds: Object.freeze([...stationRoleIds]),
    allowedStructureKinds: Object.freeze([...allowedStructureKinds]),
    defaultShift: Object.freeze([...defaultShift]) as readonly [number, number],
  })
}

export const EMPLOYMENT_ROLE_DEFS: readonly EmploymentRoleDef[] = Object.freeze([
  employmentRole(
    'shv:employment-role:custodian',
    'Custodian',
    ['shv:station-role:cleaning', 'shv:station-role:sanitation', 'shv:station-role:hand-washing'],
    ['factory', 'building'],
    [420, 900],
  ),
  employmentRole(
    'shv:employment-role:production-operator',
    'Production Operator',
    ['shv:station-role:preparation', 'shv:station-role:washing', 'shv:station-role:production'],
    ['factory'],
    [480, 960],
  ),
  employmentRole(
    'shv:employment-role:quality-inspector',
    'Quality Inspector',
    ['shv:station-role:inspection', 'shv:station-role:quality-control'],
    ['factory'],
    [480, 960],
  ),
  employmentRole(
    'shv:employment-role:logistics-coordinator',
    'Logistics Coordinator',
    ['shv:station-role:intake', 'shv:station-role:storage', 'shv:station-role:shipping'],
    ['factory'],
    [420, 900],
  ),
  employmentRole(
    'shv:employment-role:farmer',
    'Farmer',
    ['shv:station-role:agriculture'],
    ['building'],
    [360, 840],
  ),
  employmentRole(
    'shv:employment-role:animal-caretaker',
    'Animal Caretaker',
    ['shv:station-role:animal-care'],
    ['building'],
    [360, 840],
  ),
  employmentRole(
    'shv:employment-role:service-host',
    'Service Host',
    ['shv:station-role:customer-service'],
    ['building'],
    [540, 1_020],
  ),
  employmentRole(
    'shv:employment-role:cook',
    'Cook',
    ['shv:station-role:cooking'],
    ['building'],
    [480, 960],
  ),
  employmentRole(
    'shv:employment-role:researcher',
    'Researcher',
    ['shv:station-role:research'],
    ['factory', 'building'],
    [540, 1_020],
  ),
  employmentRole(
    'shv:employment-role:office-coordinator',
    'Office Coordinator',
    ['shv:station-role:office'],
    ['factory', 'building'],
    [480, 960],
  ),
  employmentRole(
    'shv:employment-role:maintenance-technician',
    'Maintenance Technician',
    ['shv:station-role:maintenance', 'shv:station-role:safety-equipment'],
    ['factory', 'building'],
    [420, 900],
  ),
])

const REQUIRED_SANITATION_ROLE_IDS = Object.freeze([
  'shv:station-role:sanitation',
  'shv:station-role:hand-washing',
  'shv:station-role:cleaning',
])

const REQUIRED_FACTORY_ROLE_IDS = Object.freeze([
  ...REQUIRED_SANITATION_ROLE_IDS,
  'shv:station-role:intake',
  'shv:station-role:inspection',
  'shv:station-role:storage',
  'shv:station-role:preparation',
  'shv:station-role:washing',
  'shv:station-role:production',
  'shv:station-role:quality-control',
  'shv:station-role:packaging',
  'shv:station-role:finished-goods-storage',
  'shv:station-role:shipping',
  'shv:station-role:maintenance',
  'shv:station-role:waste',
  'shv:station-role:recycling',
  'shv:station-role:staff-facilities',
  'shv:station-role:office',
  'shv:station-role:first-aid',
  'shv:station-role:safety-equipment',
])

const BUILDING_SPECIALITY_ROLE_IDS = Object.freeze([
  'shv:station-role:agriculture',
  'shv:station-role:animal-care',
  'shv:station-role:customer-service',
  'shv:station-role:cooking',
])

const SHARED_OPTIONAL_ROLE_IDS = Object.freeze([
  'shv:station-role:research',
  'shv:station-role:office',
  'shv:station-role:maintenance',
])

function uniqueFrozen(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)])
}

function stationRoleIdsForStructure(kind: StructureKind, index: number): readonly string[] {
  if (kind === 'factory') {
    return uniqueFrozen([
      ...REQUIRED_FACTORY_ROLE_IDS,
      ...(index % 5 === 0 ? ['shv:station-role:research'] : []),
    ])
  }

  const speciality = BUILDING_SPECIALITY_ROLE_IDS[(index - 1) % BUILDING_SPECIALITY_ROLE_IDS.length]
  return uniqueFrozen([
    ...REQUIRED_SANITATION_ROLE_IDS,
    speciality,
    ...(index % 2 === 0 ? ['shv:station-role:office'] : []),
    ...(index % 3 === 0 ? ['shv:station-role:research'] : []),
    ...(index % 5 === 0 ? ['shv:station-role:maintenance'] : []),
    ...(index % 5 === 0 ? ['shv:station-role:safety-equipment'] : []),
  ])
}

function createStructureDefinition(kind: StructureKind, index: number): StructureDefinition {
  const serial = paddedIndex(index, STRUCTURE_ID_WIDTH, 'structure definition')
  const capacity = kind === 'factory' ? 16 + ((index - 1) % 25) : 4 + ((index - 1) % 13)
  return Object.freeze({
    id: structureDefinitionId(kind, index),
    contentDefinitionId: contentDefinitionId(kind, index),
    kind,
    name: `${kind === 'factory' ? 'Operational Factory' : 'Enterable Building'} ${serial}`,
    stationRoleIds: stationRoleIdsForStructure(kind, index),
    capacity,
    enterable: true,
    supportsPlayerBuiltInstances: true,
  })
}

function createStructureDefinitions(): readonly StructureDefinition[] {
  const definitions: StructureDefinition[] = []
  for (const kind of ['factory', 'building'] as const) {
    for (let index = 1; index <= CONTENT_CATEGORY_COUNTS[kind]; index += 1) {
      definitions.push(createStructureDefinition(kind, index))
    }
  }
  return Object.freeze(definitions)
}

/** All 700 enterable structure definitions; live instances are intentionally stored separately. */
export const STRUCTURE_DEFINITIONS: readonly StructureDefinition[] = createStructureDefinitions()

const NON_NPC_DEFINITION_BY_ID: ReadonlyMap<string, NonNPCDefinition> = new Map(
  NON_NPC_DEFINITIONS.map((definition) => [definition.id, definition] as const),
)
const NON_NPC_DEFINITION_BY_KEY: ReadonlyMap<string, NonNPCDefinition> = new Map(
  NON_NPC_DEFINITIONS.map((definition) => [definition.registryKey, definition] as const),
)
const STRUCTURE_DEFINITION_BY_ID: ReadonlyMap<string, StructureDefinition> = new Map(
  STRUCTURE_DEFINITIONS.map((definition) => [definition.id, definition] as const),
)
const STATION_ROLE_DEF_BY_ID: ReadonlyMap<string, StationRoleDef> = new Map(
  STATION_ROLE_DEFS.map((definition) => [definition.id, definition] as const),
)
const EMPLOYMENT_ROLE_DEF_BY_ID: ReadonlyMap<string, EmploymentRoleDef> = new Map(
  EMPLOYMENT_ROLE_DEFS.map((definition) => [definition.id, definition] as const),
)

export function getNonNPCDefinition(id: string): NonNPCDefinition | undefined {
  return NON_NPC_DEFINITION_BY_ID.get(id)
}

export function getNonNPCDefinitionByKey(registryKey: string): NonNPCDefinition | undefined {
  return NON_NPC_DEFINITION_BY_KEY.get(registryKey)
}

export function getStructureDefinition(id: string): StructureDefinition | undefined {
  return STRUCTURE_DEFINITION_BY_ID.get(id)
}

export function getStationRoleDef(id: string): StationRoleDef | undefined {
  return STATION_ROLE_DEF_BY_ID.get(id)
}

export function getEmploymentRoleDef(id: string): EmploymentRoleDef | undefined {
  return EMPLOYMENT_ROLE_DEF_BY_ID.get(id)
}

export interface StructureInstanceRegistry {
  readonly instances: readonly StructureInstance[]
  readonly byId: ReadonlyMap<string, StructureInstance>
  readonly byDefinitionId: ReadonlyMap<string, readonly StructureInstance[]>
}

function snapshotStructureInstance(instance: StructureInstance): StructureInstance {
  const owner =
    instance.owner.kind === 'household'
      ? Object.freeze({ kind: 'household' as const, householdId: instance.owner.householdId })
      : instance.owner.kind === 'player'
        ? Object.freeze({ kind: 'player' as const })
        : Object.freeze({ kind: 'valley' as const })
  return Object.freeze({
    ...instance,
    owner,
    stationIds: Object.freeze([...instance.stationIds]),
  })
}

/** Builds indexes only for structures that currently exist in the valley or were player-built. */
export function createStructureInstanceRegistry(
  instances: readonly StructureInstance[] = [],
): StructureInstanceRegistry {
  const snapshots = Object.freeze(instances.map(snapshotStructureInstance))
  const byId = new Map<string, StructureInstance>()
  const mutableByDefinitionId = new Map<string, StructureInstance[]>()

  for (const instance of snapshots) {
    byId.set(instance.id, instance)
    const existing = mutableByDefinitionId.get(instance.definitionId)
    if (existing === undefined) {
      mutableByDefinitionId.set(instance.definitionId, [instance])
    } else {
      existing.push(instance)
    }
  }

  const byDefinitionId = new Map<string, readonly StructureInstance[]>()
  for (const [definitionId, groupedInstances] of mutableByDefinitionId) {
    byDefinitionId.set(definitionId, Object.freeze(groupedInstances))
  }

  return Object.freeze({
    instances: snapshots,
    byId,
    byDefinitionId,
  })
}

export function getStructureInstance(
  registry: StructureInstanceRegistry,
  instanceId: string,
): StructureInstance | undefined {
  return registry.byId.get(instanceId)
}

export function getStructureInstancesForDefinition(
  registry: StructureInstanceRegistry,
  definitionId: string,
): readonly StructureInstance[] {
  return registry.byDefinitionId.get(definitionId) ?? Object.freeze([])
}

/** Immutable sparse upsert suitable for valley placement or player building. */
export function upsertStructureInstance(
  registry: StructureInstanceRegistry,
  instance: StructureInstance,
): StructureInstanceRegistry {
  const next = registry.instances.filter((candidate) => candidate.id !== instance.id)
  return createStructureInstanceRegistry([...next, instance])
}

/** Immutable sparse removal; structure definitions remain available for schedules and employment. */
export function removeStructureInstance(
  registry: StructureInstanceRegistry,
  instanceId: string,
): StructureInstanceRegistry {
  return createStructureInstanceRegistry(
    registry.instances.filter((instance) => instance.id !== instanceId),
  )
}

export interface ContentCatalogValidationInput {
  readonly nonNPCDefinitions?: readonly NonNPCDefinition[]
  readonly structureDefinitions?: readonly StructureDefinition[]
  readonly stationRoleDefs?: readonly StationRoleDef[]
  readonly employmentRoleDefs?: readonly EmploymentRoleDef[]
  readonly structureInstances?: readonly StructureInstance[]
}

function duplicateValues<T>(items: readonly T[], value: (item: T) => string): readonly string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const item of items) {
    const candidate = value(item)
    if (seen.has(candidate)) {
      duplicates.add(candidate)
    }
    seen.add(candidate)
  }
  return [...duplicates].sort()
}

function reportDuplicates<T>(
  problems: string[],
  label: string,
  items: readonly T[],
  value: (item: T) => string,
): void {
  for (const duplicate of duplicateValues(items, value)) {
    problems.push(`Duplicate ${label}: ${duplicate}`)
  }
}

function validateNonNPCDefinitions(
  definitions: readonly NonNPCDefinition[],
  problems: string[],
): void {
  if (definitions.length !== 5_000) {
    problems.push(`Expected exactly 5000 non-NPC definitions; received ${definitions.length}`)
  }

  reportDuplicates(problems, 'content definition ID', definitions, (definition) => definition.id)
  reportDuplicates(problems, 'content definition name', definitions, (definition) => definition.name)
  reportDuplicates(problems, 'content registry key', definitions, (definition) => definition.registryKey)
  reportDuplicates(problems, 'content localization key', definitions, (definition) => definition.localizationKey)
  reportDuplicates(problems, 'content asset key', definitions, (definition) => definition.assetKey)
  reportDuplicates(problems, 'content documentation key', definitions, (definition) => definition.documentationKey)

  for (const category of CONTENT_CATEGORIES) {
    const matching = definitions.filter((definition) => definition.category === category)
    if (matching.length !== CONTENT_CATEGORY_COUNTS[category]) {
      problems.push(
        `Expected ${CONTENT_CATEGORY_COUNTS[category]} ${category} definitions; received ${matching.length}`,
      )
    }
    const expectedIds = new Set(
      Array.from({ length: CONTENT_CATEGORY_COUNTS[category] }, (_, offset) =>
        contentDefinitionId(category, offset + 1),
      ),
    )
    for (const definition of matching) {
      if (!expectedIds.delete(definition.id)) {
        problems.push(`Unexpected ${category} definition ID: ${definition.id}`)
      }
      if (definition.ruleTags.length === 0) {
        problems.push(`Content definition ${definition.id} has no rule tags`)
      }
      if (
        definition.name.trim().length === 0 ||
        definition.registryKey.trim().length === 0 ||
        definition.localizationKey.trim().length === 0 ||
        definition.assetKey.trim().length === 0 ||
        definition.documentationKey.trim().length === 0
      ) {
        problems.push(`Content definition ${definition.id} has a blank name or registry key`)
      }
    }
    for (const missingId of expectedIds) {
      problems.push(`Missing ${category} definition ID: ${missingId}`)
    }
  }
}

function validateRoleDefinitions(
  stationRoles: readonly StationRoleDef[],
  employmentRoles: readonly EmploymentRoleDef[],
  problems: string[],
): void {
  reportDuplicates(problems, 'station role ID', stationRoles, (role) => role.id)
  reportDuplicates(problems, 'station role name', stationRoles, (role) => role.name)
  reportDuplicates(problems, 'employment role ID', employmentRoles, (role) => role.id)
  reportDuplicates(problems, 'employment role name', employmentRoles, (role) => role.name)

  const stationRoleIds = new Set(stationRoles.map((role) => role.id))
  for (const role of stationRoles) {
    if (role.id.trim().length === 0 || role.name.trim().length === 0 || role.activities.length === 0) {
      problems.push(`Station role ${role.id || '<blank>'} is incomplete`)
    }
  }

  for (const role of employmentRoles) {
    if (role.stationRoleIds.length === 0 || role.allowedStructureKinds.length === 0) {
      problems.push(`Employment role ${role.id} has no station roles or allowed structure kinds`)
    }
    if (new Set(role.stationRoleIds).size !== role.stationRoleIds.length) {
      problems.push(`Employment role ${role.id} has duplicate station role references`)
    }
    if (new Set(role.allowedStructureKinds).size !== role.allowedStructureKinds.length) {
      problems.push(`Employment role ${role.id} has duplicate allowed structure kinds`)
    }
    if (role.allowedStructureKinds.some((kind) => kind !== 'factory' && kind !== 'building')) {
      problems.push(`Employment role ${role.id} has an invalid allowed structure kind`)
    }
    for (const stationRoleId of role.stationRoleIds) {
      if (!stationRoleIds.has(stationRoleId)) {
        problems.push(`Employment role ${role.id} references unknown station role ${stationRoleId}`)
      }
    }
    const [startMinute, endMinute] = role.defaultShift
    if (
      !Number.isSafeInteger(startMinute) ||
      !Number.isSafeInteger(endMinute) ||
      startMinute < 0 ||
      endMinute > 1_440 ||
      startMinute >= endMinute
    ) {
      problems.push(`Employment role ${role.id} has invalid shift ${startMinute}-${endMinute}`)
    }
  }
}

function validateStructureDefinitions(
  structures: readonly StructureDefinition[],
  contentDefinitions: readonly NonNPCDefinition[],
  stationRoles: readonly StationRoleDef[],
  employmentRoles: readonly EmploymentRoleDef[],
  problems: string[],
): void {
  if (structures.length !== 700) {
    problems.push(`Expected exactly 700 structure definitions; received ${structures.length}`)
  }
  reportDuplicates(problems, 'structure definition ID', structures, (definition) => definition.id)
  reportDuplicates(problems, 'structure definition name', structures, (definition) => definition.name)
  reportDuplicates(
    problems,
    'structure content definition reference',
    structures,
    (definition) => definition.contentDefinitionId,
  )

  const contentById = new Map(
    contentDefinitions.map((definition) => [definition.id, definition] as const),
  )
  const stationRoleIds = new Set(stationRoles.map((role) => role.id))

  for (const kind of ['factory', 'building'] as const) {
    const matching = structures.filter((definition) => definition.kind === kind)
    if (matching.length !== CONTENT_CATEGORY_COUNTS[kind]) {
      problems.push(
        `Expected ${CONTENT_CATEGORY_COUNTS[kind]} ${kind} structures; received ${matching.length}`,
      )
    }
    const expectedIds = new Set(
      Array.from({ length: CONTENT_CATEGORY_COUNTS[kind] }, (_, offset) =>
        structureDefinitionId(kind, offset + 1),
      ),
    )
    for (const definition of matching) {
      if (!expectedIds.delete(definition.id)) {
        problems.push(`Unexpected ${kind} structure ID: ${definition.id}`)
      }
    }
    for (const missingId of expectedIds) {
      problems.push(`Missing ${kind} structure ID: ${missingId}`)
    }
  }

  for (const structure of structures) {
    const contentDefinition = contentById.get(structure.contentDefinitionId)
    if (contentDefinition === undefined) {
      problems.push(
        `Structure ${structure.id} references unknown content definition ${structure.contentDefinitionId}`,
      )
    } else if (contentDefinition.category !== structure.kind) {
      problems.push(
        `Structure ${structure.id} kind ${structure.kind} references ${contentDefinition.category} content`,
      )
    }

    if (structure.enterable !== true) {
      problems.push(`Structure ${structure.id} is not enterable`)
    }
    if (!Number.isSafeInteger(structure.capacity) || structure.capacity < 1) {
      problems.push(`Structure ${structure.id} has invalid capacity ${structure.capacity}`)
    }
    if (structure.name.trim().length === 0) {
      problems.push(`Structure ${structure.id} has a blank name`)
    }

    const roleIds = new Set(structure.stationRoleIds)
    if (roleIds.size !== structure.stationRoleIds.length) {
      problems.push(`Structure ${structure.id} has duplicate station role references`)
    }
    for (const stationRoleId of structure.stationRoleIds) {
      if (!stationRoleIds.has(stationRoleId)) {
        problems.push(`Structure ${structure.id} references unknown station role ${stationRoleId}`)
      }
    }
    for (const roleId of REQUIRED_SANITATION_ROLE_IDS) {
      if (!roleIds.has(roleId)) {
        problems.push(`Structure ${structure.id} is missing required sanitation role ${roleId}`)
      }
    }
    if (structure.kind === 'factory') {
      for (const roleId of REQUIRED_FACTORY_ROLE_IDS) {
        if (!roleIds.has(roleId)) {
          problems.push(`Factory ${structure.id} is missing required operational role ${roleId}`)
        }
      }
    } else if (!BUILDING_SPECIALITY_ROLE_IDS.some((roleId) => roleIds.has(roleId))) {
      problems.push(`Building ${structure.id} has no purpose-specific service role`)
    }
  }

  const structureRefs = new Set(structures.map((structure) => structure.contentDefinitionId))
  for (const contentDefinition of contentDefinitions) {
    if (
      (contentDefinition.category === 'factory' || contentDefinition.category === 'building') &&
      !structureRefs.has(contentDefinition.id)
    ) {
      problems.push(`Content definition ${contentDefinition.id} has no corresponding structure`)
    }
  }

  for (const kind of ['factory', 'building'] as const) {
    for (const roleId of SHARED_OPTIONAL_ROLE_IDS) {
      if (
        !structures.some(
          (structure) => structure.kind === kind && structure.stationRoleIds.includes(roleId),
        )
      ) {
        problems.push(`${kind} structures do not cover shared role ${roleId}`)
      }
    }
  }

  for (const employmentRoleDefinition of employmentRoles) {
    for (const kind of employmentRoleDefinition.allowedStructureKinds) {
      for (const stationRoleId of employmentRoleDefinition.stationRoleIds) {
        if (
          !structures.some(
            (structure) =>
              structure.kind === kind && structure.stationRoleIds.includes(stationRoleId),
          )
        ) {
          problems.push(
            `Employment role ${employmentRoleDefinition.id} cannot use station role ${stationRoleId} in ${kind} structures`,
          )
        }
      }
    }
  }
}

function validateStructureInstances(
  instances: readonly StructureInstance[],
  structures: readonly StructureDefinition[],
  problems: string[],
): void {
  reportDuplicates(problems, 'structure instance ID', instances, (instance) => instance.id)
  const structureById = new Map(
    structures.map((structure) => [structure.id, structure] as const),
  )

  for (const instance of instances) {
    const definition = structureById.get(instance.definitionId)
    if (instance.id.trim().length === 0) {
      problems.push('Structure instance has a blank ID')
    }
    if (definition === undefined) {
      problems.push(
        `Structure instance ${instance.id} references unknown definition ${instance.definitionId}`,
      )
    } else if (instance.owner.kind === 'player' && !definition.supportsPlayerBuiltInstances) {
      problems.push(`Structure instance ${instance.id} uses a non-player-buildable definition`)
    }
    if (instance.owner.kind === 'household' && instance.owner.householdId.trim().length === 0) {
      problems.push(`Structure instance ${instance.id} has a blank household owner reference`)
    }
    if (new Set(instance.stationIds).size !== instance.stationIds.length) {
      problems.push(`Structure instance ${instance.id} has duplicate station IDs`)
    }
    if (instance.stationIds.some((stationId) => stationId.trim().length === 0)) {
      problems.push(`Structure instance ${instance.id} has a blank station ID`)
    }
  }
}

/**
 * Validates the built-in catalogs by default. Optional overrides make negative-regression tests
 * possible without mutating the frozen production registries. Sparse instance lists may be empty.
 */
export function validateContentCatalog(
  input: ContentCatalogValidationInput = {},
): ValidationResult {
  const nonNPCDefinitions = input.nonNPCDefinitions ?? NON_NPC_DEFINITIONS
  const structureDefinitions = input.structureDefinitions ?? STRUCTURE_DEFINITIONS
  const stationRoleDefs = input.stationRoleDefs ?? STATION_ROLE_DEFS
  const employmentRoleDefs = input.employmentRoleDefs ?? EMPLOYMENT_ROLE_DEFS
  const structureInstances = input.structureInstances ?? []
  const problems: string[] = []

  validateNonNPCDefinitions(nonNPCDefinitions, problems)
  validateRoleDefinitions(stationRoleDefs, employmentRoleDefs, problems)
  validateStructureDefinitions(
    structureDefinitions,
    nonNPCDefinitions,
    stationRoleDefs,
    employmentRoleDefs,
    problems,
  )
  validateStructureInstances(structureInstances, structureDefinitions, problems)

  return { ok: problems.length === 0, problems }
}
