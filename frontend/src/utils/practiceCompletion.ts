import type { CompletionCriterion, PracticeAttempt, PracticeSession } from "../types";

export type WeeklyTaskCompletion = {
  completionCriteria: CompletionCriterion[];
};

/** Maps session + optional attempt into weeklyTask.completionCriteria shape. */
export function getWeeklyTaskCompletion(
  session: PracticeSession,
  attempt?: PracticeAttempt | null,
): WeeklyTaskCompletion {
  const latestAttempt = attempt ?? session.attempts[session.attempts.length - 1];

  if (latestAttempt?.criterion_results?.length) {
    return {
      completionCriteria: latestAttempt.criterion_results.map((item) => ({
        text: item.criterion,
        passed: item.achieved,
      })),
    };
  }

  return {
    completionCriteria: session.success_criteria.map((text) => ({
      text,
      passed: false,
    })),
  };
}
