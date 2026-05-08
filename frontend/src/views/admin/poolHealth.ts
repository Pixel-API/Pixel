import type { Account, AdminGroup } from '@/types'

export type PoolHealthLevel = 'healthy' | 'warning' | 'critical' | 'empty'

export interface PoolHealthAccount extends Account {
  isSchedulableNow: boolean
  isRateLimitedNow: boolean
  isProblem: boolean
  codex5hPercent: number | null
  codex7dPercent: number | null
}

export interface PoolHealthPool {
  id: number | 'ungrouped'
  name: string
  description: string | null
  status: AdminGroup['status'] | 'active'
  totalAccounts: number
  activeAccounts: number
  schedulableAccounts: number
  rateLimitedAccounts: number
  problemAccounts: number
  codex5hAverage: number | null
  codex7dAverage: number | null
  lastUsedAt: string | null
  health: PoolHealthLevel
  accounts: PoolHealthAccount[]
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
  lastUpdatedAt: string
}

export interface PoolHealthDashboard {
  summary: PoolHealthSummary
  pools: PoolHealthPool[]
}

const UNGROUPED_POOL_ID = 'ungrouped' as const
export const UNGROUPED_POOL_NAME = 'Ungrouped accounts'

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10
}

function isFutureTime(value: string | null | undefined, now: Date): boolean {
  if (!value) return false
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) && timestamp > now.getTime()
}

function isRateLimited(account: Account, now: Date): boolean {
  return Boolean(
    account.rate_limited_at ||
      isFutureTime(account.rate_limit_reset_at, now) ||
      isFutureTime(account.temp_unschedulable_until, now) ||
      isFutureTime(account.overload_until, now),
  )
}

function toPoolAccount(account: Account, now: Date): PoolHealthAccount {
  const isRateLimitedNow = isRateLimited(account, now)
  const isSchedulableNow = account.status === 'active' && account.schedulable && !isRateLimitedNow
  const isProblem = account.status !== 'active' || !account.schedulable || isRateLimitedNow

  return {
    ...account,
    isSchedulableNow,
    isRateLimitedNow,
    isProblem,
    codex5hPercent: asNumber(account.extra?.codex_5h_used_percent),
    codex7dPercent: asNumber(account.extra?.codex_7d_used_percent),
  }
}

function getAccountGroupIds(account: Account): number[] {
  if (Array.isArray(account.group_ids) && account.group_ids.length > 0) return account.group_ids
  if (Array.isArray(account.groups) && account.groups.length > 0) return account.groups.map((group) => group.id)
  return []
}

function latestDate(left: string | null, right: string | null): string | null {
  if (!left) return right
  if (!right) return left
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right
}

function resolveHealth(total: number, problem: number, schedulable: number): PoolHealthLevel {
  if (total === 0) return 'empty'
  if (schedulable === 0) return 'critical'
  if (problem > 0) return 'warning'
  return 'healthy'
}

function buildPool(group: AdminGroup, accounts: PoolHealthAccount[]): PoolHealthPool {
  const activeAccounts = accounts.filter((account) => account.status === 'active').length
  const schedulableAccounts = accounts.filter((account) => account.isSchedulableNow).length
  const rateLimitedAccounts = accounts.filter((account) => account.isRateLimitedNow).length
  const problemAccounts = accounts.filter((account) => account.isProblem).length

  return {
    id: group.id,
    name: group.name,
    description: group.description,
    status: group.status,
    totalAccounts: accounts.length,
    activeAccounts,
    schedulableAccounts,
    rateLimitedAccounts,
    problemAccounts,
    codex5hAverage: average(accounts.map((account) => account.codex5hPercent)),
    codex7dAverage: average(accounts.map((account) => account.codex7dPercent)),
    lastUsedAt: accounts.reduce<string | null>((latest, account) => latestDate(latest, account.last_used_at), null),
    health: resolveHealth(accounts.length, problemAccounts, schedulableAccounts),
    accounts: accounts.sort((left, right) => {
      if (left.isProblem !== right.isProblem) return left.isProblem ? -1 : 1
      return left.name.localeCompare(right.name)
    }),
  }
}

function buildUngroupedPool(accounts: PoolHealthAccount[]): PoolHealthPool {
  return buildPool(
    {
      id: -1,
      name: UNGROUPED_POOL_NAME,
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
      require_oauth_only: false,
      require_privacy_set: false,
      created_at: '',
      updated_at: '',
      model_routing: null,
      model_routing_enabled: false,
      mcp_xml_inject: false,
      sort_order: Number.MAX_SAFE_INTEGER,
    },
    accounts,
  )
}

function sortPools(left: PoolHealthPool, right: PoolHealthPool): number {
  if (left.health === 'empty' && right.health !== 'empty') return 1
  if (left.health !== 'empty' && right.health === 'empty') return -1
  if (left.problemAccounts !== right.problemAccounts) return right.problemAccounts - left.problemAccounts
  if (left.totalAccounts !== right.totalAccounts) return right.totalAccounts - left.totalAccounts
  return left.name.localeCompare(right.name)
}

export function buildPoolHealthDashboard(groups: AdminGroup[], accounts: Account[], now = new Date()): PoolHealthDashboard {
  const openAIGroups = groups.filter((group) => group.platform === 'openai')
  const openAIAccounts = accounts
    .filter((account) => account.platform === 'openai')
    .map((account) => toPoolAccount(account, now))

  const accountsByGroup = new Map<number, PoolHealthAccount[]>()
  const ungroupedAccounts: PoolHealthAccount[] = []

  for (const account of openAIAccounts) {
    const groupIds = getAccountGroupIds(account)
    if (groupIds.length === 0) {
      ungroupedAccounts.push(account)
      continue
    }

    for (const groupId of groupIds) {
      const groupAccounts = accountsByGroup.get(groupId) ?? []
      groupAccounts.push(account)
      accountsByGroup.set(groupId, groupAccounts)
    }
  }

  const pools = openAIGroups.map((group) => buildPool(group, accountsByGroup.get(group.id) ?? []))
  if (ungroupedAccounts.length > 0) {
    pools.push({
      ...buildUngroupedPool(ungroupedAccounts),
      id: UNGROUPED_POOL_ID,
    })
  }

  const uniqueAccounts = openAIAccounts
  const summary: PoolHealthSummary = {
    totalPools: pools.length,
    totalAccounts: uniqueAccounts.length,
    activeAccounts: uniqueAccounts.filter((account) => account.status === 'active').length,
    schedulableAccounts: uniqueAccounts.filter((account) => account.isSchedulableNow).length,
    rateLimitedAccounts: uniqueAccounts.filter((account) => account.isRateLimitedNow).length,
    problemAccounts: uniqueAccounts.filter((account) => account.isProblem).length,
    codex5hAverage: average(uniqueAccounts.map((account) => account.codex5hPercent)),
    codex7dAverage: average(uniqueAccounts.map((account) => account.codex7dPercent)),
    lastUpdatedAt: now.toISOString(),
  }

  return {
    summary,
    pools: pools.sort(sortPools),
  }
}
