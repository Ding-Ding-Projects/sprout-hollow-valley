import type {
  EmploymentAssignment,
  LifeSeason,
  NPCDef,
  NPCIdentity,
  RelationshipEdge,
  ScheduleActivity,
  ScheduleBlock,
  ScheduleCondition,
  ScheduleDestination,
  SchedulePlan,
  StructureKind,
} from './types'
import { structureDefinitionId } from './catalog'

const authoredIdentity = (
  displayName: string,
  pronouns: NPCIdentity['pronouns'],
  lifeStage: NPCIdentity['lifeStage'],
  season: LifeSeason,
  day: number,
): NPCIdentity => ({
  displayName,
  pronouns,
  lifeStage,
  birthday: { season, day },
})

/**
 * The valley's authored population. Identity data is deliberately enumerated
 * rather than synthesized so names remain stable, localizable, and human-made.
 * Every consecutive trio belongs to one household.
 */
export const AUTHORED_NPC_IDENTITIES: readonly NPCIdentity[] = [
  // Household 001
  authoredIdentity('Avery Rowan', 'they-them', 'young-adult', 'spring', 3),
  authoredIdentity('Mira Rowan', 'she-her', 'adult', 'summer', 11),
  authoredIdentity('Elias Rowan', 'he-him', 'older-adult', 'fall', 19),
  // Household 002
  authoredIdentity('Jun Park', 'he-him', 'adult', 'summer', 4),
  authoredIdentity('Hana Park', 'she-her', 'young-adult', 'fall', 12),
  authoredIdentity('Minho Park', 'he-him', 'elder', 'winter', 20),
  // Household 003
  authoredIdentity('Lucia Alvarez', 'she-her', 'young-adult', 'fall', 5),
  authoredIdentity('Mateo Alvarez', 'he-him', 'adult', 'winter', 13),
  authoredIdentity('Rosa Alvarez', 'she-her', 'older-adult', 'spring', 21),
  // Household 004
  authoredIdentity('Amara Okafor', 'she-her', 'adult', 'winter', 6),
  authoredIdentity('Chidi Okafor', 'he-him', 'young-adult', 'spring', 14),
  authoredIdentity('Nneka Okafor', 'they-them', 'elder', 'summer', 22),
  // Household 005
  authoredIdentity('Theo Bennett', 'he-him', 'young-adult', 'spring', 7),
  authoredIdentity('Clara Bennett', 'she-her', 'adult', 'summer', 15),
  authoredIdentity('Miles Bennett', 'they-them', 'older-adult', 'fall', 23),
  // Household 006
  authoredIdentity('Priya Shah', 'she-her', 'adult', 'summer', 8),
  authoredIdentity('Rohan Shah', 'he-him', 'young-adult', 'fall', 16),
  authoredIdentity('Leela Shah', 'she-her', 'elder', 'winter', 24),
  // Household 007
  authoredIdentity('Sora Kim', 'they-them', 'young-adult', 'fall', 9),
  authoredIdentity('Jisoo Kim', 'she-her', 'adult', 'winter', 17),
  authoredIdentity('Dae Kim', 'he-him', 'older-adult', 'spring', 25),
  // Household 008
  authoredIdentity('Noor Haddad', 'they-them', 'adult', 'winter', 10),
  authoredIdentity('Sami Haddad', 'he-him', 'young-adult', 'spring', 18),
  authoredIdentity('Layla Haddad', 'she-her', 'elder', 'summer', 26),
  // Household 009
  authoredIdentity('Imani Brooks', 'she-her', 'young-adult', 'spring', 11),
  authoredIdentity('Jordan Brooks', 'they-them', 'adult', 'summer', 19),
  authoredIdentity('Celeste Brooks', 'she-her', 'older-adult', 'fall', 27),
  // Household 010
  authoredIdentity("Finn O'Connor", 'he-him', 'adult', 'summer', 12),
  authoredIdentity("Maeve O'Connor", 'she-her', 'young-adult', 'fall', 20),
  authoredIdentity("Declan O'Connor", 'he-him', 'elder', 'winter', 28),
  // Household 011
  authoredIdentity('Linh Nguyen', 'she-her', 'young-adult', 'fall', 13),
  authoredIdentity('Bao Nguyen', 'they-them', 'adult', 'winter', 21),
  authoredIdentity('Thuy Nguyen', 'she-her', 'older-adult', 'spring', 1),
  // Household 012
  authoredIdentity('Anya Petrov', 'she-her', 'adult', 'winter', 14),
  authoredIdentity('Mikhail Petrov', 'he-him', 'young-adult', 'spring', 22),
  authoredIdentity('Ilya Petrov', 'he-him', 'elder', 'summer', 2),
  // Household 013
  authoredIdentity('Kofi Mensah', 'he-him', 'young-adult', 'spring', 15),
  authoredIdentity('Abena Mensah', 'she-her', 'adult', 'summer', 23),
  authoredIdentity('Yaw Mensah', 'they-them', 'older-adult', 'fall', 3),
  // Household 014
  authoredIdentity('Emi Tanaka', 'she-her', 'adult', 'summer', 16),
  authoredIdentity('Ren Tanaka', 'they-them', 'young-adult', 'fall', 24),
  authoredIdentity('Hiro Tanaka', 'he-him', 'elder', 'winter', 4),
  // Household 015
  authoredIdentity('Camille Dubois', 'they-them', 'young-adult', 'fall', 17),
  authoredIdentity('Julien Dubois', 'he-him', 'adult', 'winter', 25),
  authoredIdentity('Odette Dubois', 'she-her', 'older-adult', 'spring', 5),
  // Household 016
  authoredIdentity('Ines Silva', 'she-her', 'adult', 'winter', 18),
  authoredIdentity('Tiago Silva', 'he-him', 'young-adult', 'spring', 26),
  authoredIdentity('Beatriz Silva', 'she-her', 'elder', 'summer', 6),
  // Household 017
  authoredIdentity('Zara Ibrahim', 'she-her', 'young-adult', 'spring', 19),
  authoredIdentity('Omar Ibrahim', 'he-him', 'adult', 'summer', 27),
  authoredIdentity('Salma Ibrahim', 'they-them', 'older-adult', 'fall', 7),
  // Household 018
  authoredIdentity('Luca Rossi', 'he-him', 'adult', 'summer', 20),
  authoredIdentity('Giulia Rossi', 'she-her', 'young-adult', 'fall', 28),
  authoredIdentity('Paolo Rossi', 'he-him', 'elder', 'winter', 8),
  // Household 019
  authoredIdentity('Mei Chen', 'she-her', 'young-adult', 'fall', 21),
  authoredIdentity('Tao Chen', 'they-them', 'adult', 'winter', 1),
  authoredIdentity('Lian Chen', 'she-her', 'older-adult', 'spring', 9),
  // Household 020
  authoredIdentity('Irena Kowalski', 'she-her', 'adult', 'winter', 22),
  authoredIdentity('Pavel Kowalski', 'he-him', 'young-adult', 'spring', 2),
  authoredIdentity('Marta Kowalski', 'she-her', 'elder', 'summer', 10),
  // Household 021
  authoredIdentity('Tunde Adeyemi', 'he-him', 'young-adult', 'spring', 23),
  authoredIdentity('Sade Adeyemi', 'she-her', 'adult', 'summer', 3),
  authoredIdentity('Bisi Adeyemi', 'they-them', 'older-adult', 'fall', 11),
  // Household 022
  authoredIdentity('Greta Fischer', 'she-her', 'adult', 'summer', 24),
  authoredIdentity('Lukas Fischer', 'he-him', 'young-adult', 'fall', 4),
  authoredIdentity('Ernst Fischer', 'he-him', 'elder', 'winter', 12),
  // Household 023
  authoredIdentity('Elena Morales', 'she-her', 'young-adult', 'fall', 25),
  authoredIdentity('Diego Morales', 'he-him', 'adult', 'winter', 5),
  authoredIdentity('Alma Morales', 'she-her', 'older-adult', 'spring', 13),
  // Household 024
  authoredIdentity('Asha Singh', 'she-her', 'adult', 'winter', 26),
  authoredIdentity('Nikhil Singh', 'he-him', 'young-adult', 'spring', 6),
  authoredIdentity('Kiran Singh', 'they-them', 'elder', 'summer', 14),
  // Household 025
  authoredIdentity('Yui Yamamoto', 'she-her', 'young-adult', 'spring', 27),
  authoredIdentity('Kenji Yamamoto', 'he-him', 'adult', 'summer', 7),
  authoredIdentity('Sachiko Yamamoto', 'she-her', 'older-adult', 'fall', 15),
  // Household 026
  authoredIdentity('Selam Abebe', 'she-her', 'adult', 'summer', 28),
  authoredIdentity('Dawit Abebe', 'he-him', 'young-adult', 'fall', 8),
  authoredIdentity('Mimi Abebe', 'they-them', 'elder', 'winter', 16),
  // Household 027
  authoredIdentity('Freja Lindberg', 'they-them', 'young-adult', 'fall', 1),
  authoredIdentity('Sven Lindberg', 'he-him', 'adult', 'winter', 9),
  authoredIdentity('Astrid Lindberg', 'she-her', 'older-adult', 'spring', 17),
  // Household 028
  authoredIdentity('Amina Rahman', 'she-her', 'adult', 'winter', 2),
  authoredIdentity('Farid Rahman', 'he-him', 'young-adult', 'spring', 10),
  authoredIdentity('Nasrin Rahman', 'she-her', 'elder', 'summer', 18),
  // Household 029
  authoredIdentity('Marina Costa', 'she-her', 'young-adult', 'spring', 3),
  authoredIdentity('Rui Costa', 'he-him', 'adult', 'summer', 11),
  authoredIdentity('Teresa Costa', 'she-her', 'older-adult', 'fall', 19),
  // Household 030
  authoredIdentity('Harper Wilson', 'they-them', 'adult', 'summer', 4),
  authoredIdentity('Evan Wilson', 'he-him', 'young-adult', 'fall', 12),
  authoredIdentity('June Wilson', 'she-her', 'elder', 'winter', 20),
  // Household 031
  authoredIdentity('Riya Das', 'she-her', 'young-adult', 'fall', 5),
  authoredIdentity('Arun Das', 'he-him', 'adult', 'winter', 13),
  authoredIdentity('Mala Das', 'they-them', 'older-adult', 'spring', 21),
  // Household 032
  authoredIdentity('Petra Novak', 'she-her', 'adult', 'winter', 6),
  authoredIdentity('Tomas Novak', 'he-him', 'young-adult', 'spring', 14),
  authoredIdentity('Vera Novak', 'she-her', 'elder', 'summer', 22),
  // Household 033
  authoredIdentity('Ada Okoye', 'she-her', 'young-adult', 'spring', 7),
  authoredIdentity('Emeka Okoye', 'he-him', 'adult', 'summer', 15),
  authoredIdentity('Uche Okoye', 'they-them', 'older-adult', 'fall', 23),
  // Household 034
  authoredIdentity('Sabine Martin', 'she-her', 'adult', 'summer', 8),
  authoredIdentity('Remy Martin', 'they-them', 'young-adult', 'fall', 16),
  authoredIdentity('Gaston Martin', 'he-him', 'elder', 'winter', 24),
  // Household 035
  authoredIdentity('Isabel Garcia', 'she-her', 'young-adult', 'fall', 9),
  authoredIdentity('Javier Garcia', 'he-him', 'adult', 'winter', 17),
  authoredIdentity('Pilar Garcia', 'she-her', 'older-adult', 'spring', 25),
  // Household 036
  authoredIdentity('Linnea Nordin', 'she-her', 'adult', 'winter', 10),
  authoredIdentity('Oskar Nordin', 'he-him', 'young-adult', 'spring', 18),
  authoredIdentity('Birgit Nordin', 'they-them', 'elder', 'summer', 26),
  // Household 037
  authoredIdentity('Ivo Santos', 'he-him', 'young-adult', 'spring', 11),
  authoredIdentity('Mara Santos', 'she-her', 'adult', 'summer', 19),
  authoredIdentity('Nuno Santos', 'he-him', 'older-adult', 'fall', 27),
  // Household 038
  authoredIdentity('Neha Patel', 'she-her', 'adult', 'summer', 12),
  authoredIdentity('Dev Patel', 'he-him', 'young-adult', 'fall', 20),
  authoredIdentity('Uma Patel', 'she-her', 'elder', 'winter', 28),
  // Household 039
  authoredIdentity('Aiko Nakamura', 'she-her', 'young-adult', 'fall', 13),
  authoredIdentity('Riku Nakamura', 'they-them', 'adult', 'winter', 21),
  authoredIdentity('Fumiko Nakamura', 'she-her', 'older-adult', 'spring', 1),
  // Household 040
  authoredIdentity('Callum Campbell', 'he-him', 'adult', 'winter', 14),
  authoredIdentity('Elspeth Campbell', 'she-her', 'young-adult', 'spring', 22),
  authoredIdentity('Angus Campbell', 'he-him', 'elder', 'summer', 2),
  // Household 041
  authoredIdentity('Moussa Diallo', 'he-him', 'young-adult', 'spring', 15),
  authoredIdentity('Fatou Diallo', 'she-her', 'adult', 'summer', 23),
  authoredIdentity('Awa Diallo', 'they-them', 'older-adult', 'fall', 3),
  // Household 042
  authoredIdentity('Klara Weiss', 'she-her', 'adult', 'summer', 16),
  authoredIdentity('Jonas Weiss', 'he-him', 'young-adult', 'fall', 24),
  authoredIdentity('Heidi Weiss', 'she-her', 'elder', 'winter', 4),
  // Household 043
  authoredIdentity('Paloma Ortega', 'she-her', 'young-adult', 'fall', 17),
  authoredIdentity('Rafael Ortega', 'he-him', 'adult', 'winter', 25),
  authoredIdentity('Luz Ortega', 'she-her', 'older-adult', 'spring', 5),
  // Household 044
  authoredIdentity('Mariam Hussein', 'she-her', 'adult', 'winter', 18),
  authoredIdentity('Karim Hussein', 'he-him', 'young-adult', 'spring', 26),
  authoredIdentity('Hadi Hussein', 'they-them', 'elder', 'summer', 6),
  // Household 045
  authoredIdentity('Anais Moreau', 'they-them', 'young-adult', 'spring', 19),
  authoredIdentity('Etienne Moreau', 'he-him', 'adult', 'summer', 27),
  authoredIdentity('Colette Moreau', 'she-her', 'older-adult', 'fall', 7),
  // Household 046
  authoredIdentity('Nao Sato', 'she-her', 'adult', 'summer', 20),
  authoredIdentity('Kaito Sato', 'he-him', 'young-adult', 'fall', 28),
  authoredIdentity('Reiko Sato', 'she-her', 'elder', 'winter', 8),
  // Household 047
  authoredIdentity('Morgan Robinson', 'they-them', 'young-adult', 'fall', 21),
  authoredIdentity('Tessa Robinson', 'she-her', 'adult', 'winter', 1),
  authoredIdentity('Graham Robinson', 'he-him', 'older-adult', 'spring', 9),
  // Household 048
  authoredIdentity('Sofie Jansen', 'she-her', 'adult', 'winter', 22),
  authoredIdentity('Daan Jansen', 'he-him', 'young-adult', 'spring', 2),
  authoredIdentity('Willem Jansen', 'he-him', 'elder', 'summer', 10),
  // Household 049
  authoredIdentity('Marisol Flores', 'she-her', 'young-adult', 'spring', 23),
  authoredIdentity('Tomas Flores', 'he-him', 'adult', 'summer', 3),
  authoredIdentity('Estela Flores', 'she-her', 'older-adult', 'fall', 11),
  // Household 050
  authoredIdentity('Kunle Adebayo', 'he-him', 'adult', 'summer', 24),
  authoredIdentity('Yemi Adebayo', 'they-them', 'young-adult', 'fall', 4),
  authoredIdentity('Ronke Adebayo', 'she-her', 'elder', 'winter', 12),
  // Household 051
  authoredIdentity('Rowan Clarke', 'they-them', 'young-adult', 'fall', 25),
  authoredIdentity('Nora Clarke', 'she-her', 'adult', 'winter', 5),
  authoredIdentity('Hugh Clarke', 'he-him', 'older-adult', 'spring', 13),
  // Household 052
  authoredIdentity('Elodie Bouchard', 'she-her', 'adult', 'winter', 26),
  authoredIdentity('Luc Bouchard', 'he-him', 'young-adult', 'spring', 6),
  authoredIdentity('Manon Bouchard', 'she-her', 'elder', 'summer', 14),
  // Household 053
  authoredIdentity('Kavya Chandra', 'she-her', 'young-adult', 'spring', 27),
  authoredIdentity('Amit Chandra', 'he-him', 'adult', 'summer', 7),
  authoredIdentity('Indu Chandra', 'they-them', 'older-adult', 'fall', 15),
  // Household 054
  authoredIdentity('Solveig Eriksen', 'she-her', 'adult', 'summer', 28),
  authoredIdentity('Leif Eriksen', 'he-him', 'young-adult', 'fall', 8),
  authoredIdentity('Tor Eriksen', 'he-him', 'elder', 'winter', 16),
  // Household 055
  authoredIdentity('Catalina Marin', 'she-her', 'young-adult', 'fall', 1),
  authoredIdentity('Nico Marin', 'they-them', 'adult', 'winter', 9),
  authoredIdentity('Dolores Marin', 'she-her', 'older-adult', 'spring', 17),
  // Household 056
  authoredIdentity('Rana Saleh', 'she-her', 'adult', 'winter', 2),
  authoredIdentity('Zain Saleh', 'he-him', 'young-adult', 'spring', 10),
  authoredIdentity('Amal Saleh', 'they-them', 'elder', 'summer', 18),
  // Household 057
  authoredIdentity('Quinn Thompson', 'they-them', 'young-adult', 'spring', 3),
  authoredIdentity('Eliza Thompson', 'she-her', 'adult', 'summer', 11),
  authoredIdentity('Arthur Thompson', 'he-him', 'older-adult', 'fall', 19),
  // Household 058
  authoredIdentity('Simran Kaur', 'she-her', 'adult', 'summer', 4),
  authoredIdentity('Jas Kaur', 'they-them', 'young-adult', 'fall', 12),
  authoredIdentity('Harleen Kaur', 'she-her', 'elder', 'winter', 20),
  // Household 059
  authoredIdentity('Mika Takahashi', 'they-them', 'young-adult', 'fall', 5),
  authoredIdentity('Akira Takahashi', 'he-him', 'adult', 'winter', 13),
  authoredIdentity('Keiko Takahashi', 'she-her', 'older-adult', 'spring', 21),
  // Household 060
  authoredIdentity('Poppy Reed', 'she-her', 'adult', 'winter', 6),
  authoredIdentity('Silas Reed', 'he-him', 'young-adult', 'spring', 14),
  authoredIdentity('Edith Reed', 'she-her', 'elder', 'summer', 22),
  // Household 061
  authoredIdentity('Lwazi Mbeki', 'he-him', 'young-adult', 'spring', 7),
  authoredIdentity('Thandi Mbeki', 'she-her', 'adult', 'summer', 15),
  authoredIdentity('Nandi Mbeki', 'they-them', 'older-adult', 'fall', 23),
  // Household 062
  authoredIdentity('Celine Lambert', 'she-her', 'adult', 'summer', 8),
  authoredIdentity('Bastien Lambert', 'he-him', 'young-adult', 'fall', 16),
  authoredIdentity('Marcel Lambert', 'he-him', 'elder', 'winter', 24),
  // Household 063
  authoredIdentity('Anjali Perera', 'she-her', 'young-adult', 'fall', 9),
  authoredIdentity('Nimal Perera', 'he-him', 'adult', 'winter', 17),
  authoredIdentity('Soma Perera', 'she-her', 'older-adult', 'spring', 25),
  // Household 064
  authoredIdentity('Liv Holm', 'they-them', 'adult', 'winter', 10),
  authoredIdentity('Mads Holm', 'he-him', 'young-adult', 'spring', 18),
  authoredIdentity('Inga Holm', 'she-her', 'elder', 'summer', 26),
  // Household 065
  authoredIdentity('Ximena Navarro', 'she-her', 'young-adult', 'spring', 11),
  authoredIdentity('Leo Navarro', 'he-him', 'adult', 'summer', 19),
  authoredIdentity('Consuelo Navarro', 'she-her', 'older-adult', 'fall', 27),
  // Household 066
  authoredIdentity('Femke Bakker', 'she-her', 'adult', 'summer', 12),
  authoredIdentity('Bram Bakker', 'he-him', 'young-adult', 'fall', 20),
  authoredIdentity('Rika Bakker', 'they-them', 'elder', 'winter', 28),
  // Household 067
  authoredIdentity('Meera Joshi', 'she-her', 'young-adult', 'fall', 13),
  authoredIdentity('Kabir Joshi', 'he-him', 'adult', 'winter', 21),
  authoredIdentity('Gita Joshi', 'she-her', 'older-adult', 'spring', 1),
  // Household 068
  authoredIdentity('Leila Farah', 'she-her', 'adult', 'winter', 14),
  authoredIdentity('Idris Farah', 'he-him', 'young-adult', 'spring', 22),
  authoredIdentity('Soraya Farah', 'they-them', 'elder', 'summer', 2),
  // Household 069
  authoredIdentity('Bianca Romano', 'she-her', 'young-adult', 'spring', 15),
  authoredIdentity('Enzo Romano', 'he-him', 'adult', 'summer', 23),
  authoredIdentity('Lucia Romano', 'she-her', 'older-adult', 'fall', 3),
  // Household 070
  authoredIdentity('Nia Yu', 'they-them', 'adult', 'summer', 16),
  authoredIdentity('Wei Yu', 'he-him', 'young-adult', 'fall', 24),
  authoredIdentity('Xiu Yu', 'she-her', 'elder', 'winter', 4),
  // Household 071
  authoredIdentity('Signe Andersen', 'she-her', 'young-adult', 'fall', 17),
  authoredIdentity('Emil Andersen', 'he-him', 'adult', 'winter', 25),
  authoredIdentity('Kari Andersen', 'they-them', 'older-adult', 'spring', 5),
  // Household 072
  authoredIdentity('Celina Baptiste', 'she-her', 'adult', 'winter', 18),
  authoredIdentity('Andre Baptiste', 'he-him', 'young-adult', 'spring', 26),
  authoredIdentity('Yvette Baptiste', 'she-her', 'elder', 'summer', 6),
  // Household 073
  authoredIdentity('Nadia Ismail', 'she-her', 'young-adult', 'spring', 19),
  authoredIdentity('Rami Ismail', 'he-him', 'adult', 'summer', 27),
  authoredIdentity('Hanan Ismail', 'they-them', 'older-adult', 'fall', 7),
  // Household 074
  authoredIdentity('Valeria Mendoza', 'she-her', 'adult', 'summer', 20),
  authoredIdentity('Gael Mendoza', 'they-them', 'young-adult', 'fall', 28),
  authoredIdentity('Ramon Mendoza', 'he-him', 'elder', 'winter', 8),
  // Household 075
  authoredIdentity('Yuna Choi', 'she-her', 'young-adult', 'fall', 21),
  authoredIdentity('Seojun Choi', 'he-him', 'adult', 'winter', 1),
  authoredIdentity('Myeong Choi', 'they-them', 'older-adult', 'spring', 9),
  // Household 076
  authoredIdentity('Lena Wagner', 'she-her', 'adult', 'winter', 22),
  authoredIdentity('Felix Wagner', 'he-him', 'young-adult', 'spring', 2),
  authoredIdentity('Ursula Wagner', 'she-her', 'elder', 'summer', 10),
  // Household 077
  authoredIdentity('Samira Suleiman', 'she-her', 'young-adult', 'spring', 23),
  authoredIdentity('Adil Suleiman', 'he-him', 'adult', 'summer', 3),
  authoredIdentity('Maryam Suleiman', 'they-them', 'older-adult', 'fall', 11),
  // Household 078
  authoredIdentity('Alba Vega', 'she-her', 'adult', 'summer', 24),
  authoredIdentity('Hugo Vega', 'he-him', 'young-adult', 'fall', 4),
  authoredIdentity('Inez Vega', 'she-her', 'elder', 'winter', 12),
  // Household 079
  authoredIdentity('Wren Hart', 'they-them', 'young-adult', 'fall', 25),
  authoredIdentity('Daisy Hart', 'she-her', 'adult', 'winter', 5),
  authoredIdentity('Walter Hart', 'he-him', 'older-adult', 'spring', 13),
  // Household 080
  authoredIdentity('Lalita Nair', 'she-her', 'adult', 'winter', 26),
  authoredIdentity('Kiran Nair', 'they-them', 'young-adult', 'spring', 6),
  authoredIdentity('Mohan Nair', 'he-him', 'elder', 'summer', 14),
]

