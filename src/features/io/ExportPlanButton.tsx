import { useState } from 'react'
import { useStore } from 'zustand'
import { userFacingError } from '../../domain/errorMessage'
import { downloadTripPlan } from '../../services/exportPlan'
import { tripStore } from '../../store/tripStore'
import type { TripPlan } from '../../types/trip'

export function ExportPlanButton({ plan }: { plan: TripPlan | null }) {
  const markExported = useStore(tripStore, (state) => state.markExported)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function exportPlan() {
    try {
      const artifact = downloadTripPlan(plan)
      markExported()
      setMessage(`Download started: ${artifact.filename}`)
      setError(null)
    } catch (caught) {
      setError(userFacingError(caught, 'Plan could not be exported.'))
      setMessage(null)
    }
  }

  return (
    <div className="settings-action-block">
      <div><h3>Export JSON backup</h3><p>Validate and download the complete versioned trip plan.</p></div>
      <button className="button" type="button" onClick={exportPlan}>Export plan</button>
      {message && <p className="success-message" role="status">{message}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  )
}
