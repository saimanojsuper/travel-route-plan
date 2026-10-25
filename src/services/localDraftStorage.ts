import { LOCAL_DRAFT_STORAGE_KEY } from '../constants/schema'
import { tripPlanSchema } from '../schemas/tripSchema'
import type { TripPlan } from '../types/trip'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface DraftStorage {
  load(): TripPlan | null
  save(plan: TripPlan): void
  clear(): void
}

export function createLocalDraftStorage(storage?: StorageLike | null): DraftStorage {
  return {
    load() {
      if (!storage) return null
      const serialized = storage.getItem(LOCAL_DRAFT_STORAGE_KEY)
      if (!serialized) return null
      try {
        const parsed: unknown = JSON.parse(serialized)
        const result = tripPlanSchema.safeParse(parsed)
        return result.success ? result.data : null
      } catch {
        return null
      }
    },
    save(plan) {
      if (!storage) return
      const validPlan = tripPlanSchema.parse(plan)
      storage.setItem(LOCAL_DRAFT_STORAGE_KEY, JSON.stringify(validPlan))
    },
    clear() {
      if (!storage) return
      storage.removeItem(LOCAL_DRAFT_STORAGE_KEY)
    },
  }
}

export function getBrowserDraftStorage(): DraftStorage {
  if (typeof window === 'undefined') return createLocalDraftStorage(null)
  try {
    return createLocalDraftStorage(window.localStorage)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Browser storage is unavailable'
    const unavailable = () => { throw new Error(message) }
    return { load: unavailable, save: unavailable, clear: unavailable }
  }
}