const padHouseholdNumber = (value: number): string => String(value).padStart(3, '0')

const slugifyName = (displayName: string): string =>
  displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const stableHash = (value: string): number => {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}

const TRAIT_SETS = [
  ['patient', 'observant', 'neighborly'],
  ['cheerful', 'resourceful', 'curious'],
  ['gentle', 'dependable', 'bookish'],
  ['bold', 'generous', 'practical'],
  ['calm', 'creative', 'punctual'],
  ['playful', 'thoughtful', 'tidy'],
  ['earnest', 'outdoorsy', 'sociable'],
  ['inventive', 'kind', 'methodical'],
  ['witty', 'loyal', 'adventurous'],
  ['soft-spoken', 'crafty', 'helpful'],
  ['spirited', 'careful', 'welcoming'],
  ['reflective', 'warm', 'organized'],
] as const

const PREFERENCE_SETS = [
  {
    likes: ['gift:wildflowers', 'gift:herbal-tea', 'activity:garden-walks'],
    dislikes: ['gift:burnt-food', 'weather:storm'],
  },
  {
    likes: ['gift:berry-jam', 'gift:linen', 'activity:picnics'],
    dislikes: ['gift:rusty-parts', 'activity:late-queues'],
  },
  {
    likes: ['gift:river-stone', 'gift:mint-cocoa', 'activity:fishing'],
    dislikes: ['gift:spoiled-produce', 'weather:muggy'],
  },
  {
    likes: ['gift:wood-carving', 'gift:apple-tart', 'activity:birdwatching'],
    dislikes: ['gift:plastic-trinket', 'activity:rushing'],
  },
  {
    likes: ['gift:wool-scarf', 'gift:roasted-nuts', 'activity:stargazing'],
    dislikes: ['gift:damp-paper', 'weather:high-wind'],
  },
  {
    likes: ['gift:pressed-leaf', 'gift:fresh-bread', 'activity:storytelling'],
    dislikes: ['gift:loud-gadget', 'activity:clutter'],
  },
  {
    likes: ['gift:ceramic-mug', 'gift:peach-preserves', 'activity:market-days'],
    dislikes: ['gift:bitter-tonic', 'activity:long-meetings'],
  },
  {
    likes: ['gift:honey-candy', 'gift:seed-packet', 'activity:trail-hikes'],
    dislikes: ['gift:broken-tool', 'weather:freezing-rain'],
  },
  {
    likes: ['gift:painted-card', 'gift:spiced-cider', 'activity:music-nights'],
    dislikes: ['gift:stale-cracker', 'activity:gossip'],
  },
  {
    likes: ['gift:lavender-soap', 'gift:pear-cake', 'activity:craft-circles'],
    dislikes: ['gift:greasy-rag', 'activity:needless-waste'],
  },
  {
    likes: ['gift:polished-shell', 'gift:oat-cookie', 'activity:beach-walks'],
    dislikes: ['gift:sharp-scrap', 'weather:dusty'],
  },
  {
    likes: ['gift:handwritten-note', 'gift:pumpkin-soup', 'activity:quiet-reading'],
    dislikes: ['gift:cracked-glass', 'activity:interruptions'],
  },
] as const

