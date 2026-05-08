<template>
  <AppLayout>
    <div class="space-y-5">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {{ t('admin.poolHealth.kicker') }}
          </p>
          <h1 class="mt-1 text-2xl font-semibold text-gray-950 dark:text-white">
            {{ t('admin.poolHealth.title') }}
          </h1>
          <p class="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            {{ t('admin.poolHealth.description') }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('admin.poolHealth.lastUpdated') }}: {{ lastUpdatedLabel }}
          </span>
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="loading"
            :title="t('admin.poolHealth.refresh')"
            @click="reload"
          >
            <Icon name="refresh" size="md" :class="loading ? 'animate-spin' : ''" />
            <span class="ml-2">{{ t('admin.poolHealth.refresh') }}</span>
          </button>
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="item in summaryCards"
          :key="item.key"
          class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-dark-700 dark:bg-dark-900"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
                {{ item.label }}
              </p>
              <p class="mt-2 text-2xl font-semibold text-gray-950 dark:text-white">
                {{ item.value }}
              </p>
            </div>
            <span class="rounded-md p-2" :class="item.iconClass">
              <Icon :name="item.icon" size="md" />
            </span>
          </div>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {{ item.hint }}
          </p>
        </div>
      </div>

      <div
        class="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-dark-700 dark:bg-dark-900 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="flex flex-1 flex-wrap items-center gap-3">
          <div class="relative w-full sm:w-72">
            <Icon
              name="search"
              size="md"
              class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            />
            <input
              v-model="searchQuery"
              type="text"
              class="input pl-10"
              :placeholder="t('admin.poolHealth.searchPlaceholder')"
            />
          </div>
          <Select
            v-model="healthFilter"
            class="w-full sm:w-44"
            :options="healthOptions"
            :placeholder="t('admin.poolHealth.allHealth')"
          />
        </div>

        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Icon name="infoCircle" size="sm" />
          <span>{{ t('admin.poolHealth.snapshotHint') }}</span>
        </div>
      </div>

      <div v-if="loading" class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="item in 6"
          :key="item"
          class="h-44 animate-pulse rounded-lg border border-gray-200 bg-white dark:border-dark-700 dark:bg-dark-900"
        />
      </div>

      <EmptyState
        v-else-if="filteredPools.length === 0"
        :title="t('admin.poolHealth.emptyTitle')"
        :description="t('admin.poolHealth.emptyDescription')"
      />

      <div v-else class="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="pool in filteredPools"
          :key="String(pool.id)"
          type="button"
          class="rounded-lg border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-dark-900"
          :class="poolCardClass(pool)"
          @click="selectedPoolId = pool.id"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex min-w-0 items-center gap-2">
                <h2 class="truncate text-base font-semibold text-gray-950 dark:text-white">
                  {{ pool.name }}
                </h2>
                <span class="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium" :class="healthBadgeClass(pool.health)">
                  {{ healthLabel(pool.health) }}
                </span>
              </div>
              <p class="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                {{ pool.description || t('admin.poolHealth.noPoolDescription') }}
              </p>
            </div>
            <Icon name="chevronRight" size="sm" class="mt-1 shrink-0 text-gray-400" />
          </div>

          <div class="mt-4 grid grid-cols-4 gap-2">
            <MetricPill :label="t('admin.poolHealth.metrics.total')" :value="pool.totalAccounts" />
            <MetricPill :label="t('admin.poolHealth.metrics.active')" :value="pool.activeAccounts" />
            <MetricPill :label="t('admin.poolHealth.metrics.schedulable')" :value="pool.schedulableAccounts" />
            <MetricPill :label="t('admin.poolHealth.metrics.problem')" :value="pool.problemAccounts" tone="danger" />
          </div>

          <div class="mt-4 space-y-3">
            <UsageBar :label="t('admin.poolHealth.codex5h')" :value="pool.codex5hAverage" />
            <UsageBar :label="t('admin.poolHealth.codex7d')" :value="pool.codex7dAverage" />
          </div>

          <div class="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{{ t('admin.poolHealth.rateLimitedCount', { count: pool.rateLimitedAccounts }) }}</span>
            <span>{{ formatLastUsed(pool.lastUsedAt ?? null) }}</span>
          </div>
        </button>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-dark-700 dark:bg-dark-900">
        <div class="flex flex-col gap-2 border-b border-gray-200 p-4 dark:border-dark-700 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-950 dark:text-white">
              {{ selectedPool ? selectedPool.name : t('admin.poolHealth.accountDetails') }}
            </h2>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ selectedPool ? selectedPoolSubtitle : t('admin.poolHealth.selectPoolHint') }}
            </p>
          </div>
          <RouterLink to="/admin/accounts" class="btn btn-secondary">
            <Icon name="globe" size="md" class="mr-2" />
            {{ t('admin.poolHealth.openAccounts') }}
          </RouterLink>
        </div>

        <EmptyState
          :title="t('admin.poolHealth.noAccountsTitle')"
          :description="t('admin.poolHealth.noAccountsDescription')"
        />
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { adminAPI } from '@/api/admin'
import type { PoolHealthLevel, PoolHealthPool, PoolHealthSnapshot } from '@/api/admin'
import AppLayout from '@/components/layout/AppLayout.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Select from '@/components/common/Select.vue'
import Icon from '@/components/icons/Icon.vue'
import { useAppStore } from '@/stores/app'
import { extractApiErrorMessage } from '@/utils/apiError'
import { formatDateTime, formatRelativeTime } from '@/utils/format'

