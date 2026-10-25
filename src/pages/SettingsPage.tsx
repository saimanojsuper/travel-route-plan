import { useStore } from 'zustand'
import { ExportPlanButton } from '../features/io/ExportPlanButton'
import { ImportPlanDialog } from '../features/io/ImportPlanDialog'
import { LocalDraftControls } from '../features/settings/LocalDraftControls'
import { selectPlan } from '../store/selectors'
import { tripStore } from '../store/tripStore'

export function SettingsPage({ onReturn }: { onReturn(): void }) {
  const plan = useStore(tripStore, selectPlan)
  const resetPlan = useStore(tripStore, (state) => state.resetPlan)
  const storageError = useStore(tripStore, (state) => state.ui.lastStorageError)
  const isDirty = useStore(tripStore, (state) => state.ui.isDirty)

  function resetAndReturn() {
    resetPlan()
    if (tripStore.getState().history.present === null) onReturn()
  }

  return (
    <main className="settings-shell">
      <header className="settings-header">
        <div><p className="eyebrow">Browser-only data</p><h1>Import, export & recovery</h1><p>Portable JSON backups and this browser’s local recovery draft. Nothing is sent to a server.</p></div>
        <button className="button secondary" type="button" onClick={onReturn}>{plan ? 'Return to planner' : 'Return to setup'}</button>
      </header>
      {storageError && <p className="warning-banner" role="alert">Browser storage problem: {storageError}. Keep an exported backup if possible.</p>}
      {isDirty && plan && <p className="info-banner">This plan has changed since its last successful export. A local recovery draft is still saved automatically.</p>}

      <section className="panel settings-section" aria-labelledby="portable-data-heading">
        <div className="section-heading"><div><p className="eyebrow">Portable backup</p><h2 id="portable-data-heading">JSON plan file</h2></div></div>
        <ExportPlanButton plan={plan} />
        <ImportPlanDialog onImported={onReturn} />
      </section>

      <section className="panel settings-section" aria-labelledby="local-data-heading">
        <div className="section-heading"><div><p className="eyebrow">This browser</p><h2 id="local-data-heading">Local data</h2></div></div>
        <LocalDraftControls hasPlan={plan !== null} onClearDraft={resetAndReturn} onNewPlan={resetAndReturn} />
      </section>
    </main>
  )
}