interface EmploymentProfile {
  readonly roleId: string
  readonly stationRoleId: string
  readonly structureKind: StructureKind
  readonly skillId: string
}

const EMPLOYMENT_PROFILES = [
  {
    roleId: 'shv:employment-role:farmer',
    stationRoleId: 'shv:station-role:agriculture',
    structureKind: 'building',
    skillId: 'skill:agriculture',
  },
  {
    roleId: 'shv:employment-role:animal-caretaker',
    stationRoleId: 'shv:station-role:animal-care',
    structureKind: 'building',
    skillId: 'skill:animal-care',
  },
  {
    roleId: 'shv:employment-role:production-operator',
    stationRoleId: 'shv:station-role:production',
    structureKind: 'factory',
    skillId: 'skill:production',
  },
  {
    roleId: 'shv:employment-role:quality-inspector',
    stationRoleId: 'shv:station-role:quality-control',
    structureKind: 'factory',
    skillId: 'skill:quality-control',
  },
  {
    roleId: 'shv:employment-role:service-host',
    stationRoleId: 'shv:station-role:customer-service',
    structureKind: 'building',
    skillId: 'skill:customer-service',
  },
  {
    roleId: 'shv:employment-role:cook',
    stationRoleId: 'shv:station-role:cooking',
    structureKind: 'building',
    skillId: 'skill:cooking',
  },
  {
    roleId: 'shv:employment-role:researcher',
    stationRoleId: 'shv:station-role:research',
    structureKind: 'factory',
    skillId: 'skill:research',
  },
  {
    roleId: 'shv:employment-role:custodian',
    stationRoleId: 'shv:station-role:cleaning',
    structureKind: 'building',
    skillId: 'skill:cleaning',
  },
] as const satisfies readonly EmploymentProfile[]

