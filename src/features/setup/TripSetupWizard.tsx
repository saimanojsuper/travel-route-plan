import { useMemo, useState, type FormEvent } from 'react'
import { useStore } from 'zustand'
import { allocateStopDates } from '../../domain/dateAllocation'
import { createTripPlan, type SetupEventInput } from '../../domain/createTripPlan'
import { addDays, toOffsetIso } from '../../domain/dateUtils'
import { createStableId } from '../../domain/id'
import { userFacingError } from '../../domain/errorMessage'
import { tripStore } from '../../store/tripStore'
import type { ArrivalDepartureType } from '../../types/trip'

interface StopDraft { id: string; city: string }
interface EventDraft { enabled: boolean; place: string; dateTime: string; mapsUrl: string; notes: string }

const today = new Date().toISOString().slice(0, 10)
const initialEvent = (date: string, time: string): EventDraft => ({
  enabled: false,
  place: '',
  dateTime: `${date}T${time}`,
  mapsUrl: '',
  notes: '',
})

function EventFields({
  type,
  draft,
  onChange,
}: {
  type: ArrivalDepartureType
  draft: EventDraft
  onChange(next: EventDraft): void
}) {
  const title = type === 'arrival' ? 'Arrival' : 'Departure'
  return (
    <fieldset className="event-fields">
      <label className="check-row">
        <input type="checkbox" checked={draft.enabled} onChange={(event) => onChange({ ...draft, enabled: event.target.checked })} />
        Add {title.toLowerCase()} details
      </label>
      {draft.enabled && (
        <div className="form-grid two-columns">
          <label>{title} place<input required value={draft.place} onChange={(event) => onChange({ ...draft, place: event.target.value })} /></label>
          <label>Date and time<input required type="datetime-local" value={draft.dateTime} onChange={(event) => onChange({ ...draft, dateTime: event.target.value })} /></label>
          <label>Directions URL<input type="url" placeholder="https://…" value={draft.mapsUrl} onChange={(event) => onChange({ ...draft, mapsUrl: event.target.value })} /></label>
          <label>Notes<input value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></label>
        </div>
      )}
    </fieldset>
  )
}

