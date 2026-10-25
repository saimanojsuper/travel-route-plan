import type { Activity } from '../types/trip'

export interface TimeConflict {
  firstActivityId: string
  secondActivityId: string
  overlapMinutes: number
}

function minutes(time: string): number {
  const [hours, value] = time.split(':').map(Number)
  return hours! * 60 + value!
}

/**
 * Resolves the clock-time minute an activity ends at. An explicit `endTime` is
 * authoritative; otherwise we fall back to `startTime + durationMinutes` so
 * activities scheduled with only a start time and a duration (a very common
 * entry pattern) still participate in overlap detection. With neither an end
 * time nor a duration, the activity's extent is unknown and it is excluded
 * rather than guessed at.
 */
function effectiveEndMinutes(activity: Activity): number | undefined {
  if (activity.endTime) return minutes(activity.endTime)
  if (activity.startTime && activity.durationMinutes) return minutes(activity.startTime) + activity.durationMinutes
  return undefined
}

interface TimedActivity {
  activity: Activity
  startMinutes: number
  endMinutes: number
}

function toTimedActivity(activity: Activity): TimedActivity | null {
  if (!activity.startTime) return null
  const endMinutes = effectiveEndMinutes(activity)
  if (endMinutes === undefined) return null
  return { activity, startMinutes: minutes(activity.startTime), endMinutes }
}

export function findTimeConflicts(activities: readonly Activity[]): TimeConflict[] {
  const timed = activities.map(toTimedActivity).filter((entry): entry is TimedActivity => entry !== null)
  const conflicts: TimeConflict[] = []

  timed.forEach((first, index) => {
    timed.slice(index + 1).forEach((second) => {
      if (first.activity.dayId !== second.activity.dayId) return
      const overlap = Math.min(first.endMinutes, second.endMinutes) - Math.max(first.startMinutes, second.startMinutes)
      if (overlap > 0) {
        conflicts.push({ firstActivityId: first.activity.id, secondActivityId: second.activity.id, overlapMinutes: overlap })
      }
    })
  })

  return conflicts
}

export function conflictingActivityIds(activities: readonly Activity[]): Set<string> {
  return new Set(findTimeConflicts(activities).flatMap((conflict) => [conflict.firstActivityId, conflict.secondActivityId]))
}
