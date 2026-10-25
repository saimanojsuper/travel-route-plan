import { useState } from 'react'
import { useStore } from 'zustand'
import { calculateBudgetSnapshot, updateBudgetTarget } from '../../domain/budget'
import { userFacingError } from '../../domain/errorMessage'
import { tripStore } from '../../store/tripStore'
import type { TripPlan } from '../../types/trip'
import { BudgetTargetEditor } from './BudgetTargetEditor'

const formatInr = (value: number) => `₹${Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export function BudgetSummary({ plan }: { plan: TripPlan }) {
  const replacePlan = useStore(tripStore, (state) => state.replacePlan)
  const [error, setError] = useState<string | null>(null)
  const snapshot = calculateBudgetSnapshot(plan)
  let percentage = 0
  if (snapshot.targetInr === 0 && snapshot.recordedTotalCostInr > 0) percentage = 100
  else if (snapshot.targetInr !== null && snapshot.targetInr > 0) {
    percentage = Math.min(100, (snapshot.recordedTotalCostInr / snapshot.targetInr) * 100)
  }

  function saveTarget(targetInr?: number) {
    try {
      replacePlan(updateBudgetTarget(plan, targetInr, new Date().toISOString()))
      setError(null)
    } catch (caught) {
      setError(userFacingError(caught, 'Budget target could not be saved.'))
    }
  }

  return (
    <section className="budget-workspace" aria-labelledby="budget-heading">
      <div className="workspace-heading"><div><p className="eyebrow">INR only</p><h2 id="budget-heading">Trip budget</h2><p>Compare your target with costs recorded on itinerary activities and must-taste food entries.</p></div></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="budget-grid">
        <article className="panel budget-card target-card"><span>Budget target</span><strong>{snapshot.targetInr === null ? 'Not set' : formatInr(snapshot.targetInr)}</strong></article>
        <article className="panel budget-card"><span>Activity costs</span><strong>{formatInr(snapshot.recordedActivityCostInr)}</strong></article>
        <article className="panel budget-card"><span>Food estimates</span><strong>{formatInr(snapshot.recordedFoodCostInr)}</strong></article>
        <article className="panel budget-card combined-cost"><span>Combined spent / planned</span><strong>{formatInr(snapshot.recordedTotalCostInr)}</strong></article>
        <article className={`panel budget-card ${snapshot.isOverBudget ? 'over-budget' : ''}`}><span>{snapshot.isOverBudget ? 'Over budget' : 'Remaining'}</span><strong>{snapshot.remainingInr === null ? 'Set a target' : formatInr(snapshot.remainingInr)}</strong></article>
      </div>
      {snapshot.targetInr !== null && <div className="budget-progress" aria-label={`${Math.round(percentage)} percent of budget used`}><span style={{ width: `${percentage}%` }} /></div>}
      <section className="panel budget-editor-panel"><div><h3>Set your target</h3><p>Use one nonnegative INR amount for the whole trip.</p></div><BudgetTargetEditor targetInr={plan.budget.targetInr} onSave={saveTarget} /></section>
      <aside className="budget-disclosure"><strong>What this total includes</strong><p>The combined total includes all INR costs recorded on itinerary activities plus all estimated INR costs in the food planner, regardless of planned, done, or skipped status. No conversion, live pricing, bookings, or external APIs are used.</p></aside>
    </section>
  )
}