const MetricPill = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: Number, required: true },
    tone: { type: String, default: 'default' },
  },
  setup(props) {
    return () => h('div', {
      class: [
        'rounded-md border px-2 py-2',
        props.tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
          : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-dark-700 dark:bg-dark-800 dark:text-gray-300',
      ],
    }, [
      h('p', { class: 'text-[11px] leading-4 text-gray-500 dark:text-gray-400' }, props.label),
      h('p', { class: 'mt-0.5 text-base font-semibold' }, String(props.value)),
    ])
  },
})

const UsageBar = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: Number as () => number | null, default: null },
  },
  setup(props) {
    const displayValue = computed(() => (typeof props.value === 'number' ? `${Math.round(props.value)}%` : '-'))
    const width = computed(() => `${Math.max(0, Math.min(100, props.value ?? 0))}%`)
    const colorClass = computed(() => {
      if (props.value === null) return 'bg-gray-300 dark:bg-dark-600'
      if (props.value >= 90) return 'bg-red-500'
      if (props.value >= 70) return 'bg-amber-500'
      return 'bg-emerald-500'
    })
    return () => h('div', [
      h('div', { class: 'mb-1 flex items-center justify-between text-xs' }, [
        h('span', { class: 'text-gray-500 dark:text-gray-400' }, props.label),
        h('span', { class: 'font-medium text-gray-800 dark:text-gray-200' }, displayValue.value),
      ]),
      h('div', { class: 'h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-dark-800' }, [
        h('div', { class: ['h-full rounded-full', colorClass.value], style: { width: width.value } }),
      ]),
    ])
  },
})

const { t } = useI18n()
const appStore = useAppStore()

const loading = ref(false)
const snapshot = ref<PoolHealthSnapshot | null>(null)
const selectedPoolId = ref<number | string | null>(null)
const searchQuery = ref('')
const healthFilter = ref<PoolHealthLevel | 'all'>('all')
let abortController: AbortController | null = null

const pools = computed(() => snapshot.value?.pools ?? [])
const summary = computed(() => snapshot.value?.summary ?? {
  totalPools: 0,
  totalAccounts: 0,
  activeAccounts: 0,
  schedulableAccounts: 0,
  rateLimitedAccounts: 0,
  problemAccounts: 0,
  codex5hAverage: null,
  codex7dAverage: null,
})

const filteredPools = computed(() => {
  const search = searchQuery.value.trim().toLowerCase()
  return pools.value.filter((pool) => {
    const matchesSearch = !search || pool.name.toLowerCase().includes(search) || (pool.description ?? '').toLowerCase().includes(search)
    const matchesHealth = healthFilter.value === 'all' || pool.health === healthFilter.value
    return matchesSearch && matchesHealth
  })
})

const selectedPool = computed(() => {
  if (selectedPoolId.value === null) return filteredPools.value[0] ?? null
  return pools.value.find((pool) => pool.id === selectedPoolId.value) ?? filteredPools.value[0] ?? null
})

const lastUpdatedLabel = computed(() => {
  const value = snapshot.value?.timestamp || snapshot.value?.summary.lastUpdatedAt
  return value ? formatDateTime(value) : '-'
})

