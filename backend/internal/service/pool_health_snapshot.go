package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/pkg/pagination"
)

const (
	PoolHealthHealthy  = "healthy"
	PoolHealthWarning  = "warning"
	PoolHealthProblem  = "problem"
	PoolHealthEmpty    = "empty"
	PoolHealthDisabled = "disabled"
)

type PoolHealthSnapshotSource interface {
	ListPoolHealthGroups(ctx context.Context) ([]Group, error)
	ListPoolHealthAccounts(ctx context.Context) ([]Account, error)
}

type PoolHealthSnapshot struct {
	Enabled   bool                      `json:"enabled"`
	Timestamp time.Time                 `json:"timestamp"`
	Summary   PoolHealthSnapshotSummary `json:"summary"`
	Pools     []PoolHealthSnapshotPool  `json:"pools"`
}

type PoolHealthSnapshotSummary struct {
	TotalPools          int      `json:"total_pools"`
	TotalAccounts       int      `json:"total_accounts"`
	ActiveAccounts      int      `json:"active_accounts"`
	SchedulableAccounts int      `json:"schedulable_accounts"`
	RateLimitedAccounts int      `json:"rate_limited_accounts"`
	ProblemAccounts     int      `json:"problem_accounts"`
	Codex5hAverage      *float64 `json:"codex_5h_average"`
	Codex7dAverage      *float64 `json:"codex_7d_average"`
}

type PoolHealthSnapshotPool struct {
	ID                  int64      `json:"id"`
	Name                string     `json:"name"`
	Description         string     `json:"description"`
	Status              string     `json:"status"`
	TotalAccounts       int        `json:"total_accounts"`
	ActiveAccounts      int        `json:"active_accounts"`
	SchedulableAccounts int        `json:"schedulable_accounts"`
	RateLimitedAccounts int        `json:"rate_limited_accounts"`
	ProblemAccounts     int        `json:"problem_accounts"`
	Codex5hAverage      *float64   `json:"codex_5h_average"`
	Codex7dAverage      *float64   `json:"codex_7d_average"`
	LastUsedAt          *time.Time `json:"last_used_at"`
	Health              string     `json:"health"`
}

type poolHealthSnapshotCache struct {
	mu        sync.Mutex
	expiresAt time.Time
	value     *PoolHealthSnapshot
}

type adminPoolHealthSnapshotSource struct {
	groupRepo   GroupRepository
	accountRepo AccountRepository
}

func newAdminPoolHealthSnapshotSource(groupRepo GroupRepository, accountRepo AccountRepository) PoolHealthSnapshotSource {
	return adminPoolHealthSnapshotSource{groupRepo: groupRepo, accountRepo: accountRepo}
}

func (s adminPoolHealthSnapshotSource) ListPoolHealthGroups(ctx context.Context) ([]Group, error) {
	repo, ok := s.groupRepo.(interface {
		ListPoolHealthGroups(context.Context) ([]Group, error)
	})
	if ok {
		return repo.ListPoolHealthGroups(ctx)
	}
	return s.groupRepo.ListActive(ctx)
}

func (s adminPoolHealthSnapshotSource) ListPoolHealthAccounts(ctx context.Context) ([]Account, error) {
	repo, ok := s.accountRepo.(interface {
		ListPoolHealthAccounts(context.Context) ([]Account, error)
	})
	if ok {
		return repo.ListPoolHealthAccounts(ctx)
	}
	accounts, _, err := s.accountRepo.List(ctx, pagination.PaginationParams{Page: 1, PageSize: 100000, SortBy: "id", SortOrder: "asc"})
	return accounts, err
}

func (s *adminServiceImpl) GetPoolHealthSnapshot(ctx context.Context) (*PoolHealthSnapshot, error) {
	nowFunc := time.Now
	if s.poolHealthSnapshotNow != nil {
		nowFunc = s.poolHealthSnapshotNow
	}
	ttl := s.poolHealthSnapshotTTL
	if ttl <= 0 {
		ttl = time.Minute
	}

	now := nowFunc()
	s.poolHealthSnapshotCache.mu.Lock()
	defer s.poolHealthSnapshotCache.mu.Unlock()
	if s.poolHealthSnapshotCache.value != nil && now.Before(s.poolHealthSnapshotCache.expiresAt) {
		return clonePoolHealthSnapshot(s.poolHealthSnapshotCache.value), nil
	}

	source := s.poolHealthSnapshotSource
	if source == nil {
		source = newAdminPoolHealthSnapshotSource(s.groupRepo, s.accountRepo)
	}
	groups, err := source.ListPoolHealthGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("list pool health groups: %w", err)
	}
	accounts, err := source.ListPoolHealthAccounts(ctx)
	if err != nil {
		return nil, fmt.Errorf("list pool health accounts: %w", err)
	}

	snapshot := buildPoolHealthSnapshot(now, groups, accounts)
	s.poolHealthSnapshotCache.value = clonePoolHealthSnapshot(snapshot)
	s.poolHealthSnapshotCache.expiresAt = now.Add(ttl)
	return snapshot, nil
}