const SKILL_LEVELS = [1, 2, 3, 4, 5] as const

const makeEmploymentAssignment = (npcIndex: number): EmploymentAssignment => {
  const profileIndex = npcIndex % EMPLOYMENT_PROFILES.length
  const profile = EMPLOYMENT_PROFILES[profileIndex]
  const roleCohort = Math.floor(npcIndex / EMPLOYMENT_PROFILES.length)
  const sharedSiteCohort = Math.floor(roleCohort / 2)
  const siteSeed = sharedSiteCohort * EMPLOYMENT_PROFILES.length + profileIndex
  const structureKind: StructureKind =
    profile.roleId === 'shv:employment-role:custodian'
      ? sharedSiteCohort % 2 === 0
        ? 'building'
        : 'factory'
      : profile.structureKind
  const definitionNumber =
    structureKind === 'building'
      ? ((siteSeed * 37 + 80) % 300) + 1
      : ((siteSeed * 53 + 16) % 400) + 1

  return {
    roleId: profile.roleId,
    structureDefinitionId: structureDefinitionId(structureKind, definitionNumber),
    stationRoleId: profile.stationRoleId,
    structureInstanceId: null,
  }
}

const makeSkills = (npcIndex: number): NPCDef['skills'] => {
  const profile = EMPLOYMENT_PROFILES[npcIndex % EMPLOYMENT_PROFILES.length]
  return [
    { id: profile.skillId, level: SKILL_LEVELS[npcIndex % SKILL_LEVELS.length] },
    { id: 'skill:community', level: SKILL_LEVELS[(npcIndex + 2) % SKILL_LEVELS.length] },
    { id: 'skill:household', level: SKILL_LEVELS[(npcIndex + 4) % SKILL_LEVELS.length] },
  ]
}

