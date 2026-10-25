import { describe, expect, it } from 'vitest'
import { createValidPlan } from '../test/fixtures'
import { resolutionKey } from './dateChangeResolver'
import { addRouteStop, deleteRouteStop, editRouteStops, reorderRouteStops } from './routeMutations'

function sequentialIds(prefix = 'generated') {
  let next = 0
  return () => `${prefix}-${++next}`
}

describe('route mutations', () => {
  it('reorders stops, rebuilds route links, resolves displaced records, and updates metadata', () => {
    const plan = createValidPlan()
    const updatedAt = '2026-10-25T09:30:00Z'

    const draft = reorderRouteStops(
      plan,
      ['stop-agra', 'stop-delhi'],
      updatedAt,
      sequentialIds(),
    )

    expect(draft.routeStops).toEqual([
      { id: 'stop-agra', city: 'Agra', startDate: '2026-11-01', endDate: '2026-11-01', order: 0 },
      { id: 'stop-delhi', city: 'Delhi', startDate: '2026-11-02', endDate: '2026-11-03', order: 1 },
    ])
    expect(draft.requiredDayChanges.map((change) => [change.recordType, change.recordId])).toEqual([
      ['activity', 'activity-1'],
      ['foodEntry', 'food-1'],
      ['arrivalDepartureEvent', 'event-1'],
    ])

    const selections = Object.fromEntries(draft.requiredDayChanges.map((change) => [
      resolutionKey(change),
      change.candidateDays[0]!.id,
    ]))
    const result = draft.finalize(selections)

    expect(result.metadata.updatedAt).toBe(updatedAt)
    expect(result.routeStops).toEqual(draft.routeStops)
    expect(result.travelLegs).toEqual([{
      id: 'generated-1',
      fromStopId: 'stop-agra',
      toStopId: 'stop-delhi',
      order: 0,
    }])
    expect(result.activities[0]?.dayId).toBe('day-2')
    expect(result.foodEntries[0]?.dayId).toBe('day:stop-agra:2026-11-01')
    expect(result.arrivalDepartureEvents[0]).toMatchObject({
      dayId: 'day:stop-agra:2026-11-01',
      dateTime: '2026-11-01T09:15:00+05:30',
    })
  })

  it('deletes all records owned by a removed stop and updates metadata', () => {
    const plan = createValidPlan()
    const updatedAt = '2026-10-25T10:00:00Z'

    const result = deleteRouteStop(
      plan,
      'stop-agra',
      updatedAt,
      sequentialIds(),
    ).finalize()

    expect(result.metadata.updatedAt).toBe(updatedAt)
    expect(result.routeStops).toEqual([{
      id: 'stop-delhi',
      city: 'Delhi',
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      order: 0,
    }])
    expect(result.travelLegs).toEqual([])
    expect(result.activities.map((activity) => activity.id)).toEqual(['activity-1'])
    expect(result.foodEntries).toEqual([])
    expect(result.arrivalDepartureEvents).toEqual([])
  })

  it('adds a new destination, reallocates trip dates across every stop, and rebuilds travel legs', () => {
    const plan = createValidPlan()
    const widened = {
      ...plan,
      metadata: { ...plan.metadata, endDate: '2026-11-04' },
      routeStops: [
        { id: 'stop-delhi', city: 'Delhi', startDate: '2026-11-01', endDate: '2026-11-02', order: 0 },
        { id: 'stop-agra', city: 'Agra', startDate: '2026-11-03', endDate: '2026-11-04', order: 1 },
      ],
      days: [
        { id: 'day-1', routeStopId: 'stop-delhi', date: '2026-11-01', dayNumber: 1, isLeisure: false },
        { id: 'day-2', routeStopId: 'stop-delhi', date: '2026-11-02', dayNumber: 2, isLeisure: true },
        { id: 'day-3', routeStopId: 'stop-agra', date: '2026-11-03', dayNumber: 3, isLeisure: false },
        { id: 'day-4', routeStopId: 'stop-agra', date: '2026-11-04', dayNumber: 4, isLeisure: true },
      ],
      activities: [],
      foodEntries: [],
      arrivalDepartureEvents: [],
    }
    const updatedAt = '2026-10-25T11:00:00Z'

    const draft = addRouteStop(widened, { id: 'stop-jaipur', city: 'Jaipur' }, updatedAt, sequentialIds())

    expect(draft.routeStops).toEqual([
      { id: 'stop-delhi', city: 'Delhi', startDate: '2026-11-01', endDate: '2026-11-02', order: 0 },
      { id: 'stop-agra', city: 'Agra', startDate: '2026-11-03', endDate: '2026-11-03', order: 1 },
      { id: 'stop-jaipur', city: 'Jaipur', startDate: '2026-11-04', endDate: '2026-11-04', order: 2 },
    ])
    expect(draft.requiredDayChanges).toEqual([])

    const result = draft.finalize()
    expect(result.metadata.updatedAt).toBe(updatedAt)
    expect(result.travelLegs).toEqual([
      { id: 'leg-1', fromStopId: 'stop-delhi', toStopId: 'stop-agra', order: 0, transportMode: 'train', mapsUrl: 'https://maps.google.com/?q=Agra' },
      { id: 'generated-1', fromStopId: 'stop-agra', toStopId: 'stop-jaipur', order: 1 },
    ])
    expect(result.days.map(({ routeStopId, date, dayNumber }) => ({ routeStopId, date, dayNumber }))).toEqual([
      { routeStopId: 'stop-delhi', date: '2026-11-01', dayNumber: 1 },
      { routeStopId: 'stop-delhi', date: '2026-11-02', dayNumber: 2 },
      { routeStopId: 'stop-agra', date: '2026-11-03', dayNumber: 3 },
      { routeStopId: 'stop-jaipur', date: '2026-11-04', dayNumber: 4 },
    ])
  })

  it('rejects reordering that omits or duplicates a stop instead of silently dropping data', () => {
    const plan = createValidPlan()
    const updatedAt = '2026-10-25T10:30:00Z'

    expect(() => reorderRouteStops(plan, ['stop-delhi'], updatedAt, sequentialIds()))
      .toThrow('Reordered stops must include every route stop exactly once')
    expect(() => reorderRouteStops(plan, ['stop-delhi', 'stop-delhi'], updatedAt, sequentialIds()))
      .toThrow('Reordered stops must include every route stop exactly once')
    expect(() => reorderRouteStops(plan, ['stop-delhi', 'unknown-stop'], updatedAt, sequentialIds()))
      .toThrow('Unknown route stop: unknown-stop')
  })

  it('rejects manual edits that add, remove, or substitute a stop rather than updating one in place', () => {
    const plan = createValidPlan()
    const updatedAt = '2026-10-25T10:45:00Z'

    expect(() => editRouteStops(plan, [plan.routeStops[0]!], updatedAt, sequentialIds()))
      .toThrow('Manual route edits must retain every stop; use add or delete for structural changes')
    expect(() => editRouteStops(
      plan,
      [plan.routeStops[0]!, { ...plan.routeStops[1]!, id: 'stop-unknown' }],
      updatedAt,
      sequentialIds(),
    )).toThrow('Manual route edits must retain every stop; use add or delete for structural changes')
  })

  it('rejects deleting an unknown stop or the last remaining stop', () => {
    const plan = createValidPlan()
    const updatedAt = '2026-10-25T11:15:00Z'

    expect(() => deleteRouteStop(plan, 'unknown-stop', updatedAt, sequentialIds()))
      .toThrow('Route stop does not exist')

    const singleStopPlan = {
      ...plan,
      routeStops: [plan.routeStops[0]!],
    }
    expect(() => deleteRouteStop(singleStopPlan, 'stop-delhi', updatedAt, sequentialIds()))
      .toThrow('A trip must keep at least one route stop')
  })
})
