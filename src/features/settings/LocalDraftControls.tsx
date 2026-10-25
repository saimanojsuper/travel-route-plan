import { useState } from 'react'
import { useStore } from 'zustand'
import { tripStore } from '../../store/tripStore'

type PendingAction = 'clear' | 'reset' | null

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
  const [pending, setPending] = useState<PendingAction>(null)

  function requestReset() {
    // Nothing destructive happens without an active plan, so skip the confirm step.
    if (!hasPlan) {
      onNewPlan()
      return
    }
    setPending('reset')
  }

  function confirmPending() {
    if (pending === 'clear') onClearDraft()
    else if (pending === 'reset') onNewPlan()
    setPending(null)
  }

  return (
    <div className="local-controls">
      <div className="settings-action-block">
        <div><h3>Local recovery draft</h3><p>{hasDraft ? 'A validated recovery draft is saved in this browser.' : 'No recovery draft is currently saved.'}</p></div>
        <button className="button secondary" type="button" disabled={!hasDraft} onClick={() => setPending('clear')}>Clear local draft</button>
      </div>
      {pending === 'clear' && (
        <div className="confirm-inline" role="alert">
          <p>Clear the browser recovery draft? This immediately clears the active plan and returns to setup.</p>
          <div className="confirm-actions">
            <button className="button secondary small" type="button" onClick={() => setPending(null)}>Cancel</button>
            <button className="button danger-button small" type="button" onClick={confirmPending}>Yes, clear draft</button>
          </div>
        </div>
      )}

      <div className="settings-action-block danger-zone">
        <div><h3>New plan</h3><p>Clear this trip and return to the route-first setup.</p></div>
        <button className="button danger-button" type="button" onClick={requestReset}>Start new plan</button>
      </div>
      {pending === 'reset' && (
        <div className="confirm-inline" role="alert">
          <p>Start a new plan? This permanently clears the active plan, undo history, and local recovery draft.</p>
          <div className="confirm-actions">
            <button className="button secondary small" type="button" onClick={() => setPending(null)}>Cancel</button>
            <button className="button danger-button small" type="button" onClick={confirmPending}>Yes, start new plan</button>
          </div>
        </div>
      )}
    </div>
  )
}
