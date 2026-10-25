import { useState } from 'react'
import { PlannerLayout, type PlannerSection } from '../components/layout/PlannerLayout'
import { StickyRoutePanel } from '../components/layout/StickyRoutePanel'
import { BudgetSummary } from '../features/budget/BudgetSummary'
import { FoodPlanner } from '../features/food/FoodPlanner'
import { ItineraryBoard } from '../features/itinerary/ItineraryBoard'
import { RouteTimeline } from '../features/route/RouteTimeline'
import type { TripPlan } from '../types/trip'

export function PlannerPage({ plan, onOpenSettings = () => {} }: { plan: TripPlan; onOpenSettings?(): void }) {
  const [activeSection, setActiveSection] = useState<PlannerSection>('itinerary')

  function showDay(dayNumber: number) {
    setActiveSection('itinerary')
    window.setTimeout(() => document.getElementById(`day-${dayNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const routePanel = <StickyRoutePanel plan={plan} onDay={showDay} />
  const workspace = {
    route: <RouteTimeline plan={plan} />,
    itinerary: <ItineraryBoard plan={plan} />,
    food: <FoodPlanner plan={plan} />,
    budget: <BudgetSummary plan={plan} />,
  }[activeSection]
  return (
    <PlannerLayout plan={plan} activeSection={activeSection} onSectionChange={setActiveSection} onOpenSettings={onOpenSettings} routePanel={routePanel}>
      {workspace}
    </PlannerLayout>
  )
}
