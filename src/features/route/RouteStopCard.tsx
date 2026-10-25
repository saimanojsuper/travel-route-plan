import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { daysInclusive } from '../../domain/dateUtils'
import type { RouteStop } from '../../types/trip'

interface RouteStopCardProps {
  stop: RouteStop
  index: number
  canDelete: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onChange(stop: RouteStop): void
  onDelete(stop: RouteStop): void
  onMove(direction: -1 | 1): void
}

export function RouteStopCard({ stop, index, canDelete, canMoveUp, canMoveDown, onChange, onDelete, onMove }: RouteStopCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id })
  let duration = 0
  try { duration = daysInclusive(stop.startDate, stop.endDate) } catch { /* Draft validation handles it. */ }

  return (
    <article
      ref={setNodeRef}
      className={`route-stop-card ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="stop-card-heading">
        <button className="drag-handle" type="button" aria-label={`Drag to reorder ${stop.city}`} {...attributes} {...listeners}>⠿</button>
        <span className="number-badge">{index + 1}</span>
        <label className="city-field"><span className="sr-only">Destination name</span><input value={stop.city} onChange={(event) => onChange({ ...stop, city: event.target.value })} /></label>
        <span className="move-buttons">
          <button className="icon-button" type="button" aria-label={`Move ${stop.city} up`} disabled={!canMoveUp} onClick={() => onMove(-1)}>↑</button>
          <button className="icon-button" type="button" aria-label={`Move ${stop.city} down`} disabled={!canMoveDown} onClick={() => onMove(1)}>↓</button>
        </span>
        <span className="duration-badge">{duration || '—'} {duration === 1 ? 'day' : 'days'}</span>
        <button className="icon-button danger" type="button" disabled={!canDelete} aria-label={`Delete ${stop.city}`} onClick={() => onDelete(stop)}>×</button>
      </div>
      <div className="date-range-fields">
        <label>From<input type="date" value={stop.startDate} onChange={(event) => onChange({ ...stop, startDate: event.target.value })} /></label>
        <span aria-hidden="true">→</span>
        <label>Through<input type="date" value={stop.endDate} onChange={(event) => onChange({ ...stop, endDate: event.target.value })} /></label>
      </div>
    </article>
  )
}
