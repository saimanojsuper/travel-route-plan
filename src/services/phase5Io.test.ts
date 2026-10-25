import { describe, expect, it, vi } from 'vitest'
import { CURRENT_SCHEMA_VERSION } from '../constants/schema'
import { tripPlanSchema } from '../schemas/tripSchema'
import { createValidPlan } from '../test/fixtures'
import {
  createExportArtifact,
  downloadTripPlan,
  sanitizeFilenamePart,
  type DownloadEnvironment,
} from './exportPlan'
import {
  MAX_IMPORT_BYTES,
  parsePlanJson,
  readPlanImport,
  validateImportFile,
  type ImportFileLike,
} from './importPlan'

function importFile(overrides: Partial<ImportFileLike> = {}): ImportFileLike {
  const json = JSON.stringify(createValidPlan())
  return {
    name: 'plan.json',
    size: new Blob([json]).size,
    type: 'application/json',
    text: async () => json,
    ...overrides,
  }
}

describe('Phase 5 JSON export', () => {
  it('exports the complete validated plan as pretty JSON with a safe dated filename', () => {
    const plan = createValidPlan()
    plan.metadata.title = '  Café / Delhi: 2026?!  '

    const artifact = createExportArtifact(plan, new Date('2026-10-25T23:59:59Z'))

    expect(artifact.filename).toBe('cafe-delhi-2026-2026-10-25.json')
    const validatedPlan = tripPlanSchema.parse(plan)
    expect(artifact.json).toBe(`${JSON.stringify(validatedPlan, null, 2)}\n`)
    expect(JSON.parse(artifact.json)).toEqual(validatedPlan)
    expect(artifact.json).toContain('\n  "metadata": {')
    expect(sanitizeFilenamePart('***')).toBe('trip-plan')
  })

  it('rejects no plan and invalid plans before initiating a download', () => {
    const environment: DownloadEnvironment = {
      createObjectUrl: vi.fn(() => 'blob:test'),
      revokeObjectUrl: vi.fn(),
      triggerDownload: vi.fn(),
    }

    expect(() => downloadTripPlan(null, new Date(), environment)).toThrow('Create or import a trip before exporting')
    expect(() => downloadTripPlan({ ...createValidPlan(), schemaVersion: 999 } as never, new Date(), environment)).toThrow()
    expect(environment.createObjectUrl).not.toHaveBeenCalled()
    expect(environment.triggerDownload).not.toHaveBeenCalled()
  })

  it('creates a JSON Blob, initiates download, and always cleans up the object URL', () => {
    let receivedBlob: Blob | undefined
    const environment: DownloadEnvironment = {
      createObjectUrl: vi.fn((blob) => {
        receivedBlob = blob
        return 'blob:phase-five'
      }),
      revokeObjectUrl: vi.fn(),
      triggerDownload: vi.fn(),
    }

    const artifact = downloadTripPlan(createValidPlan(), new Date('2026-01-02T00:00:00Z'), environment)

    expect(receivedBlob).toBeInstanceOf(Blob)
    expect(receivedBlob?.type).toBe('application/json;charset=utf-8')
    expect(receivedBlob?.size).toBe(new Blob([artifact.json]).size)
    expect(environment.triggerDownload).toHaveBeenCalledWith('blob:phase-five', 'golden-triangle-2026-01-02.json')
    expect(environment.revokeObjectUrl).toHaveBeenCalledWith('blob:phase-five')

    vi.mocked(environment.triggerDownload).mockImplementationOnce(() => { throw new Error('click blocked') })
    expect(() => downloadTripPlan(createValidPlan(), new Date(), environment)).toThrow('click blocked')
    expect(environment.revokeObjectUrl).toHaveBeenLastCalledWith('blob:phase-five')
    expect(environment.revokeObjectUrl).toHaveBeenCalledTimes(2)
  })
})

describe('Phase 5 JSON import validation', () => {
  it('guards extension, MIME type, empty files, and maximum size before reading', async () => {
    expect(validateImportFile(importFile({ name: 'plan.txt' }))?.summary).toBe('Choose a JSON plan file')
    expect(validateImportFile(importFile({ type: 'text/plain' }))?.issues[0]!.message).toContain('text/plain')
    expect(validateImportFile(importFile({ size: 0 }))?.summary).toBe('Plan file is empty')
    expect(validateImportFile(importFile({ size: MAX_IMPORT_BYTES + 1 }))?.summary).toBe('Plan file is too large')

    const text = vi.fn(async () => JSON.stringify(createValidPlan()))
    const result = await readPlanImport(importFile({ size: 0, text }))
    expect(result.success).toBe(false)
    expect(text).not.toHaveBeenCalled()
  })

  it('reports malformed JSON, unsupported schemas, and field-path Zod errors', () => {
    const malformed = parsePlanJson('{"schemaVersion":')
    expect(malformed).toMatchObject({ success: false, summary: 'The selected file is not valid JSON' })
    if (!malformed.success) expect(malformed.issues).toContainEqual({ path: '$', message: expect.any(String) })

    const unsupported = parsePlanJson(JSON.stringify({ ...createValidPlan(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 }))
    expect(unsupported).toMatchObject({ success: false, summary: 'Unsupported schema version' })
    if (!unsupported.success) expect(unsupported.issues[0]!.path).toBe('schemaVersion')

    const invalid = createValidPlan()
    invalid.metadata.title = ''
    const zodResult = parsePlanJson(JSON.stringify(invalid))
    expect(zodResult).toMatchObject({ success: false, summary: 'The plan does not match the supported format' })
    if (!zodResult.success) {
      expect(zodResult.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: 'metadata.title' }),
      ]))
      expect(zodResult.technicalDetails).toContain('metadata')
    }
  })

  it('returns a complete validated plan and turns file read rejection into a failure', async () => {
    await expect(readPlanImport(importFile())).resolves.toEqual({ success: true, plan: createValidPlan() })

    const unreadable = await readPlanImport(importFile({ text: async () => { throw new Error('denied') } }))
    expect(unreadable).toMatchObject({ success: false, summary: 'The plan file could not be read' })
  })
})
