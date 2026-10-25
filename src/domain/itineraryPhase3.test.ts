import { describe, expect, it } from 'vitest'
import { createValidPlan } from '../test/fixtures'
import type { Activity } from '../types/trip'
import { updateTripDay } from './itineraryMutations'
import { conflictingActivityIds, findTimeConflicts } from './timeConflicts'

function timedActivity(id: string, dayId: string, startTime?: string, endTime?: string, durationMinutes?: number): Activity {
  return {
    id,
    dayId,
    routeStopId: 'stop-delhi',
    title: id,
    slot: 'morning',
    startTime,
    endTime,
    durationMinutes,
    category: 'sightseeing',
    status: 'planned',
    order: 0,
  }
}

describe('updateTripDay', () => {
  it('updates notes and leisure state, trims notes, and leaves other days untouched', () => {
    const plan = createValidPlan()
    const result = updateTripDay(plan, 'day-1', { notes: '  Train tickets booked  ', isLeisure: true }, '2026-10-25T12:00:00Z')

    expect(result.days[0]).toMatchObject({ notes: 'Train tickets booked', isLeisure: true })
    expect(result.days[1]).toEqual(plan.days[1])
    expect(result.metadata.updatedAt).toBe('2026-10-25T12:00:00Z')
    expect(plan.days[0]?.notes).toBeUndefined()
  })

  it('removes blank notes and rejects an unknown day', () => {
    const plan = createValidPlan()
    plan.days[0] = { ...plan.days[0]!, notes: 'Old note' }

    expect(updateTripDay(plan, 'day-1', { notes: '   ', isLeisure: false }, '2026-10-25T12:00:00Z').days[0]?.notes).toBeUndefined()
    expect(() => updateTripDay(plan, 'missing', { notes: 'x', isLeisure: false }, '2026-10-25T12:00:00Z')).toThrow('Itinerary day does not exist')
  })
})

describe('exact-time conflicts', () => {
  it('reports exact overlap duration and both conflicting IDs', () => {
    const activities = [
      timedActivity('museum', 'day-1', '09:00', '11:30'),
      timedActivity('tour', 'day-1', '10:45', '12:00'),
    ]

    expect(findTimeConflicts(activities)).toEqual([
      { firstActivityId: 'museum', secondActivityId: 'tour', overlapMinutes: 45 },
    ])
    expect(conflictingActivityIds(activities)).toEqual(new Set(['museum', 'tour']))
  })

  it('does not flag touching boundaries, different days, or activities missing an endpoint', () => {
    const activities = [
      timedActivity('first', 'day-1', '09:00', '10:00'),
      timedActivity('touching', 'day-1', '10:00', '11:00'),
      timedActivity('other-day', 'day-2', '09:30', '10:30'),
      timedActivity('start-only', 'day-1', '09:30'),
      timedActivity('end-only', 'day-1', undefined, '10:30'),
    ]

    expect(findTimeConflicts(activities)).toEqual([])
    expect(conflictingActivityIds(activities).size).toBe(0)
  })

  it('finds contained and cross-slot overlaps because clock time, not slot label, is authoritative', () => {
    const outer = timedActivity('outer', 'day-1', '08:00', '12:00')
    const inner = { ...timedActivity('inner', 'day-1', '09:15', '09:45'), slot: 'evening' as const }

    expect(findTimeConflicts([outer, inner])).toEqual([
      { firstActivityId: 'outer', secondActivityId: 'inner', overlapMinutes: 30 },
    ])
  })

  it('derives an end time from duration when no explicit end time is set (QA repro: 10:00 and 10:30 same-day overlap)', () => {
    const activities = [
      timedActivity('first', 'day-1', '10:00', undefined, 60),
      timedActivity('second', 'day-1', '10:30', undefined, 60),
    ]

    expect(findTimeConflicts(activities)).toEqual([
      { firstActivityId: 'first', secondActivityId: 'second', overlapMinutes: 30 },
    ])
    expect(conflictingActivityIds(activities)).toEqual(new Set(['first', 'second']))
  })

  it('flags overlaps between an explicit end time and a duration-derived end time', () => {
    const activities = [
      timedActivity('explicit-end', 'day-1', '10:00', '11:00'),
      timedActivity('duration-only', 'day-1', '10:30', undefined, 45),
    ]

    expect(findTimeConflicts(activities)).toEqual([
      { firstActivityId: 'explicit-end', secondActivityId: 'duration-only', overlapMinutes: 30 },
    ])
  })

  it('does not flag a duration-derived end time that only touches, or a start time with neither end time nor duration', () => {
    const activities = [
      timedActivity('first', 'day-1', '10:00', undefined, 30),
      timedActivity('touching', 'day-1', '10:30', undefined, 30),
      timedActivity('no-extent', 'day-1', '10:15'),
    ]

    expect(findTimeConflicts(activities)).toEqual([])
    expect(conflictingActivityIds(activities).size).toBe(0)
  })
})
