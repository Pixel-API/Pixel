import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const viewPath = resolve(__dirname, '../PoolHealthMonitorView.vue')

describe('PoolHealthMonitorView account-list dependency', () => {
  const runIfViewExists = existsSync(viewPath) ? it : it.skip

  runIfViewExists('does not fetch the full account list for the health snapshot', () => {
    const source = readFileSync(viewPath, 'utf8')

    expect(source).not.toContain('adminAPI.accounts.list')
    expect(source).not.toContain('fetchAllOpenAIAccounts')
    expect(source).not.toContain('PAGE_SIZE = 500')
    expect(source).not.toContain('/admin/accounts?page_size=500')
  })
})
