import { describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from '../constants/schema'
import { createValidPlan } from '../test/fixtures'
import { tripPlanSchema } from './tripSchema'

describe('tripPlanSchema', () => {
  it('accepts a complete, internally consistent plan', () => {
    expect(tripPlanSchema.safeParse(createValidPlan()).success).toBe(true)
  })

  it('rejects a schema version other than the current supported version', () => {
    const result = tripPlanSchema.safeParse({ ...createValidPlan(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: ['schemaVersion'] }),
      ]))
    }
  })

  it('rejects bad ranges, references, costs, and URL protocols', () => {
    const plan = createValidPlan()
    plan.metadata.endDate = '2026-10-31'
    plan.activities[0]!.dayId = 'missing-day'
    plan.activities[0]!.costInr = -1
    plan.travelLegs[0]!.mapsUrl = 'javascript:alert(1)'

    const result = tripPlanSchema.safeParse(plan)
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'))
      expect(paths).toContain('metadata.endDate')
      expect(paths).toContain('activities.0.dayId')
      expect(paths).toContain('activities.0.costInr')
      expect(paths).toContain('travelLegs.0.mapsUrl')
    }
  })

  it('rejects mismatched stop/day relationships and malformed dates or times', () => {
    const plan = createValidPlan()
    plan.activities[0]!.routeStopId = 'stop-agra'
    plan.days[0]!.date = '01/11/2026'
    plan.activities[0]!.startTime = '9am'

    expect(tripPlanSchema.safeParse(plan).success).toBe(false)
  })

  it('accepts independent consecutive activity ordering within each day and slot', () => {
    const plan = createValidPlan()
    const source = plan.activities[0]!
    plan.activities = [
      { ...source, id: 'morning-1', order: 1 },
      { ...source, id: 'evening-0', slot: 'evening', order: 0 },
      { ...source, id: 'morning-0', order: 0 },
      { ...source, id: 'day-2-morning-0', dayId: 'day-2', order: 0 },
    ]

    expect(tripPlanSchema.safeParse(plan).success).toBe(true)
  })

  it.each([
    ['a gap', [0, 2]],
    ['a duplicate', [0, 0]],
    ['a non-zero start', [1, 2]],
  ])('rejects %s in activity ordering within a day and slot', (_label, orders) => {
    const plan = createValidPlan()
    const source = plan.activities[0]!
    plan.activities = orders.map((order, index) => ({ ...source, id: `activity-${index}`, order }))

    const result = tripPlanSchema.safeParse(plan)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          path: ['activities'],
          message: 'Activity order must be consecutive within each day and time slot',
        }),
      ]))
    }
  })
})
