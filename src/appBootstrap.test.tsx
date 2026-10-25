import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LOCAL_DRAFT_STORAGE_KEY } from './constants/schema'

// This file is intentionally the only consumer of `App`/`tripStore` it contains,
// so the module registry's one-time store construction genuinely observes an
// empty browser the first time it runs, exercising the real bootstrap path
// end-to-end rather than through an injected test store.
describe('app bootstrap with a genuinely empty browser', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('loads the bundled Rajasthan Circuit default plan on a true first render, with no existing local draft', async () => {
    const { default: App } = await import('./App')
    render(<App />)

    expect(await screen.findByRole('heading', { name: /Rajasthan Circuit/ })).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY) ?? 'null')?.metadata?.id).toBe(
      'trip-rajasthan-circuit-dec2026',
    )
  })
})
