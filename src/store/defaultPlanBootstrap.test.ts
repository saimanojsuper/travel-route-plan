import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TRIP_PLAN } from '../data/defaultTripPlan'
import type { DraftStorage } from '../services/localDraftStorage'
import { createValidPlan } from '../test/fixtures'
import { createTripStore } from './tripStore'

describe('default trip plan bootstrap', () => {
  it('loads the bundled default plan, validated and autosaved, when no local draft exists', () => {
    const storage: DraftStorage = { load: () => null, save: vi.fn(), clear: vi.fn() }
    const store = createTripStore({ draftStorage: storage, defaultPlan: DEFAULT_TRIP_PLAN })

    const plan = store.getState().history.present
    expect(plan).toEqual(DEFAULT_TRIP_PLAN)
    expect(plan?.metadata.id).toBe('trip-rajasthan-circuit-dec2026')
    expect(store.getState().hasRecoveryDraft).toBe(true)
    expect(store.getState().ui.lastStorageError).toBeNull()
    // Bootstrapping must autosave immediately, exactly like creating any other plan does.
    expect(storage.save).toHaveBeenCalledWith(DEFAULT_TRIP_PLAN)
  })

  it('loads the existing recovery draft instead of the default when one is already present', () => {
    const existingDraft = createValidPlan()
    const storage: DraftStorage = { load: () => existingDraft, save: vi.fn(), clear: vi.fn() }
    const store = createTripStore({ draftStorage: storage, defaultPlan: DEFAULT_TRIP_PLAN })

    const plan = store.getState().history.present
    expect(plan).toEqual(existingDraft)
    expect(plan?.metadata.id).not.toBe(DEFAULT_TRIP_PLAN.metadata.id)
    // A store construction that recovered a real draft must not also write the default over it.
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('does not bootstrap when a storage read error occurs, to avoid clobbering data that failed to load', () => {
    const storage: DraftStorage = {
      load: () => { throw new Error('storage denied') },
      save: vi.fn(),
      clear: vi.fn(),
    }
    const store = createTripStore({ draftStorage: storage, defaultPlan: DEFAULT_TRIP_PLAN })

    expect(store.getState().history.present).toBeNull()
    expect(store.getState().ui.lastStorageError).toBe('storage denied')
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('does not bootstrap when an explicit initialPlan (even null) is provided, so other tests keep full control', () => {
    const storage: DraftStorage = { load: () => null, save: vi.fn(), clear: vi.fn() }
    const store = createTripStore({ draftStorage: storage, defaultPlan: DEFAULT_TRIP_PLAN, initialPlan: null })

    expect(store.getState().history.present).toBeNull()
    expect(storage.save).not.toHaveBeenCalled()
  })

  it('autosaves edits to the bootstrapped default plan exactly like edits to any other plan', () => {
    const storage: DraftStorage = { load: () => null, save: vi.fn(), clear: vi.fn() }
    const store = createTripStore({ draftStorage: storage, defaultPlan: DEFAULT_TRIP_PLAN })
    vi.mocked(storage.save).mockClear() // isolate the edit's save from the bootstrap-time save

    store.getState().updatePlan((plan) => ({
      ...plan,
      metadata: { ...plan.metadata, title: 'Our Rajasthan Trip' },
    }))

    expect(store.getState().history.present?.metadata.title).toBe('Our Rajasthan Trip')
    expect(storage.save).toHaveBeenCalledTimes(1)
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ title: 'Our Rajasthan Trip' }) }),
    )
  })

  it('"New Plan" / "Clear local draft" (resetPlan) immediately shows a blank plan, not the default, within the same session', () => {
    const storage: DraftStorage = { load: () => null, save: vi.fn(), clear: vi.fn() }
    const store = createTripStore({ draftStorage: storage, defaultPlan: DEFAULT_TRIP_PLAN })
    expect(store.getState().history.present?.metadata.id).toBe(DEFAULT_TRIP_PLAN.metadata.id)

    store.getState().resetPlan()

    expect(store.getState().history.present).toBeNull()
    expect(store.getState().hasRecoveryDraft).toBe(false)
    expect(storage.clear).toHaveBeenCalledOnce()
  })
})
