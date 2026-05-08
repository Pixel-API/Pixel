import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  apiClient: {
    get,
  },
}))

import { health } from '@/api/admin/pools'

describe('admin pool health api', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('normalizes backend snake_case snapshot fields for the admin view', async () => {
    get.mockResolvedValue({
      data: {
        enabled: true,
        timestamp: '2026-05-08T06:30:00Z',
        summary: {
          total_pools: 2,
          total_accounts: 12,
          active_accounts: 10,
          schedulable_accounts: 8,
          rate_limited_accounts: 2,
          problem_accounts: 4,
          codex_5h_average: 33.3,
          codex_7d_average: 55.5,
        },
        pools: [
          {
            id: 7,
            name: 'free',
            description: 'Free tier pool',
            status: 'active',
            total_accounts: 12,
            active_accounts: 10,
            schedulable_accounts: 8,
            rate_limited_accounts: 2,
            problem_accounts: 4,
            codex_5h_average: 33.3,
            codex_7d_average: 55.5,
            last_used_at: '2026-05-08T06:00:00Z',
            health: 'problem',
          },
          {
            id: 8,
            name: 'disabled',
            total_accounts: 1,
            health: 'disabled',
          },
        ],
      },
    })

    const result = await health()

    expect(get).toHaveBeenCalledWith('/admin/pools/health', { signal: undefined })
    expect(result.summary).toEqual({
      totalPools: 2,
      totalAccounts: 12,
      activeAccounts: 10,
      schedulableAccounts: 8,
      rateLimitedAccounts: 2,
      problemAccounts: 4,
      codex5hAverage: 33.3,
      codex7dAverage: 55.5,
      lastUpdatedAt: '2026-05-08T06:30:00Z',
    })
    expect(result.pools[0]).toEqual({
      id: 7,
      name: 'free',
      description: 'Free tier pool',
      status: 'active',
      totalAccounts: 12,
      activeAccounts: 10,
      schedulableAccounts: 8,
      rateLimitedAccounts: 2,
      problemAccounts: 4,
      codex5hAverage: 33.3,
      codex7dAverage: 55.5,
      lastUsedAt: '2026-05-08T06:00:00Z',
      health: 'critical',
    })
    expect(result.pools[1].health).toBe('empty')
  })
})
