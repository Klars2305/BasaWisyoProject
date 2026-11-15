/* ==========================================================================
   BasaWisyo Centralized Rewards Engine
   - 10 XP for story completion + 5 XP per correct answer + 10 XP first-time bonus.
   - Retries only award XP for personal best improvements (5 XP per improved score).
   - Idempotent: finalized once per unique attempt; replaying animations never grants double XP.
   - Distinct from Phil-IRI Reading Proficiency (XP reflects engagement, not reading tier).
   ========================================================================== */

function computeAttemptRewards({ passageId, score, total, isFirstCompletion, previousBest, isEligible = true }) {
  if (!isEligible) {
    return {
      xpGained: 0,
      isFirstCompletion: Boolean(isFirstCompletion),
      improvement: 0,
      previousBest: previousBest || 0,
      breakdown: { completion: 0, accuracy: 0, improvement: 0 }
    };
  }

  let xpGained = 0;
  let improvement = 0;

  if (isFirstCompletion) {
    // 10 XP base completion + (5 XP * score)
    const completionBase = 10;
    const accuracyXP = Math.max(0, score) * 5;
    xpGained = completionBase + accuracyXP;

    return {
      xpGained,
      isFirstCompletion: true,
      improvement: 0,
      previousBest: 0,
      breakdown: {
        completion: completionBase,
        accuracy: accuracyXP,
        improvement: 0
      }
    };
  }

  // Retry attempt: only reward improvement over previous personal best
  improvement = Math.max(0, score - (previousBest || 0));
  xpGained = improvement * 5;

  return {
    xpGained,
    isFirstCompletion: false,
    improvement,
    previousBest: previousBest || 0,
    breakdown: {
      completion: 0,
      accuracy: 0,
      improvement: xpGained
    }
  };
}
