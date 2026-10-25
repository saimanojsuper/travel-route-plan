import { describe, expect, it, vi } from 'vitest'
import { LOCAL_DRAFT_STORAGE_KEY } from '../constants/schema'
import { createLocalDraftStorage, type DraftStorage, type StorageLike } from '../services/localDraftStorage'
import { createValidPlan } from '../test/fixtures'
import { createTripStore } from './tripStore'

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

function throwingStorage(overrides: Partial<DraftStorage> = {}): DraftStorage {
  return {
    load: vi.fn(() => null),
    save: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  }
}

describe('Phase 5 local recovery', () => {
  it('restores a valid local draft and silently ignores malformed or schema-invalid drafts', () => {
    const backing = new MemoryStorage()
    const drafts = createLocalDraftStorage(backing)
    drafts.save(createValidPlan())

    const restored = createTripStore({ draftStorage: drafts })
    expect(restored.getState().history.present).toEqual(createValidPlan())
    expect(restored.getState().hasRecoveryDraft).toBe(true)
    expect(restored.getState().ui.lastStorageError).toBeNull()

    for (const serialized of ['{broken', JSON.stringify({ schemaVersion: 1 })]) {
      backing.values.set(LOCAL_DRAFT_STORAGE_KEY, serialized)
      const ignored = createTripStore({ draftStorage: drafts })
      expect(ignored.getState().history.present).toBeNull()
      expect(ignored.getState().hasRecoveryDraft).toBe(false)
      expect(ignored.getState().ui.lastStorageError).toBeNull()
    }
  })

  it('surfaces get, save, and clear failures without crashing or discarding in-memory work', () => {
    const getFailure = throwingStorage({ load: () => { throw new Error('storage denied') } })
    expect(() => createTripStore({ draftStorage: getFailure })).not.toThrow()
    expect(createTripStore({ draftStorage: getFailure }).getState().ui.lastStorageError).toBe('storage denied')

    const saveFailure = throwingStorage({ save: () => { throw new Error('quota full') } })
    const saveStore = createTripStore({ draftStorage: saveFailure })
    expect(() => saveStore.getState().replacePlan(createValidPlan())).not.toThrow()
    expect(saveStore.getState().history.present).toEqual(createValidPlan())
    expect(saveStore.getState().ui.lastStorageError).toBe('quota full')

    const clearFailure = throwingStorage({ clear: () => { throw new Error('clear denied') } })
    const clearStore = createTripStore({ draftStorage: clearFailure, initialPlan: createValidPlan() })
    expect(() => clearStore.getState().clearRecoveryDraft()).not.toThrow()
    expect(clearStore.getState().history.present).toEqual(createValidPlan())
    expect(clearStore.getState().hasRecoveryDraft).toBe(true)
    expect(clearStore.getState().ui.lastStorageError).toBe('clear denied')
  })

  it('explicitly clears only the recovery copy and leaves the active plan and history intact', () => {
    const storage = throwingStorage()
    const store = createTripStore({ draftStorage: storage, initialPlan: createValidPlan() })
    store.getState().updatePlan((plan) => ({ ...plan, metadata: { ...plan.metadata, title: 'Edited' } }))
    const historyBeforeClear = store.getState().history

    store.getState().clearRecoveryDraft()

    expect(storage.clear).toHaveBeenCalledOnce()
    expect(store.getState().history).toBe(historyBeforeClear)
    expect(store.getState().history.present?.metadata.title).toBe('Edited')
    expect(store.getState().hasRecoveryDraft).toBe(false)
    expect(store.getState().ui.lastStorageError).toBeNull()
  })

  it('resetPlan clears plan, history, dirty state, and draft only after storage clear succeeds', () => {
    const storage = throwingStorage()
    const store = createTripStore({ draftStorage: storage, initialPlan: createValidPlan() })
    store.getState().updatePlan((plan) => ({ ...plan, metadata: { ...plan.metadata, title: 'Dirty' } }))

    store.getState().resetPlan()

    expect(storage.clear).toHaveBeenCalledOnce()
    expect(store.getState().history).toEqual({ past: [], present: null, future: [] })
    expect(store.getState().hasRecoveryDraft).toBe(false)
    expect(store.getState().ui).toEqual({ isDirty: false, lastStorageError: null })
  })

  it('preserves the active plan, full history, dirty state, and draft when reset clear fails', () => {
    const storage = throwingStorage({ clear: () => { throw new Error('cannot clear') } })
    const store = createTripStore({ draftStorage: storage, initialPlan: createValidPlan() })
    store.getState().updatePlan((plan) => ({ ...plan, metadata: { ...plan.metadata, title: 'Must survive' } }))
    const historyBeforeReset = store.getState().history

    store.getState().resetPlan()

    expect(store.getState().history).toBe(historyBeforeReset)
    expect(store.getState().history.present?.metadata.title).toBe('Must survive')
    expect(store.getState().hasRecoveryDraft).toBe(true)
    expect(store.getState().ui).toEqual({ isDirty: true, lastStorageError: 'cannot clear' })
  })
})
