import { ZodError } from 'zod'
import { CURRENT_SCHEMA_VERSION } from '../constants/schema'
import { tripPlanSchema } from '../schemas/tripSchema'
import type { TripPlan } from '../types/trip'

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

export interface ImportFileLike {
  name: string
  size: number
  type: string
  text(): Promise<string>
}

export interface ImportIssue {
  path: string
  message: string
}

export interface ImportFailure {
  success: false
  summary: string
  issues: ImportIssue[]
  technicalDetails: string
}

export interface ImportSuccess {
  success: true
  plan: TripPlan
}

export type ImportResult = ImportFailure | ImportSuccess

function failure(summary: string, issues: ImportIssue[], technicalDetails: string): ImportFailure {
  return { success: false, summary, issues, technicalDetails }
}

export function validateImportFile(file: Pick<ImportFileLike, 'name' | 'size' | 'type'>): ImportFailure | null {
  if (!file.name.toLowerCase().endsWith('.json')) {
    return failure('Choose a JSON plan file', [{ path: 'file', message: 'Filename must end in .json' }], 'Unsupported filename extension')
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return failure('Plan file is too large', [{ path: 'file', message: `Maximum size is ${MAX_IMPORT_BYTES} bytes` }], `Received ${file.size} bytes`)
  }
  if (file.size === 0) {
    return failure('Plan file is empty', [{ path: 'file', message: 'File must contain JSON data' }], 'Received 0 bytes')
  }
  const allowedTypes = ['', 'application/json', 'text/json']
  if (!allowedTypes.includes(file.type.toLowerCase())) {
    return failure('Choose a JSON plan file', [{ path: 'file', message: `Unsupported file type: ${file.type}` }], 'Only JSON MIME types are accepted')
  }
  return null
}

function zodFailure(error: ZodError): ImportFailure {
  const issues = error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '$',
    message: issue.message,
  }))
  return failure('The plan does not match the supported format', issues, JSON.stringify(error.issues, null, 2))
}

export function parsePlanJson(json: string): ImportResult {
  let parsed: unknown
  try { parsed = JSON.parse(json) }
  catch {
    return failure('The selected file is not valid JSON', [{ path: '$', message: 'JSON syntax could not be parsed' }], 'JSON.parse rejected the file contents')
  }

  if (typeof parsed === 'object' && parsed !== null && 'schemaVersion' in parsed) {
    const version = (parsed as { schemaVersion?: unknown }).schemaVersion
    if (version !== CURRENT_SCHEMA_VERSION) {
      return failure(
        'Unsupported schema version',
        [{ path: 'schemaVersion', message: `Expected version ${CURRENT_SCHEMA_VERSION}; received ${String(version)}` }],
        `Supported schema versions: ${CURRENT_SCHEMA_VERSION}`,
      )
    }
  }

  const result = tripPlanSchema.safeParse(parsed)
  return result.success ? { success: true, plan: result.data } : zodFailure(result.error)
}

export async function readPlanImport(file: ImportFileLike): Promise<ImportResult> {
  const fileFailure = validateImportFile(file)
  if (fileFailure) return fileFailure
  try { return parsePlanJson(await file.text()) }
  catch {
    return failure('The plan file could not be read', [{ path: 'file', message: 'Browser file reading failed' }], 'File.text() rejected')
  }
}

export function summarizePlan(plan: TripPlan) {
  return {
    title: plan.metadata.title,
    startDate: plan.metadata.startDate,
    endDate: plan.metadata.endDate,
    routeStops: plan.routeStops.length,
    days: plan.days.length,
    activities: plan.activities.length,
    foodEntries: plan.foodEntries.length,
    schemaVersion: plan.schemaVersion,
  }
}
