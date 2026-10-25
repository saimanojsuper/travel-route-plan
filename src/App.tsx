import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { TripSetupWizard } from './features/setup/TripSetupWizard'
import { PlannerPage } from './pages/PlannerPage'
import { SettingsPage } from './pages/SettingsPage'
import { selectPlan } from './store/selectors'
import { tripStore } from './store/tripStore'

export default function App() {
  const plan = useStore(tripStore, selectPlan)
  const isDirty = useStore(tripStore, (state) => state.ui.isDirty)
  const storageError = useStore(tripStore, (state) => state.ui.lastStorageError)
  const [screen, setScreen] = useState<'main' | 'settings'>('main')

  useEffect(() => {
    if (!plan || !isDirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isDirty, plan])

  if (screen === 'settings') return <SettingsPage onReturn={() => setScreen('main')} />
  if (plan) return <PlannerPage plan={plan} onOpenSettings={() => setScreen('settings')} />
  return (
    <>
      {storageError && <p className="warning-banner setup-storage-warning" role="alert">Browser storage problem: {storageError}. You can still plan and export JSON backups.</p>}
      <button className="settings-launch button secondary small" type="button" onClick={() => setScreen('settings')}>Import or manage data</button>
      <TripSetupWizard />
    </>
  )
}
