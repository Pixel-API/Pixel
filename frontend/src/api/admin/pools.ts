import { apiClient } from '../client'

export type PoolHealthLevel = 'healthy' | 'warning' | 'critical' | 'empty'

type ApiPoolHealthLevel = 'healthy' | 'warning' | 'problem' | 'empty' | 'disabled'

interface ApiPoolHealthSummary {
  total_pools?: number
  total_accounts?: number
  active_accounts?: number
  schedulable_accounts?: number
  rate_limited_accounts?: number
  problem_accounts?: number
  codex_5h_average?: number | null
  codex_7d_average?: number | null
  last_updated_at?: string | null
}

interface ApiPoolHealthPool {
  id: number | string
  name?: string
  description?: string | null
  status?: string | null
  total_accounts?: number
  active_accounts?: number
  schedulable_accounts?: number
  rate_limited_accounts?: number
  problem_accounts?: number
  codex_5h_average?: number | null
  codex_7d_average?: number | null
  last_used_at?: string | null
  health?: ApiPoolHealthLevel | string
}

interface ApiPoolHealthSnapshot {
  enabled?: boolean
  timestamp?: string
  summary?: ApiPoolHealthSummary
  pools?: ApiPoolHealthPool[]
}

export interface PoolHealthSummary {
  totalPools: number
  totalAccounts: number
  activeAccounts: number
  schedulableAccounts: number
  rateLimitedAccounts: number
  problemAccounts: number
  codex5hAverage: number | null
  codex7dAverage: number | null
  lastUpdatedAt?: string | null
}

export interface PoolHealthPool {
  id: number | string
  name: string
  description?: string | null
  status?: string | null
  totalAccounts: number
  activeAccounts: number
  schedulableAccounts: number
  rateLimitedAccounts: number
  problemAccounts: number
  codex5hAverage: number | null
  codex7dAverage: number | null
  lastUsedAt?: string | null
  health: PoolHealthLevel
}

export interface PoolHealthSnapshot {
  enabled: boolean
  timestamp: string
  summary: PoolHealthSummary
  pools: PoolHealthPool[]
}

export async function health(options?: { signal?: AbortSignal }): Promise<PoolHealthSnapshot> {
  const { data } = await apiClient.get<ApiPoolHealthSnapshot>('/admin/pools/health', {
    signal: options?.signal,
  })
  return normalizePoolHealthSnapshot(data)
}

function normalizePoolHealthSnapshot(snapshot: ApiPoolHealthSnapshot): PoolHealthSnapshot {
  const summary = snapshot.summary ?? {}
  return {
    enabled: snapshot.enabled ?? true,
    timestamp: snapshot.timestamp ?? '',
    summary: {
      totalPools: summary.total_pools ?? 0,
      totalAccounts: summary.total_accounts ?? 0,
      activeAccounts: summary.active_accounts ?? 0,
      schedulableAccounts: summary.schedulable_accounts ?? 0,
      rateLimitedAccounts: summary.rate_limited_accounts ?? 0,
      problemAccounts: summary.problem_accounts ?? 0,
      codex5hAverage: summary.codex_5h_average ?? null,
      codex7dAverage: summary.codex_7d_average ?? null,
      lastUpdatedAt: summary.last_updated_at ?? snapshot.timestamp ?? null,
    },
    pools: (snapshot.pools ?? []).map(normalizePoolHealthPool),
  }
}

function normalizePoolHealthPool(pool: ApiPoolHealthPool): PoolHealthPool {
  return {
    id: pool.id,
    name: pool.name ?? '',
    description: pool.description ?? null,
    status: pool.status ?? null,
    totalAccounts: pool.total_accounts ?? 0,
    activeAccounts: pool.active_accounts ?? 0,
    schedulableAccounts: pool.schedulable_accounts ?? 0,
    rateLimitedAccounts: pool.rate_limited_accounts ?? 0,
    problemAccounts: pool.problem_accounts ?? 0,
    codex5hAverage: pool.codex_5h_average ?? null,
    codex7dAverage: pool.codex_7d_average ?? null,
    lastUsedAt: pool.last_used_at ?? null,
    health: normalizePoolHealthLevel(pool.health),
  }
}

function normalizePoolHealthLevel(health: ApiPoolHealthPool['health']): PoolHealthLevel {
  if (health === 'healthy' || health === 'warning' || health === 'empty') return health
  if (health === 'problem') return 'critical'
  return 'empty'
}

export default {
  health,
}
