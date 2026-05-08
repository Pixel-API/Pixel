import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import PoolHealthMonitorView from '../PoolHealthMonitorView.vue'

const { health, accountsList } = vi.hoisted(() => ({
  health: vi.fn(),
  accountsList: vi.fn(),
}))

vi.mock('@/api/admin', () => ({
  adminAPI: {
    pools: {
      health,
    },
    accounts: {
      list: accountsList,
    },
  },
}))

vi.mock('@/stores/app', () => ({
  useAppStore: () => ({
    showError: vi.fn(),
  }),
}))

vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual<typeof import('vue-i18n')>('vue-i18n')
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string, params?: Record<string, unknown>) => {
        if (!params) return key
        return Object.entries(params).reduce(
          (label, [name, value]) => label.replace(`{${name}}`, String(value)),
          key,
        )
      },
    }),
  }
})

const snapshot = {
  enabled: true,
  timestamp: '2026-05-08T06:30:00Z',
  summary: {
    totalPools: 1,
    totalAccounts: 12,
    activeAccounts: 10,
    schedulableAccounts: 8,
    rateLimitedAccounts: 2,
    problemAccounts: 4,
    codex5hAverage: 33.3,
    codex7dAverage: 55.5,
    lastUpdatedAt: '2026-05-08T06:30:00Z',
  },
  pools: [
    {
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
      health: 'warning',
    },
  ],
}

describe('PoolHealthMonitorView', () => {
  beforeEach(() => {
    health.mockReset()
    accountsList.mockReset()
    health.mockResolvedValue(snapshot)
  })

  it('loads the pool health snapshot without fetching the full account list', async () => {
    const wrapper = mount(PoolHealthMonitorView, {
      global: {
        stubs: {
          AppLayout: { template: '<div><slot /></div>' },
          RouterLink: { template: '<a><slot /></a>' },
          Icon: true,
          Select: true,
          EmptyState: true,
        },
      },
    })

    await flushPromises()

    expect(health).toHaveBeenCalledTimes(1)
    expect(accountsList).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('free')
    expect(wrapper.text()).toContain('12')
  })
})