const selectedPoolSubtitle = computed(() => {
  if (!selectedPool.value) return ''
  return t('admin.poolHealth.selectedPoolSubtitle', {
    total: selectedPool.value.totalAccounts,
    schedulable: selectedPool.value.schedulableAccounts,
    problem: selectedPool.value.problemAccounts,
  })
})

const healthOptions = computed(() => [
  { value: 'all', label: t('admin.poolHealth.allHealth') },
  { value: 'healthy', label: t('admin.poolHealth.health.healthy') },
  { value: 'warning', label: t('admin.poolHealth.health.warning') },
  { value: 'critical', label: t('admin.poolHealth.health.critical') },
  { value: 'empty', label: t('admin.poolHealth.health.empty') },
])

const summaryCards = computed<Array<{ key: string; label: string; value: string; hint: string; icon: 'database' | 'checkCircle' | 'exclamationTriangle' | 'chartBar'; iconClass: string }>>(() => [
  {
    key: 'pools',
    label: t('admin.poolHealth.summary.pools'),
    value: String(summary.value.totalPools),
    hint: t('admin.poolHealth.summary.poolsHint', { total: summary.value.totalAccounts }),
    icon: 'database',
    iconClass: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300',
  },
  {
    key: 'schedulable',
    label: t('admin.poolHealth.summary.schedulable'),
    value: String(summary.value.schedulableAccounts),
    hint: t('admin.poolHealth.summary.activeHint', { active: summary.value.activeAccounts }),
    icon: 'checkCircle',
    iconClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  {
    key: 'problem',
    label: t('admin.poolHealth.summary.problem'),
    value: String(summary.value.problemAccounts),
    hint: t('admin.poolHealth.summary.rateLimitedHint', { count: summary.value.rateLimitedAccounts }),
    icon: 'exclamationTriangle',
    iconClass: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
  },
  {
    key: 'usage',
    label: t('admin.poolHealth.summary.codexUsage'),
    value: `${formatPercent(summary.value.codex5hAverage)} / ${formatPercent(summary.value.codex7dAverage)}`,
    hint: t('admin.poolHealth.summary.codexUsageHint'),
    icon: 'chartBar',
    iconClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
  },
])

async function reload() {
  abortController?.abort()
  const ctrl = new AbortController()
  abortController = ctrl
  loading.value = true

  try {
    const nextSnapshot = await adminAPI.pools.health({ signal: ctrl.signal })
    if (ctrl.signal.aborted || abortController !== ctrl) return
    snapshot.value = nextSnapshot
  } catch (err: unknown) {
    const e = err as { name?: string; code?: string }
    if (e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') return
    appStore.showError(extractApiErrorMessage(err, t('admin.poolHealth.loadFailed')))
  } finally {
    if (abortController === ctrl) {
      abortController = null
      loading.value = false
    }
  }
}

function healthLabel(health: PoolHealthLevel): string {
  return t(`admin.poolHealth.health.${health}`)
}

function healthBadgeClass(health: PoolHealthLevel): string {
  if (health === 'healthy') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
  if (health === 'warning') return 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
  if (health === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
  return 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-300'
}

function poolCardClass(pool: PoolHealthPool): string {
  const selected = selectedPool.value?.id === pool.id
  if (selected) return 'border-primary-400 ring-2 ring-primary-500/20 dark:border-primary-500'
  if (pool.health === 'critical') return 'border-red-200 dark:border-red-900/60'
  if (pool.health === 'warning') return 'border-amber-200 dark:border-amber-900/60'
  return 'border-gray-200 dark:border-dark-700'
}

function formatPercent(value: number | null): string {
  if (value === null) return '-'
  return `${Math.round(value * 10) / 10}%`
}

function formatLastUsed(value: string | null): string {
  if (!value) return t('admin.poolHealth.neverUsed')
  return `${formatRelativeTime(value)} · ${formatDateTime(value)}`
}

watch(filteredPools, (next) => {
  if (next.length === 0) {
    selectedPoolId.value = null
    return
  }
  if (selectedPoolId.value === null || !next.some((pool) => pool.id === selectedPoolId.value)) {
    selectedPoolId.value = next[0].id
  }
})

onMounted(reload)
onUnmounted(() => abortController?.abort())
</script>
