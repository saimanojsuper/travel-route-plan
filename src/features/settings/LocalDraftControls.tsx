import { useStore } from 'zustand'
import { tripStore } from '../../store/tripStore'

export function LocalDraftControls({
  hasPlan,
  onClearDraft,
  onNewPlan,
}: {
  hasPlan: boolean
  onClearDraft(): void
  onNewPlan(): void
}) {
  const hasDraft = useStore(tripStore, (state) => state.hasRecoveryDraft)

  function clear() {
    if (!window.confirm('Clear the browser recovery draft? This immediately clears the active plan and returns to setup.')) return
    onClearDraft()
  }

  function reset() {
    if (hasPlan && !window.confirm('Start a new plan? This permanently clears the active plan, undo history, and local recovery draft.')) return
    onNewPlan()
  }

  return (
    <div className="local-controls">
      <div className="settings-action-block">
        <div><h3>Local recovery draft</h3><p>{hasDraft ? 'A validated recovery draft is saved in this browser.' : 'No recovery draft is currently saved.'}</p></div>
        <button className="button secondary" type="button" disabled={!hasDraft} onClick={clear}>Clear local draft</button>
      </div>
      <div className="settings-action-block danger-zone">
        <div><h3>New plan</h3><p>Clear this trip and return to the route-first setup.</p></div>
        <button className="button danger-button" type="button" onClick={reset}>Start new plan</button>
      </div>
    </div>
  )
}