export function TripSetupWizard() {
  const replacePlan = useStore(tripStore, (state) => state.replacePlan)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [stops, setStops] = useState<StopDraft[]>([
    { id: createStableId(), city: '' },
    { id: createStableId(), city: '' },
  ])
  const [details, setDetails] = useState({
    title: '',
    description: '',
    coverImageUrl: '',
    startDate: today,
    endDate: addDays(today, 2),
  })
  const [arrival, setArrival] = useState(() => initialEvent(today, '09:00'))
  const [departure, setDeparture] = useState(() => initialEvent(addDays(today, 2), '18:00'))

  const allocation = useMemo(() => {
    try {
      return allocateStopDates(stops.filter((stop) => stop.city.trim()), details.startDate, details.endDate)
    } catch {
      return []
    }
  }, [details.endDate, details.startDate, stops])

  function updateStop(id: string, city: string) {
    setStops((current) => current.map((stop) => stop.id === id ? { ...stop, city } : stop))
  }

  function removeStop(id: string) {
    setStops((current) => current.filter((stop) => stop.id !== id))
  }

  function moveStop(index: number, direction: -1 | 1) {
    setStops((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target]!, next[index]!]
      return next
    })
  }

  function validateCurrentStep(): boolean {
    setError(null)
    if (step === 0) {
      if (stops.length === 0 || stops.some((stop) => !stop.city.trim())) {
        setError('Give every route stop a city name.')
        return false
      }
    }
    if (step === 1) {
      if (!details.title.trim()) {
        setError('Trip title is required.')
        return false
      }
      try {
        allocateStopDates(stops, details.startDate, details.endDate)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Trip dates are invalid.')
        return false
      }
    }
    return true
  }

  function nextStep() {
    if (validateCurrentStep()) setStep((current) => Math.min(2, current + 1))
  }

  function eventInput(type: ArrivalDepartureType, draft: EventDraft): SetupEventInput | undefined {
    if (!draft.enabled) return undefined
    if (!draft.place.trim() || !draft.dateTime) throw new Error(`${type === 'arrival' ? 'Arrival' : 'Departure'} place and time are required.`)
    return {
      type,
      place: draft.place.trim(),
      dateTime: toOffsetIso(draft.dateTime),
      mapsUrl: draft.mapsUrl.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    }
  }

  function finish(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const plan = createTripPlan({
        ...details,
        description: details.description || undefined,
        coverImageUrl: details.coverImageUrl || undefined,
        stops: stops.map((stop) => ({ ...stop, city: stop.city.trim() })),
        arrival: eventInput('arrival', arrival),
        departure: eventInput('departure', departure),
      }, new Date().toISOString(), createStableId)
      replacePlan(plan)
    } catch (caught) {
      setError(userFacingError(caught, 'The trip could not be created.'))
    }
  }

  return (
    <main className="setup-shell">
      <header className="setup-heading">
        <p className="eyebrow">New multi-city trip</p>
        <h1>Build the route before the itinerary</h1>
        <p>We will spread every trip date across your destinations. You can fine-tune the ranges afterward.</p>
      </header>

      <ol className="stepper" aria-label="Setup progress">
        {['Route', 'Trip details', 'Arrival & departure'].map((label, index) => (
          <li key={label} className={index === step ? 'active' : index < step ? 'complete' : ''}>{index + 1}. {label}</li>
        ))}
      </ol>

      <form className="panel setup-panel" onSubmit={finish}>
        {step === 0 && (
          <section>
            <div className="section-heading"><div><h2>Where are you going?</h2><p>Type cities in travel order.</p></div></div>
            <div className="stop-input-list">
              {stops.map((stop, index) => (
                <div className="stop-input" key={stop.id}>
                  <span className="number-badge">{index + 1}</span>
                  <label><span className="sr-only">Destination {index + 1}</span><input autoFocus={index === 0} placeholder="City or destination" value={stop.city} onChange={(event) => updateStop(stop.id, event.target.value)} /></label>
                  <button type="button" className="icon-button" aria-label="Move up" disabled={index === 0} onClick={() => moveStop(index, -1)}>↑</button>
                  <button type="button" className="icon-button" aria-label="Move down" disabled={index === stops.length - 1} onClick={() => moveStop(index, 1)}>↓</button>
                  <button type="button" className="icon-button danger" aria-label="Remove destination" disabled={stops.length === 1} onClick={() => removeStop(stop.id)}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="text-button" onClick={() => setStops((current) => [...current, { id: createStableId(), city: '' }])}>+ Add destination</button>
          </section>
        )}

        {step === 1 && (
          <section>
            <div className="section-heading"><div><h2>When is the adventure?</h2><p>Exact dates keep every destination and day aligned.</p></div></div>
            <div className="form-grid two-columns">
              <label>Trip title<input required value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} /></label>
              <label>Cover image URL <small>optional</small><input type="url" placeholder="https://…" value={details.coverImageUrl} onChange={(event) => setDetails({ ...details, coverImageUrl: event.target.value })} /></label>
              <label>Start date<input required type="date" value={details.startDate} onChange={(event) => {
                const startDate = event.target.value
                setDetails({ ...details, startDate })
                if (!arrival.enabled) setArrival((current) => ({ ...current, dateTime: `${startDate}${current.dateTime.slice(10)}` }))
              }} /></label>
              <label>End date<input required type="date" min={details.startDate} value={details.endDate} onChange={(event) => {
                const endDate = event.target.value
                setDetails({ ...details, endDate })
                if (!departure.enabled) setDeparture((current) => ({ ...current, dateTime: `${endDate}${current.dateTime.slice(10)}` }))
              }} /></label>
              <label className="full-width">Description <small>optional</small><textarea rows={3} value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} /></label>
            </div>
            {allocation.length > 0 && <div className="allocation-preview">{allocation.map((stop) => <span key={stop.id}><strong>{stop.city}</strong> {stop.startDate} → {stop.endDate}</span>)}</div>}
          </section>
        )}

        {step === 2 && (
          <section>
            <div className="section-heading"><div><h2>Bookend the route</h2><p>These itinerary events are optional and remain editable.</p></div></div>
            <EventFields type="arrival" draft={arrival} onChange={setArrival} />
            <EventFields type="departure" draft={departure} onChange={setDeparture} />
          </section>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="actions split-actions">
          <button className="button secondary" type="button" disabled={step === 0} onClick={() => { setError(null); setStep((current) => current - 1) }}>Back</button>
          {step < 2
            ? <button className="button" type="button" onClick={nextStep}>Continue</button>
            : <button className="button" type="submit">Create trip</button>}
        </div>
      </form>
    </main>
  )
}