const makeSchedule = (
  npcId: string,
  householdId: string,
  homeStructureDefinitionId: string,
  employment: EmploymentAssignment,
): SchedulePlan => {
  const home: ScheduleDestination = { kind: 'home', householdId }
  const work: ScheduleDestination = {
    kind: 'work',
    structureDefinitionId: employment.structureDefinitionId,
    stationRoleId: employment.stationRoleId,
  }
  const homeToilet: ScheduleDestination = {
    kind: 'fixture',
    fixture: 'toilet',
    structureDefinitionId: homeStructureDefinitionId,
  }
  const homeSink: ScheduleDestination = {
    kind: 'fixture',
    fixture: 'sink',
    structureDefinitionId: homeStructureDefinitionId,
  }
  const homeShower: ScheduleDestination = {
    kind: 'fixture',
    fixture: 'shower',
    structureDefinitionId: homeStructureDefinitionId,
  }
  const workToilet: ScheduleDestination = {
    kind: 'fixture',
    fixture: 'toilet',
    structureDefinitionId: employment.structureDefinitionId,
  }
  const workSink: ScheduleDestination = {
    kind: 'fixture',
    fixture: 'sink',
    structureDefinitionId: employment.structureDefinitionId,
  }
  const community = (locationId: string): ScheduleDestination => ({
    kind: 'community',
    locationId,
  })
  const block = (
    lane: 'weekday' | 'weekend' | 'seasonal' | 'event',
    suffix: string,
    startMinute: number,
    endMinute: number,
    activity: ScheduleActivity,
    destination: ScheduleDestination,
    condition?: ScheduleCondition,
  ): ScheduleBlock => ({
    id: `${npcId}:schedule:${lane}:${suffix}`,
    startMinute,
    endMinute,
    activity,
    destination,
    condition,
  })

  return {
    weekday: [
      block('weekday', 'sleep-before-dawn', 0, 360, 'sleep', home),
      block('weekday', 'morning-shower', 360, 390, 'shower', homeShower),
      block('weekday', 'breakfast', 390, 420, 'breakfast', home),
      block('weekday', 'restroom-toilet-home', 420, 430, 'toilet', homeToilet),
      block('weekday', 'restroom-wash-home', 430, 440, 'wash-hands', homeSink),
      block('weekday', 'commute-to-work', 440, 480, 'commute', work),
      block('weekday', 'work-morning', 480, 720, 'work', work),
      block('weekday', 'midday-meal', 720, 750, 'meal', work),
      block('weekday', 'restroom-toilet-work', 750, 760, 'toilet', workToilet),
      block('weekday', 'restroom-wash-work', 760, 770, 'wash-hands', workSink),
      block('weekday', 'work-afternoon', 770, 1_020, 'work', work),
      block('weekday', 'commute-home', 1_020, 1_060, 'commute', home),
      block('weekday', 'community-social', 1_060, 1_140, 'socialize', community('location:town-square')),
      block('weekday', 'evening-meal', 1_140, 1_170, 'meal', home),
      block('weekday', 'evening-shower', 1_170, 1_190, 'shower', homeShower),
      block('weekday', 'wind-down', 1_190, 1_220, 'rest', home),
      block('weekday', 'sleep-night', 1_220, 1_440, 'sleep', home),
    ],
    weekend: [
      block('weekend', 'sleep-before-dawn', 0, 420, 'sleep', home),
      block('weekend', 'morning-shower', 420, 450, 'shower', homeShower),
      block('weekend', 'breakfast', 450, 480, 'breakfast', home),
      block('weekend', 'restroom-toilet-home', 480, 490, 'toilet', homeToilet),
      block('weekend', 'restroom-wash-home', 490, 500, 'wash-hands', homeSink),
      block('weekend', 'home-leisure', 500, 620, 'leisure', home),
      block('weekend', 'market-social', 620, 720, 'socialize', community('location:market-square')),
      block('weekend', 'midday-meal', 720, 750, 'meal', community('location:market-square')),
      block('weekend', 'restroom-toilet-town', 750, 760, 'toilet', homeToilet),
      block('weekend', 'restroom-wash-town', 760, 770, 'wash-hands', homeSink),
      block('weekend', 'community-errands', 770, 900, 'errand', community('location:market-district')),
      block('weekend', 'afternoon-leisure', 900, 1_020, 'leisure', community('location:riverside-park')),
      block('weekend', 'evening-meal', 1_020, 1_050, 'meal', home),
      block('weekend', 'neighbor-social', 1_050, 1_140, 'socialize', community('location:town-square')),
      block('weekend', 'evening-shower', 1_140, 1_160, 'shower', homeShower),
      block('weekend', 'wind-down', 1_160, 1_200, 'rest', home),
      block('weekend', 'sleep-night', 1_200, 1_440, 'sleep', home),
    ],
    seasonal: [
      block(
        'seasonal',
        'spring-community-garden',
        1_060,
        1_140,
        'errand',
        community('location:community-garden'),
        { seasons: ['spring'] },
      ),
      block(
        'seasonal',
        'summer-riverside-social',
        1_060,
        1_140,
        'socialize',
        community('location:riverside-park'),
        { seasons: ['summer'] },
      ),
      block(
        'seasonal',
        'fall-harvest-leisure',
        1_060,
        1_140,
        'leisure',
        community('location:harvest-green'),
        { seasons: ['fall'] },
      ),
      block('seasonal', 'winter-home-rest', 1_060, 1_140, 'rest', home, { seasons: ['winter'] }),
    ],
    event: [
      block(
        'event',
        'community-celebration',
        1_060,
        1_140,
        'socialize',
        community('location:festival-green'),
        { eventKinds: ['community-celebration'] },
      ),
      block('event', 'conflict-recovery', 1_060, 1_140, 'rest', home, {
        eventKinds: ['argument', 'reconciliation'],
      }),
      block(
        'event',
        'life-change-errand',
        1_060,
        1_140,
        'errand',
        community('location:civic-hall'),
        {
          eventKinds: [
            'temporary-move',
            'return-home',
            'job-change',
            'promotion',
            'resignation',
            'business-break',
            'business-reopen',
            'routine-change',
          ],
        },
      ),
    ],
  }
}

