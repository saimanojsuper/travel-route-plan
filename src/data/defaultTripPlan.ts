import { parseTripPlan } from '../schemas/tripSchema'
import type { TripPlan } from '../types/trip'
import rawDefaultTripPlan from './defaultTripPlan.json'

/**
 * Bundled starter trip ("Rajasthan Circuit") shown on a genuinely first load of
 * the app, i.e. when no local recovery draft exists yet in this browser. It is
 * validated through the exact same schema as any hand-built or imported plan,
 * so it is held to the same correctness bar and never bypasses validation.
 *
 * Parsing eagerly at module load (rather than lazily inside the store) means a
 * malformed bundled plan fails fast during development/build instead of
 * silently breaking the first-load experience for real users.
 */
export const DEFAULT_TRIP_PLAN: TripPlan = parseTripPlan(rawDefaultTripPlan)
