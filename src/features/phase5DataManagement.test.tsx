import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { LOCAL_DRAFT_STORAGE_KEY } from '../constants/schema'
import { createHistory } from '../store/history'
import { tripStore } from '../store/tripStore'
import { createValidPlan } from '../test/fixtures'
import type { TripPlan } from '../types/trip'

function installPlan(plan: TripPlan | null = createValidPlan(), isDirty = false) {
  tripStore.setState({
    history: createHistory(plan),
    ui: { isDirty, lastStorageError: null },
    hasRecoveryDraft: plan !== null,
  })
}

function jsonFile(value: unknown, name = 'plan.json', type = 'application/json'): File {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const file = new File([text], name, { type })
  Object.defineProperty(file, 'text', { value: vi.fn(async () => text) })
  return file
}

function openSettings() {
  fireEvent.click(screen.getByRole('button', { name: 'Data & settings' }))
  expect(screen.getByRole('heading', { name: 'Import, export & recovery' })).toBeInTheDocument()
}

beforeEach(() => {
  window.localStorage.clear()
  installPlan()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('Phase 5 data management UI', () => {
  it('navigates to settings and returns to the active planner', () => {
    render(<App />)
    openSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Return to planner' }))
    expect(screen.getByRole('heading', { name: 'Golden Triangle' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Import, export & recovery' })).not.toBeInTheDocument()
  })

  it('marks exported only after download initiation succeeds', () => {
    installPlan(createValidPlan(), true)
    const createObjectURL = vi.fn(() => 'blob:ui-export')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementationOnce(() => { throw new Error('download blocked') })
    render(<App />)
    openSettings()

    fireEvent.click(screen.getByRole('button', { name: 'Export plan' }))
    expect(screen.getByRole('alert')).toHaveTextContent('download blocked')
    expect(tripStore.getState().ui.isDirty).toBe(true)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:ui-export')

    click.mockImplementationOnce(() => undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Export plan' }))
    expect(screen.getByRole('status')).toHaveTextContent('Download started: golden-triangle-')
    expect(tripStore.getState().ui.isDirty).toBe(false)
    expect(createObjectURL).toHaveBeenCalledTimes(2)
    expect(revokeObjectURL).toHaveBeenCalledTimes(2)
  })

  it('previews a valid import, cancels without mutation, then confirms as one undoable autosaved replacement', async () => {
    const imported = createValidPlan()
    imported.metadata = { ...imported.metadata, id: 'imported-id', title: 'Imported Adventure' }
    render(<App />)
    openSettings()
    const input = screen.getByLabelText('Select JSON file')

    fireEvent.change(input, { target: { files: [jsonFile(imported)] } })
    expect(await screen.findByRole('dialog', { name: 'Imported Adventure' })).toHaveTextContent('2 stops · 3 days')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(tripStore.getState().history.present?.metadata.title).toBe('Golden Triangle')
    expect(tripStore.getState().history.past).toHaveLength(0)

    const replacementInput = screen.getByLabelText('Select JSON file')
    fireEvent.change(replacementInput, { target: { files: [jsonFile(imported)] } })
    await screen.findByRole('dialog', { name: 'Imported Adventure' })
    fireEvent.click(screen.getByRole('button', { name: 'Replace active plan' }))

    expect(screen.getByRole('heading', { name: 'Imported Adventure' })).toBeInTheDocument()
    expect(tripStore.getState().history.past).toHaveLength(1)
    expect(tripStore.getState().history.past[0]?.metadata.title).toBe('Golden Triangle')
    expect(JSON.parse(window.localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY) ?? '{}').metadata.title).toBe('Imported Adventure')
    act(() => tripStore.getState().undo())
    expect(tripStore.getState().history.present?.metadata.title).toBe('Golden Triangle')
  })

  it('shows import errors with field paths and preserves current state for malformed and invalid files', async () => {
    render(<App />)
    openSettings()
    const original = tripStore.getState().history

    fireEvent.change(screen.getByLabelText('Select JSON file'), { target: { files: [jsonFile('{nope')] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON')
    expect(tripStore.getState().history).toBe(original)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    const invalid = createValidPlan()
    invalid.metadata.title = ''
    fireEvent.change(screen.getByLabelText('Select JSON file'), { target: { files: [jsonFile(invalid)] } })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('metadata.title')
    expect(tripStore.getState().history).toBe(original)
  })

  it('requires New Plan confirmation via an in-app dialog (no native window.confirm) and resets only after confirmation', () => {
    const confirm = vi.spyOn(window, 'confirm')
    window.localStorage.setItem(LOCAL_DRAFT_STORAGE_KEY, JSON.stringify(createValidPlan()))
    render(<App />)
    openSettings()

    fireEvent.click(screen.getByRole('button', { name: 'Start new plan' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Start a new plan? This permanently clears the active plan, undo history, and local recovery draft.',
    )
    expect(tripStore.getState().history.present?.metadata.title).toBe('Golden Triangle')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(tripStore.getState().history.present?.metadata.title).toBe('Golden Triangle')

    fireEvent.click(screen.getByRole('button', { name: 'Start new plan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, start new plan' }))

    expect(tripStore.getState().history.present).toBeNull()
    expect(tripStore.getState().history.past).toEqual([])
    expect(tripStore.getState().ui.isDirty).toBe(false)
    expect(window.localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY)).toBeNull()

    // The setup screen must actually be showing, not a stale plan view left behind by a missed re-render.
    expect(screen.queryByRole('heading', { name: 'Import, export & recovery' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Golden Triangle' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Build the route before the itinerary' })).toBeInTheDocument()
  })

  it('clears the local draft via an in-app dialog (no native window.confirm), synchronously resetting the active plan and UI without any reload', () => {
    const confirm = vi.spyOn(window, 'confirm')
    render(<App />)
    openSettings()

    fireEvent.click(screen.getByRole('button', { name: 'Clear local draft' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Clear the browser recovery draft? This immediately clears the active plan and returns to setup.',
    )
    expect(tripStore.getState().history.present?.metadata.title).toBe('Golden Triangle')
    expect(screen.getByRole('heading', { name: 'Import, export & recovery' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(tripStore.getState().history.present?.metadata.title).toBe('Golden Triangle')

    fireEvent.click(screen.getByRole('button', { name: 'Clear local draft' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, clear draft' }))

    expect(tripStore.getState().history.present).toBeNull()
    expect(tripStore.getState().history.past).toEqual([])
    expect(tripStore.getState().hasRecoveryDraft).toBe(false)
    expect(tripStore.getState().ui.isDirty).toBe(false)
    expect(window.localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY)).toBeNull()

    // No stale plan should reappear: the setup screen renders in its place within the same render tree.
    expect(screen.queryByRole('heading', { name: 'Import, export & recovery' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Golden Triangle' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Build the route before the itinerary' })).toBeInTheDocument()
  })

  it('installs beforeunload protection only while a plan is dirty, removing it after export/reset state', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const view = render(<App />)
    expect(add.mock.calls.filter(([type]) => type === 'beforeunload')).toHaveLength(0)

    act(() => tripStore.getState().setUiState({ isDirty: true }))
    const warning = add.mock.calls.find(([type]) => type === 'beforeunload')?.[1]
    expect(warning).toEqual(expect.any(Function))
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)

    act(() => tripStore.getState().markExported())
    expect(remove).toHaveBeenCalledWith('beforeunload', warning)

    act(() => tripStore.getState().setUiState({ isDirty: true }))
    act(() => tripStore.setState({ history: createHistory(null), ui: { isDirty: false, lastStorageError: null }, hasRecoveryDraft: false }))
    expect(remove.mock.calls.filter(([type]) => type === 'beforeunload').length).toBeGreaterThanOrEqual(2)
    view.unmount()
  })
})
