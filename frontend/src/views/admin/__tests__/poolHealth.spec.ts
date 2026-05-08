import { describe, expect, it } from 'vitest'
import type { Account, AdminGroup } from '@/types'
import { buildPoolHealthDashboard } from '../poolHealth'

const baseGroup = (overrides: Partial<AdminGroup>): AdminGroup => ({
  id: 1,
  name: 'free',
  description: null,
  platform: 'openai',
  rate_multiplier: 1,
  is_exclusive: false,
  status: 'active',
  scope: 'public',
  subscription_type: 'standard',
  daily_limit_usd: null,
  weekly_limit_usd: null,
  monthly_limit_usd: null,
  image_price_1k: null,
  image_price_2k: null,
  image_price_4k: null,
  claude_code_only: false,
  fallback_group_id: null,
  fallback_group_id_on_invalid_request: null,
  allow_messages_dispatch: true,
  require_oauth_only: false,
  require_privacy_set: false,
  created_at: '2026-05-08T00:00:00Z',
  updated_at: '2026-05-08T00:00:00Z',
  model_routing: null,
  model_routing_enabled: false,
  mcp_xml_inject: false,
  sort_order: 0,
  ...overrides,
})

const baseAccount = (overrides: Partial<Account>): Account => ({
  id: 1,
  name: 'codex-1',
  platform: 'openai',
  type: 'oauth',
  proxy_id: null,
  concurrency: 1,
  priority: 0,
  status: 'active',
  error_message: null,
  last_used_at: null,
  expires_at: null,
  auto_pause_on_expired: false,
  created_at: '2026-05-08T00:00:00Z',
  updated_at: '2026-05-08T00:00:00Z',
  schedulable: true,
  rate_limited_at: null,
  rate_limit_reset_at: null,
  overload_until: null,
  temp_unschedulable_until: null,
  temp_unschedulable_reason: null,
  session_window_start: null,
  session_window_end: null,
  session_window_status: null,
  group_ids: [],
  groups: [],
  ...overrides,
})

describe('buildPoolHealthDashboard', () => {
  it('aggregates openai accounts by pool and includes ungrouped accounts', () => {
    const free = baseGroup({ id: 7, name: 'free' })
    const pro = baseGroup({ id: 8, name: 'pro' })
    const accounts = [
      baseAccount({
        id: 1,
        name: 'healthy',
        group_ids: [7],
        groups: [{ ...free }],
        last_used_at: '2026-05-08T03:00:00Z',
        extra: {
          codex_5h_used_percent: 20,
          codex_7d_used_percent: 40,
        },
      }),
      baseAccount({
        id: 2,
        name: 'limited',
        group_ids: [7, 8],
        groups: [{ ...free }, { ...pro }],
        schedulable: false,
        rate_limited_at: '2026-05-08T02:00:00Z',
        rate_limit_reset_at: '2026-05-08T04:00:00Z',
        extra: {
          codex_5h_used_percent: 90,
          codex_7d_used_percent: 80,
        },
      }),
      baseAccount({
        id: 3,
        name: 'ungrouped',
        group_ids: [],
        groups: [],
        status: 'inactive',
      }),
      baseAccount({
        id: 4,
        name: 'anthropic-ignored',
        platform: 'anthropic',
        group_ids: [7],
      }),
    ]

    const dashboard = buildPoolHealthDashboard([free, pro], accounts, new Date('2026-05-08T03:30:00Z'))

    expect(dashboard.summary.totalPools).toBe(3)
    expect(dashboard.summary.totalAccounts).toBe(3)
    expect(dashboard.summary.schedulableAccounts).toBe(1)
    expect(dashboard.summary.problemAccounts).toBe(2)

    const freePool = dashboard.pools.find((pool) => pool.id === 7)
    expect(freePool).toMatchObject({
      name: 'free',
      totalAccounts: 2,
      schedulableAccounts: 1,
      rateLimitedAccounts: 1,
      problemAccounts: 1,
      codex5hAverage: 55,
      codex7dAverage: 60,
      health: 'warning',
    })

    const proPool = dashboard.pools.find((pool) => pool.id === 8)
    expect(proPool).toMatchObject({
      name: 'pro',
      totalAccounts: 1,
      schedulableAccounts: 0,
      rateLimitedAccounts: 1,
      health: 'critical',
    })

    const ungroupedPool = dashboard.pools.find((pool) => pool.id === 'ungrouped')
    expect(ungroupedPool).toMatchObject({
      name: 'Ungrouped accounts',
      totalAccounts: 1,
      activeAccounts: 0,
      problemAccounts: 1,
      health: 'critical',
    })
  })

  it('marks pools without accounts as empty and sorts healthy pools before empty pools', () => {
    const free = baseGroup({ id: 7, name: 'free' })
    const empty = baseGroup({ id: 9, name: 'empty' })
    const dashboard = buildPoolHealthDashboard(
      [empty, free],
      [
        baseAccount({
          id: 1,
          name: 'healthy',
          group_ids: [7],
          status: 'active',
          schedulable: true,
        }),
      ],
      new Date('2026-05-08T03:30:00Z'),
    )

    expect(dashboard.pools.map((pool) => pool.name)).toEqual(['free', 'empty'])
    expect(dashboard.pools[0].health).toBe('healthy')
    expect(dashboard.pools[1].health).toBe('empty')
  })
})
