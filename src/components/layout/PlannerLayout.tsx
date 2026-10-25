import { useStore } from 'zustand'
import { selectCanRedo, selectCanUndo } from '../../store/selectors'
import { tripStore } from '../../store/tripStore'
import type { TripPlan } from '../../types/trip'

export type PlannerSection = 'route' | 'itinerary' | 'food' | 'budget'

export function PlannerLayout({
  plan,
  activeSection,
  onSectionChange,
  onOpenSettings,
  children,
  routePanel,
}: {
  plan: TripPlan
  activeSection: PlannerSection
  onSectionChange(section: PlannerSection): void
  onOpenSettings(): void
  children: React.ReactNode
  routePanel: React.ReactNode
}) {
  const undo = useStore(tripStore, (state) => state.undo)
  const redo = useStore(tripStore, (state) => state.redo)
  const canUndo = useStore(tripStore, selectCanUndo)
  const canRedo = useStore(tripStore, selectCanRedo)
  const storageError = useStore(tripStore, (state) => state.ui.lastStorageError)

  return (
    <main className="planner-shell phase-three-shell">
      <header className="planner-header">
        <div><p className="eyebrow">Trip workspace</p><h1>{plan.metadata.title}</h1><p>{plan.metadata.startDate} → {plan.metadata.endDate} · {plan.days.length} days</p></div>
        <div className="history-actions"><button className="button secondary small" type="button" disabled={!canUndo} onClick={undo}>Undo</button><button className="button secondary small" type="button" disabled={!canRedo} onClick={redo}>Redo</button><button className="button secondary small" type="button" onClick={onOpenSettings}>Data & settings</button></div>
      </header>
      {plan.metadata.coverImageUrl && <img className="cover-image planner-cover" src={plan.metadata.coverImageUrl} alt="" />}
      {storageError && <p className="warning-banner">Draft could not be saved locally: {storageError}</p>}
      <nav className="planner-nav" aria-label="Planner sections">
        <button type="button" className={activeSection === 'route' ? 'active' : ''} onClick={() => onSectionChange('route')}>Route</button>
        <button type="button" className={activeSection === 'itinerary' ? 'active' : ''} onClick={() => onSectionChange('itinerary')}>Itinerary</button>
        <button type="button" className={activeSection === 'food' ? 'active' : ''} onClick={() => onSectionChange('food')}>Food</button>
        <button type="button" className={activeSection === 'budget' ? 'active' : ''} onClick={() => onSectionChange('budget')}>Budget</button>
      </nav>
      <details className="mobile-route-summary"><summary>Route summary · {plan.routeStops.length} destinations</summary>{routePanel}</details>
      <div className="planner-grid"><section className="planner-content">{children}</section><div className="desktop-aside">{routePanel}</div></div>
    </main>
  )
}
