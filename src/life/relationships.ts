import type {
  PlayerRelationshipState,
  RelationshipAction,
  RelationshipConsent,
  RelationshipTransitionResult,
} from './types'

function clonePlayerRelationshipState(
  state: PlayerRelationshipState,
): PlayerRelationshipState {
  return {
    ...state,
    consentHistory: state.consentHistory.map((record) => ({ ...record })),
  }
}

function refusal(
  state: PlayerRelationshipState,
  message: string,
): RelationshipTransitionResult {
  return {
    ok: false,
    message: `Transition refused: ${message}`,
    state: clonePlayerRelationshipState(state),
  }
}

function consentRefusal(
  consent: RelationshipConsent,
  action: RelationshipAction,
): string | null {
  if (!consent.player && !consent.npc) {
    return `mutual consent is required for ${action}; neither participant consented.`
  }
  if (!consent.player) {
    return `player consent is required for ${action}.`
  }
  if (!consent.npc) {
    return `NPC consent is required for ${action}.`
  }
  return null
}

function success(
  state: PlayerRelationshipState,
  action: RelationshipAction,
  day: number,
  message: string,
): RelationshipTransitionResult {
  return {
    ok: true,
    message,
    state: {
      ...state,
      consentHistory: [
        ...state.consentHistory.map((record) => ({ ...record })),
        {
          action,
          day,
          playerConsented: true,
          npcConsented: true,
        },
      ],
    },
  }
}

/**
 * Applies one player/NPC relationship action without mutating the supplied state.
 * Every progression and reversal is explicit and mutually consented. A placed
 * adoption is never cancelled by a partner transition: the family commitment
 * remains while dating, cohabitation, and marriage can change respectfully.
 */
export function transitionPlayerRelationship(
  state: PlayerRelationshipState,
  action: RelationshipAction,
  consent: RelationshipConsent,
  day: number,
): RelationshipTransitionResult {
  if (!Number.isSafeInteger(day) || day < 0) {
    return refusal(state, 'the transition day must be a non-negative safe integer.')
  }

  const missingConsent = consentRefusal(consent, action)
  if (missingConsent) {
    return refusal(state, missingConsent)
  }

  switch (action) {
    case 'meet': {
      if (state.friendship !== 'stranger') {
        return refusal(state, `${state.npcId} has already been introduced.`)
      }
      return success(
        { ...state, friendship: 'acquaintance' },
        action,
        day,
        `${state.npcId} and the player introduced themselves.`,
      )
    }

    case 'befriend': {
      if (state.friendship === 'stranger') {
        return refusal(state, 'an introduction is required before becoming friends.')
      }
      if (state.friendship === 'close-friend') {
        return refusal(state, `${state.npcId} is already a close friend.`)
      }
      const friendship = state.friendship === 'acquaintance' ? 'friend' : 'close-friend'
      return success(
        { ...state, friendship },
        action,
        day,
        `${state.npcId} and the player agreed to become ${friendship === 'friend' ? 'friends' : 'close friends'}.`,
      )
    }

    case 'start-dating': {
      if (state.romance !== 'none') {
        return refusal(state, `dating cannot start while the romance stage is ${state.romance}.`)
      }
      if (state.friendship !== 'friend' && state.friendship !== 'close-friend') {
        return refusal(state, 'friendship is required before dating can begin.')
      }
      return success(
        { ...state, romance: 'dating' },
        action,
        day,
        `${state.npcId} and the player agreed to start dating.`,
      )
    }

    case 'end-dating': {
      if (state.romance !== 'dating') {
        return refusal(state, 'ending dating requires an active dating relationship.')
      }
      return success(
        { ...state, romance: 'none' },
        action,
        day,
        `${state.npcId} and the player ended dating respectfully; friendship and family commitments remain.`,
      )
    }

    case 'become-engaged': {
      if (state.romance !== 'dating') {
        return refusal(state, 'engagement requires an active dating relationship.')
      }
      return success(
        { ...state, romance: 'engaged' },
        action,
        day,
        `${state.npcId} and the player agreed to become engaged.`,
      )
    }

    case 'marry': {
      if (state.romance !== 'engaged') {
        return refusal(state, 'marriage requires an engagement first.')
      }
      return success(
        { ...state, romance: 'married' },
        action,
        day,
        `${state.npcId} and the player agreed to marry.`,
      )
    }

    case 'share-home': {
      if (state.sharedHome) {
        return refusal(state, `${state.npcId} and the player already share a home.`)
      }
      if (state.romance === 'none') {
        return refusal(state, 'a dating, engaged, or married relationship is required to share a home.')
      }
      return success(
        { ...state, sharedHome: true },
        action,
        day,
        `${state.npcId} and the player agreed to share a home.`,
      )
    }

    case 'move-out': {
      if (!state.sharedHome) {
        return refusal(state, `${state.npcId} and the player do not currently share a home.`)
      }
      return success(
        { ...state, sharedHome: false },
        action,
        day,
        `${state.npcId} and the player completed a respectful household move.`,
      )
    }

    case 'consider-adoption': {
      if (state.adoption !== 'none') {
        return refusal(state, `adoption is already at the ${state.adoption} stage.`)
      }
      if (state.romance !== 'married' || !state.sharedHome) {
        return refusal(state, 'considering adoption requires a marriage and a shared home.')
      }
      return success(
        { ...state, adoption: 'considering' },
        action,
        day,
        `${state.npcId} and the player agreed to consider adoption.`,
      )
    }

    case 'approve-adoption': {
      if (state.adoption !== 'considering') {
        return refusal(state, 'adoption approval requires the considering stage.')
      }
      if (state.romance !== 'married' || !state.sharedHome) {
        return refusal(state, 'adoption approval requires a marriage and a shared home.')
      }
      return success(
        { ...state, adoption: 'approved' },
        action,
        day,
        `${state.npcId} and the player approved the adoption plan together.`,
      )
    }

    case 'place-adoption': {
      if (state.adoption !== 'approved') {
        return refusal(state, 'adoption placement requires prior approval.')
      }
      if (state.romance !== 'married' || !state.sharedHome) {
        return refusal(state, 'adoption placement requires a marriage and a shared home.')
      }
      return success(
        { ...state, adoption: 'placed' },
        action,
        day,
        `${state.npcId} and the player welcomed their child into a cared-for family commitment.`,
      )
    }

    case 'cancel-adoption': {
      if (state.adoption === 'placed') {
        return refusal(
          state,
          'a placed adoption cannot be cancelled; the child remains a cared-for family member.',
        )
      }
      if (state.adoption !== 'considering' && state.adoption !== 'approved') {
        return refusal(state, 'there is no pre-placement adoption plan to cancel.')
      }
      return success(
        { ...state, adoption: 'none' },
        action,
        day,
        `${state.npcId} and the player cancelled the pre-placement adoption plan respectfully.`,
      )
    }

    case 'separate': {
      if (state.romance !== 'engaged' && state.romance !== 'married') {
        return refusal(state, 'separation requires an engaged or married relationship.')
      }
      const familyMessage =
        state.adoption === 'placed'
          ? ' Their placed adoption remains a cared-for family commitment.'
          : ''
      return success(
        { ...state, romance: 'none', sharedHome: false },
        action,
        day,
        `${state.npcId} and the player separated respectfully.${familyMessage}`,
      )
    }

    default: {
      const exhaustiveAction: never = action
      return refusal(state, `unsupported relationship action ${String(exhaustiveAction)}.`)
    }
  }
}

export const applyRelationshipTransition = transitionPlayerRelationship
