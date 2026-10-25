import { tripPlanSchema } from '../schemas/tripSchema'
import type { TripPlan } from '../types/trip'

export interface ExportArtifact {
  filename: string
  json: string
}

export interface DownloadEnvironment {
  createObjectUrl(blob: Blob): string
  revokeObjectUrl(url: string): void
  triggerDownload(url: string, filename: string): void
}

export function sanitizeFilenamePart(title: string): string {
  const safe = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return safe || 'trip-plan'
}

export function createExportArtifact(plan: TripPlan, exportedAt = new Date()): ExportArtifact {
  const validPlan = tripPlanSchema.parse(plan)
  return {
    filename: `${sanitizeFilenamePart(validPlan.metadata.title)}-${exportedAt.toISOString().slice(0, 10)}.json`,
    json: `${JSON.stringify(validPlan, null, 2)}\n`,
  }
}

function browserDownloadEnvironment(): DownloadEnvironment {
  return {
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    triggerDownload(url, filename) {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.hidden = true
      document.body.append(anchor)
      try { anchor.click() }
      finally { anchor.remove() }
    },
  }
}

export function downloadTripPlan(
  plan: TripPlan | null,
  exportedAt = new Date(),
  environment: DownloadEnvironment = browserDownloadEnvironment(),
): ExportArtifact {
  if (!plan) throw new Error('Create or import a trip before exporting')
  const artifact = createExportArtifact(plan, exportedAt)
  const blob = new Blob([artifact.json], { type: 'application/json;charset=utf-8' })
  const objectUrl = environment.createObjectUrl(blob)
  try {
    environment.triggerDownload(objectUrl, artifact.filename)
    return artifact
  } finally {
    environment.revokeObjectUrl(objectUrl)
  }
}