func buildPoolHealthSnapshot(now time.Time, groups []Group, accounts []Account) *PoolHealthSnapshot {
	pools := make([]PoolHealthSnapshotPool, 0, len(groups))
	poolIndexByID := make(map[int64]int, len(groups))
	pool5h := make(map[int64]*averageAccumulator, len(groups))
	pool7d := make(map[int64]*averageAccumulator, len(groups))
	for _, group := range groups {
		poolIndexByID[group.ID] = len(pools)
		pools = append(pools, PoolHealthSnapshotPool{
			ID:          group.ID,
			Name:        group.Name,
			Description: group.Description,
			Status:      group.Status,
			Health:      PoolHealthEmpty,
		})
		pool5h[group.ID] = &averageAccumulator{}
		pool7d[group.ID] = &averageAccumulator{}
	}

	summary := PoolHealthSnapshotSummary{TotalPools: len(pools)}
	summary5h := averageAccumulator{}
	summary7d := averageAccumulator{}
	for i := range accounts {
		account := &accounts[i]
		if account.Platform != "" && account.Platform != PlatformOpenAI {
			continue
		}
		summary.TotalAccounts++
		active := account.IsActive()
		schedulable := account.IsSchedulable()
		rateLimited := account.IsRateLimited()
		problem := isPoolHealthProblemAccount(account)

		if active {
			summary.ActiveAccounts++
		}
		if schedulable {
			summary.SchedulableAccounts++
		}
		if rateLimited {
			summary.RateLimitedAccounts++
		}
		if problem {
			summary.ProblemAccounts++
		}
		fiveHour, has5h := poolHealthExtraFloat(account.Extra, "codex_5h_used_percent")
		sevenDay, has7d := poolHealthExtraFloat(account.Extra, "codex_7d_used_percent")
		if has5h {
			summary5h.Add(fiveHour)
		}
		if has7d {
			summary7d.Add(sevenDay)
		}

		for _, groupID := range account.GroupIDs {
			poolIdx, ok := poolIndexByID[groupID]
			if !ok {
				continue
			}
			pool := &pools[poolIdx]
			pool.TotalAccounts++
			if active {
				pool.ActiveAccounts++
			}
			if schedulable {
				pool.SchedulableAccounts++
			}
			if rateLimited {
				pool.RateLimitedAccounts++
			}
			if problem {
				pool.ProblemAccounts++
			}
			if account.LastUsedAt != nil && (pool.LastUsedAt == nil || account.LastUsedAt.After(*pool.LastUsedAt)) {
				lastUsed := *account.LastUsedAt
				pool.LastUsedAt = &lastUsed
			}
			if has5h {
				pool5h[groupID].Add(fiveHour)
			}
			if has7d {
				pool7d[groupID].Add(sevenDay)
			}
		}
	}

	for i := range pools {
		pools[i].Codex5hAverage = pool5h[pools[i].ID].Average()
		pools[i].Codex7dAverage = pool7d[pools[i].ID].Average()
		pools[i].Health = resolvePoolHealth(pools[i])
	}
	summary.Codex5hAverage = summary5h.Average()
	summary.Codex7dAverage = summary7d.Average()
	return &PoolHealthSnapshot{
		Enabled:   true,
		Timestamp: now,
		Summary:   summary,
		Pools:     pools,
	}
}

type averageAccumulator struct {
	sum   float64
	count int
}

func (a *averageAccumulator) Add(value float64) {
	a.sum += value
	a.count++
}

func (a averageAccumulator) Average() *float64 {
	if a.count == 0 {
		return nil
	}
	value := a.sum / float64(a.count)
	return &value
}

func isPoolHealthProblemAccount(account *Account) bool {
	if account == nil {
		return false
	}
	if account.Status == StatusError {
		return true
	}
	return account.IsActive() && !account.IsSchedulable()
}

func resolvePoolHealth(pool PoolHealthSnapshotPool) string {
	if pool.Status != StatusActive {
		return PoolHealthDisabled
	}
	if pool.TotalAccounts == 0 {
		return PoolHealthEmpty
	}
	if pool.ProblemAccounts > 0 {
		return PoolHealthProblem
	}
	if pool.SchedulableAccounts == 0 || pool.RateLimitedAccounts > 0 {
		return PoolHealthWarning
	}
	return PoolHealthHealthy
}

func poolHealthExtraFloat(extra map[string]any, key string) (float64, bool) {
	if extra == nil {
		return 0, false
	}
	switch value := extra[key].(type) {
	case float64:
		return value, true
	case float32:
		return float64(value), true
	case int:
		return float64(value), true
	case int64:
		return float64(value), true
	case json.Number:
		parsed, err := value.Float64()
		return parsed, err == nil
	default:
		return 0, false
	}
}

func clonePoolHealthSnapshot(snapshot *PoolHealthSnapshot) *PoolHealthSnapshot {
	if snapshot == nil {
		return nil
	}
	clone := *snapshot
	clone.Summary.Codex5hAverage = cloneFloat64(snapshot.Summary.Codex5hAverage)
	clone.Summary.Codex7dAverage = cloneFloat64(snapshot.Summary.Codex7dAverage)
	clone.Pools = append([]PoolHealthSnapshotPool(nil), snapshot.Pools...)
	for i := range clone.Pools {
		clone.Pools[i].Codex5hAverage = cloneFloat64(snapshot.Pools[i].Codex5hAverage)
		clone.Pools[i].Codex7dAverage = cloneFloat64(snapshot.Pools[i].Codex7dAverage)
		if snapshot.Pools[i].LastUsedAt != nil {
			lastUsed := *snapshot.Pools[i].LastUsedAt
			clone.Pools[i].LastUsedAt = &lastUsed
		}
	}
	return &clone
}

func cloneFloat64(value *float64) *float64 {
	if value == nil {
		return nil
	}
	clone := *value
	return &clone
}
