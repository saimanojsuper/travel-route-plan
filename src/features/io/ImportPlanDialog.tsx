import { useState } from 'react'
import { useStore } from 'zustand'
import { readPlanImport, summarizePlan, type ImportResult } from '../../services/importPlan'
import { tripStore } from '../../store/tripStore'

export function ImportPlanDialog({ onImported }: { onImported(): void }) {
  const replacePlan = useStore(tripStore, (state) => state.replacePlan)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [inputKey, setInputKey] = useState(0)

  async function selectFile(file?: File) {
    if (!file) return
    setReading(true)
    setFilename(file.name)
    setResult(await readPlanImport(file))
    setReading(false)
  }

  function cancel() {
    setResult(null)
    setFilename(null)
    setInputKey((value) => value + 1)
  }

  function confirm() {
    if (!result?.success) return
    replacePlan(result.plan)
    cancel()
    onImported()
  }

  const preview = result?.success ? summarizePlan(result.plan) : null

  return (
    <div className="import-control">
      <div className="settings-action-block">
        <div><h3>Import JSON backup</h3><p>Choose a local plan to validate and preview before replacing the active trip.</p></div>
        <label className="file-picker">Select JSON file<input key={inputKey} type="file" accept=".json,application/json" disabled={reading} onChange={(event) => void selectFile(event.target.files?.[0])} /></label>
      </div>
      {reading && <p role="status">Reading and validating file…</p>}
      {result && !result.success && (
        <section className="import-result import-errors" role="alert" aria-labelledby="import-error-title">
          <h4 id="import-error-title">{result.summary}</h4>
          {filename && <p>{filename}</p>}
          <ul>{result.issues.map((issue, index) => <li key={`${issue.path}-${index}`}><code>{issue.path}</code>: {issue.message}</li>)}</ul>
          <details><summary>Technical validation details</summary><pre>{result.technicalDetails}</pre></details>
          <button className="button secondary small" type="button" onClick={cancel}>Dismiss</button>
        </section>
      )}
      {result?.success && preview && (
        <section className="import-result import-preview" role="dialog" aria-modal="false" aria-labelledby="import-preview-title">
          <p className="eyebrow">Validated preview</p>
          <h4 id="import-preview-title">{preview.title}</h4>
          <dl>
            <div><dt>Dates</dt><dd>{preview.startDate} → {preview.endDate}</dd></div>
            <div><dt>Schema</dt><dd>Version {preview.schemaVersion}</dd></div>
            <div><dt>Route</dt><dd>{preview.routeStops} stops · {preview.days} days</dd></div>
            <div><dt>Content</dt><dd>{preview.activities} activities · {preview.foodEntries} food entries</dd></div>
          </dl>
          <p>Confirming replaces the active plan. You can undo this replacement during the current session.</p>
          <div className="actions"><button className="button secondary" type="button" onClick={cancel}>Cancel</button><button className="button" type="button" onClick={confirm}>Replace active plan</button></div>
        </section>
      )}
    </div>
  )
}