const NPC_IDS: readonly string[] = AUTHORED_NPC_IDENTITIES.map(
  (identity) => `npc:${slugifyName(identity.displayName)}`,
)

export interface HouseholdBlueprint {
  readonly id: string
  readonly memberIds: readonly [string, string, string]
  readonly homeStructureDefinitionId: string
}

export const HOUSEHOLD_BLUEPRINTS: readonly HouseholdBlueprint[] = Array.from(
  { length: 80 },
  (_, householdIndex): HouseholdBlueprint => {
    const householdNumber = householdIndex + 1
    const firstMemberIndex = householdIndex * 3
    return {
      id: `household:${padHouseholdNumber(householdNumber)}`,
      memberIds: [
        NPC_IDS[firstMemberIndex],
        NPC_IDS[firstMemberIndex + 1],
        NPC_IDS[firstMemberIndex + 2],
      ],
      homeStructureDefinitionId: structureDefinitionId('building', householdNumber),
    }
  },
)

export const NPC_DEFINITIONS: readonly NPCDef[] = AUTHORED_NPC_IDENTITIES.map(
  (identity, npcIndex): NPCDef => {
    const id = NPC_IDS[npcIndex]
    const slug = id.slice('npc:'.length)
    const household = HOUSEHOLD_BLUEPRINTS[Math.floor(npcIndex / 3)]
    const employment = makeEmploymentAssignment(npcIndex)
    const preferenceSet = PREFERENCE_SETS[npcIndex % PREFERENCE_SETS.length]

    return {
      id,
      identity,
      appearanceSeed: stableHash(id),
      traits: TRAIT_SETS[npcIndex % TRAIT_SETS.length],
      preferences: {
        likes: preferenceSet.likes,
        dislikes: preferenceSet.dislikes,
        favoriteGiftTag: preferenceSet.likes[0],
      },
      skills: makeSkills(npcIndex),
      householdId: household.id,
      homeStructureDefinitionId: household.homeStructureDefinitionId,
      initialEmployment: employment,
      schedule: makeSchedule(id, household.id, household.homeStructureDefinitionId, employment),
      dialogueProfileId: `dialogue-profile:${slug}`,
      requestIds: [
        `request:${slug}:neighbor-help`,
        `request:${slug}:gift-search`,
        `request:${slug}:community-errand`,
      ],
      romanceable: identity.lifeStage === 'young-adult' || identity.lifeStage === 'adult',
    }
  },
)

