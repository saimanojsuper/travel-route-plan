import { useEffect, useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useStore } from 'zustand'
import { DayResolutionDialog } from '../../components/DayResolutionDialog'
import { scheduleStopsByDuration } from '../../domain/dateAllocation'
import { userFacingError } from '../../domain/errorMessage'
import { createStableId } from '../../domain/id'
import { applyArrivalDepartureEvents } from '../../domain/tripExtension'
import {
  addRouteStop,
  deleteRouteStop,
  editRouteStops,
  type RouteChangeDraft,
} from '../../domain/routeMutations'
import { tripStore } from '../../store/tripStore'
import type { TravelLeg, TripPlan } from '../../types/trip'
import { ArrivalDepartureEditor } from './ArrivalDepartureEditor'
import { RouteStopCard } from './RouteStopCard'
import { TravelLegEditor } from './TravelLegEditor'
import { TripDurationEditor } from './TripDurationEditor'

export function RouteTimeline({ plan }: { plan: TripPlan }) {
  const replacePlan = useStore(tripStore, (state) => state.replacePlan)
  const [routeDraft, setRouteDraft] = useState(() => [...plan.routeStops].sort((a, b) => a.order - b.order))
  const [pending, setPending] = useState<RouteChangeDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [newCity, setNewCity] = useState('')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    setRouteDraft([...plan.routeStops].sort((a, b) => a.order - b.order))
  }, [plan.routeStops])

  function presentChange(change: RouteChangeDraft) {
    setError(null)
    if (change.requiredDayChanges.length > 0) setPending(change)
    else replacePlan(change.finalize())
  }

  function attempt(operation: () => RouteChangeDraft) {
    try { presentChange(operation()) }
    catch (caught) { setError(userFacingError(caught, 'Route change failed.')) }
  }

  function saveRouteDraft() {
    if (routeDraft.some((stop) => !stop.city.trim())) {
      setError('Every destination needs a city name.')
      return
    }
    const normalized = routeDraft.map((stop, order) => ({ ...stop, city: stop.city.trim(), order }))
    attempt(() => editRouteStops(plan, normalized, new Date().toISOString(), createStableId))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = routeDraft.findIndex((stop) => stop.id === active.id)
    const newIndex = routeDraft.findIndex((stop) => stop.id === over.id)
    const reordered = arrayMove(routeDraft, oldIndex, newIndex)
    const scheduled = scheduleStopsByDuration(reordered, plan.metadata.startDate, plan.metadata.endDate)
    attempt(() => editRouteStops(plan, scheduled, new Date().toISOString(), createStableId))
  }

  function moveStop(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= routeDraft.length) return
    const reordered = arrayMove(routeDraft, index, targetIndex)
    const scheduled = scheduleStopsByDuration(reordered, plan.metadata.startDate, plan.metadata.endDate)
    attempt(() => editRouteStops(plan, scheduled, new Date().toISOString(), createStableId))
  }

  function saveLeg(leg: TravelLeg) {
    try {
      replacePlan({
        ...plan,
        metadata: { ...plan.metadata, updatedAt: new Date().toISOString() },
        travelLegs: plan.travelLegs.map((candidate) => candidate.id === leg.id ? leg : candidate),
      })
      setError(null)
    } catch (caught) {
      setError(userFacingError(caught, 'Travel leg is invalid.'))
    }
  }

  function updateEvents(events: TripPlan['arrivalDepartureEvents']) {
    try {
      replacePlan(applyArrivalDepartureEvents(plan, events, new Date().toISOString()))
      setError(null)
    } catch (caught) {
      setError(userFacingError(caught, 'Route event is invalid.'))
    }
  }

  const orderedStops = [...plan.routeStops].sort((a, b) => a.order - b.order)

  return (
    <div className="route-workspace">
      <div className="workspace-heading"><div><p className="eyebrow">Route builder</p><h2>Destinations & travel</h2><p>Edit the route, travel legs, and arrival or departure details.</p></div></div>
      {error && <p className="form-error global-error" role="alert">{error}</p>}
      <TripDurationEditor plan={plan} />

      <section className="panel route-section">
        <div className="section-heading">
          <div><p className="eyebrow">{routeDraft.length} destinations</p><h2>Route timeline</h2><p>Drag to reorder, or use the move buttons. Date ranges must form one continuous trip with no gaps.</p></div>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={routeDraft.map((stop) => stop.id)} strategy={verticalListSortingStrategy}>
            <div className="route-list">
              {routeDraft.map((stop, index) => (
                <RouteStopCard
                  key={stop.id}
                  stop={stop}
                  index={index}
                  canDelete={routeDraft.length > 1}
                  canMoveUp={index > 0}
                  canMoveDown={index < routeDraft.length - 1}
                  onMove={(direction) => moveStop(index, direction)}
                  onChange={(updated) => setRouteDraft((current) => current.map((candidate) => candidate.id === stop.id ? updated : candidate))}
                  onDelete={(target) => {
                    if (window.confirm(`Delete ${target.city}? Its activities and food entries will also be deleted.`)) {
                      attempt(() => deleteRouteStop(plan, target.id, new Date().toISOString(), createStableId))
                    }
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="route-actions">
          <div className="add-stop-row">
            <label><span className="sr-only">New destination</span><input placeholder="Add another city" value={newCity} onChange={(event) => setNewCity(event.target.value)} /></label>
            <button className="button secondary" type="button" disabled={!newCity.trim()} onClick={() => {
              attempt(() => addRouteStop(plan, { id: createStableId(), city: newCity.trim() }, new Date().toISOString(), createStableId))
              setNewCity('')
            }}>Add stop</button>
          </div>
          <button className="button" type="button" onClick={saveRouteDraft}>Apply route details</button>
        </div>
      </section>

      {plan.travelLegs.length > 0 && (
        <section className="panel route-section">
          <div className="section-heading"><div><p className="eyebrow">Between cities</p><h2>Travel legs</h2></div></div>
          {[...plan.travelLegs].sort((a, b) => a.order - b.order).map((leg) => (
            <TravelLegEditor key={leg.id} leg={leg} from={orderedStops[leg.order]!} to={orderedStops[leg.order + 1]!} onSave={saveLeg} />
          ))}
        </section>
      )}

      <ArrivalDepartureEditor events={plan.arrivalDepartureEvents} stops={orderedStops} days={plan.days} tripEndDate={plan.metadata.endDate} onChange={updateEvents} />

      {pending && (
        <DayResolutionDialog
          draft={pending}
          onCancel={() => setPending(null)}
          onResolve={(selections) => {
            try { replacePlan(pending.finalize(selections)); setPending(null); setError(null) }
            catch (caught) { setError(userFacingError(caught, 'Could not resolve schedule.')); setPending(null) }
          }}
        />
      )}
    </div>
  )
}
