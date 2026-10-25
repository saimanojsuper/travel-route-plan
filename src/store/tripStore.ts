import { createStore, type StoreApi } from 'zustand/vanilla'
import { DEFAULT_HISTORY_LIMIT } from '../constants/schema'
import { DEFAULT_TRIP_PLAN } from '../data/defaultTripPlan'
import { tripPlanSchema } from '../schemas/tripSchema'
import {
  getBrowserDraftStorage,
  type DraftStorage,
} from '../services/localDraftStorage'
import type { TripPlan } from '../types/trip'
import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type History,
} from './history'

export interface TripUiState {
  isDirty: boolean
  lastStorageError: string | null
}

export interface TripStoreState {
  history: History<TripPlan | null>
  ui: TripUiState
  hasRecoveryDraft: boolean
  replacePlan(plan: TripPlan): void
  updatePlan(updater: (plan: TripPlan) => TripPlan): void
  clearPlan(): void
  resetPlan(): void
  undo(): void
  redo(): void
  markExported(): void
  clearRecoveryDraft(): void
  setUiState(update: Partial<TripUiState>): void
}

export interface TripStoreOptions {
  draftStorage?: DraftStorage
  historyLimit?: number
  initialPlan?: TripPlan | null
  /**
   * A bundled starter plan to load automatically when there is no existing
   * local recovery draft (a genuine first load, or storage cleared). Ignored
   * whenever `initialPlan` is explicitly provided, so tests that need a
   * precise blank or seeded state are unaffected. Defaults to `undefined`
   * (no bootstrap), so only callers that opt in (the app's singleton store)
   * see this behavior.
   */
  defaultPlan?: TripPlan | null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Browser storage operation failed'
}

export function createTripStore(options: TripStoreOptions = {}): StoreApi<TripStoreState> {
  const storage = options.draftStorage ?? getBrowserDraftStorage()
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT
  if (!Number.isInteger(historyLimit) || historyLimit < 1) {
    throw new RangeError('historyLimit must be a positive integer')
  }

  let recoveredPlan: TripPlan | null = null
  let initialStorageError: string | null = null
  try {
    recoveredPlan = options.initialPlan === undefined ? storage.load() : options.initialPlan
  } catch (error) {
    initialStorageError = errorMessage(error)
  }

  if (recoveredPlan) {
    recoveredPlan = tripPlanSchema.parse(recoveredPlan)
  } else if (options.initialPlan === undefined && !initialStorageError && options.defaultPlan) {
    // Genuinely empty storage (no draft, no read error): bootstrap with the bundled
    // starter plan, validated like any other plan, and autosave it immediately so
    // it behaves exactly like a freshly created trip from this point on.
    recoveredPlan = tripPlanSchema.parse(options.defaultPlan)
    try {
      storage.save(recoveredPlan)
    } catch (error) {
      initialStorageError = errorMessage(error)
    }
  }

  return createStore<TripStoreState>()((set, get) => {
    function persist(plan: TripPlan | null): void {
      try {
        if (plan) storage.save(plan)
        else storage.clear()
        set({ hasRecoveryDraft: plan !== null, ui: { ...get().ui, lastStorageError: null } })
      } catch (error) {
        set({ ui: { ...get().ui, lastStorageError: errorMessage(error) } })
      }
    }

    function applyHistory(history: History<TripPlan | null>): void {
      set({ history, ui: { ...get().ui, isDirty: true } })
      persist(history.present)
    }

    return {
      history: createHistory(recoveredPlan),
      ui: { isDirty: false, lastStorageError: initialStorageError },
      hasRecoveryDraft: recoveredPlan !== null,

      replacePlan(plan) {
        const validPlan = tripPlanSchema.parse(plan)
        applyHistory(pushHistory(get().history, validPlan, historyLimit))
      },

      updatePlan(updater) {
        const current = get().history.present
        if (!current) throw new Error('Cannot update a plan before one has been created')
        const isolatedCurrent = tripPlanSchema.parse(current)
        const validPlan = tripPlanSchema.parse(updater(isolatedCurrent))
        applyHistory(pushHistory(get().history, validPlan, historyLimit))
      },

      clearPlan() {
        applyHistory(pushHistory(get().history, null, historyLimit))
      },

      resetPlan() {
        try { storage.clear() }
        catch (error) {
          set({ ui: { ...get().ui, lastStorageError: errorMessage(error) } })
          return
        }
        set({
          history: createHistory(null),
          hasRecoveryDraft: false,
          ui: { isDirty: false, lastStorageError: null },
        })
      },

      undo() {
        const current = get().history
        const next = undoHistory(current)
        if (next !== current) applyHistory(next)
      },

      redo() {
        const current = get().history
        const next = redoHistory(current)
        if (next !== current) applyHistory(next)
      },

      markExported() {
        set({ ui: { ...get().ui, isDirty: false } })
      },

      clearRecoveryDraft() {
        try {
          storage.clear()
          set({ hasRecoveryDraft: false, ui: { ...get().ui, lastStorageError: null } })
        } catch (error) {
          set({ ui: { ...get().ui, lastStorageError: errorMessage(error) } })
        }
      },

      setUiState(update) {
        set({ ui: { ...get().ui, ...update } })
      },
    }
  })
}

export const tripStore = createTripStore({ defaultPlan: DEFAULT_TRIP_PLAN })