interface RelationshipMetrics {
  readonly affinity: number
  readonly trust: number
  readonly romance: number
  readonly rivalry: number
}

const buildInitialRelationshipEdges = (): RelationshipEdge[] => {
  const edges = new Map<string, RelationshipEdge>()
  const addEdge = (
    first: string,
    second: string,
    kinds: RelationshipEdge['kinds'],
    metrics: RelationshipMetrics,
  ): void => {
    const [a, b] = first < second ? [first, second] : [second, first]
    const key = `${a}|${b}`
    if (a === b || edges.has(key)) {
      throw new Error(`Duplicate or self-referential authored relationship pair: ${key}`)
    }
    edges.set(key, {
      a,
      b,
      kinds: [...kinds],
      affinity: metrics.affinity,
      trust: metrics.trust,
      romance: metrics.romance,
      rivalry: metrics.rivalry,
      memories: [],
    })
  }

  for (const household of HOUSEHOLD_BLUEPRINTS) {
    const [first, second, third] = household.memberIds
    const familyMetrics = { affinity: 70, trust: 80, romance: 0, rivalry: 0 }
    addEdge(first, second, ['family'], familyMetrics)
    addEdge(first, third, ['family'], familyMetrics)
    addEdge(second, third, ['family'], familyMetrics)
  }

  for (let householdIndex = 0; householdIndex < HOUSEHOLD_BLUEPRINTS.length; householdIndex += 1) {
    const nextHouseholdIndex = (householdIndex + 1) % HOUSEHOLD_BLUEPRINTS.length
    addEdge(
      HOUSEHOLD_BLUEPRINTS[householdIndex].memberIds[0],
      HOUSEHOLD_BLUEPRINTS[nextHouseholdIndex].memberIds[0],
      ['friend'],
      { affinity: 45, trust: 40, romance: 0, rivalry: 0 },
    )
  }

  for (let roleIndex = 0; roleIndex < EMPLOYMENT_PROFILES.length; roleIndex += 1) {
    for (let cohort = 0; cohort < 30; cohort += 2) {
      const firstNpcIndex = roleIndex + cohort * EMPLOYMENT_PROFILES.length
      const secondNpcIndex = firstNpcIndex + EMPLOYMENT_PROFILES.length
      addEdge(NPC_IDS[firstNpcIndex], NPC_IDS[secondNpcIndex], ['coworker'], {
        affinity: 25,
        trust: 30,
        romance: 0,
        rivalry: 0,
      })
    }
  }

  for (let householdPair = 0; householdPair < 40; householdPair += 1) {
    const firstHouseholdIndex = householdPair * 2
    const secondHouseholdIndex = firstHouseholdIndex + 1
    addEdge(
      HOUSEHOLD_BLUEPRINTS[firstHouseholdIndex].memberIds[2],
      HOUSEHOLD_BLUEPRINTS[secondHouseholdIndex].memberIds[2],
      ['rival'],
      { affinity: -15, trust: 5, romance: 0, rivalry: 45 },
    )
    addEdge(
      HOUSEHOLD_BLUEPRINTS[firstHouseholdIndex].memberIds[1],
      HOUSEHOLD_BLUEPRINTS[secondHouseholdIndex].memberIds[1],
      ['romance'],
      { affinity: 60, trust: 65, romance: 55, rivalry: 0 },
    )
  }

  return [...edges.values()].sort((left, right) => {
    const byFirst = left.a.localeCompare(right.a)
    return byFirst === 0 ? left.b.localeCompare(right.b) : byFirst
  })
}

export const INITIAL_RELATIONSHIP_EDGES: readonly RelationshipEdge[] =
  buildInitialRelationshipEdges()

const assertAuthoredRosterInvariants = (): void => {
  if (AUTHORED_NPC_IDENTITIES.length !== 240 || NPC_DEFINITIONS.length !== 240) {
    throw new Error('The authored valley roster must contain exactly 240 NPCs')
  }
  if (HOUSEHOLD_BLUEPRINTS.length !== 80) {
    throw new Error('The authored valley roster must contain exactly 80 households')
  }

  const names = new Set(AUTHORED_NPC_IDENTITIES.map((identity) => identity.displayName))
  const ids = new Set(NPC_IDS)
  const householdMembers = HOUSEHOLD_BLUEPRINTS.flatMap((household) => household.memberIds)
  if (names.size !== 240 || ids.size !== 240 || new Set(householdMembers).size !== 240) {
    throw new Error('Authored NPC names, IDs, and household membership must be unique')
  }
  if (householdMembers.some((npcId, index) => npcId !== NPC_IDS[index])) {
    throw new Error('Every authored NPC must appear exactly once in consecutive household order')
  }
}

assertAuthoredRosterInvariants()
